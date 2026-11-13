# Audit độc lập — `docs/PLAN_WIDGET_BACKEND_ROADMAP_20261113.md` rev 1

Ngày: 2026-11-13 · Base verify: `80ceaf6ff` (khớp `git log` tip) · Kết quả: **NEED_REVISION**

## Spot-check inventory §1 (4/4 mục kiểm)

| Mục plan | Kết quả |
|---|---|
| R1: ws-ticket 0 hit; `?token=` live ở `consumers.py:52-83,130-155` | **ĐÚNG** (`grep ws_ticket` trong `identity_access/` = 0 hit; `token=` ở `signal_intelligence/consumers.py:57,71-79,130,145-151`) |
| R2: depth rỗng trung thực `native_views.py:452-472` | **ĐÚNG sostanza, SAI nhẹ line** (class mở ở `:452`; payload rỗng `bids/asks: []` ở `:464-472`, `note: orderbook_not_available` `:471`) |
| R5: helper `fetch_symbol_group_members()` có | **ĐÚNG** (`market_data/vnbroker_adapter.py:840`, body tới ~`:925`) |
| R9: "chưa verify `/api/auth/token/refresh/` có serve không" | **SAI một phần — đóng được ngay bằng đọc code**: `identity_access/api_urls.py:18` định nghĩa `auth/token/refresh/` + `vninvest_core/urls.py:79` mount `identity_access.api_urls` ở prefix `api/` ⇒ route **CÓ serve** |

## Claim-conflict S1–S3/S8

- S1 (`identity_access/urls.py`, `consumers.py`, NEW `views_ws_ticket.py`): **không claim `in-progress` nào giữ** — tự do.
- S2/S3/S8 runtime files: **không bị giữ**. `w0-10` đã `done` (`:1833`, PR #283 merged); `pm-audit-fix-plan` (`:1884`) `in-progress` nhưng **doc-only**, không trùng file runtime.
- Deny-list: **sạch** (plan chỉ chạm docs + NEW views/test + `core_urls.py`; không shared-file, không migration ở phiên plan). Lessons: **có ghi** (`L-001,002,003,007,008,M02,V01,V02` ở header).

## Objections (bắt sửa trước khi duyệt)

- **O1 — S2 né `market_data/urls.py` vì "w0-2 in-progress đang giữ để xóa": STALE.** `w0-2` đã `done` (`:1844`, PR #284 — kết luận GIỮ code, không xóa). Hơn nữa `core_urls.py:44` vẫn `from .urls import shared_urlpatterns` ⇒ né `urls.py` mà sửa `core_urls.py` là **né ảo**, coupling còn nguyên. Sửa: bỏ lý do w0-2, ghi rõ S2 vẫn phụ thuộc `urls.py` qua import.
- **O2 — R9/S3(a) "verify curl staging": thừa.** Đọc code đã trả lời (xem bảng trên). Sửa: đổi S3(a) thành "đã verify bằng đọc code; chỉ curl smoke nếu muốn".
- **O3 — Viện dẫn `w0-10 giữ partner_urls/views_tenant`: STALE.** `w0-10` đã `done` (`:1833`); S1–S3/S8 cũng không chạm 2 file này. Sửa: xóa viện dẫn, ghi "không conflict".
- **O4 (minor) — line R2:** sửa `:452-472` thành `:452-472 (payload rỗng :464-472)` cho chính xác.

Không phát hiện thêm rủi ro chặn. Sau khi sửa O1–O3, plan đủ điều kiện duyệt làm spec doc-only.
