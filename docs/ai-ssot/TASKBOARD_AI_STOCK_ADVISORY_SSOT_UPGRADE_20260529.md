# TASKBOARD & CHECKLIST: AI STOCK ADVISORY SSOT UPGRADE
**Đường dẫn tài liệu:** `docs/ai-ssot/TASKBOARD_AI_STOCK_ADVISORY_SSOT_UPGRADE_20260529.md`

Tài liệu này đóng vai trò là bảng điều khiển tiến độ và danh mục kiểm tra nghiệm thu (Checklist) dành cho đội ngũ lập trình viên tiếp nhận và triển khai công việc.

---

## 1. Bảng Nhiệm Vụ Tổng Quan (WBS Taskboard)

```text
+---------------------------------------------------------------------------------------------------------+
|                                          TASKBOARD TIẾN ĐỘ                                              |
+-------------------------------------------------------+-------------------------------------------------+
| [ ] GIAI ĐOẠN 1: Đồng Bộ Thực Thể & Stateful Delivery  | [ ] GIAI ĐOẠN 4: Trò Chuyện Bám Sát Ngữ Cảnh    |
|   - Thiết lập Delivery Filter và per-user delivery     |   - Thiết lập AdvisorySession chat đa lượt      |
|   - Tích hợp UserProfile.whale_alert_threshold        |   - Ngăn chặn AI tự suy diễn bằng context       |
+-------------------------------------------------------+-------------------------------------------------+
| [ ] GIAI ĐOẠN 2: Multi-Agent Tích Hợp SSOT             | [ ] GIAI ĐOẠN 5: Giao Diện Cao Cấp Dashboard    |
|   - Triển khai Effective AI Context Merging           |   - Xây dựng AIAdvisorAlertPanel Glassmorphism  |
|   - Tích hợp Fernet mã hóa khóa bảo mật BYOK          |   - Nhúng hook useViewportWhaleMarkers 10%      |
+-------------------------------------------------------+-------------------------------------------------+
| [ ] GIAI ĐOẠN 3: Chuẩn Hóa API OpenAPI & Token Budget |                                                 |
|   - Chuyển đổi route theo spec /core/v1/signals/*      |                                                 |
|   - Viết Celery Task tự động reset token hàng ngày     |                                                 |
+-------------------------------------------------------+-------------------------------------------------+
```

---

## 2. Danh Mục Kiểm Tra Chi Tiết (Dev Checklist)

### Giai Đoạn 1: Đồng Bộ Hóa Mô Hình Thực Thể & Stateful Delivery
- [ ] **1.1** Đảm bảo các bảng cơ sở dữ liệu `MarketAnomalyEvent`, `AdvisorySignalEvent`, `UserAlertDelivery`, `UserAlertPreference` được ánh xạ đầy đủ trong các migration database của core (`packages/core/backend/src/signal_intelligence/models.py`).
- [ ] **1.2** Viết hàm lọc phân phát tín hiệu: Khi có sự kiện thị trường, đối chiếu với ngưỡng `UserProfile.whale_alert_threshold` của từng cá nhân để ghi nhận bản ghi vào `UserAlertDelivery`.
- [x] **1.3** Thực hiện cách ly hoàn toàn đa thuê bao: Tất cả các truy vấn lấy tín hiệu của người dùng phải áp dụng bộ lọc Tenant (`UserProfile.tenant_id`), không truy vấn chéo giữa các Tenant.

### Giai Đoạn 2: Tích Hợp Multi-Agent Core Vào Trung Tâm Quản Lý AI (SSOT)
- [ ] **2.1** Triển khai hàm `_get_or_create_active_ai_settings()` để truy xuất chính xác bối cảnh mặc định hệ thống.
- [ ] **2.2** Đọc ghi đè từ `UserProfile.language` và `UserProfile.preferences` (cho cấu hình BYOK).
- [ ] **2.3** Triển khai mã hóa đối xứng bằng **chuẩn Fernet** cho khóa API của người dùng trước khi lưu xuống trường `preferences` (sử dụng `AI_CREDENTIAL_FERNET_KEY` env var hoặc key derived từ `settings.SECRET_KEY`).
- [ ] **2.4** Báo lỗi và ghi log bảo mật rõ ràng khi giải mã thất bại thay vì nuốt lỗi âm thầm.
- [ ] **2.5** Đảm bảo `AdvisoryOrchestrator` nhận cấu hình hợp nhất và kích hoạt các tác nhân (Technical, Flow, Sentiment) theo đúng prompt template cấu hình trong `SystemAISettings`.

### Giai Đoạn 3: Chuẩn Hóa API OpenAPI & Kiểm Soát Định Mức
- [ ] **3.1** Quy hoạch lại toàn bộ API sang cấu trúc mới trong `packages/core/backend/src/signal_intelligence/urls.py` và `advisory/urls.py`:
  - `GET /core/v1/signals/alert-center/feed` (Dùng lớp `AlertCenterFeedView` kế thừa `UserScopedAlertFeedBaseView` để thừa hưởng Cursor Pagination và Tenant Isolation).
  - `GET /core/v1/signals/alert-center/symbols/{symbol}/context` (Truy cập bối cảnh snapshot của mã chứng khoán tại `AlertCenterSymbolContextView`).
  - `GET /core/v1/signals/ai-alerts/feed` (Xem lane tư vấn AI chuyên biệt tại `AIAlertsFeedView`).
  - `POST /core/v1/advisory/refresh/{symbol}/` (Route kích hoạt refresh thủ công riêng biệt tại `AdvisoryRefreshView`).
- [ ] **3.2** Viết Celery Task `reset_daily_token_budgets` để reset toàn bộ `AdvisorySession.tokens_used` và `daily_tokens_used` của người dùng về `0`.
- [x] **3.2a** Bổ sung bằng chứng scheduler cho task reset trong `CELERY_BEAT_SCHEDULE` (00:00 UTC+7) hoặc tài liệu quyết định vận hành tương đương nếu chưa bật schedule production.
- [ ] **3.3** Tích hợp Token Budget Control: Kiểm tra lượng token đã dùng trong ngày của `AdvisorySession` trước khi cho phép gọi LLM, nếu vượt hạn mức hệ thống lập tức chặn và trả về lỗi `429 Too Many Requests`.

### Giai Đoạn 4: Trò Chuyện Trực Tiếp Bám Sát Bối Cảnh
- [ ] **4.1** Tích hợp hai thực thể `AdvisorySession` và `AdvisoryComponent` phục vụ chat trợ lý thông minh đa lượt.
- [ ] **4.2** Lưu vết bối cảnh snapshot thị trường (`context_snapshot`) trong phiên chat để làm mỏ neo thông tin cho Prompt, ngăn chặn AI suy diễn sai lệch.

### Giai Đoạn 5: Nâng Cấp Trực Quan Dashboard (UI Triad Alignment)
- [x] **5.1** Xóa bỏ hook gán cứng `useAIAdvisor.js` ở frontend.
- [x] **5.2** Tạo mới `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js` + `.css`, kết nối trực tiếp vào API `/core/v1/signals/ai-alerts/feed` và mount vào runtime dashboard.
- [x] **5.3** Triển khai hiệu ứng **Neon Glassmorphism** nhấp nháy phát sáng dựa trên chỉ số RSI cực đoan từ server (emerald pulse khi RSI thấp, rose pulse khi RSI cao).
- [x] **5.4** Tạo mới hook `packages/web/src/features/stock-detail/hooks/useViewportWhaleMarkers.js` và test `packages/web/src/features/stock-detail/__tests__/viewportWhaleMarkers.test.js`, đã nhúng vào KLine runtime tại `packages/web/src/components/VNStockChartPanel.js` để đảm bảo **chỉ hiển thị icon Cá mập cho top 10% nến có volume lớn nhất nằm trong viewport hiện hành**.
- [x] **5.7** Baseline dashboard đã được nâng cấp: `AIAdvisorAlertPanel.js` đang chạy trong lane AI của `packages/web/src/pages/DashboardPage.js`.
- [x] **5.5** Bản địa hóa i18n toàn bộ các nhãn chữ tiếng Việt có đầy đủ dấu.
- [x] **5.6** Tuyệt đối cấm phát triển tệp tin mới vào thư mục `/frontend` cũ đã deprecated. Mọi tệp code frontend mới bắt buộc phải nằm trong cấu trúc SaaS-native `packages/web/src/`.

---

## 3. Cổng Chất Lượng PR Gate (Quality Gates)

Trước khi tạo Pull Request (PR) bàn giao mã nguồn lên nhánh chính, lập trình viên phải tự kiểm tra và xác nhận các điều kiện sau:

| Tiêu Chí Đánh Giá | Mô Tả Yêu Cầu | Kết Quả Tự Đánh Giá |
| :--- | :--- | :--- |
| **1. Zero Hardcoding** | Mô hình AI, tham số nhiệt độ, prompt template và các ngưỡng kỹ thuật tuyệt đối không viết cứng trong code. | `[ ] ĐẠT` |
| **2. Multi-Tenant Isolation** | Không có bất kỳ truy vấn chéo nào giữa các tenant khác nhau. Bộ lọc `tenant_id` được áp dụng cho mọi lệnh SELECT/UPDATE liên quan cảnh báo. | `[ ] ĐẠT` |
| **3. BYOK Secure Fernet Encryption** | API Key của người dùng được mã hóa bằng chuẩn Fernet trước khi lưu vào DB. Không có khóa nào lộ bản rõ trong log. | `[ ] ĐẠT` |
| **4. Viewport 10% Rule** | Biểu tượng Cá mập trên KLineChart tuân thủ nghiêm ngặt nguyên tắc 10% nến lớn nhất trong visible viewport. | `[ ] ĐẠT` |
| **5. Test Coverage >= 80%** | Toàn bộ các bộ test tự động kiểm thử luồng hợp nhất SSOT, kiểm soát token budget và bộ lọc cảnh báo đều chạy thành công. | `[ ] ĐẠT` |
| **6. i18n Localization** | Mọi nhãn hiển thị mới hỗ trợ tiếng Việt có dấu đầy đủ và chuẩn xác. | `[x] ĐẠT` |
