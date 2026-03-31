# Hướng dẫn tạo bảng SubAccount trong database

1. Kích hoạt môi trường ảo (nếu chưa kích hoạt):
   
   ```powershell
   & "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\Activate.ps1"
   ```

2. Di chuyển vào thư mục backend:
   
   ```powershell
   cd backend
   ```

3. Chạy lệnh migrate để tạo bảng SubAccount cùng các bảng khác:
   
   ```powershell
   python manage.py migrate
   ```

4. Kiểm tra lại database (db.sqlite3) để xác nhận bảng SubAccount đã được tạo.

---

Nếu gặp lỗi, hãy kiểm tra lại models.py và các file migration. Nếu cần tạo migration mới:

```powershell
python manage.py makemigrations
python manage.py migrate
```

Nếu vẫn gặp vấn đề, hãy liên hệ để được hỗ trợ thêm.