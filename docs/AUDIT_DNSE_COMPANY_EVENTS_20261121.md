# AUDIT — DNSE có phải nguồn thay thế cho company events không (2026-11-21)

- **Scope**: VCI đang trả 418 (rate-limit sau bulk backfill). Kiểm tra DNSE trong `vnbroker==3.8.2` (package đang cài trong container staging) có đảm nhận được `events()` / corporate actions cho vninvest hay không.
- **Phương pháp**: read-only probe — đọc source đang cài (`/usr/local/lib/python3.13/site-packages/vnbroker/...`), chạy thật trong `vninvest-core-api`, kiểm tra env/DB/DNS/TLS. **Không đọc/ghi giá trị secret** (chỉ presence).
- **Kết luận ngắn**: **Không.** DNSE thiếu 3 thứ và kể cả có đủ thì `events()` vẫn rỗng theo thiết kế. Xem bảng "Còn thiếu gì" ở cuối.

## 1. BẰNG CHỨNG RUNTIME

| Kiểm tra | Kết quả thật |
|---|---|
| Version | `3.8.2` (đúng pin `requirements.txt:38`) |
| Env `DNSE_API_KEY` / `DNSE_API_SECRET` | **KHÔNG CÓ** trong `compose.staging.env` và container. Chỉ có `DNSE_CREDENTIAL_FERNET_KEY` (dùng giải mã credential lưu trong DB) |
| `UserDNSECredential` trong DB | **0 dòng** — không có credential người dùng để tái sử dụng |
| `DNSECompany('VNM')` không truyền key | `ValueError: DNSE cần api_key và api_secret. Đặt biến môi trường DNSE_API_KEY và DNSE_API_SECRET ...` (`explorer/dnse/company.py:171`) |
| `DNSECompany('VNM', api_key='dummy', api_secret='dummy').events(from_date='20100101')` | **0 dòng**, 11 cột: `symbol, event_code, event_name, public_date, record_date, exright_date, issue_date, cash_dividend, stock_dividend, ratio, note` (`:257-265` — `_log_fallback` + `_empty_df`, **hard-coded empty**, không gọi API) |
| `hasattr(DNSECompany, 'corporate_actions')` | `False` |
| `Facade(source='DNSE').corporate_actions(...)` | Method **có** (`api/company.py:184`, `@dynamic_method`) nhưng ném `NotImplementedError: Source 'DNSE' does not support 'corporate_actions'` |
| `DNSEClient.get_corporate_action_history` | Có, chữ ký `(account_no, market_type, from_date, to_date, dry_run, raw)` (`connector/dnse/client.py:743` → `services/account_service.py:56`) |
| Endpoint | 3.8.2 **đã sửa path** từ `/accounts/{no}/corporate-actions` (404) sang `/accounts/{no}/corporate-action-history`; docstring ghi đo production **200** với token thật |
| DNS/TLS từ staging | `103.151.242.24`, TLS 1.3 thành công, `GET /` → 404 (root endpoint — bình thường). ⇒ **không còn blocker TLS** như ghi chú cũ 2026-10-10 |

## 2. PHÂN TÍCH

### 2.1 `events()` — không thể dùng

`explorer/dnse/company.py` mở đầu ghi rõ: *"DNSE OpenAPI does not provide company information endpoints. Returns empty DataFrames with proper schema to maintain API compatibility."* Method `events()` chỉ gọi `_log_fallback()` rồi trả `_empty_df(_EVENTS_COLUMNS)`. **Không có tham số nào làm nó gọi API** — truyền `from_date`, `event_codes` đều vô nghĩa. Dù có credentials thật, vẫn 0 dòng.

### 2.2 `corporate_actions()` — có vỏ, không có implementation

Facade (`api/company.py:184`) dùng `@dynamic_method`: chỉ delegate sang provider nếu provider có method cùng tên. DNSE provider không có ⇒ `NotImplementedError`. Đây là hành vi **đúng** (fail loudly, không trả frame rỗng lừa client) — nhưng cũng có nghĩa DNSE không thay được VCI.

### 2.3 `get_corporate_action_history` — có thật nhưng sai mục đích

- Path đã được sửa ở 3.8.2 và đo 200 production (tiến bộ so với audit cũ) — **nhưng** vẫn là API **theo tài khoản** (`account_no`), trả lịch sử corporate action của **một tài khoản chứng khoán cụ thể**, không phải feed thị trường cho mọi mã.
- Để gọi cần: `DNSE_API_KEY` + `DNSE_API_SECRET` + `account_no` + `market_type`. Staging không có 2 biến đầu, DB không có credential, và vninvest không có account_no DNSE của người dùng nào trong ngữ cảnh backend.
- SDK hỗ trợ thêm `symbol`/`caType`/`caStatus`/`pageIndex`/`pageSize` nhưng docstring ghi rõ **chưa thêm** vì "không có defect đo được" — tức thư viện chưa expose lọc theo mã.

## 3. CÒN THIẾU GÌ ĐỂ CHẠY COMPANY EVENTS QUA DNSE

| # | Thứ còn thiếu | Có thể có không | Ghi chú |
|---|---|---|---|
| 1 | `DNSE_API_KEY` | ❌ không có trên staging; cần owner đăng ký `https://developers.dnse.com.vn/` | Chỉ presence được kiểm tra, không đọc giá trị |
| 2 | `DNSE_API_SECRET` | ❌ tương tự | Cặp với key |
| 3 | `account_no` + `market_type` | ❌ backend không có; đây là dữ liệu tài khoản cá nhân | Chỉ cần nếu dùng `get_corporate_action_history` |
| 4 | Implementation `DNSECompany.corporate_actions()` / `events()` có data | ❌ **không thể chỉ bằng credentials** — provider upstream không có endpoint công khai | Đây là lý do quyết định, không phải cấu hình |

⇒ Kể cả bổ sung (1)+(2), `events()` vẫn trả rỗng và `corporate_actions()` vẫn `NotImplementedError`. Chỉ (3) + (4) mới cho dữ liệu, mà (4) thuộc phạm vi **vnbroker package team**, không phải vninvest.

## 4. ĐỀ XUẤT

1. **Không chuyển ingest sang DNSE** — VCI vẫn là nguồn duy nhất khả thi cho company events. VCI đang 418 tạm thời; chờ hết chặn rồi chạy lại với `countdown=2s` (Entry 595).
2. **Không request DNSE credentials** cho mục đích này — vô ích vì provider không có endpoint.
3. Nếu sau này cần đối chiếu chéo cho **một tài khoản cụ thể**, yêu cầu owner cung cấp key/secret + account_no qua secret manager, rồi gọi trực tiếp `DNSEClient.get_corporate_action_history` (không đi qua facade `events()`). Đây là use case khác, không thay feed thị trường.
4. Gửi vnbroker team: confirm không có plan implement `corporate_actions()` cho DNSE; nếu có, cần method market-wide chứ không phải account-scoped.

## 5. GATES

| Gate | Kết quả |
|---|---|
| Verify source + runtime 3.8.2 | ✅ read + chạy thật |
| Env/DB credential presence | ✅ kiểm tra presence, không đọc secret |
| DNS/TLS | ✅ 103.151.242.24, TLS 1.3 OK |
| Code changes / migrations | **KHÔNG** — audit read-only |
| Full BE/FE | **CHƯA CHẠY** (không liên quan; doc-only) |

**Lessons**: `[L-V01, L-V02, L-E02]` — mọi kết luận kèm lệnh/evidence; không khẳng định "DNSE hỏng" khi thực tế là "chưa có credentials + upstream không có endpoint"; không đọc giá trị secret.
