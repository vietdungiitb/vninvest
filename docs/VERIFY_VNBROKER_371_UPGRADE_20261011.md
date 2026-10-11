# KIỂM CHỨNG SAU NÂNG CẤP — `vnbroker` 3.7.1 cho `vninvest`

**Ngày:** 2026-10-11 · **Người kiểm chứng:** TechLead phía `vninvest` · **Bên nhận:** Owner
**Đối tượng:** `vnbroker` `v3.7.1` (`eeccdb8`), nâng từ `v3.7.0` (`662e2ef`)
**Căn cứ:** đo lại **đúng các phép đo** đã dùng để phát hiện bug, không đọc commit message.

---

## 0. Kết luận một đoạn

**ĐƯỢC CẬP NHẬT — với 1 điều kiện.**

Cả 4 BLOCKER của Hàng 1 đã được sửa **đúng**, và tôi đã **đo lại** từng cái bằng chính phép đo cũ:
BL-1 từ `120/1/1/1` → `4/4 vòng loop OK`; BL-3 từ *"mọi lỗi 4xx đều failover"* → *"4xx không failover, 429/5xx vẫn còn"*; BL-6 từ *"lỗi → cache 24h"* → *ném `EmptyProviderResult`*; BL-2 từ *"mọi tenant dùng chung 1 cache key"* → *"credential A ≠ credential B"*.
Test suite **2071 passed / 26 skipped / 0 fail**. Contract test của chính vninvest chạy trên 3.7.1: **4 passed**.

**Nhưng fix BL-2 tạo ra một regression mới: API secret được ghi rõ vào log DEBUG.** Đo được, không suy đoán. Đây là thứ **duy nhất** chặn lên production.

---

## 1. Đã sửa — đo lại được

### BL-1 · `asyncio.Lock` module scope ✅ FIXED

| | Trước (3.7.0) | Sau (3.7.1) |
|:--|:--|:--|
| 4 batch × 120 request qua `fetch_multiple_requests` | `120 ok` → `1 ok, 119 lỗi` → `1` → `1` | **`ok` cả 4 vòng** |
| Lỗi | `... is bound to a different event loop` | **không còn** |
| httpx client qua 3 loop | dùng chung pool | **3 id khác nhau** (per-loop, đúng) |

Cấu trúc fix đúng: `weakref.WeakKeyDictionary` khoá theo `get_running_loop()`, trường token khoá bằng `threading.Lock()` **không giữ qua `await`** (`async_client.py`, commit `6fa4e2a`). Comment giải thích rõ tại sao không dùng `asyncio.Lock` ở `__init__`.

### BL-2 · Cache key sụp về tên lớn ✅ FIXED (nhưng xem §2)

Đo bằng **class thật**, không phải mô hình:

| Trường hợp | Kết quả |
|:--|:--|
| `DNSEListing(tenant A)` vs `DNSEListing(tenant B)` | **key khác nhau** ✅ |
| Chứa `TENANT_A` trong key? | **Có** — credential sống sót tới key |
| `SSIListing` A vs B | **khác nhau** ✅ |
| `SSIListing` **sau** khi `_market()` dựng `SSIMarketService` | **vẫn khác nhau** ✅ |
| `VCIListing` proxy khác nhau | **khác nhau** ✅ |
| `show_log=True/False` | **khác nhau** ✅ |

Có cả backstop `_key_is_cacheable()` + `_UNCACHEABLE_MARKER` cho instance không có attribute nào.

### BL-3 · Lỗi vĩnh viễn failover ✅ FIXED

Đo qua HTTP server thật, gọi `send_request_direct` rồi `should_failover`:

| status | Trước | Sau | Đúng? |
|:--|:-:|:-:|:-:|
| 400 | failover=**True** | `ProviderBadRequestError` / failover=**False** | ✅ |
| 401 | failover=**True** | `ProviderAuthError` / failover=**False** | ✅ |
| 403 | failover=**True** | `ProviderAuthError` / failover=**False** | ✅ |
| 404 | failover=**True** | `ProviderNotFoundError` / failover=**False** | ✅ |
| 422 | failover=**True** | `ProviderBadRequestError` / failover=**False** | ✅ |
| 429 | failover=True | `RateLimitError` / failover=**True** | ✅ giữ nguyên |
| 500 | failover=True | `ConnectionError` / failover=**True** | ✅ giữ nguyên |

Không phải vá bằng `isinstance` — họ tách lớp exception riêng, và **cố ý không kế thừa `OSError`** để `should_failover` không khớp. Đúng P-4 trong đề xuất.

### BL-6 · Lỗi bị nuốt thành frame rỗng ✅ FIXED

| | Trước | Sau |
|:--|:--|:--|
| KBS `all_symbols()` lỗi | `(0, 2)` DataFrame, `record_success`, cache 24h | **ném** `EmptyProviderResult` |
| KBS `symbols_by_exchange()` lỗi | frame rỗng có cột | **ném** |
| KBS provider trả list rỗng | im lặng | **ném** `EmptyProviderResult` |
| KBS `price_board` lỗi | `logger.info("Truy xuất thành công")` | `raise_for_status()` |

Diff có ghi thẳng: *"dung sai một phần là chính sách có ý thức, ngoài scope S4"* — trung thực, đúng cách làm.

### MA-30 · Metrics mù ✅ FIXED (ngoài yêu cầu, làm thêm)

| | Trước | Sau |
|:--|:--|:--|
| 20 request lỗi | `total 0`, `successful 160` | **`total 5, successful 0, failed 5`** |

---

## 2. 🔴 REGRESSION MỚI — API secret rò vào log (chặn production)

**Đây là hệ quả trực tiếp của fix BL-2, và nó trái với chính bộ phòng vệ mà thư viện xây.**

### Bằng chứng đo được

```
DEBUG - Cache MISS for all_symbols: ...|state=dict:4:{str:_api_key=str:TENANT_A,
        str:_api_secret=str:SUPER_SECRET_abc123XYZ, str:_service=none, ...}
                                                        ^^^^^^^^^^^^^^^^^^^^^^^^ secret rõ
```

- **Vị trí rò:** `vnbroker/core/utils/cache.py:505` và `:537`
  ```python
  logger.debug(f"Cache MISS for {func.__name__}: {key}")
  ```
- **Vì sao mới:** fix BL-2 đổi `_instance_state` từ `None` sang trả về **mã hoá sâu attribute**. Trước đó key chỉ có `...<Listing object at <addr>>` — **không có attribute nào**. Đo xác nhận: `_instance_state(SSIListing(...))` giờ trả `dict:4:{..._api_secret=str:B...}`.
- **`SensitiveDataFilter` của chính thư viện KHÔNG che được:** đo trực tiếp — `secret survives the filter = True`. Pattern `str:_api_secret=str:XXX` không khớp `SENSITIVE_PATTERN`.

### Mức độ

| Câu hỏi | Trả lời |
|:--|:--|
| Chạm production không? | Chỉ ở mức **DEBUG**. vninvest prod để `DJANGO_DEBUG=0` ⇒ mức DEBUG tắt. |
| Chạm dev/CI không? | **Có** — mọi môi trường bật log DEBUG. |
| Nhạy với multi-tenant? | **Có** — vninvest lưu credential DNSE/SSI **theo từng người dùng** (`VNBROKER_BROKER_SSI_API_KEY/…SECRET`, `UserDNECredential`). Key của user A đọc bởi user B sẽ in ra secret A. |
| Kích hoạt khi nào? | Mỗi lần gọi `cached_listing` / `cached_industry` trên provider có credential mà cache **miss**. Với `TTL=86400` và `all_symbols()` nặng, đây là **mọi lần khởi động worker** và sau mỗi `invalidate_listing_cache()`. |

### Đề xuất sửa (nhỏ, độc lập)

Không cần bỏ deep-encode — chỉ cần **không in key thô**:

1. `cache.py:498,502,505,530,534,537` — in **độ dài + hash 8 ký tự** thay vì key đầy đủ: `f"Cache MISS for {name}: key#{blake2b(key)[:8]} len={len(key)}"`.
2. Hoặc: đưa key qua `Redactor.redact_str()` có sẵn trước khi log.
3. Thêm test: `assert SECRET not in caplog.text` khi gọi listing có credential — đóng băng bằng test như L-G02 yêu cầu.

> Lưu ý: repo `vninvest` có lesson **"số trong log là bí mật"**; ngược lại ở đây secret **là** thứ bị log. Đây là loại lỗi mà `gate-integrity.md` gọi là *cổng xanh giả* — và nó đến từ chính một fix chất lượng.

### Chi phí phụ đo được (không chặn, nhưng nên biết)

`_make_key` giờ **0.064–0.163 ms/lần**, key dài **1487–1564 ký tự** (trước: chuỗi ngắn tên lớn). Key nằm trên đường nóng của mọi lần đọc listing + `blake2b` trên ~1.5 KB. Chấp nhận được, nhưng nên biết khi profile.

---

## 3. Tương thích phía vninvest: **0 breaking**

### 3.1 Bề mặt API

| Kiểm tra | Kết quả |
|:--|:--|
| 14 symbol vninvest import | **thiếu 0** |
| `Vnbroker`, `api.listing/company/financial/news`, `common.retail` | ✅ |
| `explorer.{vci,kbs,ssi,dnse}.quote` | ✅ |
| `broker.{tcbs,ssi}.client`, `connector.dnse.client` | ✅ |
| `EmptyProviderResult` (mới) | ✅ export được |
| `DNSEQuote.__init__/intraday`, `DNSEClient.get_order_history` | ✅ **không đổi** |
| `TCBS.authenticate(otp)`, `SSI.authenticate(otp, transaction_id)` | ✅ **không đổi** |

### 3.2 Breaking change mà thư viện tự công bố — **không chạm vninvest**

`VERSION_NOTICES["3.7.1"]` cảnh báo: *"400/401/403/404/422 giờ ném `ProviderAuthError`/`ProviderNotFoundError`/`ProviderBadRequestError` thay vì `ConnectionError`. Các lớp này cố ý KHÔNG kế thừa `OSError`. **Code bắt `except ConnectionError` sẽ không thấy chúng nữa.**"*

Đã kiểm toàn backend vninvest: **0 chỗ** bắt `ConnectionError` / `OSError` / `RequestException` / `TimeoutError` quanh đường vnbroker (kết quả duy nhất là `test_migration_0008_rehearsal.py:475`, không liên quan).

Các adapter của vninvest đều bắt `Exception` rộng ⇒ vẫn bắt được. **Không cần sửa gì.**

### 3.3 BL-6 (KBS giờ ném) — vninvest sống sót

Đường `fetch_listing_symbols` (`vnbroker_adapter.py:713-737`) đã có sẵn `except Exception` → fallback `all_symbols()` → fallback seed data. Nay KBS ném thay vì trả rỗng ⇒ vninvest đi vào đúng nhánh fallback đó. **Cải thiện**, không phá: trước đây lỗi KBS bị cache 24h, nay không.

### 3.4 Contract test của vninvest chạy thật trên 3.7.1

```
$ PYTHONPATH=<vnbroker source> pytest test_vnbroker_broker_signatures.py
4 passed, 2 skipped
```
(2 skip là `LiveBrokerContractTests`, gate bởi `VNBROKER_RUN_LIVE_CONTRACT=1` — **CHƯA CHẠY**, không phải do 3.7.1.)

### 3.5 Test suite của thư viện

```
2071 passed, 26 skipped, 0 failed   (211 s)
```

---

## 4. Còn tồn đọng — chưa nằm trong Hàng 1

Không phải lỗi mới; là những gì **chưa tới hạn**. Ghi lại để không mất dấu:

| ID | Vấn đề | Trạng thái |
|:--|:--|:--|
| **BL-4** | Không kiểm mã nghiệp vụ response write; `describe_business_code()` 0 caller | ⏳ Hàng 3 (khi mở R3) |
| **BL-5** | `IdempotencyStore` code chết; SSI tự sinh `request_id` mới mỗi lần | ⏳ Hàng 3 |
| **L-R06 drift** | `broker/tcbs/equity.py:409-441` vẫn thiếu `404`/`422`, rồi `return resp.json()` | ❌ **broker/ KHÔNG bị đụng** ở Hàng 1 |
| MA-32 | `VERSION_REQUIREMENTS["3.7.1"] = {"vnii": ">=0.1.5"}` nhưng `vnii` không có trong `pyproject.toml` và **không cài** | ❌ đo: `vnii installed = False`. Nay lại **thêm một entry cùng lỗi** |
| MA-11 | `quote.history(symbol=X)` trả dữ liệu symbol khác | ⏳ Row 2 (vninvest hiện không kích hoạt — truyền cùng symbol ở ctor) |
| MA-27 | `symbols_by_exchange(self, lang='vi', …)` — caller truyền `'HOSE'` bind vào `lang` | ⏳ Row 2 |
| MA-13/14/15 | `clean_numeric_string` phá dấu phẩy · `datetime.now()` theo TZ máy · interval phút dùng tỉ lệ ngày | ⏳ Row 2 |
| MA-23 | Rate limiter tắt mặc định ở đường sync; bật ở async, per-process | ⏳ Row 2 |

**L-R06 drift là mục đáng lo nhất còn lại**, vì nó nằm trên **đường đặt lệnh chính** và lesson L-R06 đã tự mô tả đúng hậu quả của nó.

---

## 5. Có thể cập nhật — cách làm và điều kiện

### Điều kiện (không thoả hiệp)

| # | Điều kiện | Lý do |
|:--|:--|:--|
| **C1** | **Sửa rò secret ở `cache.py:505/537` trước** (mục §2) | vninvest để credential theo từng người dùng; log ở dev sẽ in secret thật |
| **C2** | Rebuild Docker image | `Dockerfile:4` ghi rõ *"No source mounts"* ⇒ **không** có hiệu lực nếu không rebuild |
| **C3** | `pip uninstall vnbroker` cũ **trước** khi cài | bản 3.4.0 đang rò `tests/`, `scripts/`, `docs/`, `artifacts/` vào `site-packages` |
| **C4** | Chạy `pytest` phía vninvest sau khi bump | AGENTS.md: baseline **602 test / failures=10 / errors=3** — phải so với baseline |

### Lệnh bump

```powershell
# 1. Sửa dòng pin — packages/core/backend/requirements.txt:30
#    1ff04e609b940f672d44bb88e9f006b721fd1262  (3.4.0)
# -> eeccdb8  hoặc  tag v3.7.1
vnbroker @ git+https://x-access-token:${VNBROKER_GITHUB_TOKEN}@github.com/vietdungiitb/vnbroker.git@eeccdb8...

# 2. Vẫn chạy trên v3.4.0 cho tới khi C1 xong — không vội.
# 3. Rebuild image; không có volume mount nên build là bắt buộc.
```

### Rủi ro còn lại khi bump

| Rủi ro | Mức | Giảm thiểu |
|:--|:-:|:--|
| Cache cũ (3.4.0/3.7.0) không đọc được bằng key mới | Thấp | Tự xử: cache miss một lần |
| KBS listing giờ ném ⇒ log vninvest đầy hơn | Thấp | Đã có `except` + fallback; thực ra là cải thiện |
| `match_type`/`time` đổi (3.7.0, **đã có từ trước**) | **Cao** | Đây là thay đổi **3.4.0→3.7.0**, chưa từng được kiểm trên dữ liệu thật. Xem §6. |
| Timestamp tick lệch 7 giờ | **Cao** | Không phải do 3.7.1. Xem §6. |

---

## 6. Hai việc **không** phải của thư viện, nhưng chặn giá trị của việc bump

Bump lên 3.7.1 **không** làm hai điều này đúng. Cả hai đang chạy production ngay bây giờ:

### 6.1 🔴 Timestamp tick lệch 7 giờ (lỗi phía vninvest, có sẵn từ 3.4.0)

- `vnbroker/explorer/dnse/quote.py::_parse_trades` trả **giờ VN dạng naive** (đã đối chiếu: đoạn này **giống hệt** ở 3.4.0, 3.7.0, 3.7.1).
- `vnbroker_adapter.py:993-1000` gán `.replace(tzinfo=utc)` với comment *"naive UTC"* — **comment sai**.
- Với `USE_TZ=True` + `TIME_ZONE='Asia/Ho_Chi_Minh'`: lệnh lúc **09:15 VN** lưu thành `09:15 UTC` ⇒ hiển thị **16:15**.

⇒ Mọi tick trong `IntradayTick` lệch **+7 giờ**. Đây là lỗi **của vninvest**, không phải của thư viện, và nâng version không chữa được.

### 6.2 🟠 `match_type` / `time` đổi hợp đồng dữ liệu (từ 3.7.0, chưa kiểm thật)

Đã kiểm lại: `vnbroker_adapter.py:142` dùng `.strip().lower()` + `.startswith('buy')` ⇒ **`match_type` an toàn**. Nhưng thay đổi `time` (dtype/tz) của 3.7.0 **chưa từng được chạy trên dữ liệu thật**, và cột `time` của đường `explorer.*.quote` **không** qua `Normalizer` (chỉ `common/api` mới qua).

---

## 7. CHƯA XÁC MINH

| Hạng mục | Vì sao |
|:--|:--|
| `LiveBrokerContractTests` (`VNBROKER_RUN_LIVE_CONTRACT=1`) | Cần JWT thật cho SSI/TCBS |
| Probe DNSE/KBS/VCI thật | Không có credential trong phiên kiểm chứng |
| `market_cap` VCI (mối nghi ngờ 1000× từ audit 3.7.0) | Chưa probe; **không thuộc diff 3.7.0→3.7.1** |
| Test suite phía vninvest (baseline 602) | Cần Postgres; chưa chạy trong phiên này |
| Dữ liệu `IntradayTick` production | Cần query DB để xác nhận mục 6.1 |

---

## 8. Đề xuất quyết định

**Phê duyệt cập nhật `vnbroker` 3.7.1** — điều kiện C1 (vá rò secret) và C2 (rebuild image).

Thứ tự:

1. **Trước khi bump:** vá `cache.py:505/537` (§2) — nhỏ, độc lập, **không** nên để production.
2. **Song song:** sửa timestamp 7 giờ phía vninvest (§6.1) — lỗi này tồn tại dù vnbroker ở version nào.
3. **Sau bump:** chạy test vninvest, so với baseline 602/10/3.

**Không** bump trước khi làm bước 1: 3.7.1 sửa đúng 4 lỗi nghiêm trọng nhất, nhưng đổi lại làm lộ credential theo từng người dùng ra log — đánh đổi đó không đáng.

---

## 9. Phụ lục — phép đo đã dùng

Tất cả chạy bằng `C:\Mujoco Projects\vnbroker\.venv\Scripts\python.exe` (Python 3.13.14), script tạm trong `%TEMP%\opencode\`, **không sửa file nào trong repo**:

| Phép đo | Kết quả |
|:--|:--|
| Limiter qua 4 `asyncio.run` | `ok, ok, ok, ok` |
| httpx client id qua 3 loop | 3 id **khác nhau** |
| HTTP server thật → `should_failover` | bảng 7 status ở §1 |
| KBS listing với provider lỗi | `RAISED RuntimeError` / `RAISED EmptyProviderResult` |
| `DNSEListing`/`SSIListing` key A vs B | khác nhau |
| `SensitiveDataFilter` trên key | **secret sống sót** |
| `pytest tests/` | `2071 passed, 26 skipped` |
| `pytest test_vnbroker_broker_signatures.py` (venv vninvest, PYTHONPATH trỏ source 3.7.1) | `4 passed, 2 skipped` |

`git status` repo `vnbroker`: **sạch**. Repo `vninvest`: chỉ thêm file `.md` này.