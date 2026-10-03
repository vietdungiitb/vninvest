# HANDOFF MASTER: AI STOCK ADVISORY SSOT UPGRADE
**Phiên bản:** 1.3.0 (Production-Ready Verified)  
**Ngày cập nhật:** 2026-05-29  
**Trạng thái:** Sẵn sàng production sau xác minh test + runtime (Production-Ready Verified)  
**Mục tiêu:** Nâng cấp hệ thống AI Alert & Advisor trên Dashboard dự án VNInvest đạt tiêu chuẩn quốc tế, tuân thủ tuyệt đối nguyên tắc SSOT, cách ly đa thuê bao (SaaS Tenant Isolation) và bảo mật theo chuẩn Fernet của dự án.

---

## 1. Giới Thiệu Feature Pack

Feature Pack **AI Stock Advisory SSOT Upgrade** được thiết kế nhằm đồng bộ hóa toàn bộ các hoạt động xử lý, phân phối tín hiệu cảnh báo (`AI Alerts`) và phân tích khuyến nghị (`AI Advisor`) về một nguồn chân lý cấu hình duy nhất:
1. **SystemAISettings (Global SSOT)**: Cấu hình mặc định toàn hệ thống do Operator quản trị qua Django Admin.
2. **UserProfile (Account SSOT)**: Tùy chỉnh cá nhân hóa của người dùng (ngôn ngữ, ngưỡng lệnh cá mập, chiến lược đầu tư) và cấu hình khóa riêng (BYOK - Bring Your Own Key).

Mọi quyết định sinh nội dung AI, lọc tín hiệu cảnh báo, hay đếm token định mức đều phải được điều phối thông qua sự hợp nhất của hai cấu hình trên, loại bỏ hoàn toàn các logic gán cứng (hardcode) tại Client-side hoặc Mock-data tại Server-side.

---

## 2. Bản Đồ Tài Liệu Bàn Giao (Feature Pack Catalog)

Để đội ngũ lập trình viên có đầy đủ bối cảnh và hướng dẫn chi tiết nhất, bộ tài liệu này bao gồm 5 cấu phần cốt lõi được liên kết chặt chẽ với nhau sử dụng liên kết di động (portable relative links):

| STT | Tài Liệu Bàn Giao | Nội Dung Chi Tiết | Đường Dẫn Tệp |
| :--- | :--- | :--- | :--- |
| 1 | **Handoff Master** | Tài liệu định hướng chung, danh mục tài liệu và chỉ dẫn kỹ thuật bàn giao. | [AI_STOCK_ADVISORY_SSOT_UPGRADE_HANDOFF_MASTER_20260529.md](AI_STOCK_ADVISORY_SSOT_UPGRADE_HANDOFF_MASTER_20260529.md) |
| 2 | **Tech Spec & Designs** | Tài liệu thiết kế kiến trúc chi tiết cho cả Backend (Multi-Agent, BYOK, Tenant Isolation) và Frontend (Neon Triad Dashboard, Viewport-based KLine). | [TECH_SPEC_AI_STOCK_ADVISORY_SSOT_UPGRADE_20260529.md](../tech_spec_ai/TECH_SPEC_AI_STOCK_ADVISORY_SSOT_UPGRADE_20260529.md) |
| 3 | **Taskboard & Checklist** | Phân rã công việc chi tiết theo 5 giai đoạn, kèm checklist nghiệm thu kỹ thuật cụ thể. | [TASKBOARD_AI_STOCK_ADVISORY_SSOT_UPGRADE_20260529.md](../taskboard_ai_stock/TASKBOARD_AI_STOCK_ADVISORY_SSOT_UPGRADE_20260529.md) |
| 4 | **Self Audit & Test Protocol** | Bộ nguyên tắc kiểm thử tự động, kịch bản xác minh thủ công, giả lập trôi lệch và bảo mật khóa BYOK. | [AI_STOCK_ADVISORY_SSOT_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260529.md](AI_STOCK_ADVISORY_SSOT_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260529.md) |
| 5 | **Traceability Matrix** | Ma trận truy xuất nguồn gốc liên kết từ Yêu cầu nghiệp vụ -> Tệp Code Backend -> Tệp Code Frontend -> Tệp Test tương ứng. | [AI_STOCK_ADVISORY_SSOT_UPGRADE_TRACEABILITY_MATRIX_20260529.md](AI_STOCK_ADVISORY_SSOT_UPGRADE_TRACEABILITY_MATRIX_20260529.md) |

---

## 3. Chỉ Dẫn Kỹ Thuật Quan Trọng (Hard Constraints)

Đội ngũ lập trình viên **bắt buộc** phải tuân thủ các quy tắc bất biến sau trong suốt quá trình triển khai:

1. **Không Hardcode mô hình/Prompt**: Tuyệt đối không viết cứng tên model (như `'gpt-4o-mini'`) hay chuỗi Prompt vào mã nguồn. Luôn đọc từ trường `SystemAISettings.ai_model` và `SystemAISettings.prompt_template`.
2. **Cách Ly Đa Thuê Bao (SaaS Tenant Isolation)**: Mọi truy vấn đọc tín hiệu cảnh báo hoặc cập nhật tùy chọn người dùng đều phải thông qua thuộc tính `user.core_profile.tenant_id`. Nghiêm cấm truy vấn chéo dữ liệu giữa các tenant khác nhau.
3. **Bảo Mật BYOK (Bring Your Own Key)**: Khóa API cá nhân lưu trong `UserProfile.preferences` phải được mã hóa bảo mật sử dụng **chuẩn Fernet** đồng bộ với chuẩn hóa credentials hiện hành trong hệ thống tại `identity_access/models.py`. Tuyệt đối không tự ý dùng mã hóa tùy biến kém an toàn hoặc lưu bản rõ của khóa người dùng xuống cơ sở dữ liệu.
4. **Quy Tắc Khung Nhìn 10% KLine (Viewport-based Whale Marker)**: Biểu tượng Cá mập (Whale Marker) trên KLineChart của trang Stock Detail chỉ được gán động cho **top 10% nến có volume giao dịch cá mập lớn nhất hiện đang nằm trong viewport của người dùng**, thay vì tính toán tĩnh trên toàn bộ mảng dữ liệu lịch sử tải về.
5. **Đồng Bộ i18n Tiếng Việt**: Toàn bộ các thông điệp phản hồi mới từ AI hoặc từ hệ thống trên UI phải hỗ trợ đa ngôn ngữ đầy đủ dấu thông qua module i18n của hệ thống.
6. **Không Phát Triển Trên Thư Mục Legacy**: Mọi tệp code frontend mới hoặc chỉnh sửa bắt buộc phải nằm trong `packages/web/` và backend mới nằm trong `packages/core/`. Tuyệt đối không phát triển hay lưu trữ file vào thư mục `frontend/` hoặc `backend/` cũ đã bị deprecated.

---

## 4. Trạng Thái Chuyển Giao & Điều Kiện Bắt Đầu (Handoff Conditions)

Tính năng này đã đạt trạng thái **Production-Ready Verified** với evidence triển khai và validation như sau:
- **Kiểm thử liên hợp (Traceability Audit)**: Đã có đầy đủ evidence cho các gate chính gồm `test_alert_center_feed_tenant_isolation`, `viewportWhaleMarkers.test.js`, suite advisory/token budget và các suite frontend regression liên quan.
- **Tương thích Endpoint**: Panel AI dashboard đang đọc từ lane `/core/v1/signals/ai-alerts/feed`; route advisory refresh tiếp tục dùng `POST /core/v1/advisory/refresh/<symbol>/`.
- **Runtime verification**: `start_dev.ps1` build + up thành công, smoke check `Core API health: OK` và `Frontend health: OK`.
