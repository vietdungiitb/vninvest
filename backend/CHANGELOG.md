## Ghi chú thay đổi ngày 04/04/2026

- Thay thư viện `vnstock3>=0.3.0.9` bằng fork tùy chỉnh `vnstock @ git+https://github.com/vietdung-edusuccess/vnstock.git@main` trong `backend/requirements.txt`.
- Phiên bản runtime hiện tại được cài từ branch `main` của fork `vietdung-edusuccess/vnstock`.
- Lý do: sử dụng bản fork riêng có các thay đổi chưa merge vào upstream.
- Cập nhật theo hướng thư viện nâng cấp throughput: bỏ monkey-patch bypass rate-limit trong `config/settings.py` và dùng đúng runtime từ thư viện.
- Bổ sung dependency `asyncio-throttle>=1.0.2` trong `backend/requirements.txt` (yêu cầu mới từ bản vnstock nâng cấp).
- Bổ sung endpoint `GET /api/health/prefetch/` để theo dõi trạng thái ticker prefetch, metadata lần chạy gần nhất và sample cache hits.
- Mở rộng phạm vi symbol cho task `prefetch_ticker_price_board`: gom từ `TrackedSymbol`, `WatchlistItem`, `PriceAlertRule`, `Transaction`; hỗ trợ batch size và symbol limit qua biến môi trường.
- Bổ sung script `backend/start_stack.ps1` để khởi động nhanh backend + Celery worker + Celery beat trên Windows.
- Mở rộng `GET /api/admin-ops/stats/` với payload `ticker_prefetch` để admin theo dõi fast path cache-first ngay trong dashboard thống kê.
- Bổ sung endpoint `POST /api/admin-ops/prefetch/warm/` để staff trigger warm cache thủ công từ giao diện Admin Ops.
- Bổ sung retry/backoff riêng cho `prefetch_ticker_price_board` khi upstream trả `429 Too Many Requests`, đồng thời phản ánh trạng thái `retrying` trong metadata health.

---

## Ghi chú thay đổi ngày 03/04/2026

- Bổ sung model `Tài khoản gửi mail` trong Django admin để quản trị viên cấu hình SMTP trực tiếp trên hệ thống.
- Hỗ trợ chọn một cấu hình mail mặc định, lưu mật khẩu SMTP ở dạng ký/mã hóa theo `SECRET_KEY`, và gửi mail kiểm tra ngay từ trang quản trị.
- Thêm helper backend để các luồng gửi email sau này có thể dùng cấu hình mail đang active trong database thay vì phụ thuộc cứng vào `settings.EMAIL_*`.
- Đã chuyển auth flow từ `auto-login sau đăng ký` sang `verify email trước khi đăng nhập`, bao gồm endpoint `verify-email`, `resend-verification` và chặn JWT login cho tài khoản chưa xác thực.

---

## Ghi chú thay đổi ngày 31/03/2026

- Đã thực hiện các thao tác kiểm tra, migrate lại database để tạo bảng SubAccount.
- File db.sqlite3 không tồn tại hoặc đã bị xóa trước đó.
- Đã chạy migrate, hệ thống báo không có migration nào cần áp dụng.
- Nếu vẫn không thấy bảng SubAccount, cần kiểm tra lại migration hoặc tạo migration mới.

---
Nếu cần tạo migration mới:

```powershell
cd backend
.venv\Scripts\python.exe manage.py makemigrations
.venv\Scripts\python.exe manage.py migrate
```
