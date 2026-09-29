# TRACEABILITY MATRIX: AI STOCK ADVISORY SSOT UPGRADE
**Đường dẫn tài liệu:** `docs/ai-ssot/AI_STOCK_ADVISORY_SSOT_UPGRADE_TRACEABILITY_MATRIX_20260529.md`

Tài liệu này thiết lập mối liên kết chéo (Traceability) từ yêu cầu nghiệp vụ đến các cấu phần mã nguồn Backend, Frontend và ca kiểm thử tương ứng. Ma trận đồng thời phản ánh trạng thái coverage hiện tại: `implemented`, `partial` hoặc `gap`.

---

## Ma Trận Truy Xuất Nguồn Gốc Chi Tiết

| Mã Yêu Cầu | Yêu Cầu Nghiệp Vụ | Cấu Phần Backend (File & Method) | Cấu Phần Frontend (File & Component) | Tệp Kiểm Thử & Assertions |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-SSOT-01** | **Nguyên tắc SSOT**: Hợp nhất cấu hình `SystemAISettings` & `UserProfile` trên mỗi request. | `packages/core/backend/src/advisory/views.py` -> `AdvisoryRefreshView` <br> `_get_or_create_active_ai_settings()` | `packages/web/src/adapters/coreApiAdapter.js` -> `refreshAdvisory()` | `packages/core/backend/tests/test_advisory_ssot.py` <br> Assert: `effective_context` chứa model/language/api_key đúng. (`implemented`) |
| **REQ-MA-02** | **Multi-Agent Advisory**: Điều phối Technical, Flow và Sentiment Agents qua Orchestrator. | `packages/core/backend/src/advisory/orchestrator.py` -> `AdvisoryOrchestrator.run()` | `packages/web/src/pages/signals/ShellAiAdvisoryPage.js` | `packages/core/backend/tests/test_advisory_api_routes.py` <br> Assert: trigger refresh + pipeline chạy qua orchestrator task. (`partial`: chưa có assertion theo từng agent reasoning) |
| **REQ-TEN-03** | **Cách ly đa thuê bao (SaaS)**: Lọc tín hiệu cảnh báo cách ly theo `tenant_id` tại feed views. | `packages/core/backend/src/signal_intelligence/views.py` -> `AlertCenterFeedView` & `AIAlertsFeedView` | `packages/web/src/pages/workspace/ShellDashboardPage.js` | `packages/core/backend/tests/test_signal_intelligence_api_routes.py` <br> Assert: `test_alert_center_feed_tenant_isolation` xác thực `/core/v1/signals/alert-center/feed` không bleed chéo tenant. (`implemented`) |
| **REQ-BYOK-04** | **Khóa người dùng bảo mật**: Lưu mã hóa Fernet API Key trong `UserProfile.preferences`. | `packages/core/backend/src/identity_access/security.py` -> `encrypt_user_api_key()` & `decrypt_user_api_key()` | `packages/web/src/pages/system/ShellSettingsPage.js` | `packages/core/backend/tests/test_advisory_ssot.py` <br> Assert: key mã hóa Fernet, giải mã và truyền đúng vào `effective_context`. (`implemented`) |
| **REQ-RATE-05** | **Token Budget**: Rate limiting lượng token tiêu hao và Celery Task reset lúc 00:00. | `packages/core/backend/src/advisory/tasks.py` -> `reset_daily_token_budgets()` <br> `packages/core/backend/src/vninvest_core/settings.py` -> `CELERY_BEAT_SCHEDULE['reset-daily-token-budgets-0000']` | `packages/web/src/components/ShellPageTemplate.js` | `packages/core/backend/tests/test_advisory_api_routes.py`, `packages/core/backend/tests/test_advisory_tasks.py` <br> Assert: 429 khi vượt ngưỡng + reset counters về 0 + scheduler `crontab(hour=0, minute=0)` đã đăng ký. (`implemented`) |
| **REQ-CHAT-06** | **Chat đa lượt bối cảnh**: Lưu vết qua `AdvisorySession` và `AdvisoryComponent` chống AI ảo tưởng. | `packages/core/backend/src/advisory/models.py` -> `AdvisorySession` & `AdvisoryComponent` | `packages/web/src/pages/signals/ShellAiAdvisoryPage.js` -> Chat Interface | `packages/core/backend/tests/test_advisory_api_routes.py` <br> Assert: Đọc đúng context_snapshot để trả lời. |
| **REQ-UI-07** | **Dashboard Triad**: Layout kính mờ, Algo Breakdown và Risk Selector cập nhật preferences. | `packages/core/backend/src/identity_access/views_tenant.py` -> `UserProfileView` | `packages/web/src/pages/DashboardPage.js`, `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js`, `packages/web/src/features/dashboard/AIAdvisorAlertPanel.css` | `packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js` (`implemented`: panel đã mount vào lane AI runtime dashboard) |
| **REQ-KL-08** | **Nguyên tắc KLine Viewport**: Chỉ gán icon Cá mập cho top 10% volume trong visible viewport. | N/A (Client-side) | `packages/web/src/features/stock-detail/hooks/useViewportWhaleMarkers.js` + `packages/web/src/components/VNStockChartPanel.js` | `packages/web/src/features/stock-detail/__tests__/viewportWhaleMarkers.test.js` <br> Assert: bounds/count/zoom-pan updates cho top 10% viewport markers. (`implemented`) |
| **REQ-LANG-09** | **i18n Bản địa hóa**: Hỗ trợ tiếng Việt đầy đủ dấu trên tất cả các thông điệp UI/AI. | `packages/core/backend/src/advisory/views.py` -> `effective_context.language` | `packages/web/src/pages/commercial/BillingCenterPage.js` -> `useI18n()` | `packages/web/src/pages/auth/AuthPages.test.js` (`partial`: chưa có backend test chuyên biệt cho language propagation end-to-end) |

---

## Hướng Dẫn Sử Dụng Ma Trận

* **Đối với QA/QC**:
  - Sử dụng cột **Tệp Kiểm Thử & Assertions** theo trạng thái `implemented|partial|gap` để lên kế hoạch regression theo thứ tự ưu tiên rủi ro.
  - Ở phiên bản hiện tại, các gate REQ-TEN-03 và REQ-KL-08 đã có evidence test và implementation runtime; ưu tiên hồi quy lane advisory + alert-center theo smoke cycle chuẩn.
* **Đối với Tech Lead**: Khi tiến hành xem xét mã nguồn (Code Review) trước khi gộp nhánh, đối chiếu tệp code thay đổi với cột **Cấu phần Backend/Frontend** tương ứng để đảm bảo lập trình viên không sửa đổi sai phạm vi thiết kế và phát triển đúng cấu trúc thư mục SaaS-native `packages/core/` và `packages/web/`, tránh nhầm lẫn sang thư mục legacy.
