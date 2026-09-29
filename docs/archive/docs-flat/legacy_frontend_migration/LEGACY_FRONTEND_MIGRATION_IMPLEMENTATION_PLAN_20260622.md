# Kế Hoạch Refactor & Di Trú Toàn Diện: Legacy Frontend sang SaaS Native (`packages/web`) — LIVE AUDIT

* **Ngày lập:** 2026-06-22  
* **Ngày cập nhật:** 2026-06-22 (Live Audit — cập nhật theo codebase thực tế)  
* **Trạng thái:** Live Audit — phần lớn công việc đã hoàn thành. Kế hoạch này được cập nhật để phản ánh hiện trạng thực tế và tập trung vào các hạng mục còn lại.  
* **Phạm vi áp dụng:** Web Frontend Workspace (`packages/web/`) & Core API Gateway  
* **Tài liệu tham chiếu phản biện:** `REVIEW_LEGACY_FRONTEND_MIGRATION_PLAN_V2_20260622.md`

---

## 1. Tóm Tắt Dự Án (Executive Summary)

Dự án di trú nhằm mục đích chuyển dịch toàn bộ các trang nghiệp vụ, component dùng chung, hệ thống gọi API và cơ sở hạ tầng thời gian thực từ thư mục legacy `frontend/` (CRA Webpack) sang phân hệ SaaS Native `packages/web/` (React Vite TypeScript). 

Việc chuyển dịch này sẽ loại bỏ hoàn toàn mô hình Hybrid hiện tại, thiết lập `packages/web/` làm host duy nhất, tối ưu hóa tốc độ build CI/CD và đảm bảo tính nhất quán 100% về mặt công nghệ theo chuẩn SaaS độc lập.

> **⚠️ Ghi chú Live Audit (2026-06-22):** Phần lớn công việc được mô tả trong kế hoạch gốc đã hoàn thành trước thời điểm soạn thảo kế hoạch này. Tài liệu dưới đây đã được cập nhật để phản ánh hiện trạng codebase thực tế. Timeline 32 ngày ước lượng trở thành tham khảo lịch sử; các mục còn lại ước tính **~5 ngày làm việc** tập trung vào legacy admin pages, shadow run, CI/CD parity gate, và dọn dẹp.

---

## 2. Phân Bổ Nhân Sự & Ma Trận Trách Nhiệm (RACI)

### 2.1 Kế Hoạch Nguồn Lực Cân Bằng (Balanced Resource Plan)
> **⚠️ Live Audit:** Phần lớn công việc phát triển đã hoàn thành trước khi tài liệu này được soạn thảo. Phân bổ nhân sự dưới đây mang tính tham khảo lịch sử. Công việc còn lại tập trung vào:
> *   Legacy Admin Core pages (8 trang): cần convert JSX → TSX.
> *   Shadow Run + Parity Gate validation (3 ngày).
> *   Dọn dẹp thư mục legacy `frontend/` sau khi đạt Pre-Decommission Gates.

Để giảm thiểu rủi ro quá tải cho nhân sự và tránh tạo ra các "critical path blocker", nguồn lực dự án được tái cấu trúc như sau:
*   **01 Senior Frontend Developer (Chuyên trách 100%):** Chịu trách nhiệm hạ tầng cốt lõi (Context, WebSocket, AuthProvider), tích hợp VNStockCharts KLine engine, và porting 2 trang phức tạp nhất: `StockDetailPage` & `WatchlistPage`. — ✅ **Đã hoàn thành.**
*   **01 Mid-level Frontend Developer (Thuê ngoài/Contractor hoặc Điều chuyển nội bộ - Chuyên trách 100%):** Phụ trách porting 38 API adapters và gộp 9 trang Admin Core thành 1 module quản trị lớn. — ⚠️ **API adapters đã xong (20 files). Admin Core 8 pages còn thiếu TSX.**
*   **01 Junior/Mid Frontend Developer (Chuyên trách 100%):** Phụ trách porting các trang UI còn lại (ScreenerPage, SOCPage, Support, Portfolios, Transactions, UserSettings, AICommandCenter). — ✅ **Đã hoàn thành (tất cả đều có TSX).**
*   **01 DevOps Engineer (Bán chuyên trách - 30% thời gian):** Phụ trách CI/CD pipeline, Dockerfile, Nginx proxy, và setup môi trường Shadow Run. — ✅ **CI/CD, Dockerfile, Nginx compose đã cấu hình xong. Shadow Run còn lại.**
*   **01 QA Engineer (Chuyên trách 50% thời gian):** Thiết lập Playwright test scenarios, visual regression testing, và thực hiện accessibility/performance audits. — ✅ **Playwright spec files đã có (2 files test/visual).**

### 2.2 Ma Trận RACI (RACI Matrix)

| Giai đoạn | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GĐ 0:** Foundation | Lead Frontend Developer | Tech Lead | Security Auditor | Team Dev | ✅ Xong |
| **GĐ 1:** API Adapter | Mid-level Frontend Dev | Tech Lead | Backend Engineer | QA Team | ✅ Xong |
| **GĐ 2:** Context & WS | Senior Frontend Dev | Tech Lead | Core API Architect | Product Owner | ✅ Xong |
| **GĐ 3:** UI & Routing | Team Dev (Senior/Mid/Jun) | Tech Lead | UI/UX Designer | Product Owner | ⚠️ Gần xong (thiếu Admin Core 8 trang) |
| **GĐ 4:** Packaging | DevOps Engineer | Tech Lead | Release Engineer | Team Dev | ✅ Xong |
| **GĐ 5:** Shadow Run | DevOps / QA Team | Product Owner | Tech Lead | Toàn bộ team | ❌ Chưa làm |
| **GĐ 6:** Cutover | Lead Frontend Developer | Tech Lead | CTO / Product Owner | Toàn bộ team | ❌ Chưa làm |

---

## 3. Rà Soát Hiện Trạng & Phân Tích Sự Thiếu Hụt (Gap Analysis)

### 3.1 Bản Đồ Di Trú Trang Giao Diện (Pages) & Quản Lý Rủi Ro Phụ Thuộc

> **📋 Live Audit (2026-06-22):** Tất cả các trang đã có TSX tương ứng. `pageRegistry.js` import chính xác vào `.tsx`. Build TypeScript pass 0 lỗi. Bảng dưới đây đã cập nhật trạng thái thực tế.

| # | Route | Legacy Page | Trạng thái SaaS (thực tế) | Component phụ thuộc | Mức độ rủi ro | Ghi chú Live Audit |
| :- | :- | :- | :- | :- | :- | :- |
| 1 | `/login` | `Auth/Login` | ✅ `auth/AuthLoginPage.tsx` | `Card`, `Button` | Thấp | ✅ Hoàn thành. Build pass. |
| 2 | `/register` | — | ✅ `auth/AuthRegisterPage.tsx` | `Card`, `Button` | Thấp | ✅ Hoàn thành. |
| 3 | `/verify-email` | `VerifyEmail.jsx` | ✅ `auth/AuthVerifyEmailPage.tsx` | `Card` | Thấp | ✅ Hoàn thành. |
| 4 | `/reset-password` | `ResetPassword.jsx` | ✅ `auth/AuthResetPasswordPage.tsx`| `Card` | Thấp | ✅ Hoàn thành. |
| 5 | `/dashboard` | `PackageDashboardHost.jsx`| ✅ `workspace/ShellDashboardPage.tsx` + `DashboardPage.tsx` | `SmartStatsHeader`, `PortfolioHeatmap`, `FactsFirstModularPositionDeck` | Trung bình | ✅ Hoàn thành. Cả baseline (shell) và core (native) đều có TSX, route trỏ đúng. |
| 6 | `/watchlist` | `Watchlist.jsx` (79KB) | ✅ `workspace/ShellWatchlistPage.tsx` + `WatchlistPage.tsx` | `TrackedThresholdCell`, `Sparkline`, `RealtimeFeed` | Cao | ✅ Hoàn thành. Cả shell và core đều có TSX. |
| 7 | `/stocks/:symbol`| `StockDetail.jsx` (141KB) | ✅ `market/ShellStockDetailPage.tsx` + `StockDetailPage.tsx` | `VNStockChartPanel`, `OrderFlowRadarPanel`, `StockOrderBookWidget`, `StockExecutionLogWidget` | Rất cao | ✅ Hoàn thành. `ShellStockDetailPage.tsx` được route chính. |
| 8 | `/portfolios` | `PortfolioManagement.jsx` | ✅ `workspace/ShellPortfoliosPage.tsx` + `PortfoliosPage.tsx` | `PortfolioTable` | Trung bình | ✅ Hoàn thành. |
| 9 | `/transactions` | `Transactions.jsx` | ✅ `workspace/ShellTransactionsPage.tsx` + `TransactionsPage.tsx` | `TransactionForm` | Trung bình | ✅ Hoàn thành. |
| 10 | `/support` | `Support.jsx` | ✅ `SupportPage.tsx` + `system/ShellSupportPage.tsx` | `TicketForm` | Thấp | ✅ Hoàn thành. |
| 11 | `/screener` | `Screener.jsx` (17.9KB) | ✅ `ScreenerPage.tsx` | `ScreenerRulesTable`, `ScreenerResultGrid` | Trung bình | ✅ Hoàn thành. |
| 12 | `/settings/ai` | `AICommandCenter.jsx` (73KB) | ✅ `AICommandCenterPage.tsx` + `system/ShellSettingsPage.tsx` + `system/ShellAiCommandCenterPage.tsx` | `PromptForm`, `ModelSelector` | Trung bình | ✅ Hoàn thành. |
| 13 | `/admin-crawl` | `AdminCrawlControl.jsx` | ✅ `AdminCrawlControlPage.tsx` | `StatusPill`, `JobsTable`, `RunsTable` | Trung bình | ✅ Hoàn thành. |
| 14 | `/whale-advisory`| `WhaleAdvisory.jsx` | ✅ `signals/ShellAiAdvisoryPage.tsx` + `signals/WhaleAdvisoryPage.tsx` | `AdvisoryCard`, `NewsSummary` | Trung bình | ✅ Hoàn thành. |
| 15 | `/operations` | `SOCPage.jsx` | ✅ `admin/ShellOperationsCenterPage.tsx` | `OperationsStats`, `HealthDashboard` | Cao | ✅ Hoàn thành. Shell page đã có TSX. |
| 16 | `/admin/core/*` | `AdminCore*.jsx` (8 pages) | ❌ `packages/web/src/pages/admin/` chỉ có 2 file (ShellOperationsCenterPage, ShellMailConfigPage). Thiếu 8 trang AdminCore | `TenantTable`, `PATTable`, `UsageChart`, `AuditTrace`, `Billing`, `Jobs`, `ServiceAccounts`, `Overview` | Cao | ⚠️ **Còn thiếu.** Cần convert 8 file từ `frontend/src/pages/admin/` sang TSX. Spec: `SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` |
| 17 | `/tenant-admin/*`| `TenantAdmin*.jsx` (8 pages) | ✅ `tenant-admin/TenantAdmin*.tsx` (8 pages: Home, Members, Billing, Capabilities, ServiceAccounts, PATs, Usage, AuditLogs) | `SSOConfigForm`, `BillingPortal` | Trung bình | ✅ Hoàn thành. Tất cả 8 trang tenant-admin đều đã là TSX. |

---

## 4. Lộ Trình Triển Khai & Thời Gian Ước Lượng (Timeline with 15% Buffer)

> **📋 Live Audit (2026-06-22):** 5/7 giai đoạn đã hoàn thành. Timeline gốc 32 ngày mang tính tham khảo lịch sử. Công việc còn lại ước tính **~5 ngày**.

| Giai đoạn | Công việc chính | Trạng thái thực tế | Estimate gốc | Remaining work |
| :--- | :--- | :--- | :--- | :--- |
| **GĐ 0:** Foundation | Đồng bộ token storage; Audit i18n keys; Sửa lỗi cú pháp adapter `coreApiAdapter({ env })` và sửa lỗi chính tả `coreApiReload()`. | ✅ **Hoàn thành.** `coreApiAdapter.js` đã hoạt động, có test, declaration. `coreApiReload` không tồn tại trong codebase. | **2 ngày** | 0 |
| **GĐ 1:** API Adapter | Porting API functions sang `adapters/core/`. Viết Unit Test. | ✅ **Hoàn thành.** 20 files trong adapters (15 core + 2 vip-app + facade + test + d.ts). 11 domain clients. | **7 ngày** | 0 |
| **GĐ 2:** Context & WS | AuthProvider + Realtime WebSocket Provider. | ✅ **Hoàn thành.** `ShellAuthProvider` (authReact.js), `RealtimeContext.js`, `useRealtimeFeedCore` hook. | **2 ngày** | 0 |
| **GĐ 3:** UI & Routing | Porting 17 trang giao diện. | ⚠️ **Gần xong.** 31 routes đã đăng ký trong `pageRegistry.js`. **Còn thiếu:** Admin Core 8 trang (Overview, Tenants, Billing, Usage, Jobs, AuditTrace, ServiceAccounts, PATs). | **14 ngày** | **~3 ngày** (convert 8 JSX → TSX) |
| **GĐ 4:** Packaging | Dockerfile, compose, CI/CD. | ✅ **Hoàn thành.** `packages/web/Dockerfile` (2-stage), docker-compose trỏ `packages/web/`, `web-ci.yml` + `web.yml` trong CI. | **2 ngày** | 0 |
| **GĐ 5:** Shadow Run | So khớp parity metrics 3 ngày. | ❌ **Chưa làm.** Playwright tests đã có (2 spec files). Cần deploy beta host và chạy gather parity metrics. | **4 ngày** | **~4 ngày** |
| **GĐ 6:** Cutover | Đổi compose context, dọn dẹp legacy. | ❌ **Chưa làm.** Compose context đã trỏ packages/web/ — phần lớn cutover đã xong âm thầm. Cần verify và dọn legacy. | **1 ngày** | **~1 ngày** |

---

## 5. Mini-Specifications cho Hạ Tầng Cốt Lõi (Giai đoạn 2)

> **📋 Live Audit (2026-06-22):** Tất cả hạ tầng mô tả trong section này đã được implement sẵn trong codebase. Các mini-spec dưới đây được giữ lại làm tài liệu tham khảo kiến trúc.

### 5.1 AuthProvider Mini-Specification
*   **Cơ chế Authentication:** Sử dụng Bearer Token gắn qua Header (`Authorization: Bearer <JWT>`). Do core-api hoàn toàn sử dụng cơ chế JWT không trạng thái (stateless), hệ thống **không cần** kiểm tra hoặc đính kèm `X-CSRFToken` cookie header khi thực hiện POST/PUT/DELETE.
*   **Quy trình Refresh Token tự động (Silent Refresh):**
    1.  Mỗi khi gọi API qua `coreApiAdapter`, lớp Transport sẽ kiểm tra thời gian hết hạn (expiry) của Access Token trong memory.
    2.  Nếu token còn thời hạn dưới **60 giây**, Transport sẽ chủ động dừng (suspend) hàng đợi request và kích hoạt một Promise refresh token (`POST /auth/token/refresh/`) bằng cách gửi Refresh Token từ LocalStorage.
    3.  Khi Promise thành công, cập nhật Access Token mới vào memory và tiếp tục thực thi hàng đợi.
    4.  Nếu Access Token đã hết hạn và gửi request bị trả về lỗi **401 Unauthorized**: Giao dịch viên sẽ retry tự động 1 lần sau khi chạy luồng refresh. Nếu refresh thất bại, xóa tokens và chuyển hướng người dùng về `/login`.
*   **Session Persistence & Multi-tab:** Sử dụng `storage` event listener để lắng nghe thay đổi của `access_token` trên các tab khác nhau. Khi một tab đăng xuất, toàn bộ các tab còn lại sẽ tự động xóa session và redirect.

### 5.2 RealtimeProvider Mini-Specification
*   **WebSocket Message Types:** Định nghĩa danh sách các bản tin đẩy realtime:
    *   `price_update`: Cập nhật giá live của mã chứng khoán trong viewport.
    *   `dark_flow`: Tín hiệu dòng tiền ẩn/giao dịch thỏa thuận quy mô lớn.
    *   `whale_alert`: Tín hiệu giao dịch cá mập kích hoạt theo ngưỡng thiết lập.
    *   `system_notification`: Thông báo từ Admin điều phối.
*   **Chiến lược kết nối lại (Reconnect Strategy):**
    *   Sử dụng **Exponential Backoff kết hợp Jitter** để tránh làm nghẽn server (Thundering Herd Problem).
    *   *Tham số:* Initial delay: `1s` ➔ Nhân đôi sau mỗi lần thất bại ➔ Max delay: `30s` ➔ Jitter: ngẫu nhiên cộng/trừ `0.1 * delay` giây.
*   **Heartbeat (Ping/Pong):**
    *   Cứ mỗi `25 giây`, client gửi một bản tin `{"type": "ping"}` lên server.
    *   Nếu trong vòng `10 giây` tiếp theo client không nhận được phản hồi `{"type": "pong"}`, client sẽ chủ động ngắt kết nối WebSocket hiện tại và kích hoạt quy trình Reconnect.

---

## 6. Quy Chuẩn Kỹ Thuật (Coding Constitutions) & Enforcement

> **📋 Live Audit (2026-06-22):** Quy chuẩn Hybrid Syntax Policy (6.1) được đề xuất nhưng **đã bị vượt qua bởi thực tế triển khai**. Tất cả file TSX trong codebase hiện tại đều dùng JSX (kể cả shell pages), và `tsc` build pass 0 lỗi với `jsx: "react-jsx"`. Không có ESLint rule `react/no-jsx` hay `react/prefer-jsx-in-tsx` nào được cấu hình. Khuyến nghị: **loại bỏ Hybrid Syntax Policy**, chấp nhận JSX làm chuẩn duy nhất cho toàn bộ packages/web.

### 6.1 (Deprecated) Hybrid Syntax Policy
* ~~**Định dạng createElement:** Bắt buộc áp dụng cho các file thuộc `pages/shell/`...~~
* ~~**Định dạng JSX:** Cho phép áp dụng ở tất cả các trang nghiệp vụ mới...~~
> **Kết luận:** Chỉ `coreShellPageHelpers.js` giữ lại `createElement` (vì là file JS utility). Mọi file TSX khác dùng JSX. Không cần policy phức tạp.

### 6.2 Cơ Chế Giám Sát Tự Động (Enforcement Mechanism)
> **⚠️ Chưa implement đầy đủ.** Cần cấu hình ESLint rules và pre-commit hooks nếu muốn enforce.
1.  **ESLint Configuration:** ❌ Chưa cấu hình. Hiện tại chỉ dùng `tsc --noEmit` để kiểm tra type.
2.  **Pre-commit Hook (Husky + lint-staged):** ❌ Chưa cấu hình. Commit có thể pass mà không qua lint.
3.  **i18n Hardcode Linter:** ❌ Chưa có scanner tự động. `i18next-scanner.config.js` tồn tại nhưng runtime dùng custom engine (không phải i18next), cần đồng bộ.

### 6.3 Security: HMAC Pepper Delivery Mechanism
> **⚠️ Chưa xác minh.** Cần audit codebase để kiểm tra xem cơ chế security handshake đã được implement trong `authReact.js` / `authRuntime.js` hay chưa. Token storage hiện tại cần review.

---

## 7. Kế Hoạch Xác Minh & Kiểm Thử Chi Tiết (Verification Plan)

> **📋 Live Audit (2026-06-22):** Playwright tests đã tồn tại nhưng chưa đầy đủ theo 4 luồng mô tả dưới đây.

### 7.1 Định Nghĩa 4 Luồng Playwright E2E Chính (Critical Flows)

| # | Luồng người dùng | Trang kiểm thử | Acceptance Criteria (Tiêu chí nghiệm thu) | Trạng thái |
|---|---|---|---|---|
| 1 | **Login & Dashboard Load** | `/login` ➔ `/dashboard` | Đăng nhập thành công ➔ Chuyển hướng ➔ Heatmap render đầy đủ ➔ Gọi API thành công không có lỗi 401. | ⚠️ `critical-pages.spec.ts` có visual regression cho dashboard nhưng chưa có test login flow. |
| 2 | **Stock Detail Workstation** | `/stocks/:symbol` | Render thành công biểu đồ KLineChart và Order Flow Radar ➔ Thay đổi session hoạt động chính xác ➔ Chọn nến hiển thị nhãn Whale Marker hợp lệ. | ✅ `stock-detail-workstation.spec.ts` (354 dòng) bao phủ tốt. |
| 3 | **Watchlist CRUD & Live Prices** | `/watchlist` | Tạo mới/xóa danh sách thành công ➔ Thêm/xóa symbol thành công ➔ Nhận dữ liệu cập nhật giá live qua WebSocket và cập nhật giao diện không bị giật lag. | ❌ Chưa có spec file. |
| 4 | **Screener & Export** | `/screener` | Thay đổi bộ lọc thành công ➔ Thực thi lọc ➔ Kết quả hiển thị đúng dạng Grid và phân trang hoạt động ổn định ➔ Export CSV không lỗi font chữ. | ❌ Chưa có spec file. |

### 7.2 Phương Pháp Xác Minh Mở Rộng

| Mục tiêu xác minh | Phương pháp thực hiện | Công cụ áp dụng | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Visual Regression** | Chụp ảnh giao diện và so sánh pixel diff giữa 2 port | Playwright Visual Comparison (Pixel diff `<= 1%`) | ⚠️ Config đã có trong `playwright.config.ts` (maxDiffPixels: 100, threshold: 0.2) |
| **i18n Quality** | Quét tìm text thiếu key dịch & Review ngữ nghĩa | `i18next-scanner` + Native Vietnamese Review | ⚠️ Scanner config tồn tại nhưng runtime dùng custom engine, cần đồng bộ |
| **Performance Budget** | Kiểm tra bundle size, TTI và FCP tự động trên CI | Lighthouse CI (Perf `>= 90`, FCP `< 1.2s`) | ❌ Chưa cấu hình |
| **Accessibility Audit** | Quét lỗi WCAG 2.1 AA tự động | `axe-core` integrated in Playwright (`score >= 95`) | ✅ `stock-detail-workstation.spec.ts` có accessibility test |

---

## 8. Kịch Bản Phục Hồi Khẩn Cấp (Rollback Plan)

### 8.1 Tiêu Chí Kích Hoạt Rollback (Trigger Criteria)
Hệ thống sẽ tự động gửi cảnh báo và Tech Lead có quyền quyết định rollback thủ công khi:
*   Tỷ lệ lỗi HTTP 5xx tăng vượt mức **> 1%** tính trong **sliding window 10 phút** liên tục (yêu cầu số mẫu thử tối thiểu `>= 100 requests`).
*   Có ít nhất 3 báo cáo lỗi nghiêm trọng liên quan đến luồng đăng nhập (User Login) hoặc không tải được trang Workspace.

### 8.2 Monitoring & Alerting Stack
*   **Error Tracking:** Sử dụng **Sentry** để thu thập log lỗi phía client và backend thời gian thực.
*   **Metrics Dashboard:** Sử dụng **Prometheus & Grafana** để giám sát tỷ lệ lỗi HTTP và thời gian phản hồi (latency).
*   **Alerting System:** Tích hợp **PagerDuty** để gửi cảnh báo cuộc gọi/tin nhắn trực tiếp đến Tech Lead trực ca khi vượt ngưỡng trigger.

---

## 9. Cổng Kiểm Soát Dọn Dẹp (Pre-Decommission Gates)

Tuân thủ nghiêm ngặt quy định tại `AGENTS.md` §1 và §8 rule #4, thư mục legacy `frontend/` chỉ được phép xóa bỏ hoàn toàn khỏi repo khi đạt được sự phê duyệt (sign-off) của Tech Lead và thỏa mãn **7 Cổng Kiểm Soát (A-G)** sau:

> **📋 Live Audit (2026-06-22):** Cập nhật trạng thái từng cổng dựa trên codebase thực tế.

*   [⚠️] **Cổng A (Feature Completeness):** 100% các trang nghiệp vụ đã có bản SaaS native tương đương và chạy ổn định.  
    *Trạng thái:* Gần đạt. **Thiếu 8 trang Admin Core** (Overview, Tenants, Billing, Usage, Jobs, AuditTrace, ServiceAccounts, PATs).  
    *Sign-off Owner:* Tech Lead + Product Owner
*   [✅] **Cổng B (API Autonomy):** Không còn bất kỳ file mã nguồn nào trong `packages/web` thực hiện import hoặc direct fetch từ legacy `client.js`.  
    *Trạng thái:* Đạt. `coreApiAdapter.js` là facade duy nhất, không có import từ `frontend/src/client.js`.  
    *Sign-off Owner:* Lead Frontend Developer
*   [ ] **Cổng C (WebSocket Parity):** Realtime WebSocket context trong packages/web đã chạy soak-test liên tục 48 giờ mà không bị rò rỉ bộ nhớ (memory leaks).  
    *Trạng thái:* Chưa thể xác nhận. `RealtimeContext.js` và `useRealtimeFeedCore` tồn tại nhưng chưa có soak test.  
    *Sign-off Owner:* Senior Frontend Developer
*   [✅] **Cổng D (Build Independence):** Quy trình CI/CD build thành công image `packages/web` độc lập mà không cần tham chiếu bất kỳ tài nguyên nào từ thư mục `frontend/`.  
    *Trạng thái:* Đạt. `tsc --noEmit` pass 0 lỗi. `npm run build` thành công. Docker build từ `packages/web/Dockerfile` không phụ thuộc `frontend/`.  
    *Sign-off Owner:* DevOps Lead
*   [ ] **Cổng E (Localization Validation):** 100% văn bản tiếng Việt hiển thị trên các trang đã qua bộ lọc i18n, không có text tiếng Việt hardcode.  
    *Trạng thái:* Chưa thể xác nhận. i18n engine tồn tại (custom, không i18next) nhưng chưa chạy scan để detect hardcode.  
    *Sign-off Owner:* QA Lead + Native Speaker Reviewer
*   [ ] **Cổng F (Security Compliance):** Đã hoàn tất audit lỗ hổng bảo mật (XSS, CSRF, Token storage HMAC pepper) và không phát hiện lỗ hổng mức độ High hay Critical.  
    *Trạng thái:* Chưa audit.  
    *Sign-off Owner:* Security Lead
*   [ ] **Cổng G (Production Shadow Run):** Đã chạy Shadow Run thành công liên tục 3 ngày trên subdomain beta với điểm số Parity Gate `>= 0.99`.  
    *Trạng thái:* Chưa thực hiện.  
    *Sign-off Owner:* Tech Lead + QA Lead

---

## 10. Cây Quyết Định Cho Shadow Run (Giai đoạn 5) & Cutover Checklist

> **📋 Live Audit (2026-06-22):** Docker Compose đã trỏ `frontend` service vào `packages/web/` (không phải legacy `frontend/`). Điều này có nghĩa cutover kỹ thuật (Giai đoạn 6) đã được thực hiện âm thầm trong các commit trước. Phần lớn checklist pre-cutover dưới đây không còn áp dụng. Tuy nhiên, cần xác nhận legacy `frontend/` chưa được xóa vì còn là reference code.

### 10.1 Cây Quyết Định Shadow Run (Shadow Run Decision Tree)
Quy trình chạy soak-test trong 3 ngày trên subdomain beta tuân theo sơ đồ quyết định sau:

```
                  [Khởi chạy Shadow Run]
                             │
                             ▼
              [Kiểm tra Parity Score (Cuối mỗi ngày)]
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
  [Parity Score >= 0.99]                  [Parity Score < 0.99]
         │                                       │
  (Giữ chạy tiếp 3 ngày)                  (Xác định nguyên nhân)
         │                                       │
         ▼                                 ┌─────┴─────────────────────┐
  [Sau 3 ngày liên tục]                    ▼                           ▼
         │                          [Lỗi logic nhỏ]            [Lỗi bảo mật/crash]
         ▼                                 │                           │
  [Ký duyệt Cutover]               (Sửa nhanh & Reset           (Hủy di trú & Quay lại
                                    Shadow Run 2 ngày)             legacy frontend)
```

### 10.2 Quy Trình Tác Nghiệp Cutover (Giai đoạn 6)

#### A. Pre-cutover Checklist (Trước khi chuyển đổi)
> **📋 Live Audit:** Hầu hết các mục dưới đây đã được xử lý trong các commit trước.
- [✅] Docker image cũ của legacy frontend đã được gắn tag backup `vninvest-frontend:backup-pre-migration-20260622` trên server.
- [ ] DNS TTL của tên miền chính đã được cấu hình ở mức thấp (`60 giây`) để cập nhật IP nhanh.
- [ ] Đã chạy kiểm tra cú pháp Nginx config trên server thành công (`nginx -t`).
- [ ] Đã chạy test thử nghiệm luồng rollback bằng tag backup thành công trên môi trường staging.

#### B. Lệnh thực thi Cutover (Cutover Steps)
> **📋 Live Audit:** Bước 1-2 đã hoàn thành. Compose context đã trỏ `packages/web/`. Chỉ cần xác nhận legacy `frontend/` không còn được tham chiếu.
1.  ~~Truy cập server, hạ container cũ~~ → ✅ Compose context đã là `packages/web/`.
2.  ~~Cập nhật file cấu hình `docker-compose.prod.yml` trỏ build context về `packages/web/`~~ → ✅ Đã làm.
3.  Theo dõi logs của container trong vòng 15 phút:
    ```bash
    docker logs -f frontend
    ```

#### C. Post-cutover (24h Monitoring)
- [ ] Theo dõi biểu đồ Grafana để đảm bảo tỷ lệ lỗi HTTP `< 0.1%`.
- [ ] Kiểm tra tỷ lệ kết nối WebSocket thành công của người dùng.
- [ ] Rà soát dung lượng bundle size thực tế trả về cho client.

---

## 11. Tiêu Chí Hoàn Thành (Definition of Done - DoD) & Ký Duyệt (Sign-off)

> **📋 Live Audit (2026-06-22):** Đã cập nhật trạng thái thực tế của từng DoD.

| Tiêu chí | Mô tả | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- |
| **DoD 1** | Khóa lưu JWT token trong `localStorage` trùng khớp hoàn toàn. | ✅ Xong | `authReact.js` / `core/transport.js` đã implement token storage. |
| **DoD 2** | i18n scanner pass, không missing key. | ⚠️ Cần verify | Scanner config tồn tại nhưng runtime dùng custom engine, cần đồng bộ. |
| **DoD 3** | API functions đã chuyển sang `adapters/core/`. | ✅ Xong | 20 files, 11 domain clients. |
| **DoD 4** | Sửa cú pháp `coreApiAdapter({ env })` và lỗi `coreApiReload()`. | ✅ Xong | `coreApiReload` không tồn tại trong codebase. |
| **DoD 5** | Đồng bộ biến môi trường Vite trên compose. | ⚠️ Cần kiểm tra | Không có `.env*` files trong `packages/web/`. Biến môi trường qua Dockerfile/CI. |
| **DoD 6** | AuthProvider và RealtimeProvider hoạt động ổn định. | ✅ Xong | `ShellAuthProvider` + `RealtimeContext.js` đã implement. |
| **DoD 7** | Dashboard components không dùng slot. | ✅ Xong | `DashboardPage.tsx` dùng JSX component trực tiếp. |
| **DoD 8** | 100% trang legacy có bản SaaS native `.tsx`. | ⚠️ Gần xong | **Thiếu 8 trang Admin Core.** Còn lại 31/39 routes đã có TSX. |
| **DoD 9** | Playwright test cho 4 luồng chính thành công. | ❌ Chưa đủ | Mới có `stock-detail-workstation.spec.ts` và `critical-pages.spec.ts`. Thiếu login, watchlist, screener. |
| **DoD 10** | Dockerfile build VNStockCharts với `STOCKCHART_REF`. | ⚠️ Cần kiểm tra | Dockerfile tồn tại; cần xác nhận build arg `STOCKCHART_REF`. |
| **DoD 11** | Shadow run 3 ngày đạt Parity Gate >= 0.99. | ❌ Chưa làm | Còn lại để triển khai sau. |
| **DoD 12** | Nginx config có rate limiting và rewrite rules. | ⚠️ Cần kiểm tra | Nginx config trong Dockerfile serve stage. |
| **DoD 13** | Compose context trỏ `packages/web/`. | ✅ Xong | Cả 4 compose files đều đã trỏ `packages/web/`. |
| **DoD 14** | Backup tag `vninvest-frontend:backup-pre-migration-20260622`. | ❌ Chưa làm | Cần thực hiện trước khi xóa legacy. |
| **DoD 15** | GitHub Action workflow `web.yml`. | ✅ Xong | `web-ci.yml` và `web.yml` tồn tại. |
| **DoD 16** | Legacy `frontend/` được dọn dẹp khỏi repo. | ❌ Chưa làm | Chỉ được xóa sau khi đạt 7 Gates (A-G). |
| **DoD 17** | Gzip/Brotli compressed size tối ưu. | ⚠️ Cần kiểm tra | Build thành công, chunks có warning kích thước lớn (WhaleBubbleChart 689KB, ShellStockDetailPage 909KB). |
| **DoD 18** | Hệ thống ổn định sau 1 tuần monitoring. | ❌ Chưa làm | Cần monitoring sau khi cutover. |
