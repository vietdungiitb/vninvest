# Kế Hoạch Nâng Cấp Hệ Thống Trợ Lý Tư Vấn AI - Tuân Thủ Tuyệt Đối Nguyên Tắc SSOT
**Đường dẫn tài liệu:** `docs/ai-ssot/KE_HOACH_NANG_CAP_HE_THONG_TRO_LY_TU_VAN_AI_SSOT_20260528.md`

Tài liệu này cập nhật kế hoạch rà soát và nâng cấp tính năng AI Alert & Advisor dựa trên nguyên tắc SSOT (Single Source of Truth), tích hợp sâu sắc với Trung tâm quản lý AI hiện tại của hệ thống VNInvest (bao gồm cấu hình toàn hệ thống `SystemAISettings` và cấu hình tài khoản người dùng `UserProfile`).

---

## 1. Nguyên Tắc Thiết Kế SSOT Cho Cấu Hình AI

Hệ thống VNInvest hiện tại đã có một trung tâm quản lý cấu hình AI hoàn chỉnh. Bất kỳ nâng cấp nào cho AI Alert & Advisor đều phải tuân thủ luồng phân cấp cấu hình SSOT sau:

```text
+---------------------------------------------------------------------------------+
|                       SYSTEM AI SETTINGS (System-wide SSOT)                     |
|  - Cấu hình mặc định toàn hệ thống (Default model: GPT-4o-mini / Gemini Flash) |
|  - Tham số cơ bản: temperature, max_tokens, prompt_template                     |
|  - Bộ quy tắc kiểm soát định mức Token hàng ngày (max_tokens)                   |
+---------------------------------------------------------------------------------+
                                         |
                                         v [Hợp nhất / Ghi đè]
+---------------------------------------------------------------------------------+
|                       USER PROFILE / USERCONFIG (Account SSOT)                  |
|  - Ngưỡng kích hoạt lệnh cá mập cá nhân (whale_alert_threshold)                 |
|  - Tùy chọn hiển thị, ngôn ngữ tư vấn (language: vi/en)                         |
|  - Cấu hình khóa nhà cung cấp riêng (BYOK - mã hóa bảo mật Fernet)              |
+---------------------------------------------------------------------------------+
                                         |
                                         v [Nguồn cấu hình duy nhất]
+---------------------------------------------------------------------------------+
|                       CORE MULTI-AGENT ADVISORY GENERATOR                       |
|  - Không hardcode mô hình, prompts hoặc thresholds trong code.                  |
|  - Đọc cấu hình hợp nhất trên mỗi yêu cầu (request) để điều phối tác nhân.     |
+---------------------------------------------------------------------------------+
```

### Các khoảng cách trôi lệch (Drift) cấu hình hiện tại
- **Frontend tự xử lý logic**: Hook `useAIAdvisor.js` ở client-side tự định nghĩa các tham số `rsiTrim`, `rsiBuild` trong code, vi phạm nguyên tắc SSOT.
- **Backend Mock bỏ qua AI Config**: Logic sinh components và summary hiện tại ở backend (`stock_mgmt_native_views.py`) tạo dữ liệu tĩnh mà hoàn toàn không đọc qua `SystemAISettings` hay `UserProfile` để chọn AI provider hoặc prompt tương ứng.

---

## 2. Lộ Trình Nâng Cấp Tích Hợp Hệ Thống (Sát Kiến Trúc SSOT)

Chúng tôi thiết lập lộ trình 5 giai đoạn, đặt cấu hình AI của hệ thống làm trái tim điều hướng dòng xử lý.

### Giai Đoạn 1: Đồng Bộ Hóa Mô Hình Thực Thể & Stateful Delivery
* **Mục tiêu**: Khóa các thực thể dữ liệu an toàn cho per-user delivery.
* **Nội dung**:
  - Đảm bảo các bảng dữ liệu `MarketAnomalyEvent`, `AdvisorySignalEvent`, `UserAlertDelivery`, `UserAlertPreference` được thiết lập hoàn chỉnh ở `packages/core/backend/src/signal_intelligence/models.py`.
  - Xây dựng bộ lọc Delivery: khi có tín hiệu toàn cục, hệ thống sẽ đọc `UserProfile.whale_alert_threshold` và danh mục Holdings/Watchlist của từng tài khoản cụ thể để lọc và phân phát chính xác vào `UserAlertDelivery`. Áp dụng cách ly đa thuê bao nghiêm ngặt bằng cách lọc theo `tenant_id` của `UserProfile`.

### Giai Đoạn 2: Tích Hợp Multi-Agent Core Vào Trung Tâm Quản Lý AI (Chuẩn Fernet)
* **Mục tiêu**: Loại bỏ hoàn toàn mock logic, kích hoạt Gemini/OpenAI thông qua cấu hình SSOT và bảo vệ an toàn thông tin BYOK.
* **Nội dung**:
  - Triển khai mã hóa đối xứng khóa BYOK cá nhân bằng **chuẩn Fernet** đồng bộ với hệ thống tại `identity_access/security.py`, ném lỗi giải mã rõ ràng khi gặp khóa giả mạo hoặc sai lệch.
  - Khi người dùng bấm Refresh AI Advisory hoặc hệ thống tự động chạy, luồng xử lý tại `AdvisoryRefreshView` sẽ:
    - **Bước 1**: Gọi hàm `_get_or_create_active_ai_settings()` để lấy cấu hình hệ thống hiện hành (LLM mặc định, temperature, system prompt template).
    - **Bước 2**: Đọc `UserProfile` của tài khoản yêu cầu để kiểm tra cấu hình ngôn ngữ (vi/en) và giải mã an toàn API Key BYOK cá nhân.
    - **Bước 3**: Hợp nhất cấu hình trên thành bối cảnh thực thi duy nhất (Effective AI Context) truyền vào `AdvisoryOrchestrator` để điều phối tác nhân.

### Giai Đoạn 3: Chuẩn Hóa API Hợp Đồng OpenAPI & Phân Phối Tín Hiệu (DRF Generic)
* **Mục tiêu**: Đồng bộ họ route theo đúng spec `/core/v1/signals/*` và `/core/v1/advisory/*`.
* **Nội dung**:
  - Chuyển đổi toàn bộ API giao tiếp sang cấu trúc mới:
    - `GET /core/v1/signals/alert-center/feed` (Dùng `ListAPIView` chuẩn để phân trang tự động).
    - `GET /core/v1/signals/alert-center/symbols/{symbol}/context` (Truy xuất bối cảnh snapshot của phiên).
    - `GET /core/v1/signals/ai-alerts/feed` (Xem lane tư vấn AI riêng biệt).
    - `POST /core/v1/advisory/refresh/{symbol}/` (Route kích hoạt refresh thủ công riêng biệt).
  - Tích hợp cơ chế kiểm soát định mức Token (Token Budget Control) dựa trên cấu hình giới hạn trong `SystemAISettings` nhằm bảo vệ hạ tầng API, trả về `429 Too Many Requests` khi quá hạn ngạch.
  - Lên lịch Celery task `reset_daily_token_budgets` chạy định kỳ lúc 00:00 UTC+7 để đặt lượng tiêu thụ token hàng ngày của tất cả tài khoản về `0`.

### Giai Đoạn 4: Trò Chuyện Trực Tiếp Dựa Trên Bối Cảnh (Conversational SSOT)
* **Mục tiêu**: Cung cấp trải nghiệm chat trợ lý thông minh đa lượt.
* **Nội dung**:
  - Sử dụng model `AdvisorySession` và `AdvisoryComponent` để lưu vết hội thoại.
  - Khi người dùng gửi câu hỏi trong phiên chat, backend sẽ nạp `context_snapshot` kết hợp cùng `SystemAISettings.prompt_template` để sinh câu trả lời bám sát thực tế thị trường lúc đó, loại bỏ hoàn toàn hiện tượng AI tự suy diễn sai lệch.

### Giai Đoạn 5: Nâng Cấp Trực Quan Dashboard (UI Triad Alignment)
* **Mục tiêu**: Đồng bộ giao diện với dữ liệu gốc của server, tạo trải nghiệm đẳng cấp quốc tế trên cấu trúc SaaS-native `packages/web/`.
* **Nội dung**:
  - Xóa bỏ hook tự tổng hợp `useAIAdvisor.js` ở frontend. `AIAdvisorAlertPanel.jsx` (nằm tại `packages/web/src/features/dashboard/`) sẽ đọc dữ liệu trực tiếp từ `coreApiAdapter.js` qua API `/core/v1/signals/ai-alerts/feed`.
  - Tăng cường thiết kế giao diện:
    - **Hiệu ứng Neon Glassmorphism**: Hiển thị thẻ tín hiệu thông minh. Viền thẻ tự động nhấp nháy phát sáng (neon glow) dựa trên chỉ số RSI nguy hiểm (emerald pulse khi RSI cực thấp / rose pulse khi RSI cực cao) đọc từ dữ liệu server.
    - **Bảng Phân Tích Logic Chi Tiết (Algo Breakdown)**: Hiển thị trực quan tham số RSI và thanh đo cường độ Whale Flow khi click vào thẻ.
    - **Khung nhìn 10% KLine**: Nhúng hook `useViewportWhaleMarkers` vào biểu đồ KLineChart của trang Stock Detail (`packages/web/src/features/stock-detail/`), đảm bảo chỉ hiển thị icon Cá mập cho top 10% nến có volume lớn nhất nằm trong visible viewport.

---

## 3. Kế Hoạch Xác Minh (Verification Plan)

### 3.1 Kiểm Thử Tự Động (Automated Tests)
Các tệp test mới phải được đặt trực tiếp dưới thư mục `packages/core/backend/tests/`:
- `packages/core/backend/tests/test_advisory_ssot.py`: Xác minh luồng hợp nhất cấu hình giữa `SystemAISettings` và `UserProfile`, đảm bảo cấu hình người dùng ghi đè chính xác và mã hóa/giải mã Fernet chuẩn hoạt động trơn tru.
- `packages/core/backend/tests/test_advisory_api_routes.py`: Xác minh cơ chế chặn cuộc gọi (cooldown rate-limiting) và chặn token budget vượt định mức khi gọi refresh POST.
- `packages/core/backend/tests/test_signal_intelligence_api_routes.py`: Xác minh bộ lọc cách ly cảnh báo đa thuê bao hoạt động chính xác dựa trên `tenant_id`.

### 3.2 Xác Minh Thủ Công (Manual Verification)
- **Kiểm tra cấu hình Hệ thống**: Vào Django Admin, thay đổi prompt template hoặc giảm `max_tokens` của `SystemAISettings` xuống cực thấp (ví dụ: 50). Thực hiện refresh tư vấn và xác nhận backend ghi nhận lỗi vượt giới hạn hoặc phản hồi đúng prompt mới.
- **Kiểm tra cấu hình Tài khoản**: Thay đổi ngôn ngữ tư vấn trong `UserProfile` sang tiếng Anh (`en`). Xác nhận các khuyến nghị tư vấn AI mới được trả về bằng tiếng Anh.
- **Kiểm tra tính tương tác**: Đổi khung nhìn (zoom/pan) trên biểu đồ KLineChart trang Stock Detail, xác nhận số lượng Icon Cá mập thay đổi động và luôn khớp đúng tỷ lệ 10% số nến hiển thị trong viewport.
