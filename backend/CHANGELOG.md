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
