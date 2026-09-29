# Kế hoạch cải tiến Main Menu — thu gọn sát code thực tế (bàn giao đội code, không cần hỏi lại)

Ngày lập: 2026-09-22. Căn cứ audit menu 2026-09-22 (sidebaritems / main.tsx / routeCatalog / helpers.py / vi.js+en.js).
Mục tiêu: xóa ảo giác menu đôi, xóa 1 route trùng, sửa nhãn sai, đồng bộ 4 nguồn điều hướng, giữ mọi chức năng đang chạy.

---

## 1. Phạm vi (Scope)

### 1.1. Trong phạm vi (MUST)
- Main sidebar `packages/web` (nhóm + mục + nhãn VI/EN + icon + active state).
- Router `main.tsx` (redirect giữ tương thích bookmark, không xóa URL đang có người dùng).
- `routeCatalog.js` (đồng bộ để gate F-04 không vỡ).
- i18n `vi.js` + `en.js` (nhãn menu + routes).
- BE `identity_access/views/helpers.py::_build_navigation` (visible_groups/visible_routes) + tests `test_capabilities_soc.py`.
- Xóa file rác `Sidebar (1).tsx`, `FullLayout (1).tsx`.
- Test mới FE (sidebar contract) + cập nhật BE test.
- Gates + minh chứng + cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` + AGENTS.md (mục Done).

### 1.2. Ngoài phạm vi (MUST NOT — làm là fail nghiệm thu)
- KHÔNG sửa 8 SOC tabs trong `ShellOperationsCenterPage.tsx:25-34`.
- KHÔNG sửa 15 sub-mục `TenantAdminSidebar.tsx:18-34` (giữ nguyên sub-sidebar).
- KHÔNG đổi API shape `capabilities.navigation` (chỉ thêm phần tử vào mảng, không đổi key).
- KHÔNG viết lại `Sidebar.tsx` sang JSX/CSS mới, không đổi layout/token/màu.
- KHÔNG xóa `navigationCatalog.js` (chỉ đồng bộ hoặc ghi DEPRECATED có lý do; xóa là scope khác).
- KHÔNG đụng `vninvestcharts-widget`, `coreApiAdapter` transport, DB migration (thay đổi này không cần migration).

---

## 2. Căn cứ code hiện tại (đội code không cần tìm lại)

| # | File:line | Thực tế chốt |
|---|---|---|
| R1 | `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts:3-52` | SSOT đang render: 5 groups, 14 items (13 + 1 conditional advertising). Group `dashboard`=Tổng quan trùng item `dashboard`=Tổng quan; group `trading`=Giao dịch trùng item `transactions`=Giao dịch |
| R2 | `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx:124-163` | Render group header + items, không filter theo `visible_routes` |
| R3 | `packages/web/src/main.tsx:88-130` | Tồn tại đồng thời `/whale-alerts` (`127`) và `/alert-center` (`126`); `resolvePageComponent:22-30` map `whale-alerts→alert-center`, `ai-advisory→whale-advisory`, `dashboard→core-dashboard`, `watchlist→core-watchlist`, `transactions→core-transactions`, `portfolios→core-portfolios`, `settings→core-user-settings` |
| R4 | `packages/web/src/app/routeCatalog.js:66-85` | Cả `whale-alerts` (`/whale-alerts`) và `alert-center` (`/alert-center`) cùng `requiredCapabilities: signals.whale_alerts.read` — trùng lặp được hợp thức hóa trong catalog |
| R5 | `packages/web/src/app/routeCatalog.js:5-246` | Thiếu: `upgrade`, `admin-crawl-control`, `tenant-admin/*`; thừa-trùng: `whale-alerts` vs `alert-center` |
| R6 | `packages/core/backend/src/identity_access/views/helpers.py:179-199` | BE base routes `['dashboard','watchlist','support','settings']`, non-free thêm `['ai-advisory','whale-alerts','transactions','portfolios']`, staff thêm `['operations-center','operations-center-mail-config','ai-command-center','advertising-admin']`. Thiếu: `screener`, `upgrade`, `tenant-admin`, `alert-center`, `admin-crawl-control`, `commercial-billing-center` |
| R7 | `packages/web/src/i18n/vi.js:59-100` | `group.dashboard:61`=Tổng quan = `dashboard:70`; `group.trading:66`=Giao dịch ≈ `transactions:71`=Giao dịch; `settings:84`=`UserConfig`; `soc:76`=Trung tâm SOC vs `routes.operationsCenter:127`=Trung tâm hoạt động (1 route 2 tên) |
| R8 | `packages/web/src/i18n/en.js:59-100` | `settings:84`=`UserConfig` (lỗi y hệt VI) |
| R9 | `packages/web/src/components/__tests__/route-catalog-contract.component.test.ts:13-33` | Gate F-04: mọi `routeCatalog` (trừ `externalEntry:true`) phải có mặt trong `main.tsx` (quét regex `path:`). Xóa catalog entry mà không xóa route (hoặc ngược lại) là vỡ gate |
| R10 | `packages/web/scripts/check-shell.mjs:134-155` | Script legacy assert `ai-advisory===ShellAiAdvisoryPage`, `dashboard===ShellDashboardPage`… ngược với `main.tsx` remap sang `core-*`. Script này đã gắn DEPRECATED (`check:shell:legacy`), gate hiện hành là `check:shell` (dom-landmarks+tokens+stock-detail-shell) |
| R11 | `packages/web/src/components/TenantAdminSidebar.tsx:163-164` | Mẫu chuẩn capability-gating: `.filter(item => !item.subject \|\| ability?.can('read', item.subject))` — main Sidebar chưa có |
| R12 | File rác tồn tại | `packages/web/src/layouts/full/vertical/sidebar/Sidebar (1).tsx`, `packages/web/src/layouts/full/FullLayout (1).tsx` (`Test-Path=True`, không được import) |

---

## 3. Menu đích CHỐT (không được tự ý thêm/bớt)

### 3.1. Cấu trúc final: 5 nhóm, 13 mục

| Nhóm (label mới) | Mục (label mới) | Path | Ghi chú so với hiện tại |
|---|---|---|---|
| Thị trường | Tổng quan | `/dashboard` | Đổi tên nhóm (hết trùng item) |
| Thị trường | Radar thị trường | `/watchlist` | Giữ |
| Thị trường | Screener | `/screener` | Giữ + bổ sung BE/catalog |
| Tài sản | Sổ giao dịch | `/transactions` | Đổi nhãn item (hết trùng nhóm). VI: `Sổ giao dịch`; EN: `Orders` |
| Tài sản | Danh mục | `/portfolios` | Giữ |
| Tín hiệu & AI | Trung tâm cảnh báo | `/alert-center` | Giữ duy nhất; `/whale-alerts` redirect về đây |
| Tín hiệu & AI | AI Advisory | `/ai-advisory` | Giữ (render `WhaleAdvisoryPage`) |
| Tín hiệu & AI | Trung tâm AI | `/settings/ai` | Giữ; `/settings/ai/agents`, `/settings/ai/usage` là sub-tab nội bộ, KHÔNG lên menu; `/ai-command-center` redirect về `/settings/ai` |
| Tài khoản | Nâng cấp | `/upgrade` | Giữ; `/commercial/billing` là sub-page của Nâng cấp, KHÔNG lên menu |
| Tài khoản | Hỗ trợ | `/support` | Giữ |
| Tài khoản | Cài đặt | `/settings` | Sửa nhãn (xóa `UserConfig`) |
| Quản trị (staff-only) | Trung tâm SOC | `/operations-center` | Giữ; 8 SOC tabs giữ nội bộ |
| Quản trị (staff-only) | Kiểm soát cào dữ liệu | `/admin-crawl-control` | Giữ + bổ sung BE/catalog |
| Quản trị (staff-only) | Quản trị Thành viên | `/tenant-admin` | Giữ 1 entry; 15 sub giữ trong `TenantAdminSidebar` |
| Quản trị (staff-only, flag) | Quản trị Quảng cáo | `/admin/advertising` | Giữ, chỉ hiện khi `VITE_FEATURE_ADVERTISING_ADMIN !== 'false'` |

Tổng: nhóm Quản trị 4 mục thường + 1 mục flag = 5 dòng khi flag bật. Toàn menu 13 dòng thường + 1 flag.

### 3.2. Bảng mapping cũ → mới + redirect (bắt buộc giữ tương thích)

| URL cũ | Hành vi mới | Loại | Giữ query/hash |
|---|---|---|---|
| `/whale-alerts` (+ `/whale-alerts/*`) | `Navigate` về `/alert-center` (+ preserve suffix) | Redirect 1 lần, `replace:true` | Có (`?tab=…`, `#…` giữ nguyên) |
| `/ai-command-center` | `Navigate` về `/settings/ai` | Redirect 1 lần, `replace:true` | Có |
| Mọi URL còn lại | Giữ nguyên, không redirect | — | — |

Yêu cầu: redirect đặt TRƯỚC route gốc trong `Routes`, dùng `Navigate replace`, không tạo vòng lặp (`/alert-center` không redirect ngược).

### 3.3. i18n keys chốt (không tự đặt key mới ngoài danh sách)

| Key | VI (mới) | EN (mới) |
|---|---|---|
| `layout.nav.group.dashboard` | `Thị trường` | `Market` |
| `layout.nav.group.trading` | `Tài sản` | `Assets` |
| `layout.nav.transactions` | `Sổ giao dịch` | `Orders` |
| `layout.nav.settings` | `Cài đặt` | `Settings` |
| `layout.nav.group.signals` | Giữ `Tín hiệu & Whale` | Giữ `Signals & Whale` |
| `layout.nav.group.account` | Giữ `Tài khoản` | Giữ `Account` |
| `layout.nav.group.admin` | Giữ `Quản trị` | Giữ `Admin` |
| `layout.nav.alertCenter` | Giữ `Trung tâm cảnh báo` | Giữ `Alert Center` |
| `routes.operationsCenter` | Đổi thành `Trung tâm SOC` (đồng nhất với `layout.nav.soc`) | Đổi thành `SOC Center` |

Cấm: hardcode string Việt/Anh trong `.tsx` (phải qua `t()` + `LangContext`, theo AGENTS.md).

---

## 4. Yêu cầu cần đạt (Requirements)

### 4.1. Chức năng (FR)
- FR1: Sidebar render đúng 5 nhóm / 13 mục (+1 flag) theo §3.1, đúng thứ tự, đúng icon hiện tại (không đổi icon).
- FR2: Không còn 2 nhãn kề nhau trùng chữ (group ≠ item trong cùng nhóm).
- FR3: `/whale-alerts` và `/ai-command-center` redirect đúng §3.2, không mất query/hash, không loop, back-button về đúng trang trước.
- FR4: Nhóm `Quản trị` + các mục con chỉ hiện khi `user.is_staff || user.is_superuser` (dựa trên `usePortfolio()` identity đã có, KHÔNG gọi API mới). Non-staff: nhóm biến mất hoàn toàn (cả header).
- FR5: `Quản trị Quảng cáo` vẫn tôn trọng flag `VITE_FEATURE_ADVERTISING_ADMIN !== 'false'`.
- FR6: Active-state (`isActivePath`) đúng cho cả URL redirect nguồn (đang ở `/alert-center` thì mục `Trung tâm cảnh báo` sáng; không còn mục `Whale Alerts` để sáng nhầm).
- FR7: `routeCatalog` + `main.tsx` + `sidebaritems` + BE nav 4 bên đồng nhất (mọi path menu đều có trong catalog và router; mọi catalog non-external đều có trong router — gate F-04 xanh).
- FR8: Không vỡ deep-link/bookmark hiện có; không đổi `pageRegistry` status của các entry đang dùng.

### 4.2. Phi chức năng (NFR)
- NFR1: Không thêm dependency, không thêm API call, không thêm migration.
- NFR2: Không đổi visual (màu/token/layout) ngoài chữ nhãn; giữ `Sidebar.tsx` structure + `soc`/Tailwind classes hiện tại.
- NFR3: A11y giữ nguyên: `role=navigation/menubar/menu/menuitem`, `aria-current=page`, `aria-label` group qua `t()`.
- NFR4: Performance: không tăng bundle (xóa file rác phải làm giảm hoặc giữ nguyên kích thước chunk); redirect dùng `Navigate` (không lazy thêm chunk).
- NFR5: Tương thích `tenant-changed` (Sprint 6 F1/F2): filter menu theo identity mới sau khi đổi workspace, không stale.
- NFR6: Tuân AGENTS.md: API (nếu chạm) dùng `defaultCoreApiAdapter cast as unknown as {…}`; nhãn Việt full dấu theo bảng thuật ngữ.

---

## 5. Work breakdown — 7 slices (làm đúng thứ tự, mỗi slice xong chạy gate của slice)

### SLICE S1 — i18n labels (FE, ~30 phút)
**File:** `packages/web/src/i18n/vi.js` (dòng ~59-100, ~127), `packages/web/src/i18n/en.js` (dòng ~59-100, ~127).
**Thay đổi:**
1. `vi.js`: `group.dashboard: 'Tổng quan'` → `'Thị trường'`; `group.trading: 'Giao dịch'` → `'Tài sản'`; `transactions: 'Giao dịch'` → `'Sổ giao dịch'`; `settings: 'UserConfig'` → `'Cài đặt'`; `routes.operationsCenter: 'Trung tâm hoạt động'` → `'Trung tâm SOC'`.
2. `en.js`: `group.dashboard: 'Overview'` → `'Market'`; `group.trading: 'Trading'` → `'Assets'`; `transactions: 'Transactions'` → `'Orders'`; `settings: 'UserConfig'` → `'Settings'`; `routes.operationsCenter: 'Operations Center'` → `'SOC Center'`.
3. Không thêm/xóa key, chỉ sửa value (trừ khi linter i18n bắt buộc thêm — phải ghi rõ trong PR).
**Gate slice:** `npx tsc --noEmit` (0 error) + `npm run i18n:scan` (exit 0, diff chỉ 9 value trên).
**Minh chứng:** `git diff -- packages/web/src/i18n/` + log `i18n:scan`.

### SLICE S2 — sidebaritems + capability gating (FE, ~1.5 giờ)
**File:** `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts`, `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx`.
**Thay đổi:**
1. `sidebaritems.ts`: nhóm signals chỉ giữ `[{whaleAlerts→XÓA}, {aiAdvisory}, {alertCenter}]` thành `[{alertCenter /alert-center}, {aiAdvisory /ai-advisory}]` theo thứ tự Cảnh báo trước, Advisory sau; xóa item `whaleAlerts /whale-alerts`; xóa item `alertCenter` khỏi group admin (hết trùng 2 chỗ); giữ nguyên icon các mục còn lại; thêm field optional `staffOnly?: boolean` cho 5 mục admin (hoặc tách group admin — chọn 1 cách, ghi vào PR; khuyến nghị field để diff nhỏ).
2. `Sidebar.tsx`: lấy identity từ `usePortfolio()` (đã có `userTenants/activeTenantId/switchTenant` — mở rộng destructure thêm identity/ability sẵn có, KHÔNG tạo context mới); filter: `staffOnly` items/groups chỉ render khi `is_staff||is_superuser`; group rỗng sau filter thì ẩn cả header (`group.items.length===0 → return null`). Giữ nguyên `isActivePath`, class, a11y attributes.
3. Cấm: đổi icon, đổi CSS, thêm fetch.
**Gate slice:** `npx tsc --noEmit` 0 error.
**Minh chứng:** screenshot sidebar staff vs non-staff (xem §7 TC-03/TC-04).

### SLICE S3 — Router redirect + routeCatalog sync (FE, ~1 giờ)
**File:** `packages/web/src/main.tsx` (khu vực `88-130`), `packages/web/src/app/routeCatalog.js`.
**Thay đổi:**
1. `main.tsx`: thêm 2 `Route` redirect ĐẶT TRƯỚC route gốc: `path='whale-alerts/*' → Navigate to='/alert-center…'` (preserve suffix+search+hash), `path='ai-command-center' → Navigate to='/settings/ai'`. Dùng `replace`. Không xóa route `/alert-center`, `/settings/ai`.
2. `routeCatalog.js`: (a) thêm entries thiếu: `upgrade (/upgrade)`, `admin-crawl-control (/admin-crawl-control)`, `tenant-admin-home (/tenant-admin/home, externalEntry:false)` + các sub `tenant-admin/*` còn lại hoặc đánh `externalEntry:true` cho sub (chọn 1, phải liệt kê đủ 15 sub trong PR description); (b) `whale-alerts` entry: giữ nguyên path để F-04 xanh (vì redirect route vẫn match regex `path:`), thêm field `deprecated:true, redirectTo:'/alert-center'` + comment; (c) KHÔNG đổi `requiredCapabilities` hiện có.
3. Kiểm tra regex F-04: mọi `routeCatalog[].path` (trừ external) phải match `path:\s*['"]…` trong `main.tsx` — redirect dạng `path='whale-alerts/*'` vẫn match `/whale-alerts`? Regex lấy full string `whale-alerts/*` → `registeredPaths` có `/whale-alerts/*` nhưng catalog cần `/whale-alerts` → SẼ LỆCH. Vì vậy redirect phải khai báo `path='whale-alerts'` (không `/*`) + thêm `path='whale-alerts/*'` second line, hoặc sửa test cho phép prefix. Phương án chốt: khai báo cả 2 dòng `path='whale-alerts'` và `path='whale-alerts/*'` trong `main.tsx` (2 Route cùng target) — không sửa test.
**Gate slice:** `npx vitest run src/components/__tests__/route-catalog-contract.component.test.ts` PASS (3/3) + `npx tsc --noEmit` 0.
**Minh chứng:** log vitest + `rg "path:" main.tsx` liệt kê đủ paths.

### SLICE S4 — BE navigation sync (BE, ~1 giờ)
**File:** `packages/core/backend/src/identity_access/views/helpers.py:179-199`, `packages/core/backend/src/identity_access/tests/test_capabilities_soc.py`.
**Thay đổi:**
1. `_build_navigation`: base `routes` thêm `'screener'` (mọi plan, vì FE hiện cho mọi plan và catalog `ALL_BUILD_TARGETS`); non-free (`tenant.plan != FREE`) thêm `'transactions','portfolios','ai-advisory','whale-alerts'` (giữ `whale-alerts` để tương thích client cũ — comment `deprecated, FE redirects`) + thêm `'alert-center'`; staff thêm `'operations-center','operations-center-mail-config','ai-command-center','advertising-admin'` (giữ) + thêm `'admin-crawl-control','tenant-admin','commercial-billing-center'`. Groups giữ `['workspace','signals','system']` + `'admin'` khi staff (+ `'vip-local'` khi vip) — không đổi tên group (FE không dùng BE group name để render header).
2. Tests: mở rộng `test_capabilities_soc.py` thêm 2 cases: (a) staff navigation chứa `screener, alert-center, admin-crawl-control, tenant-admin`; (b) free-plan không chứa `transactions/portfolios/ai-advisory` nhưng vẫn chứa `screener/dashboard/watchlist`. Giữ 3 tests cũ xanh.
**Gate slice:** `python packages/core/backend/manage.py check` (0 issues) + `python packages/core/backend/manage.py test identity_access.tests.test_capabilities_soc` (5/5 PASS).
**Minh chứng:** log 2 lệnh trên.

### SLICE S5 — Xóa file rác + chốt legacy (FE, ~30 phút)
**File:** xóa `packages/web/src/layouts/full/vertical/sidebar/Sidebar (1).tsx`, `packages/web/src/layouts/full/FullLayout (1).tsx`. Sửa `packages/web/scripts/check-shell.mjs` HOẶC ghi chú: vì script đã DEPRECATED (`check:shell:legacy`), KHÔNG sửa logic assert — chỉ thêm comment header `DEPRECATED — router dùng core-* remap (main.tsx:22-30), không dùng để nghiệm thu menu`. Cấm xóa `navigationCatalog.js`.
**Gate slice:** `rg --files | rg "\(1\)\.tsx"` = 0 hit; `npx tsc --noEmit` 0; `npm run check:shell` PASS.
**Minh chứng:** `git status` (2 deleted) + log `check:shell`.

### SLICE S6 — Test mới (FE+BE, ~1.5 giờ)
**File mới:** `packages/web/src/components/__tests__/main-menu-contract.component.test.tsx` (vitest + RTL, theo mẫu `TenantAdminRolesPage.component.test.tsx`).
**Cases bắt buộc (6):**
1. Render đủ 5 nhóm / 13 mục (+flag bật) với nhãn mới (assert text `Thị trường`, `Tài sản`, `Sổ giao dịch`, `Cài đặt`, không còn `UserConfig`).
2. Không có 2 mục cùng path; không còn path `/whale-alerts` trong sidebar (assert `queryByText('Whale Alerts')` null khi đã xóa — lưu ý phân biệt với `Trung tâm cảnh báo`).
3. Non-staff: nhóm `Quản trị` biến mất (mock `usePortfolio` identity `is_staff:false`).
4. Staff: nhóm `Quản trị` hiện đủ 4+1.
5. `isActivePath('/alert-center/123','/alert-center')===true` (import từ `sidebaritems.ts`).
6. `routeCatalog` mọi menu path đều có route tương ứng (mirror logic F-04 nhưng assert trên `sidebaritems` thay vì catalog).
**BE:** 2 cases mới trong `test_capabilities_soc.py` (§S4).
**Gate slice:** `npx vitest run src/components/__tests__/main-menu-contract.component.test.tsx` (6/6) + BE 5/5.
**Minh chứng:** log vitest + BE test.

### SLICE S7 — Gates tổng + docs + ledger (30 phút)
1. Chạy tuần tự: `npx tsc --noEmit` (0) → `npm run lint` (0 errors; warn pre-existing được phép) → `npm run build` (PASS, ghi duration) → `npm run test:components` (full, ghi x/y) → `npm run test` (jest, ghi x/y) → `npm run i18n:scan` (exit 0) → `npm run check:shell` (PASS) → BE `manage.py check` + `test identity_access` (PASS).
2. Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (1 entry theo quy ước hiện hành: Entry N+1, liệt kê files + gates + DoD).
3. Cập nhật `AGENTS.md` mục Done (1 bullet, ngày 2026-09-22, tóm tắt menu 5 nhóm/13 mục + redirects).
**Minh chứng:** §7 checklist.

---

## 6. Tiêu chí nghiệm thu (DoD toàn dự án — thiếu 1 là FAIL)

| ID | Tiêu chí | Cách đo |
|---|---|---|
| DoD-1 | Sidebar staff hiện đúng 5 nhóm/13 mục + flag; non-staff 4 nhóm/8 mục | Screenshot 2 trạng thái + test S6-3/4 xanh |
| DoD-2 | Không còn chữ `UserConfig` trong UI lẫn source (trừ historical ledger) | `rg "UserConfig" packages/web/src` = 0 hit (cho phép hit trong `*.test.*` nếu là assert-negative, phải liệt kê) |
| DoD-3 | Không còn mục menu trỏ `/whale-alerts`; truy cập URL cũ redirect 1 lần giữ query | TC-01/TC-02 PASS + `rg "whale-alerts" sidebaritems.ts` = 0 hit |
| DoD-4 | Group header ≠ item label trong cùng nhóm | Test S6-1 assert `Thị trường/Tài sản/Sổ giao dịch/Cài đặt` |
| DoD-5 | 4 nguồn đồng nhất: sidebar path ⊆ router paths; catalog non-external ⊆ router paths; BE visible_routes ⊇ mọi menu path | Gate F-04 + test S6-6 + BE test xanh |
| DoD-6 | Nhóm Quản trị ẩn hoàn toàn với non-staff (kể cả header), hiện đủ với staff | TC-03/TC-04 PASS |
| DoD-7 | Gates tổng xanh (§S7.1) với log đầy đủ | Paste log vào PR + lưu `docs/evidence/main-menu-20260922/` |
| DoD-8 | Ledger + AGENTS.md đã cập nhật | Link entry + diff |

---

## 7. Kịch bản kiểm thử bàn giao (QA chạy nguyên văn, không cần hỏi)

| ID | Vai trò | Steps | Expected |
|---|---|---|---|
| TC-01 | Mọi user | Mở `/whale-alerts?tab=critical#row-5` | URL thành `/alert-center?tab=critical#row-5` sau đúng 1 redirect; mục `Trung tâm cảnh báo` sáng; nội dung AlertCenter load bình thường |
| TC-02 | Mọi user | Mở `/ai-command-center` | Về `/settings/ai`, 3 sub-tab (Tổng quan/Agents/Usage) còn đủ |
| TC-03 | Non-staff (free) | Login, mở sidebar, đếm nhóm/mục; thử GET `/operations-center` | Thấy 4 nhóm/8 mục, không có `Quản trị`; GET admin trả trang `noPermission` (`vi.js:5`), không crash |
| TC-04 | Staff | Login staff, đếm sidebar | Thấy 5 nhóm, đủ `Trung tâm SOC / Kiểm soát cào / Quản trị Thành viên / Quảng cáo`(khi flag bật) |
| TC-05 | Mọi user | Click từng mục menu từ trên xuống | Mỗi mục đúng 1 trang, không có 2 mục dẫn cùng trang (trừ redirect đã khai báo), back-button đúng |
| TC-06 | Mobile 390px | Mở menu, chọn mục | Drawer đóng sau click (`onMobileClose`), không kẹt overlay |
| TC-07 | Đổi workspace | `switchTenant` sang tenant khác plan | Menu re-render theo identity mới, không stale (hồi quy Sprint 6 F1/F2) |

**Minh chứng xác thực bắt buộc (lưu `docs/evidence/main-menu-20260922/`):**
1. `01-sidebar-staff.png` + `02-sidebar-nonstaff.png` (full-height, thấy rõ 5 vs 4 nhóm).
2. `03-redirect-whale.mp4` hoặc HAR (1 redirect, giữ query/hash).
3. `04-gates.log` (paste nguyên văn 8 lệnh §S7.1 kèm exit code + duration).
4. `05-grep.log` (`rg UserConfig`, `rg whale-alerts sidebaritems`, `rg "\(1\)\.tsx"` = 0).
5. `06-tests.log` (vitest 6/6 + route-catalog 3/3 + BE 5/5).
6. PR description link ledger entry + AGENTS diff.

---

## 8. Rủi ro + Rollback

| Rủi ro | Giảm thiểu | Rollback |
|---|---|---|
| Redirect loop nếu config ngược | TC-01/02 + assert không redirect ngược trong code review | Revert 2 Route trong `main.tsx` (1 commit riêng) |
| F-04 vỡ vì `whale-alerts/*` | Làm đúng §S3.3 (2 dòng path) + chạy gate trước push | Revert `routeCatalog.js` |
| Non-staff thấy menu admin do mock sai identity | Dùng đúng field `is_staff/is_superuser` từ `usePortfolio` (đã có ở `Header.tsx:15-21`), không tự chế field mới | Revert `Sidebar.tsx` filter |
| EN/VI lệch | Sửa song song 2 file, `i18n:scan` gate | Revert i18n commit |
| File `(1).tsx` đang được import ở đâu đó | `rg "Sidebar \(1\)|FullLayout \(1\)"` trước xóa (= 0 mới xóa) | `git revert` |

Thứ tự commit khuyến nghị (4 commits): C1=S1+S2 (FE menu), C2=S3 (router+catalog), C3=S4+S6-BE (BE+tests), C4=S5+S6-FE+S7 (cleanup+tests+docs). Mỗi commit chạy `npx tsc --noEmit`; cuối C4 chạy full §S7.1 + `npm run build`.

---

## 9. Checklist bàn giao (đội code tick đủ mới merge)

- [ ] Code đúng §3 (không thêm/bớt mục, đúng nhãn, đúng redirect giữ query).
- [ ] 7 gates §S7.1 xanh, log lưu `docs/evidence/main-menu-20260922/04-gates.log`.
- [ ] 5 greps §DoD-2/DoD-3/S5 = 0 hit (log `05-grep.log`).
- [ ] Tests: vitest menu 6/6, route-catalog 3/3, BE capabilities 5/5 (`06-tests.log`).
- [ ] QA chạy đủ TC-01→TC-07, đính kèm 01/02/03.
- [ ] Ledger entry + AGENTS.md bullet đã push.
- [ ] Không migration, không dep mới, không API shape đổi (reviewer xác nhận trong PR).
