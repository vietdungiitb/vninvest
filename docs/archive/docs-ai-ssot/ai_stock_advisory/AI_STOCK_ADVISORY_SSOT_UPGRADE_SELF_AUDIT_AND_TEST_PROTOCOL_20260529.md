# SELF AUDIT & TEST PROTOCOL: AI STOCK ADVISORY SSOT UPGRADE
**Đường dẫn tài liệu:** `docs/ai-ssot/AI_STOCK_ADVISORY_SSOT_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260529.md`

Tài liệu này hướng dẫn chi tiết cách thức thực hiện kiểm thử tự động, kiểm tra bảo mật tĩnh (Security Audit) và kịch bản xác minh thủ công để nghiệm thu tính năng.

---

## 1. Thiết Kế Kiểm Thử Tự Động (Automated Test Specs)

Lập trình viên phải triển khai đầy đủ các ca kiểm thử mới và tích hợp chúng một cách đồng bộ trong bộ test của core nằm tại thư mục `packages/core/backend/tests/`:

### 1.1 Kiểm Thử Hợp Nhất Cấu Hình SSOT (`test_advisory_ssot.py`)
* **Mục tiêu**: Đảm bảo cấu hình hệ thống (`SystemAISettings`) và hồ sơ người dùng (`UserProfile`) được hợp nhất chính xác, cấu hình người dùng ghi đè được cấu hình hệ thống ở các tùy chỉnh tương ứng.
* **Tệp test**: `packages/core/backend/tests/test_advisory_ssot.py`
* **Kịch bản kiểm thử**:
  1. Khởi tạo một bản ghi `SystemAISettings` có tên `'default'`, mô hình mặc định `'gpt-4o-mini'`, system prompt mặc định `'He thong tu van chung khoan'`.
  2. Khởi tạo một `UserProfile` cho `UserA` có tùy chỉnh ngôn ngữ `'en'` và trường `preferences` chứa API Key BYOK cá nhân đã được mã hóa Fernet.
  3. Mô phỏng hành động gọi API Refresh `POST /core/v1/advisory/refresh/FPT/` bằng `APIClient`.
  4. Thực hiện Mock phương thức chạy tác nhân `AdvisoryOrchestrator.run` để đánh giá tham số truyền vào:
     ```python
     from unittest.mock import patch
     with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
         response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
         # Lấy tham số Effective AI Context được truyền sang Orchestrator
         effective_context = mock_run.call_args[0][0]
     ```
  5. **Khẳng định (Assertions)**:
     - `self.assertEqual(effective_context['ai_model'], 'gpt-4o-mini')` (Đọc đúng cấu hình hệ thống).
     - `self.assertEqual(effective_context['language'], 'en')` (Ghi đè thành công ngôn ngữ từ UserProfile).
     - `self.assertEqual(effective_context['api_key'], decrypted_key)` (Giải mã chuẩn mã hóa Fernet chính xác).

### 1.2 Kiểm Thử Giới Hạn & Định Mức Token (`test_advisory_api_routes.py` + `test_advisory_tasks.py`)
* **Mục tiêu**: Ngăn chặn người dùng thực hiện cuộc gọi tư vấn khi lượng token tiêu thụ vượt ngưỡng cấu hình trong ngày.
* **Kịch bản kiểm thử**:
  1. Đặt `SystemAISettings.max_tokens = 1000`.
  2. Tạo một `AdvisorySession` của `UserA` có `tokens_used = 1200`.
  3. Gửi yêu cầu Refresh tư vấn tại endpoint refresh của hệ thống: `POST /core/v1/advisory/refresh/FPT/` (Route thực thi POST thay vì feed GET).
  4. **Khẳng định (Assertions)**:
     - Kiểm tra mã phản hồi HTTP trả về phải là `429 Too Many Requests`.
     - Kiểm tra payload có trường `token_budget` và `tokens_used`.
     - Kiểm tra task `reset_daily_token_budgets` reset `AdvisorySession.tokens_used` và `UserProfile.preferences.daily_tokens_used` về `0`.

### 1.3 Kiểm Thử Cách Ly Tenant Tín Hiệu (`test_signal_intelligence_api_routes.py`)
* **Mục tiêu**: Xác minh dữ liệu cảnh báo không bị lộ chéo giữa các thuê bao (SaaS Tenant Isolation).
* **Tệp test**: `packages/core/backend/tests/test_signal_intelligence_api_routes.py`
* **Kịch bản kiểm thử**:
  1. Tạo `TenantA` và `TenantB`.
  2. Tạo `UserA` (thuộc `TenantA`) và `UserB` (thuộc `TenantB`).
  3. Khởi tạo cảnh báo `Alert1` có thuộc tính `tenant_id = TenantA.id` và `Alert2` có `tenant_id = TenantB.id`.
  4. Tạo bản ghi phân phát `UserAlertDelivery` cho `UserA` với `Alert1` và `Alert2`.
   5. Đăng nhập tài khoản `UserA`, gọi API `GET /core/v1/signals/alert-center/feed`.
   6. **Khẳng định (Assertions)**:
       - `self.assertEqual(response.status_code, 200)`
       - Chỉ chứa dữ liệu cùng tenant của `UserA`, tuyệt đối không chứa dữ liệu tenant khác.
* **Evidence trạng thái hiện tại**: test `test_alert_center_feed_tenant_isolation` đã được bổ sung và xác thực route `/core/v1/signals/alert-center/feed` không có cross-tenant bleed.

---

## 2. Kịch Bản Xác Minh Thủ Công (Manual Verification Protocols)

Đội ngũ QA/QC thực hiện xác minh thủ công theo các bước sau trong môi trường Stagging/Local:

### 2.1 Giả lập Thay Đổi Cấu Thiết Hệ Thống (Django Admin Audit)
1. Truy cập vào **Django Admin** -> Mục **System AI Settings**.
2. Sửa đổi `SystemAISettings.prompt_template` thành: `"Bạn là một chuyên gia phân tích kỹ thuật, hãy bắt đầu câu trả lời bằng mã định danh [VNINVEST-AI]."`
3. Nhấn lưu cấu hình.
4. Ra ngoài Dashboard phần AI Advisor, thực hiện gọi POST bằng cách nhấn nút **Refresh AI Recommendation** cho mã chứng khoán bất kỳ (ví dụ: `SSI`).
5. **Kỳ vọng đạt**: Kết quả tư vấn AI hiển thị trên màn hình phải bắt đầu chính xác bằng cụm từ `[VNINVEST-AI]`, chứng minh backend đã đọc trực tiếp cấu hình SSOT từ DB mà không thông qua cache cũ hay hardcode prompt.

### 2.2 Giả lập Thay Đổi Khẩu Vị Đầu Tư (Risk Profile Switching)
1. Trên giao diện Dashboard, chọn **Risk Profile Selector** đổi từ chiến lược `'Cơ bản'` sang chiến lược `'Mạo hiểm'`.
2. Kiểm tra database, xác nhận trường `UserProfile.preferences['risk_strategy']` đã được cập nhật thành công thành `'aggressive'`.
3. Nhấp chọn xem chi tiết một cảnh báo dòng tiền cá mập.
4. **Kỳ vọng đạt**: Phần giải luận phân tích kỹ thuật Algo Breakdown hiển thị các phân tích dòng tiền tập trung vào biên độ dao động giá rộng và chỉ số dòng tiền nóng, khớp với định nghĩa chiến lược mạo hiểm trong prompt template của `SystemAISettings`.

### 2.3 Kiểm Tra Biểu Tượng Cá Mập 10% Khung Nhìn (KLine Viewport Audit)
1. Truy cập trang Stock Detail của mã chứng khoán bất kỳ trong packages/web. Tải toàn bộ lịch sử 100 nến giao dịch.
2. Cuộn (zoom/pan) biểu đồ KLineChart để thay đổi khung nhìn hiển thị (ví dụ: từ hiển thị 10 nến lên 40 nến).
3. **Kỳ vọng đạt**:
   - Khi hiển thị 10 nến: Chỉ có duy nhất **1 nến** (10% của 10 nến trong khung nhìn) hiển thị Icon Cá mập.
   - Khi cuộn hiển thị 40 nến: Số lượng nến có Icon Cá mập thay đổi động và tăng lên thành **4 nến** có volume giao dịch lớn nhất hiện hữu trong khung nhìn.
   - Không xuất hiện hiện tượng hiển thị tĩnh Icon Cá mập trên toàn bộ 100 nến khi cuộn.

---

## 3. Danh Mục Rà Soát Mã Nguồn Tĩnh (Static Code Audit)

Lập trình viên và Tech Lead thực hiện rà soát các lỗi chống mẫu (anti-patterns) sau trong mã nguồn:

- [ ] **Chống mẫu 1**: Sử dụng trực tiếp chuỗi thô khóa API trong mã nguồn thay vì gọi `decrypt_user_api_key(preferences['api_key'])` sử dụng chuẩn Fernet đã giải mã bảo mật.
- [ ] **Chống mẫu 2**: Sử dụng câu lệnh SQL thô (`raw SQL`) không lọc `tenant_id` để truy xuất cảnh báo. Tất cả truy vấn phải dùng ORM: `.filter(alert__tenant_id=profile.tenant_id)`.
- [ ] **Chống mẫu 3**: Tự tính toán rsiTrim hay rsiBuild ở frontend. Mọi logic tính toán RSI và Whale Flow cường độ đều được xử lý và trả về từ Backend API.
