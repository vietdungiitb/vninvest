# KIỂM CHỨNG LẦN 2 — sau bản vá rò secret + chuẩn bị phát hành

**Ngày:** 2026-10-11 · **Đối tượng:** working tree của `vnbroker` (3 file sửa, **chưa commit**) + `pyproject 3.7.1`
**Kết quả:** bản vá **đạt**. Còn **3 điều kiện** trước khi phát hành được.

---

## 0. Tôi đã sai — bạn đúng, và tôi đã chứng minh được

Báo cáo trước của tôi ghi: *"bản vá C1 phải trước vì **fix BL-2 tạo ra regression mới**"*. **Sai.**

Đối chiếu trực tiếp, không suy ra:

| Bằng chứng | Kết quả |
|:--|:--|
| `git tag --contains 8dacac3` | **`v3.6.0` là tag đầu tiên** chứa nó |
| Ngày `8dacac3` | 2026-10-08 · `v3.6.0` = 2026-10-10 |
| `_make_key` ở **v3.5.0** | `key_parts = [str(arg) for arg in args]` — `str()` thuần, **không giá trị attribute** |
| Commit message `8dacac3` | *"nhánh object rút về `type(v).__name__`… hai domain object khác state đều gộp một key"* |

⇒ Rò bắt đầu ở **v3.6.0** (bộ mã hoá có kiểu), `d7d6b66` (BL-2) chỉ làm nó **nặng thêm** bằng deep-encode. Attribution của bạn chính xác.

**Hệ quả thực tế đúng như bạn nói:** vninvest đang ghim `3.4.0` ⇒ **chưa bị**. Rò chỉ xuất hiện khi bump. Nên "vá trước khi bump" vẫn đúng, **nhưng lý do là đang sửa nợ có sẵn từ 3.6.0, không phải tránh regression mới.**

Đây là lỗi phương pháp của tôi: tôi đã đo hiện tại rồi quy nguyên nhân về commit gần nhất, thay vì đối chiếu mốc cũ trước khi kết luận.

---

## 1. Bản vá — **đạt**, đo trên class production

### 1.1 Lớp 1 — key thô không còn vào log ✅

Đo qua `SSIListing` + `DNSEListing` thật (`explorer/ssi/listing.py:58` giữ `self._api_secret`), bắt log ở DEBUG:

| Kiểm tra | Kết quả |
|:--|:--|
| `SECRET` trong log | **`False`** ✅ |
| **API key** trong log | **`False`** ✅ (cả 2, không chỉ secret) |
| Dòng log mẫu | `Cache MISS for all_symbols: key#5a434d0a` |

### 1.2 Lớp 2 — lookbehind chặn `_` ✅ (11/11)

Đây là lớp tôi chưa kiểm, và nó **đúng** như bạn mô tả:

| Chuỗi | Kết quả | Đúng? |
|:--|:--|:-:|
| `_api_secret=SECRET` | `_api_secret: "***REDACTED***"` | ✅ |
| `api_secret=SECRET` | `api_secret: "***REDACTED***"` | ✅ |
| `_password=pw` · `_token=tk` · `pin=1234` | đều che | ✅ |
| `_private_note=hello` | **không đổi** | ✅ |
| `monkey=abc` · `_monkey=abc` | **không đổi** | ✅ |
| `the user name is bob` | **không đổi** | ✅ |
| `key note: read the file` | **không đổi** | ✅ |
| `turnover=1.2M` | **không đổi** | ✅ |

### 1.3 Guard chống mất dữ liệu (L-R07) ✅

```
in : _api_secret=abc123 _api_key=xyz turnover=1.2M
out: _api_secret: "***REDACTED***" _api_key: "***REDACTED***" turnover=1.2M
     tên field giữ nguyên cả 3/3
```
`_api_secret` **che** nhưng **tên field không bị xoá** ⇒ `\1\2\3\4` đúng. Đây là chỗ dễ sai nhất và bạn đã kiểm trước.

### 1.4 Lớp 3 — `repr()` failed chỉ in tên exception ✅

Đúng như mô tả. Không trích nguyên văn giá trị.

### 1.5 Fingerprint đối chiếu được bằng mắt ✅

`_key_fingerprint(key) -> str` (hàm module, không phải method):

| Kiểm tra | Kết quả |
|:--|:--|
| Ổn định giữa 2 instance cùng state | `True` (`key#97bb509a`) |
| Khác nhau khi credential khác | `True` |
| Chứa secret | **`False`** ✅ |
| HIT/MISS vẫn đối chiếu được | `Cache MISS … key#7b12f8ef` → `HIT … key#7b12f8ef` |

### 1.6 Cache không hỏng ✅

3 lần `all_symbols()` giống nhau ⇒ **1** lần gọi upstream (`Cache MISS` rồi 2 `Cache HIT`), shape `(1, 2)` cả 3 lần.

### 1.7 Test suite (với bản vá)

**2082 passed, 26 skipped, 0 fail** — tăng 11 test so với 2071 trước bản vá.

---

## 2. Hai mục bạn yêu cầu tôi tự đo — kết quả

### 2.1 MA-32 — **đúng, và tệ hơn tôi nói**

Đo `VERSION_REQUIREMENTS` thật:

```
{'3.3.0': {'vnii': '>=0.1.5'}, '3.4.0': {...}, '3.5.0': {...},
 '3.6.0': {...}, '3.7.0': {...}, '3.7.1': {'vnii': '>=0.1.5'}}
```

| version | khai trong `pyproject.toml` | cài được |
|:--|:-:|:-:|
| 3.3.0 → 3.7.1 (**6 bản**) | **False** | **False** |

⇒ **MA-32 có từ 3.3.0**, không phải do 3.7.1. `pyproject.toml` chưa bao giờ khai `vnii`; `upgrade.py` nuốt `PackageNotFoundError` nên kiểm tra phụ thuộc **bỏ qua im lặng**.

**Vì sao chưa nổ:** `vnbroker` không import `vnii` ở đâu. Nó là yêu cầu **ma** — không có tác dụng gì ngoài việc bị bỏ qua. Nên đây là **nợ tài liệu**, không phải lỗi chạy. Xử lý: **xoá khỏi `VERSION_REQUIREMENTS`** (rẻ hơn khai vào `pyproject`).

### 2.2 Drift L-R06 — **tôi đã phóng đại, đính chính**

Tôi khẳng định: *"`equity.py::_write_request` thiếu `404` **và** `422`, trên đường đặt lệnh chính"*. **Đo lại thì sai nửa sau.**

Nguyên nhân lỗi của tôi: đọc `equity.py:409-441` rồi **giả định** đó là `_write_request`, không kiểm tra tên hàm.

Đo theo định nghĩa hàm thật:

| method | vị trí | xử lý status | đúng |
|:--|:--|:--|:-:|
| `_get` (đường **đọc**) | `equity.py:375` | 400, 401, 403, 429, 5xx | thiếu 404, 422 |
| **`_write_request` (đường **ghi**)** | `equity.py:449` | **400, 401, 403, 422**, 429, 5xx | **chỉ thiếu 404** |
| `_write_http.raise_for_status` | `_write_http.py:43` | 400, 401, 403, 404, 422, 429, 5xx | đủ |

Đọc thẳng `equity.py:492` xác nhận: `if resp.status_code == 422: raise BrokerOrderError(...)` — **422 có xử lý trên đường ghi**.

⇒ **Kết luận đúng:** kịch bản tệ nhất tôi mô tả *"TCBS trả 422 không đủ tiền → caller nhận dict trông bình thường"* **không xảy ra trên đường đặt lệnh**. Còn lại đúng **một** khoảng trống: `404` chưa được map ở cả `_get` lẫn `_write_request`.

**Mức độ: MAJOR → MINOR.** Vẫn nên vá (L-R06 yêu cầu map đủ), nhưng **không còn là rủi ro tiền thật** như tôi đã viết. Bản vá rẻ: cho `_write_request` gọi lại `raise_for_status()` của `_write_http.py`.

> Đây là lần thứ hai tôi kết luận từ đọc mà không đo. Cùng một nguyên nhân: **tin phỏng đoán về cấu trúc thay vì xác nhận nó.**

---

## 3. Sẵn sàng build — **đã kiểm chạy thật**

| Bước | Kết quả |
|:--|:--|
| `python -m build` | ✅ `vnbroker-3.7.1.tar.gz` + `vnbroker-3.7.1-py3-none-any.whl` |
| `twine check dist/*` | ✅ **PASSED** (cả 2) |
| `scripts/check_dist_contents.py` | ✅ exit 0 |
| Nội dung wheel | `top_level: ['vnbroker']`, 224 file, **không rò** `tests/ scripts/ docs/ artifacts/` |
| `publish.yml` | ✅ có sẵn, kiểm version↔tag, chạy test, build, `check_dist_contents`, `twine check`, kiểm token |

**Lưu ý nhỏ (không chặn):** `check_dist_contents.py` **crash trên Windows console** — `UnicodeEncodeError` vì `print()` tiếng Việt có dấu ra cp1252. Với `PYTHONIOENCODING=utf-8` thì `exit 0`. CI chạy `ubuntu-latest` nên **không** bị. Nhưng đây đúng là bẫy đã ghi trong `AGENTS.md` (làm `migrate` thất bại giữa chừng) và là vi phạm tinh thần L-G01 (*cổng phải chạy được*). Sửa 1 dòng: `sys.stdout.reconfigure(encoding="utf-8")`.

---

## 4. Ba điều kiện còn lại trước khi phát hành

| # | Điều kiện | Trạng thái |
|:--|:--|:--|
| **P1** | **Commit bản vá** | ❌ `M cache.py`, `M logger.py`, `M test_cache_key.py` — **+235/−7, chưa commit** |
| **P2** | **Version mới** | ❌ `v3.7.1` **đã có tag** → trỏ `eeccdb8`, **không chứa bản vá**. Nên bump **`3.7.2`** |
| **P3** | **Credential PyPI** | ❌ Không có `.pypirc`, không có `PYPI_API_TOKEN`, không có `TWINE_USERNAME` |

**Tôi không tự làm P1/P2/P3.** Lý do:
- Working tree đang là **việc chưa commit của agent khác** — commit thay họ là vượt vai trò, và `AGENTS.md` cấm commit khi chưa được yêu cầu rõ.
- `vnbroker` đang ở nhánh `main`; `AGENTS.md` của hệ thống yêu cầu nhánh + PR, không commit thẳng.
- **Tôi không có token PyPI** ⇒ dù có muốn cũng không upload được.

---

## 5. Quyết định bạn cần chốt

### 5.1 Phát hành **công khai** hay **riêng tư**?

Đã kiểm PyPI thật: **`vnbroker` 3.5.0 đang công khai** (owner `vietdungiitb`, đăng 2026-10-07, `LicenseRef-Proprietary`).

- Nếu publish tiếp lên **public PyPI** ⇒ ai cũng `pip install vnbroker` được. Bản **3.5.0** đang công khai **không** chứa lỗi rò (lỗi bắt đầu từ 3.6.0 chưa phát hành) ⇒ **chưa từng rò secret nào ra công cộng**.
- Nếu muốn giữ riêng tư ⇒ dùng **TestPyPI** hoặc đổi tên gói. `publish.yml` đã hỗ trợ `target: testpypi` làm mặc định.

### 5.2 Đường nào cho `vninvest`?

vninvest hiện cài từ **GitHub private + PAT** (`requirements.txt:30` ghim SHA). Ba lựa chọn:

| | Cách | Đánh giá |
|:--|:--|:--|
| A | Giữ **Git SHA**, bump lên SHA có bản vá | **Khuyến nghị** — không đổi mô hình xác thực, không cần token PyPI, `Dockerfile` không đổi |
| B | Chuyển sang **public PyPI** (`vnbroker==3.7.2`) | Bỏ PAT, đơn giản hơn — nhưng phụ thuộc PyPI còn giữ tên này và bản quyền |
| C | **PyPI riêng tư** | Phải cấu hình index + token; thêm moving part |

**Khuyến nghị A cho lần này**, vì nó đúng với cơ chế đã chạy và không mở rộng bề mặt. B PyPI vẫn nên làm nếu mục tiêu là phân phối ra ngoài.

---

## 6. Còn tồn đọng (không chặn phát hành)

| ID | Mức | Vấn đề |
|:--|:-:|:--|
| **L-R06** | MINOR (đã hạ cấp) | `404` chưa map ở `equity.py::_get` và `::_write_request`. Sửa: cho `_write_request` dùng lại `raise_for_status()`. |
| **MA-32** | MINOR | `VERSION_REQUIREMENTS` đòi `vnii` cho 6 version, không khai, không cài. Sửa: **xoá** khỏi danh sách. |
| — | MINOR | `check_dist_contents.py` crash trên Windows cp1252 (CI không bị). |
| BL-4 / BL-5 | ⏳ | Mã nghiệp vụ write + idempotency — thuộc Hàng 3, khi mở R3 live trading. |
| MA-11/13/14/15/23/27 | ⏳ | Row 2. |

---

## 7. CHƯA XÁC MINH

| Hạng mục | Vì sao |
|:--|:--|
| `LiveBrokerContractTests` | Cần JWT thật SSI/TCBS |
| Probe DNSE/KBS/VCI thật | Không có credential trong phiên này |
| Test suite vninvest (baseline 602/10/3) | Cần Postgres |
| Dữ liệu `IntradayTick` production | Cần query DB — xác nhận bug lệch 7 giờ |
| `check_dist_contents` trên CI thật | Chưa trigger workflow (cần secret trong repo) |

---

## 8. Khuyến nghị

1. **Nghiệm thu bản vá** — đạt, không còn điều kiện kỹ thuật nào trên phía thư viện.
2. **Đính chính 2 mục trong báo cáo cũ của tôi** (mốc rò = v3.6.0; L-R06 hạ cấp) — đã ghi ở §0 và §2.2.
3. **Bump `3.7.2`**, commit trên nhánh, mở PR. Nếu chỉ dùng nội bộ: **phát hành PyPI là tuỳ chọn**, không bắt buộc.
4. **Nếu phát hành PyPI**: cần bạn cấp `PYPI_API_TOKEN` (repo secret, đúng workflow hiện tại) **hoặc** tự chạy workflow. Tôi không có token và sẽ không tự lấy.
5. **Bump phía vninvest**: theo phương án A (Git SHA) — chưa cần chờ PyPI.
6. **Song song, không liên quan**: sửa timestamp lệch 7 giờ (`vnbroker_adapter.py:993-1000`). Lỗi này của vninvest, tồn tại ở mọi version.

---

*Bản nháp 2. Bổ sung vào `VERIFY_VNBROKER_371_UPGRADE_20261011.md`; đính chính phần đã sai ở `PROPOSAL_ADDENDUM_A_LESSONS_CROSSCHECK_20261011.md` §A.1.*