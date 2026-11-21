# AUDIT — TCBS có company events không (2026-11-21)

- **Scope**: sau DNSE (Entry 596), kiểm tra TCBS trong `vnbroker==3.8.2` có thay được VCI (đang 418) cho company events / corporate actions không.
- **Phương pháp**: read source đang cài trong container staging + chạy runtime với dummy token; chỉ kiểm tra **presence** của credential, không đọc giá trị.
- **Kết luận ngắn**: **Có `events()` và `dividends()` thật, nhưng KHÔNG có `corporate_actions()`**. Thiếu token và có 1 bug wrap lỗi trong 3.8.2.

## 1. BẰNG CHỨNG

| Kiểm tra | Kết quả thật |
|---|---|
| Env `TCBS_JWT_TOKEN` / `TCBS_AUTH_TOKEN` / `VNBROKER_TCBS_*` | **KHÔNG CÓ** trong `compose.staging.env` lẫn container |
| `TCBSCompany` methods | `events=True`, `dividends=True`, `corporate_actions=False` |
| `events(page_size, page)` | Gọi `GET /tcanalysis/v1/ticker/{symbol}/events-news` → `listEventNews` (`:374-414`) — **tin tức/sự kiện**, không phải bảng corporate action có field số |
| `dividends(page_size, page)` | Gọi `GET /tcanalysis/v1/company/{symbol}/dividend-payment-histories` → `listDividendPaymentHis` (`:469-503`) — **có field số** (đây là nguồn từng được kỳ vọng ở handoff R1) |
| `events()` với dummy token | `ProviderAuthError [PROVIDER_AUTH] Token hết hạn/không hợp lệ...` (kèm URL thật) — lỗi sạch, đúng thiết kế |
| `dividends()` với dummy token | **`TypeError: ProviderAuthError.__init__() missing 1 required keyword-only argument: 'http_status'`** — bug (xem §2) |
| Facade `Company(source='TCBS').corporate_actions()` | Method có nhưng `NotImplementedError: Source 'TCBS' does not support 'corporate_actions'` |

## 2. BUG TRONG 3.8.2 (cần báo vnbroker)

`explorer/tcbs/company.py:497-503` (bản cài):

```python
except Exception as exc:
    raise type(exc)(
        f"{exc}. Đối với TCBS dividends(), hãy đặt TCBS_JWT_TOKEN ..."
    ) from exc
```

`ProviderAuthError` (`core/exceptions.py:384-394`) khai `__init__(self, message, *, http_status, url=None, details=None)` — **`http_status` là keyword-only bắt buộc**. Việc tạo lại bằng `type(exc)(message)` ⇒ `TypeError`, **che mất thông báo hướng dẫn vừa thêm ở 3.8.2** (commit c3c028e) và cả lỗi auth gốc.

Đề xuất fix cho package team: giữ nguyên exception gốc, chỉ nối hướng dẫn vào `message` (hoặc truyền đủ `http_status=exc.http_status, url=exc.url, details=exc.details`). Ngắn gọn nhất:

```python
except ProviderAuthError as exc:
    exc.args = (f"{exc}. Hãy đặt TCBS_JWT_TOKEN ...",)
    raise
```

## 3. SO SÁNH NHANH 3 NGUỒN

| Nguồn | `events()` | `corporate_actions()` | Field số | Dùng được cho vninvest không |
|---|---|---|---|---|
| **VCI** | ✅ có data (snake_case `exright_date`) | ✅ 3.8.1+ (có bug `ex_date` ở 3.8.1, đã sửa 3.8.2) | ✅ parse từ title | **Đang dùng**, chỉ bị 418 tạm |
| **TCBS** | ✅ nhưng là news (`events-news`) | ❌ NotImplemented | ✅ riêng ở `dividends()` | Có thể bổ sung sau khi có JWT + map riêng; không phải thay thế trực tiếp |
| **DNSE** | ❌ rỗng hard-coded | ❌ NotImplemented | ❌ (chỉ account-scoped) | Không (Entry 596) |

## 4. ĐIỀU CÒN THIẾU ĐỂ DÙNG TCBS

1. **`TCBS_JWT_TOKEN`** (ưu tiên — `TCBS_AUTH_TOKEN` là mã 48 ký tự bị server từ chối 401, xử lý sẵn ở `auth.py:42-55`). Owner cung cấp qua secret manager, **không ghi vào repo**.
2. **Sửa bug TypeError** ở `dividends()` (phía vnbroker, slice mới).
3. **Quyết định map field**: `dividends()` trả schema riêng (`exercise_date`, amount...), không phải contract 14 cột của `corporate_actions()`. Cần slice ingest riêng + test song song, giữ VCI làm chính.
4. Kiểm tra độ sâu lịch sử / phân trang (`page_size`, `page`) — `dividends()` mặc định 15 dòng/trang, cần loop.

## 5. GATES

- Verify source + runtime 3.8.2: ✅
- Env/credential presence: ✅ (không đọc giá trị)
- Doc-only, không đổi code/migration; full BE/FE **CHƯA CHẠY** (không liên quan).

**Lessons**: `[L-V01, L-V02, L-E02]` — phân biệt "có method" với "có dữ liệu"; báo bug kèm file:line + đề xuất fix; không đọc secret.
