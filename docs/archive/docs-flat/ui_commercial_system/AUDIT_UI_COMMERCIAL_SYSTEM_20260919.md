# Audit toàn bộ giao diện và chức năng theo tiêu chuẩn phần mềm thương mại

**Ngày audit:** 2026-09-19  
**Phạm vi:** `packages/web` và các điểm giao tiếp trực tiếp với `packages/core/backend`  
**Phương pháp:** đọc route catalog/page registry, trace router và adapter, rà soát i18n/loading/error/realtime, chạy build/lint/test/shell gates. Không sửa mã nguồn trong audit này.

## Tóm tắt điều hành

Hệ thống **chưa đạt trạng thái commercial-ready** tại thời điểm audit. Có 2 blocker trực tiếp: production build fail do import sai phần mở rộng file và lint fail do lỗi parse trong header. Component suite cũng fail 1 test SSE overview; đây là luồng giám sát realtime trọng yếu. Ngoài ra còn các rủi ro High về route catalog không đồng bộ router, fallback UI còn hard-code/`alert()`, và khả năng vận hành backend chưa kiểm chứng được vì môi trường thiếu biến cấu hình bắt buộc.

## Findings ưu tiên

### F-01 — BLOCKER: production build không tạo được artifact

- **Bằng chứng:** `packages/web/src/hooks/useAlertCenterData.js:3` import `./useCoreQuery.js`, nhưng file thực tế là `packages/web/src/hooks/useCoreQuery.ts`.
- **Kết quả:** `npm run build` chạy được TypeScript nhưng Vite/Rollup dừng với `Could not resolve "./useCoreQuery.js"`.
- **Tác động thương mại:** CI/CD không thể phát hành bản frontend; Alert Center và các module import gián tiếp không thể đóng gói production.
- **Mức:** Critical/Release blocker.

### F-02 — HIGH: lint fail do lỗi cú pháp trong Header

- **Bằng chứng:** `packages/web/src/layouts/full/vertical/header/Header.tsx:315` báo `Parsing error: ')' expected`.
- **Kết quả:** ESLint báo **1 error + 3552 warnings**.
- **Tác động:** quality gate không đáng tin cậy; lỗi cú pháp có thể làm route/header fail khi bundler chạm tới module, dù build hiện đã dừng sớm vì F-01.
- **Mức:** High.

### F-03 — HIGH: realtime Overview SSE không đạt component test

- **Bằng chứng:** `packages/web/src/components/__tests__/soc-overview-stream.component.test.tsx:107` nhận `esInstances[0]` là `undefined`; test `hiển thị Live khi SSE mở...` fail. Hook kết nối được điều khiển bởi `packages/web/src/hooks/useOverviewStream.ts:84-153`, còn panel chỉ enable stream khi `!loading` tại `packages/web/src/components/soc/SocOverviewPanel.tsx:225-226`.
- **Kết quả:** component suite **45 files / 227 pass, 1 file / 1 test fail**.
- **Tác động:** trạng thái Live/Connecting/Polling của Operations Center chưa có bằng chứng regression xanh; lỗi có thể là race trong test hoặc điều kiện enable thực tế, cần reproduce trên browser trước khi kết luận runtime root cause.
- **Mức:** High.

### F-04 — HIGH: route catalog và router không đồng bộ

- **Bằng chứng:** catalog khai báo `vip-local-control` tại `packages/web/src/app/routeCatalog.js:217-224`, page registry có loader tương ứng tại `packages/web/src/pages/pageRegistry.js:178-180`, nhưng `packages/web/src/main.tsx:72-124` không đăng ký route `/vip/local-control`.
- **Tác động:** capability/build target có thể quảng bá route VIP nhưng direct navigation không có route runtime; người dùng có thể bị chuyển về `/dashboard` bởi wildcard tại `main.tsx:125`.
- **Mức:** High, đặc biệt với build target VIP.

### F-05 — MEDIUM: token gate còn hard-coded color

- **Bằng chứng:** `packages/web/src/components/soc/soc.components.css:3221` còn `var(--accent, #5078a8)`.
- **Kết quả:** `npm run check:shell` pass DOM landmarks và stock-detail shell nhưng fail `check:tokens`.
- **Tác động:** theme/token contract không hoàn chỉnh, gây sai khác màu khi đổi theme/brand và làm quality gate đỏ.
- **Mức:** Medium.

### F-06 — MEDIUM: error UX chưa đạt chuẩn sản phẩm thương mại

- **Bằng chứng:** các màn hình vẫn gọi native `alert()` tại `packages/web/src/components/soc/SocMatrixScrapeMonitor.tsx:100-111`, `packages/web/src/components/soc/SocVnbrokerPanel.tsx:136-186`, `packages/web/src/pages/admin/ShellMailConfigPage.tsx:108-124`, `packages/web/src/pages/AdminCrawlControlPage.tsx:100-111`, `packages/web/src/pages/PortfoliosPage.tsx:88`.
- **Tác động:** thông báo không nhất quán, chặn luồng thao tác, khó truy cập bằng keyboard/screen reader, không có retry/context/action recovery đồng nhất.
- **Mức:** Medium; nâng High cho thao tác admin, crawl, broker và billing.

### F-07 — MEDIUM: còn chức năng hiển thị stub/coming soon trong production surface

- **Bằng chứng:** i18n còn `smoke_label` nói endpoint trả stub tại `packages/web/src/i18n/vi.js:354` và `packages/web/src/i18n/en.js:354`; thêm các key `coming_soon` tại `packages/web/src/i18n/en.js:787,995,2019`.
- **Tác động:** người dùng thương mại có thể hiểu nhầm tính năng đã hoàn thiện trong khi kết quả không phải dữ liệu vận hành thật; cần gắn rõ beta/disabled hoặc ẩn khỏi build production.
- **Mức:** Medium.

### F-08 — MEDIUM: fallback và loading vẫn có hard-coded product copy

- **Bằng chứng:** `packages/web/src/main.tsx:34-46` dùng trực tiếp `Đang xác thực tài khoản...`, `Page ... not found`; `packages/web/src/pages/pageRegistry.js:39-114` chứa loading/error copy và style inline trong deferred page fallback.
- **Tác động:** vi phạm i18n parity VI/EN, khiến fallback route không đổi ngôn ngữ và khó quản trị copy; inline CSS/inline SVG cũng bypass token governance.
- **Mức:** Medium.

## Ma trận chức năng giao diện

| Nhóm chức năng | Surface chính | Trạng thái audit | Rủi ro chính |
|---|---|---|---|
| Auth | login, register, verify email, reset password | Có route/page/test, chưa browser E2E đầy đủ | Fallback/auth loading hard-code; backend runtime chưa check được |
| Workspace | dashboard, watchlist, screener, transactions, portfolios | Có router và component/Jest coverage | Build blocker; thiếu visual/E2E evidence toàn luồng |
| Market | stock detail, chart/widget, order book, whale markers | Stock-detail shell pass; widget là dependency npm ngoài | Chưa chạy visual browser; build không tạo artifact |
| Signals | AI advisory, whale alerts, Alert Center, signal feed/SSE | Adapter/component tests hiện diện | Stub smoke endpoint; realtime regression chưa xanh |
| Operations/SOC | overview, inventory, DataOps, scheduler, config, monitor, signals | Nhiều component tests và shell gates | Token fail; native alert còn tồn tại; thiếu E2E từng tab |
| Admin/Tenant | members, PAT, SSO, roles, settings, webhooks, billing, audit | Route/page registry đầy đủ ở source | Chưa chứng minh permission isolation và mutation recovery |
| Commercial | upgrade, billing center, payment return, advertising | Có page registry/router chính | Chưa có live E2E payment/callback |
| VIP | VIP local control | Có catalog + page registry | Router không đăng ký route, F-04 |
| System | settings, support, AI command center, mail config | Có route/page registry | Hard-coded copy/native alert; lint/build blocker |

## Quality gates đã chạy

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` | Pass | TypeScript không bắt được import `.js` tới file `.ts` mà Rollup bắt được |
| `npm run build` | **Fail** | F-01, Vite không resolve `useCoreQuery.js` |
| `npm run lint` | **Fail** | F-02: 1 error, 3552 warnings |
| `npm run test:components` | **Fail** | 45/46 files pass, 227/228 tests pass; F-03 |
| `npm test -- --runInBand` | Pass với cảnh báo runtime | Có React `act(...)` warnings và React Router future warnings |
| `npm run check:shell` | **Fail** | DOM landmarks pass, token check fail F-05; stock-detail shell pass |
| `npm run i18n:scan` | Không ghi nhận blocker | Không thay đổi kết luận về hard-coded fallback/runtime copy |
| `python manage.py check` | Chưa chạy được | Môi trường thiếu `DJANGO_ALLOWED_HOSTS` explicit |

## Đánh giá theo tiêu chuẩn thương mại

- **Release readiness:** Không đạt vì build production fail.
- **Reliability:** Chưa đạt vì SSE overview test fail và Jest phát cảnh báo async `act(...)`.
- **Maintainability:** Chưa đạt vì lint error và 3552 warnings làm giảm tín hiệu review.
- **UX consistency:** Chưa đạt vì native `alert()`, hard-coded fallback copy và token violation.
- **Internationalization:** Business screens có i18n rộng, nhưng fallback/deferred/error surfaces chưa parity đầy đủ.
- **Security/tenant isolation:** Chưa thể cấp verdict đầy đủ; cần backend test và browser E2E qua hai tenant/role.
- **Observability/recovery:** SOC có retry/poll/SSE architecture, nhưng cần đóng test đỏ và xác minh live browser; stub label còn xuất hiện trên user-facing surface.

## Thứ tự khắc phục đề xuất

1. Sửa F-01 và F-02, chạy lại build/lint.
2. Điều tra F-03 bằng browser test thật, sửa điều kiện enable hoặc test harness, rồi chạy toàn bộ component suite.
3. Đồng bộ route catalog/router cho VIP và thêm route-contract test chống orphan route.
4. Thay native `alert()` bằng Toast/Confirm/error panel thống nhất; đưa copy fallback vào VI/EN.
5. Dọn hard-coded color/token và giảm warning lint theo nhóm.
6. Chạy backend gates với env production-like không wildcard và Playwright trên auth, dashboard, stock detail, signals, SOC, tenant admin, billing/payment.

## Giới hạn và bằng chứng còn thiếu

Audit này không tự sửa code và không giả định các claim trong ledger là bằng chứng runtime hiện tại. Chưa có browser session production-like/credentials để kiểm tra toàn bộ route, responsive mobile, permission matrix, payment callback, SSE thật, WebSocket chart và cross-tenant isolation. Các nhóm này được đánh dấu “chưa chứng minh”, không mặc định là pass.

## Danh sách file audit tạo/cập nhật

- `docs/AUDIT_UI_COMMERCIAL_SYSTEM_20260919.md`
- `docs/CODE_CHANGE_AUDIT_LEDGER.md`