# AUDIT: `vnbroker` ↔ `vninvest` — Tương thích, nâng cấp, yêu cầu

**Ngày:** 2026-10-11 · **Người audit:** TechLead (độc lập, không sửa code)
**Phạm vi:** `C:\Mujoco Projects\vnbroker` (thư viện) ↔ `C:\Mujoco Projects\vninvest` (sản phẩm)
**Yêu cầu:** tìm bug, đánh giá tương thích, xác định nhu cầu nâng cấp — **báo cáo trước, code sau**

> **Trạng thái:** BÁO CÁO. Chưa sửa dòng code nào ở cả 2 repo.

---

## 0. Tóm tắt điều hành (đọc 5 dòng này trước)

1. **vninvest đang chạy `vnbroker` 3.4.0, thư viện đã ở 3.7.0** — chênh **3 phiên bản nhỏ**, ghim bằng SHA git trong `requirements.txt:30`. Chưa có version guard nào.
2. **Nâng 3.4.0 → 3.7.0 KHÔNG phá API nào vninvest đang gọi.** Đã kiểm chứng 19 symbol / ~22 method bằng AST diff. Đây là tin tốt.
3. **Nhưng có 1 bug BLOCKER trong 3.7.0 mà vninvest *đang chạm gián tiếp***: `quote.history(symbol=X)` trả dữ liệu của symbol **khác**. Rủi ro nếu sau này ai đó gọi kiểu đó.
4. **Nghiêm trọng hơn nâng cấp: vninvest có bug sẵn — timestamp tick lệch 7 giờ.** Đây không phải do nâng version; nó đang chạy production ngay bây giờ.
5. **Không nên nâng "mù".** Đề xuất: **fix 3 bug của vninvest trước** → **thêm hàng rào hợp đồng** → **rồi mới bump SHA**.

---

## 1. Trạng thái thực tế (đo được, không suy đoán)

### 1.1 Ba cây `vnbroker` tồn tại trên máy

| Đường dẫn | Version | Vai trò |
|---|---|---|
| `C:\Mujoco Projects\vnbroker` | **3.7.0** (`pyproject.toml:7`, tag `v3.7.0`, HEAD `662e2ef`) | Repo nguồn phát triển |
| `C:\Mujoco Projects\vninvest\.venv\Lib\site-packages\vnbroker` | **3.4.0** | **Cái vninvest thực sự chạy** |
| `C:\Mujoco Projects\vninvest-sdk\vnbroker` | bản fork cũ hơn (có `vndirect`, `msn`, `fmp`, `gateway_client.py`) | SDK riêng, **không phải** cái vninvest dùng |

Đo thật:
```
$ .venv\Scripts\python.exe -c "import vnbroker, importlib.metadata as m; ..."
FILE: ...\vninvest\.venv\Lib\site-packages\vnbroker\__init__.py
VER: 3.4.0
```

### 1.2 Hai vấn đề môi trường (không phải bug thư viện)

**VẤN ĐỀ 1 — Python hệ thống không import được `vnbroker`**
```
$ pip show vnbroker
Version: 1.0.2
Editable project location: C:\Mujoco Projects\vnbrokder   ← thư mục KHÔNG TỒN TẠI
$ Test-Path "C:\Mujoco Projects\vnbrokder"   →  False
$ python -c "import vnbroker"               →  ModuleNotFoundError
```
⇒ Metadata pip **rỗng / hỏng**. Ai chạy test ngoài `.venv` của vninvest sẽ tưởng thiếu thư viện. Cần `pip uninstall vnbroker` ở Python hệ thống.

**VẤN ĐỀ 2 — bản 3.4.0 rò rỉ file ngoài package vào `site-packages`**
```
$ ...\vnbroker-3.4.0.dist-info\top_level.txt
artifacts
docs
scripts        ← KHÔNG tồn tại ở 3.7.0
tests          ← KHÔNG tồn tại ở 3.7.0
vnbroker
```
Đã sửa ở 3.5.0 (`pyproject.toml:79` `packages.find.include = ["vnbroker*"]`). Nâng cấp sẽ **tự dọn** — nhưng phải `pip uninstall` cũ trước, không cài đè.

### 1.3 Cách vninvest khai báo dependency

`packages/core/backend/requirements.txt:29-30`
```
# DNSE LightSpeed broker connector + SSI/TCBS broker lanes (B3.0: v3.4.0 ghim SHA)
vnbroker @ git+https://x-access-token:${VNBROKER_GITHUB_TOKEN}@github.com/vietdungiitb/vnbroker.git@1ff04e609b940f672d44bb88e9f006b721fd1262
```
- `1ff04e60` = tag **v3.4.0** (xác nhận: `git log -1 1ff04e6` → *"release: merge dev into main for v3.4.0"*).
- **Ghim SHA, không ghim version** ⇒ không có `>=` / `<` để chặn. Muốn nâng phải sửa tay dòng 30.
- Cài qua **GitHub repo private** + PAT (`Dockerfile:23` nhận secret `vnbroker_github_token`, `:32` xoá token khỏi requirements trước khi pip đọc).
- **Không** có volume mount source (`Dockerfile:4`: *"No source mounts. All code baked in at build time."*) ⇒ mỗi lần bump SHA **phải rebuild image**.

---

## 2. Tương thích 3.4.0 → 3.7.0

### 2.1 Quy mô thay đổi

```
git diff --stat 1ff04e60..662e2ef -- vnbroker/   →  78 files, +8570 / −3098
```
File thay đổi nhiều nhất: `explorer/tcbs/websocket.py` (+955), `core/bulk_router.py` (mới, +524), `broker/tcbs/account.py` (+640), **`common/data.py` (+462/−77)**, `connector/dnse/client.py` (+210), `core/utils/normalizer.py` (mới, +203).

**Không đổi dòng nào** (byte-for-byte): `api/listing.py`, `api/financial.py`, `api/news.py`, `common/retail.py`, `explorer/vci/quote.py`, `explorer/ssi/quote.py`, `broker/ssi/client.py`.

### 2.2 Kết luận tương thích API: **KHÔNG BREAKING**

Đã kiểm chứng 19 symbol / ~22 method vnimport (AST diff + đọc file ở cả 2 version):

| Mặt | Kết luận |
|---|---|
| Class/method bị **xoá** | **0** |
| **BREAKING** (đổi/đổi signature) | **0** |
| **MISSING** (biến mất) | **0** |
| Đường dẫn module đổi | **0** |

`broker/ssi/client.py` giống **byte-for-byte** giữa 2 version (MD5 `09CDF1AF`) ⇒ lane SSI có **rủi ro 0**.

### 2.3 NHƯNG: thay đổi **hành vi** mà signature không đổi

Đây là chỗ nguy hiểm — code compile được nhưng ra số khác.

| # | Thay đổi | Ảnh hưởng vninvest |
|---|---|---|
| B-1 | `match_type`: KBS `buy/sell/atc` → `Buy/Sell/ATC`; thêm giá trị `unknown` | ✅ **AN TOÀN** — `vnbroker_adapter.py:142` đã `.strip().lower()` + `.startswith('buy')`. Đã kiểm tra toàn repo: **không có chỗ nào so sánh `match_type == 'buy'`**. Chỉ lưu chuỗi. |
| B-2 | Cột `time`: `datetime64[us/s]` → `[ns, Asia/Ho_Chi_Minh]`; timestamp **naive** giờ được hiểu là **giờ VN** (không phải UTC) | ⚠ Cần xem mục 3.1 — code hiện tại đang **giả định ngược lại** |
| B-3 | `history()` lọc `start`/`end` **client-side**; `end` giờ là **cuối ngày** | ⚠ Đếm số dòng/kiểm tra biên có thể đổi |
| B-4 | Row NaT bị **drop**, frame được `sort_values('time')` + `reset_index(drop=True)` | ⚠ Đừng so sánh `df.index` với range cũ |
| B-5 | `DNSEClient.api_version` default `2026-05-07` → `2026-07-23` | ⚠ Đổi chữ ký HMAC. **vninvest không truyền** ⇒ âm thầm lấy giá trị mới. **CHƯA CHẠY** — cần probe DNSE thật. |
| B-6 | `DNSEClient.get_accounts/get_balances/get_order_history` DataFrame **thêm cột** mới | ⚠ Assert theo cột sẽ vỡ |
| B-7 | `TCBSBrokerClient.get_order_history()` → `NotImplementedError` (cùng 17 method khác) | ✅ vninvest không dùng → không ảnh hưởng |
| B-8 | 429 → `RateLimitError` (thay `ConnectionError`), **không retry** | ✅ `RateLimitError` **vẫn là** `ConnectionError` ⇒ `except ConnectionError` vẫn bắt. Nhưng `type(e) is ConnectionError` thì vỡ. |
| B-9 | `core/utils/cache.py` đổi thuật toán sinh cache key | ⚠ **Cache cũ toàn bộ vô hiệu** — lần đầu sau nâng sẽ cache miss ồ. Bình thường, cần biết trước. |
| B-10 | `MarketSnapshot.market_cap` đổi cách suy đơn vị (từ `args['price_unit']`) | ⚠ **Nghi ngờ sai cho VCI** — xem 3.3 |

### 2.4 Kiểm chứng 6 claim trong `CHANGELOG.md` (repo tự công bố)

| Claim | Kết luận |
|---|---|
| `match_type` chuẩn hoá | ✅ Đúng, nhưng tập giá trị thật là `{Buy, Sell, ATO, ATC, unknown}` — **không phải** `['ATC','Buy','Sell']` như mô tả |
| `time` chuẩn hoá `[ns, Asia/Ho_Chi_Minh]` | ⚠ **Chỉ đúng trên 2/4 đường.** `Normalizer` chỉ chạy trong `common/data.py::Quote` và `api/quote.py::Quote`. vninvest gọi **`explorer.*.quote` trực tiếp** (bảng 3.2) ⇒ **không hề được chuẩn hoá** |
| `market_cap` phóng đại 1000× đã sửa | ⚠ **Đúng cho KBS, nghi ngờ sai cho VCI** (mục 3.3) |
| TCBS `TCBS_AUTH_TOKEN` + 5 lỗi | ⚠ **Dễ hiểu nhầm.** `TCBS_AUTH_TOKEN` **vẫn là biến hỏng** (48 ký tự), chỉ còn là fallback cuối. Biến **mới** `TCBS_JWT_TOKEN` mới hoạt động. Production chỉ set `TCBS_AUTH_TOKEN` ⇒ **không có gì được cải thiện** |
| 429 không retry + failover + cooldown | ✅ Đúng |
| Logger che token/OTP | ✅ Đúng |

---

## 3. Bug phát hiện được

### 3.1 🔴 BLOCKER — Timestamp tick DNSE lệch **7 giờ** (đang chạy production, KHÔNG do nâng version)

**Đây là phát hiện nghiêm trọng nhất, và nó không liên quan gì tới việc nâng cấp.**

**Chuỗi bằng chứng (tôi tự đọc file, không suy đoán):**

1. `vnbroker/explorer/dnse/quote.py` — hàm `_parse_trades`:
   ```python
   df["time"] = (
       pd.to_datetime(df["time"], unit="s", utc=True)
       .dt.tz_convert("Asia/Ho_Chi_Minh")   # ← đổi sang GIỜ VIỆT
       .dt.tz_localize(None)                 # ← BỎ timezone
       .astype("datetime64[ns]")
   )
   ```
   ⇒ `time` trả về là **giờ VN dạng naive** (đúng 2 chỗ: 09:15 VN, không có tz).
   
   **Tôi đã đối chiếu: đoạn này GIỐNG HỆT trong 3.4.0 (venv) và 3.7.0.** Không phải regression.

2. `packages/core/backend/src/market_data/vnbroker_adapter.py:993-1000`:
   ```python
   # _parse_trades converts Unix timestamps → naive UTC datetime (tz stripped).
   # For string timestamps from DNSE, they may be VN local naive; treat as UTC
   # since VN production data consistently uses Unix seconds (UTC).
   ts = pd.Timestamp(ts_raw)
   if ts.tzinfo is None:
       utc_ts = ts.to_pydatetime().replace(tzinfo=_dt_timezone.utc)  # ← SAI
   ```
   **Comment sai.** DNSE **không** trả naive-UTC — nó trả **wall-clock giờ VN đã bỏ tz**.

3. `settings.py:339-341` → `TIME_ZONE = 'Asia/Ho_Chi_Minh'`, `USE_TZ = True`
4. Đích nhận: `market_data/models.py:167` `class IntradayTick(models.Model)`

**Hậu quả:** lệnh khớp lúc **09:15 giờ VN** được lưu thành `09:15 UTC`. Django đọc lại và hiển thị theo giờ VN ⇒ hiện ra **16:15**.

⇒ **Mọi tick lưu vào `IntradayTick` lệch đúng +7 giờ.** Điều này làm hỏng:
- biểu đồ intraday (`synthesize_intraday_bars_from_ticks`, `tasks.py:2557`)
- phân tích whale / `detect_and_store_global_whale_alerts` (`tasks.py:2555`)
- `materialize_session_facts` (`tasks.py:2556`)
- mọi logic "tick xảy ra trước/sau X giờ"

**Lưu ý:** `fetch_intraday_tape` (đường khác, `adapter.py:151`) dùng `.isoformat()` ⇒ **giữ đúng offset**. Nên hiện tại có **2 đường ghi timestamp khác nhau 7 giờ** — cùng bảng, hai cách hiểu.

**Việc cần làm:** xác nhận bằng dữ liệu thật (`SELECT min(timestamp), max(timestamp) FROM ...intraday_tick`) trước khi sửa. Nếu dữ liệu đã lưu sai thì cần **backfill**, không chỉ sửa code.

---

### 3.2 🔴 BLOCKER (trong thư viện) — `quote.history(symbol=X)` trả dữ liệu symbol **khác**

`vnbroker/common/data.py:719-734` (3.7.0):
```python
def history(self, symbol=None, **kwargs):
    if symbol:
        self.symbol = symbol.upper()          # ← chỉ set thuộc tính
    result = self._run_with_failover("history", "quote", kwargs)
```
`_run_with_failover` → `data.py:652` gọi `self._update_data_source()` **không truyền argument** → `data.py:611 if symbol:` là False ⇒ **`self.data_source` không được nạp lại**.

3.4.0 gọi `self._update_data_source(symbol)` ⇒ đúng. 3.7.0 thì không.

⇒ `history(symbol='TCB')` trên client đã dựng bằng `'VCB'` sẽ trả dữ liệu **VCB**. Không log, không exception, giá nhìn rất thật.

**Mức độ ảnh hưởng vninvest: THẤP (hiện tại).** Tôi đã grep toàn repo — chỉ có **1** chỗ truyền `symbol=` vào method:
```python
# vnbroker_adapter.py:195-196
client = Vnbroker().stock(symbol=symbol_upper, source=source)
frame = client.quote.intraday(symbol=symbol_upper, page_size=page_size)
```
Constructor và method truyền **cùng một symbol** ⇒ thao tác set thuộc tính là no-op ⇒ **không hỏng**.

⚠ **Nhưng đây là cái bẫy**: chỉ cần một dev sau này tái dùng `client` cho symbol khác → âm thầm sai dữ liệu, không ai thấy. Cần chốt bằng test.

---

### 3.3 🟠 MAJOR — `market_cap` VCI có thể lệch **1000× theo hướng ngược lại**

3.7.0 sửa `market_cap` bằng cách đọc `df.attrs['price_unit']` thay vì suy từ tham số `price_unit` (hướng sửa đúng).

Nhưng `explorer/vci/trading.py:133-139` (không đổi) vẫn **stamp `attrs['price_unit'] = "VND"` vô điều kiện** (`transform.py:98`), bất kể số thật là gì. Với VCI, payload `matchPrice` đi qua **không scale**.

⇒ `price_unit='VND'` ⇒ `multiplier = 1`.
- **3.4.0**: VCI bị nhân 1000 khi `price_unit=None` ⇒ **phóng đại**.
- **3.7.0**: không nhân ⇒ nếu VCI thật sự trả nghìn ⇒ **thu nhỏ 1000×**.

Chính `CHANGELOG.md` cũng tự ghi: *"đối chiếu `market_cap` bằng provider thứ hai (screener của VCI/KBS trả 0 dòng)"* — tức là **chưa kiểm chứng**.

⇒ **Bắt buộc probe VCI thật trước khi tin `MarketSnapshot(source='vci')`.**

---

### 3.4 🟠 MAJOR (có sẵn ở cả 2 version) — `symbols_by_exchange('HOSE')` truyền SAI tham số

Tôi đã đọc trực tiếp `explorer/kbs/listing.py:123-128`:
```python
def symbols_by_exchange(self, lang: str = 'vi', get_all=False, show_log=False) -> pd.DataFrame:
```
**Tham số đầu tiên là `lang`, không phải exchange.**

vninvest gọi:
```python
# vnbroker_adapter.py:713
listing_class(source=...).symbols_by_exchange('HOSE')   # ← 'HOSE' bind vào lang
```
⇒ Lọc sai. Lỗi bị nuốt ở `:714-715` (`logger.info` + fallback `all_symbols()`), nên **không ai thấy**. `exchange` sau đó lấy từ cột của từng dòng thay vì từ filter.

---

### 3.5 🟠 MAJOR — 3 chỗ `except Exception` biến lỗi thành "không có dữ liệu"

`vnbroker_adapter.py` có **24** `except Exception`. Nguy hiểm nhất:

```python
# :1027-1034
except Exception:
    # Không log exception message...
    logger.warning('...failed: symbol=%s date=%s', symbol_upper, trade_date_str)
    return []
```
Mọi lỗi — kể cả `TypeError` do **đổi signature** (tức là dấu hiệu duy nhất của việc nâng version hỏng) — đều thành "hôm nay không có giao dịch".

Tương tự `:501-503` (`return None`), `:555-557` (`return {}`).

⇒ **Nâng version sẽ KHÔNG crash. Nó sẽ âm thầm trả rỗng.** Đây là rủi ro vận hành lớn nhất của việc nâng.

---

### 3.6 🟠 MAJOR — `common/data.py` trả về **DataFrame dùng chuyển vị**

```python
# common/data.py:903-946 — 9 method của Listing
@lru_cache(maxsize=Config.CACHE_SIZE)
def all_symbols(self, **kwargs):
    return self.data_source.all_symbols(**kwargs)
```
`lru_cache` trả về **đúng object đã cache**, không copy. Bất kỳ thao tác in-place nào của caller (`dropna(inplace=True)`, `df["x"]=…`, `sort_values(inplace=True)`) sẽ **hỏng cache cho mọi caller sau** — không lỗi, không TTL để tự lành.

Lưu ý: cùng file đó đã **cố ý tránh** `@lru_cache` cho `Company`/`News`/`Finance` với comment *"would leak self"* (`data.py:1063-1066`) — nhưng bỏ sót `Listing`.

---

### 3.7 🟠 MAJOR — `clean_numeric_string` phá số thập phân dấu phẩy

```python
# core/utils/transform.py:157-167
s = s.replace('\u00A0', '').replace(',', '')        # ← xoá hết dấu phẩy TRƯỚC
if s.count('.') == 0 and s.count(',') == 1:          # ← nhánh này không bao giờ vào
    s = s.replace(',', '.')
```
Đo được: `'1,5'` → `'15'` (sai 10×), `'-3,75'` → `'-375'` (sai 100×).

Hiện chưa kích hoạt vì provider trả số thập phân dấu chấm. Nhưng bất kỳ nguồn nào theo chuẩn VN/EU là nổ. **Silent.**

---

### 3.8 🟠 MAJOR — Lookback lấy "hôm nay" theo **múi giờ máy host**

```python
# core/utils/lookback.py:190-196
end_dt = datetime.now()          # ← múi giờ máy chạy, không phải Asia/Ho_Chi_Minh
```
Lặp lại ở `explorer/kbs/quote.py:359-360` và `explorer/vci/quote.py:141`.

Máy dev set `Asia/Ho_Chi_Minh` ra **kết quả đúng**; container `TZ=UTC` ra **sai 1 ngày** đúng phiên giao dịch VN.
⇒ **Cùng code, khác kết quả theo môi trường.** Loại bug dễ tái nhất vào CI và mất lâu nhất để phát hiện.

---

### 3.9 🟡 Bug khác trong 3.7.0 (không chạm vninvest, ghi để biết)

| # | Vị trí | Vấn đề |
|---|---|---|
| B-a | `api/quote.py:123-130` | `@retry` **không có predicate** ⇒ 429 bị retry 3 lần; `reraise` cũng thiếu ⇒ ném `tenacity.RetryError` thay vì `RateLimitError`. **vninvest không import `api.quote`** ⇒ chưa chạm. |
| B-b | `explorer/kbs/listing.py:93-101` | Lỗi → `DataFrame(columns=[...])` **có cột** ⇒ router coi là thành công ⇒ cache 24h. Phân biệt "thị trường đóng" với "KBS chết" là **bất khả thi**. |
| B-c | `core/utils/lookback.py:156-178` | Interval phút (`1m/5m/15m/30m`) rơi vào **tỉ lệ ngày** ⇒ cửa sổ 150 ngày thay vì ~0,6 ngày. Nhánh `ratio=0.006` là **dead code** (điều kiện mâu thuẫn). |
| B-d | `common/data.py:296-306` | `_load_fallback_provider` mutate `self.source` **không `try/finally`, không lock**. Lỗi ⇒ giữ sai tên provider ⇒ **ghi sai provenance vào DB**. |
| B-e | `analytics/indicators.py:14` | `min_periods=1` ⇒ `sma_50` trên frame 10 dòng ra 10 giá trị, **không NaN**. Indicator nửa vời mang nhãn 50 nến. |
| B-f | `core/utils/transform.py:1043` | `resample` **bịa nến rỗng** cho khoảng thời gian không có giao dịch, với `volume=0` (không phải NaN ⇒ lọt mọi bộ lọc). |
| B-g | `core/utils/parser.py:124-143` | `pytz.localize()` ném `ValueError` khi input **đã có tz** ⇒ `except` ⇒ **trả `None` làm timestamp**. Đây là public API. |

---

## 4. Yêu cầu vnbroker phải đáp ứng cho vninvest

### 4.1 Hợp đồng kỹ thuật bắt buộc (việc làm ở repo `vnbroker`)

| # | Yêu cầu | Lý do | Mức |
|---|---|---|---|
| R-1 | **`quote.history/intraday/price_depth(symbol=X)` phải nạp lại provider** hoặc **bỏ tham số `symbol`** | Hiện trả nhầm symbol, im lặng | **P0** |
| R-2 | **`__version__` thật** từ metadata; vninvest ghi vào log khởi động | Hiện không biết version đang chạy khi sự cố | **P0** |
| R-3 | **`VERSION_NOTICES` machine-readable** (list breaking change + ngày + SHA) để backend assert lúc boot | Nâng version mà không ai đọc changelog | **P0** |
| R-4 | **Hợp đồng "rỗng"**: provider lỗi phải **ném**, không trả DataFrame rỗng (đã có `EmptyProviderResult` — **áp dụng hết**, không áp dụng một phần) | Phân biệt "nghỉ" vs "chết" | **P0** |
| R-5 | **Bỏ `@lru_cache` trên method `Listing`** (hoặc trả `.copy()`); TTL thay vì `lru_cache` | DataFrame dùng chung + rò instance | **P0** |
| R-6 | **`_load_fallback_provider` bọc `try/finally` + lock** | Sai provenance ghi vào DB | P1 |
| R-7 | **`@retry` phải khai `retry=` predicate ở MỌI nơi** | 429 bị retry | P1 |
| R-8 | **Timezone: `datetime.now()` → `datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))`** toàn bộ | Kết quả phụ thuộc môi trường | P1 |
| R-9 | **Sửa `lookback` cho interval phút** | Cửa sổ sai 250× | P1 |
| R-10 | **Chuẩn hoá `time` ở tầng `explorer`**, không chỉ `common/api` | 2 đường gọi trả dtype khác nhau | P1 |
| R-11 | **Bảng `symbols_by_exchange(exchange=...)`** — đổi tên tham số hoặc thêm `exchange=` | Truyền sai tham số, lỗi bị nuốt | P1 |
| R-12 | **Sửa `clean_numeric_string`** — kiểm `,` TRƯỚC khi xoá | Sai 10–100× | P2 |
| R-13 | **`market_cap` VCI** — chốt đơn vị bằng probe thật | Lệch 1000× | P2 |
| R-14 | **Chốt `TCBS_JWT_TOKEN`** trong tài liệu + fail sớm nếu chỉ có `TCBS_AUTH_TOKEN` | TCBS 401 nếu set sai biến | P2 |
| R-15 | **`MIN_VER`/`MAX_VER`** trong metadata; backend assert lúc boot | Chặn downgrade/bump ngoài ý muốn | P1 |

### 4.2 Yêu cầu về **quy trình** (quan trọng ngang bug)

| # | Yêu cầu |
|---|---|
| Q-1 | **`CHANGELOG.md` phải kèm mức tin cậy.** 6 claim kiểm chứng: 2 đúng, 1 nửa vời, 2 dễ hiểu nhầm, 1 nghi sai. Không ai đọc được mà tin tuyệt đối. |
| Q-2 | **Mọi breaking change phải kèm `test` chứng minh** — không chỉ mô tả. |
| Q-3 | **`scripts/check_breaking_api.py`** — diff AST public surface giữa 2 tag, fail CI khi có symbol biến mất/đổi signature. Hiện có `check_provider_consistency.py` nhưng **không** kiểm tra bản thân API. |
| Q-4 | **CI GitHub Actions đang chết** do billing (ghi trong cả 2 `CHANGELOG`). Tức là **không có gate nào chạy trên merge**. Đây là gốc rễ của cả 6 claim sai. |

---

## 5. Việc cần làm ở vninvest (trước khi nâng)

| # | Việc | Vị trí | Ưu tiên |
|---|---|---|---|
| V-1 | **Sửa bug timestamp 7 giờ** + backfill dữ liệu đã lưu sai | `vnbroker_adapter.py:993-1000` | **P0** |
| V-2 | **Xoá metadata pip hỏng** ở Python hệ thống (`vnbrokder` không tồn tại) | môi trường | **P0** |
| V-3 | **`except Exception` phải `re-raise` `TypeError`/`AttributeError`** — 2 lớp lỗi đó đúng là dấu hiệu signature đổi | `vnbroker_adapter.py:1027`, `:501`, `:555` | **P0** |
| V-4 | **Log `vnbroker.__version__` + `importlib.metadata.version()` lúc boot** | settings/app ready | P1 |
| V-5 | **Assert version lúc boot** (`3.4.0 <= v < 3.8.0`) | settings | P1 |
| V-6 | **Sửa `symbols_by_exchange('HOSE')`** | `vnbroker_adapter.py:713` | P1 |
| V-7 | **Thêm `DNSE→DNSEQuote` vào `_QUOTE_CLASS_ALIASES`** | `vnbroker_adapter.py:32` | P1 |
| V-8 | **Sửa `SSIQuote.fetch_multiple(symbols=...)`** (tên tham số là `symbols_list`, không phải classmethod) | `vnbroker_adapter.py:540` | P1 |
| V-9 | **Gỡ `@retry`-theo-chuỗi** — `adapter.py:63` dựa vào text `"rate limit"` trong log; đổi message là hỏng im lặng | `vnbroker_adapter.py:56-63` | P2 |
| V-10 | **Hợp đồng cột output** — assert schema sau mỗi lần gọi vnbroker | `vnbroker_adapter.py` | P2 |

---

## 6. Lộ trình đề xuất

```
GIAI ĐOẠN A — Dừng tổn thương (chưa đụng version)
  ├─ A1  Xác minh bug 7 giờ trên dữ liệu thật (SELECT min/max timestamp)
  ├─ A2  Sửa + backfill timestamp
  ├─ A3  Dọn pip hỏng ở Python hệ thống
  └─ A4  V-3 (re-raise TypeError/AttributeError)   ← hàng rào chống "âm thầm rỗng"

GIAI ĐOẠN B — Làm thư viện đủ điều kiện (ở repo vnbroker)
  ├─ B1  R-1 sửa symbol regression  + test
  ├─ B2  R-4/R-5 "rỗng" + bỏ lru_cache trên Listing
  ├─ B3  R-2/R-3/R-15 version + VERSION_NOTICES machine-readable
  └─ B4  R-6..R-11 (P1 còn lại)

GIAI ĐOẠN C — Nâng version
  ├─ C1  Tag v3.8.0 (đóng gói A+B)
  ├─ C2  Sửa requirements.txt:30 SHA → tag mới
  ├─ C3  pip uninstall vnbroker cũ (dọn tests/ scripts/ docs/ rò) → cài mới
  ├─ C4  Chạy LiveBrokerContractTests: VNBROKER_RUN_LIVE_CONTRACT=1  ← CHƯA TỪNG CHẠY
  ├─ C5  Probe DNSE thật (kiểm api_version 2026-07-23)
  ├─ C6  Probe VCI thật (kiểm market_cap)
  └─ C7  Rebuild Docker image (không có volume mount)

GIAI ĐOẠN D — Gia cố dài hạn
  ├─ D1  CI GitHub Actions (đang chết vì billing) ← gốc rễ của 6 claim sai
  ├─ D2  scripts/check_breaking_api.py (AST diff public surface)
  └─ D3  Chốt lịch bump định kỳ + changelog có mức tin cậy
```

**Ưu tiên tuyệt đối: A trước C.** Nâng version **không** sửa bug 7 giờ — nó vẫn sai sau khi nâng. Và nếu A4 chưa làm thì lúc nâng, mọi hỏng đều hiện ra dưới dạng "hôm nay không có giao dịch".

---

## 7. Câu hỏi cần Owner chốt

| # | Câu hỏi | Vì sao chặn |
|---|---|---|
| Q1 | Dữ liệu `IntradayTick` đã lưu đã lệch 7 giờ chưa? Cần chạy query để xác nhận trước khi quyết sửa/backfill | Quyết định "sửa 1 dòng" vs "sửa + migration backfill toàn bảng" |
| Q2 | `vninvest` có dùng `MarketSnapshot(source='vci')` thật không? | Quyết định 3.3 là blocker hay chỉ là ghi chú |
| Q3 | Có chủ ý bật `source='AUTO'` sắp tới không? | `AUTO` mới có ở 3.7.0; pool quote đổi `["vci"]` → `["vci","kbs"]` |
| Q4 | Có định bật TCBS làm provider `AUTO` không? | Phải có `TCBS_JWT_TOKEN`; chỉ có `TCBS_AUTH_TOKEN` sẽ 401 |
| Q5 | Cho phép sửa 2 repo trong cùng 1 ticket, hay tách ticket riêng cho `vnbroker`? | AGENTS.md yêu cầu claim/multi-agent; 2 repo = 2 registry |
| Q6 | CI GitHub Actions của `vnbroker` còn cứu được không, hay bỏ và chạy gate local? | Không có CI ⇒ không có gate nào chạy khi merge ⇒ mọi bug 3.7.0 sẽ lặp lại |

---

## 8. Giới hạn của audit — những gì **CHƯA CHẠY**

| Hạng mục | Trạng thái | Vì sao |
|---|---|---|
| Test suite vnbroker (200 file) | **CHƯA CHẠY** | Không chạy trong phiên audit này. CHANGELOG tự ghi "1978 passed" cho 3.7.0 — **chưa tự kiểm chứng lại**. |
| Test suite vninvest | **CHƯA CHẠY** | Cần Postgres (`CORE_DATABASE_URL` + `DJANGO_DEBUG=1`); `AGENTS.md` ghi baseline 602 test / failures=10 / errors=3 |
| `LiveBrokerContractTests` | **CHƯA CHẠY** | Gate bởi `VNBROKER_RUN_LIVE_CONTRACT=1` (`test_vnbroker_broker_signatures.py:115-116`) |
| Probe DNSE / VCI / KBS thật | **CHƯA CHẠY** | Không có credential trong môi trường audit |
| `DNSEClient.api_version` mới | **CHƯA XÁC MINH** | Cần tài khoản DNSE thật |
| `market_cap` VCI | **CHƯA XÁC MINH** | Cùng lý do |
| Dữ liệu `IntradayTick` production | **CHƯA XÁC MINH** | Cần truy vấn DB |
| Phân tích tĩnh AST | Đã làm | Đủ cho phần tương thích signature, **không** đủ kết luận hành vi runtime |

> Theo `AGENTS.md`: **không báo PASS cho thứ chưa chạy.** Mọi dòng trên đây ghi "CHƯA CHẠY" là thật.

---

## 9. Phụ lục — 19 symbol vninvest phụ thuộc (đã kiểm chứng 2 version)

| Call site | Symbol | Kết luận 3.7.0 |
|---|---|---|
| `vnbroker_adapter.py:186` | `vnbroker.Vnbroker` | OK |
| `vnbroker_adapter.py:196` | `.stock()` → `.quote.intraday()` | OK (symbol trùng ⇒ bug 3.2 không kích hoạt) |
| `vnbroker_adapter.py:345-349` | `explorer.{vci,kbs,ssi}.quote` | OK · **DNSE thiếu alias `Quote`** |
| `vnbroker_adapter.py:455,652` | `.history()` | OK |
| `vnbroker_adapter.py:540` | `.fetch_multiple()` | OK VCI/KBS · **SSI sai tên tham số** |
| `vnbroker_adapter.py:359` | `api.listing.Listing` | OK |
| `vnbroker_adapter.py:713` | `.symbols_by_exchange('HOSE')` | OK nhưng **sai tham số** (mục 3.4) |
| `vnbroker_adapter.py:961-974` | `explorer.dnse.quote.DNSEQuote.intraday` | OK |
| `vnbroker_adapter.py:1043-1087` | `api.company.Company` + 4 method | OK |
| `vnbroker_adapter.py:1120-1151` | `api.financial.Finance` + 3 method | OK |
| `vnbroker_dnse_compat.py:43-121` | `connector.dnse.client.DNSEClient` + 3 method | OK · **`api_version` đổi, chưa probe** |
| `views_retail.py:26-104` | `common.retail.Retail` | OK (file giống byte-for-byte) |
| `stock_mgmt_native_views.py:2221` | `api.news.News.by_symbol` | OK (file giống byte-for-byte) |
| `broker/tcbs.py:96`, `adapters.py:491-601` | `broker.tcbs.client.TCBSBrokerClient` + 8 method | OK (thêm 7 method mới) |
| `broker/ssi.py:106-119`, `adapters.py:395-455` | `broker.ssi.client.SSIBrokerClient` + 9 method | OK — **file giống byte-for-byte, rủi ro 0** |
| `test_vnbroker_broker_signatures.py:122-143` | contract test | OK, sẽ xanh trên 3.7.0 |

**Monkeypatch / subclass: 0.** Không `setattr`, không `patch('vnbroker…')`, không subclass. Toàn bộ là composition — đây là tin tốt: **nâng version không thể phá vỡ qua đường đó.**

Duy nhất có can thiệp: `vnbroker_adapter.py:970-976` gắn handler tạm vào logger `'vnbroker'` (để bắt rate-limit), tháo trong `finally`. Dựa vào **string** `"rate limit"` ⇒ **brittle** nếu 3.7.0 đổi message.

---

*Báo cáo kết thúc. Chưa sửa code. Chờ Owner chốt mục 7 trước khi mở Giai đoạn A.*