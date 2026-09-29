# EVIDENCE TEMPLATE: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_EXECUTION_EVIDENCE_TEMPLATE_20260524`  
**Ngày lập**: 24-05-2026  
**Trạng thái**: CHỜ ĐIỀN THÔNG TIN (DEVELOPER RUN TEMPLATE)  
**Phạm vi**: Backend API Service (`packages/core`)  

---

## BẰNG CHỨNG THỰC THI & KIỂM THỬ THÀNH CÔNG (EVIDENCE TRAIL)

Tài liệu này được điền bởi nhà phát triển trong quá trình code và kiểm thử thực tế để làm căn cứ phê duyệt PR lên môi trường sản xuất.

---

## 1. NHẬT KÝ DI CƯ CƠ SỞ DỮ LIỆU (DATABASE MIGRATION LOG)
*Nhà phát triển dán kết quả apply migration tạo bảng SystemMailConfig, OutboxEvent và ProcessedEvent vào đây:*

```bash
python manage.py migrate --noinput
# [DÁN KẾT QUẢ RUN LỆNH DI CƯ VÀO ĐÂY]
# Ví dụ:
# Applying identity_access.0008_systemmailconfig_outboxevent... OK
```

---

## 2. KẾT QUẢ CHẠY TEST SUITE TỰ ĐỘNG (AUTOMATED TEST MATRIX OUTPUT)
*Nhà phát triển dán kết quả chạy thành công 100% test suite nâng cao vào đây:*

```bash
python manage.py test tests.test_register_upgrade --keepdb --verbosity 2
# [DÁN TOÀN BỘ KẾ HỘI ĐỒNG RUN TEST VỚI TRẠNG THÁI OK VÀO ĐÂY]
```

---

## 3. BẰNG CHỨNG PHÒNG THỦ SPAM & DYNAMIC MAIL ROUTER
*Nhà phát triển dán log console của Celery worker và API handler chứng minh việc chặn spam thành công và gửi mail động thành công qua SMTP hoặc Google Gmail API:*

```bash
# Log block Honeypot
# [DÁN LOG CẢNH BÁO BẮT BOT HONEYPOT Ở ĐÂY]

# Log block email rác
# [DÁN LOG BLOCK DISPOSABLE EMAIL Ở ĐÂY]

# Log gửi mail động qua Google Gmail API thành công
# [DÁN LOG DECRYPT CREDENTIALS VÀ SEND_MAIL THÀNH CÔNG VỚI SUBJECT IMPERSONATION Ở ĐÂY]
```

---

## 4. XÁC NHẬN CHẤT LƯỢNG (DEVELOPER SIGN-OFF)

- **Developer Name**: `[Tên của nhà phát triển thực thi]`
- **Date**: `[Ngày hoàn thành]`
- **PR Link**: `[Đường dẫn Pull Request]`
- **Verdict**: `✅ READY FOR STAGING REVIEW`
