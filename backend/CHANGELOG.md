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
