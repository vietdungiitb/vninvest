# Code Quality Constitution

1. **No Print()**: Backend không dùng `print()`, dùng `logging`.
2. **No Secret Log**: Không được log password hay credential vào file log (bắt buộc filter).
3. **No Legacy Import**: Web frontend cấm import từ `../frontend/` cũ. API cấm import từ `../backend/` cũ.
4. **Idempotency**: Mọi background task xử lý queue/event phải có lock DB (`select_for_update`) hoặc Redis lock chống double-execution.
5. **No Hardcode Secrets**: Giao diện không hardcode API Keys, secrets lấy từ Env hoặc cấu hình qua UI an toàn.
6. **HMAC Pepper**: Bắt buộc sử dụng Django `SECRET_KEY` làm pepper khi hash hoặc mã hóa các tài sản nhạy cảm (như Token, API Keys).
