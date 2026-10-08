# HANDOFF — UI/UX còn dở sau vòng audit 327 → 246

> **Session này dừng ở đây, chưa sửa code nào.** Commit cuối: `d431383ef` (doc-only).
> Nhánh `dev`, working tree sạch (trừ symlink skill local, không track).
> Tái lập số liệu: `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src`

---

## 0. CẢNH BÁO QUAN TRỌNG NHẤT — con số cũ SAI, đừng sửa theo

Trước khi làm bất cứ việc gì, đọc `docs/audit-uiux/UIUX_AUDIT_20261007.md` **§10**.
Tôi đã báo 5 con số, **4/5 sai** vì lấy output scanner làm số lỗi:

| Mục | Đã báo (SAI) | Thật (đã kiểm chứng) |
|---|---|---|
| NAV-1 | 115 | **29 điểm / 12 file** |
| I18N-1 | 19 | **19–21** (tuỳ cách đếm, xem §2) |
| A11Y-9 | 44 | **45** |
| Thiếu `<h1>` | 63 | **19** |
| Mobile | "chưa kiểm" | **3 thiếu cụ thể** |

⚠ **Sửa `<h1>` theo danh sách 63 trang cũ sẽ tạo 32 trang có 2 `<h1>`** —
`ShellPageTemplate.js:119` đã render `<h1>`.

⚠ **Và 24 (số ở bảng trên) cũng sai — thật là 19.** Tôi đếm theo **tên file**
(`*Page.tsx`) thay vì theo `pageRegistry.js`. 5 file `Portfolio*Page.tsx` là tab
con, không phải route. Đây là lần thứ 5 trong 5 mục mà con số tôi đưa ra phải
sửa lại — xem `docs/LESSONS/build-gates.md` L-G04.

---

## 1. NAV-1 — ưu tiên CAO · 29 điểm / 12 file

**Vì sao thật**: bảng có phân trang + filter, gửi link cho người khác → họ thấy
dữ liệu **không được lọc**. Đây là bug hành vi, không phải cây thức.

**Vì sao 84 điểm còn lại KHÔNG phải lỗi**: chỉ có filter/sort, hiếm gửi link.
**2 điểm tuyệt đối không sửa**: `components/advisory/AdvisoryOrderTicket.js:14` (`quantity`) và
`components/DNSEConnectionPanel.js` (`orderQuantity`) — ô nhập trong form, deep-link vô nghĩa.

### Chặn trước khi code: cần Owner chốt thư viện
12 file đều có **cả bộ lọc + phân trang + sắp xếp**. Sửa tay = lặp đoạn
parse/serialize `URLSearchParams` 12 lần. Nên viết **1 hook `useUrlState`** rồi
áp cho cả 12. **Hỏi Owner trước: hook tự viết hay thư viện (`use-query-params`)?**

### Danh sách đích kèm `file:line`

| File | State | Ghi chú |
|---|---|---|
| `components/dashboard/CoreDashboardPositionDeck.tsx` | `activeTab:52`, `pageSize:53`, `currentPage:54` | |
| `components/dashboard/FactsFirstModularPositionDeck.jsx` | `activeTab:27`, `pageSize:28`, `currentPage:29` | trùng kiểu với file trên |
| `pages/admin/AdminCoreAuditTracePage.tsx` | `filtersDraft:68`, `filters:69`, `selectedRequestId:71` | có `Draft` = chỉ ô input |
| `pages/admin/AdminCoreJobsPage.tsx` | `filtersDraft:52`, `filters:53` | |
| `pages/admin/AdminCorePATsPage.tsx` | `filtersDraft:25`, `filters:32` | |
| `pages/admin/AdminCoreServiceAccountsPage.tsx` | `filtersDraft:23`, `filters:30` | |
| `pages/admin/AdminCoreTenantsPage.tsx` | `searchDraft:16`, `search:18`, `page:27` | |
| `pages/admin/AdminBillingFleetPage.tsx` | `page:21`, `search:24` | |
| `pages/admin/AdminAuditPage.tsx` | `page:19` | |
| `pages/tenant-admin/TenantAdminMembersPage.tsx` | `searchQuery:65`, `roleFilter:66`, `activeTab:67` | |
| `pages/portfolio/PortfolioHoldingsPage.tsx` | `search:79`, `sortKey:81`, `sortDir:82` | **do tôi viết** |
| `features/advertising/components/CampaignTable.jsx` | `sorting:52`, `globalFilter:53` | |

**Mẹo**: `*Draft` chỉ là ô input đang soạn — **đồng bộ `filters`/`search`/`page`**
vào URL, để `Draft` ở local. Đồng bộ cả hai sẽ gây `useEffect` loop.

---

## 2. I18N-1 — P2, ít rủi ro · 19 điểm

**`formatDateTime` ĐÃ CÓ SẴN** ở `context/LangContext.js:86` (`formatDateTime: (value, options) => …`) — không cần viết
helper mới (tôi đã nói sai khi nghĩ ngược lại).

### 2a. Điểm chắc chắn phải sửa (5 file)

| File | Line | Ghi chú |
|---|---|---|
| `components/AIUsageDashboard.tsx` | **205, 206** | **bị revert lô nhầm**, sửa lại được ngay |
| `components/soc/SocDataInventorySection.tsx` | 129, 130 | `(s.total_rows ?? 0).toLocaleString()` |
| `components/soc/SocDataOpsMonitorSection.tsx` | **507, 821** | `new Date(x).toLocaleString()` → `formatDateTime` |
| `components/screener/ScreenerHistory.tsx` | **295** | trộn `formatNumber` + `toLocaleString` |
| `components/advisory/DataFreshnessBadge.js` | **83** | `toLocaleTimeString()` |

### 2b. Cần sửa nhưng khác scope

- `components/ui/calendar.tsx:134` — **file duy nhất chưa dùng hook i18n**,
  cần truyền `locale` qua props hoặc thêm `useI18n`.
- `pages/tenant-admin/TenantAdminBillingPage.tsx:84,85,100` — `useI18n()` gọi ở
  dòng 117 nhưng dùng ở 84–100 ⇒ scope sai, phải sửa cấu trúc.
- `pages/tenant-admin/TenantAdminSettingsPage.tsx:177`,
  `components/soc/SocRetentionHealthPanel.tsx:115`,
  `pages/watchlist/components/WatchlistTable.tsx:233,255,256,257,259`,
  `components/OrderFlowRadarPanel.js` — **không còn `toLocale*`** (đã dùng `formatNumber`), xem lại khi code,
  `components/screener/ScreenerResultsTable.tsx:72`

### 2c. ⚠ FALSE POSITIVE — đã có locale, ĐỪNG sửa

Script đếm thô được 38 dòng, nhưng các file sau **đã truyền biến hợp lệ**:

| File | Line | Bằng chứng |
|---|---|---|
| `components/soc/SocSignalsPanel.tsx` | 1541, 1544, 1546, 1923, 1926, 1928 | `const tag = localeTag \|\| "vi-VN"` ở `:1527` |
| `components/screener/ScreenerSchedulePanel.tsx` | 44 (`const tag` ở :32) | `const tag = localeTag \|\| "vi-VN"` ở `:32` |
| `components/BrokerSettingsSection.tsx` | 61 | `formatTime(iso, locale = "vi-VN")` |
| `components/soc/SocBrokerPanel.tsx` | 69 | `formatTime(iso, locale = "vi-VN")` ở `:65` |
| `components/soc/SocUsersPanel.tsx` | 39 | tương tự |
| `features/stock-detail/components/*` | 9, 9, 11 | đã truyền `locale` |
| `features/dashboard/AIAdvisorAlertPanel.js` | 118, 183 | đã truyền `"en-US"/"vi-VN"` |

**Không đổi `packages/web/scripts/` hay scanner cho tới khi hỏi Owner.**

---

## 3. A11Y-9 — P1, sửa rẻ vì tập trung · 45 điểm

Đã loại `<Input>` wrapper: `components/ui/input.tsx:6` **có sẵn prop `label`**
render `<label>`. Còn lại là **control thô** — 45 điểm nhưng chỉ nằm ở 2 nhóm lớn:

| Nhóm | Số | Chiến lược |
|---|---|---|
| `features/advertising/components` | **15** | sửa 1 chỗ → nhiều màn hình |
| `components/ui` | **5** | sửa ở primitive → được mọi trang |
| `pages/admin` | 10 | |
| `pages/tenant-admin` | 8 | |
| `components/alert-center` | 3 | |
| còn lại | 4 | rải rác |

**Bắt đầu từ `components/ui`** — rẻ nhất, phủ rộng nhất:
- `components/ui/command.tsx:17` và `:47` — `<input>` chỉ có `placeholder`.
  **`placeholder` KHÔNG phải accessible name** (đây là finding đúng).
- `components/ui/input-otp.tsx:62` (dòng 93 cũng là `<input>`)

Các điểm còn lại đã xác nhận có thật:
`alert-center/FilterBar.tsx:107,117` · `alert-center/StatsPanel.tsx:51` ·
`dashboard/OptimizationModal.jsx:87` · `TenantAdminCommandPalette.tsx:57`

**Có sẵn test mẫu**: `components/shared/__tests__/PaginationBar.a11y.component.test.tsx`
(khoá 8 icon button + 2 select). Copy pattern này.

---

## 4. `<h1>` — P1, 19 trang · dễ sửa nhưng dễ gây hỏng ngược

### Cơ chế đã có (ĐỪNG viết lại)
`components/ShellPageTemplate.js:119` render `<h1>` + `role="region"` +
`aria-labelledby` ở `:106-107`. **42 file dùng shell này.**
Test khoá hành vi: `components/__tests__/dom-landmarks.component.test.tsx`.

**Phân bồ đúng theo `pageRegistry.js` (61 component thật sự được render)**:
10 tự viết `<h1>` · 32 qua shell (đã có) · **19 thật sự thiếu**.

⚠ **Con số 19 này CŨNG SAI — audit Stage 2 (2026-10-08) đã sửa thành 4.**
14/19 trang đã có đúng 1 `<h1>`, chỉ là không nằm trong file page mà đến từ
`createElement("h1", …)` hoặc component con (`adminUi.tsx:24` qua `AdminPageHeader`,
`WorkstationShell.tsx:53`, `WhaleAdvisoryBentoHeader.js:44`). Bằng chứng từng trang
ở `docs/PLAN_UIUX_WAVE2_FINAL.md` §2 FU-02c. **Đây là sai số thứ 6** — xem
`docs/LESSONS/build-gates.md` L-G04 + L-G07. Số đo duy nhất đáng tin là DOM thật
(`getAllByRole`), không phải grep.

⚠ **Đừng đếm theo tên file.** 5 file `pages/portfolio/Portfolio*Page.tsx` **không
phải route-level** — 5 route portfolio đều map về **1 entry**
`portfolio-workspace` (`pageRegistry.js:214-215` — dòng 210-211 là `core-portfolios`,
trích cũ SAI). `<h1>` phải nằm trong
`PortfolioWorkspace.tsx` (khung dùng chung), **không** nằm trong 5 file tab.
Thêm vào tab ⇒ 2 `<h1>` trên mọi trang portfolio.

### 19 trang cần sửa

| Nhóm | Số | Trang (đã đối chiếu `pageRegistry.js`) |
|---|---|---|
| Auth | 4 | `auth/AuthLoginPage` · `auth/AuthRegisterPage` · `auth/AuthVerifyEmailPage` · `auth/AuthResetPasswordPage` |
| Admin | 5 | `admin/AdminUsersPage` · `AdminBillingFleetPage` · `AdminUsageFleetPage` · `AdminAuditPage` · `AdminAnalyticsPage` |
| **Portfolio** | **1** | `portfolio/PortfolioWorkspacePage` — 5 route dùng chung entry này. **Sửa `PortfolioWorkspace.tsx`** (khung), không sửa 5 file tab |
| Khác | 9 | `DashboardPage` · `SupportPage` · `TransactionsPage` · `UserSettingsPage` · `UpgradePage` · `market/ShellStockDetailPage.js` · `signals/WhaleAdvisoryPage.tsx` · `AIAgentFederationPage.tsx` · `AIUsageAnalyticsPage.tsx` |

Tổng: 4 + 5 + 1 + 9 = **19** ✅

⚠ **`market/ShellStockDetailPage.js` tên có `Shell` nhưng KHÔNG dùng
`ShellPageTemplate`** — đây là shell riêng của market, vẫn phải tự thêm `<h1>`.
Không tin tên file.

### ⚠ Hai cái bẫy đã kiểm tra
1. `app/routeCatalog.js` có `titleKey` nhưng **không component nào render nó** (grep
   `titleKey` chỉ ra trong chính `routeCatalog.js`) ⇒ `titleKey` **không** giúp
   gắn `<h1>`. Đừng tin nó.
2. `pages/portfolio/PortfolioWorkspace.tsx` là **khung dùng chung cho cả 5 tab** —
   đây là chỗ **ĐÚNG** để đặt `<h1>` (1 cái phục vụ 5 route). 5 file
   `Portfolio*Page.tsx` là tab con, **đừng** thêm `<h1>` vào chúng.

---

## 5. Mobile — 3 thiếu cụ thể, sửa ở `index.css`

Không phải "chưa kiểm" — đã đo được. Sửa được ngay, không cần thiết bị:

| Hạng mục | Trạng thái | Việc cần làm |
|---|---|---|
| `viewport` | ✅ `width=device-width, initial-scale=1` | **không** thêm `user-scalable=no` (đã đúng) |
| `safe-area-inset-*` | **0** | thêm cho header/sidebar cố định — iPhone notch |
| `touch-action: manipulation` | **0** | nhấn nút mobile chậm ~300ms |
| `overscroll-behavior` | **0** | kéo modal/drawer kéo luôn trang |
| Responsive | ✅ `sm:` 30 · `md:` 59 · `lg:` 43 · `xl:` 35 · `2xl:` 3 | |
| Sidebar mobile | ✅ `layouts/full/FullLayout.tsx:14-29` | |

**Không làm được trong phiên không có thiết bị**: viewport thật, focus ring khi
touch, tốc độ cuộn. Ghi `CHƯA CHẠY`, đừng đoán.

---

## 6. Việc khác còn dở

| # | Việc | Trạng thái |
|---|---|---|
| 6.1 | Skill đã cài nhưng thân là **symlink local, chưa track** (`skills/`, `.claude/`, `agent/`) | chỉ `skills-lock.json` được commit. **Đừng xóa đệ quy** — có junction |
| 6.2 | Portfolio visual acceptance | `LedgerEntry = 0` trên dev DB ⇒ chưa nghiệm thu được chart với holding thật |
| 6.3 | `route-contract.test.js` lỗi ESM pre-existing | đừng báo PASS |
| 6.4 | `CLAIMS.md` còn ~66 cảnh báo file không tồn tại | cảnh báo, không chặn. Dọn ở task riêng |
| 6.5 | `AIUsageDashboard.tsx` 2 điểm locale bị revert nhầm | xem §2a |
| 6.6 | Cỡ 5 rule `transition:` trong `aiSettings.module.css` chưa có `prefers-reduced-motion` | P2, dễ |

---

## 7. Quy trình bắt buộc cho session mới

```powershell
sh scripts/agent-install-hooks.sh          # nếu chưa
pwsh -File scripts/agent-sync.ps1           # rebase
git -C <main tree> status --short
node packages/web/scripts/check-multi-agent.mjs
```

1. **Khai claim** vào cuối `docs/CLAIMS.md`, **commit riêng, trước khi sửa dòng đầu tiên**.
2. Tạo nhánh `feat/<slice>-<agent>`. **Không commit thẳng vào `dev`.**
3. Không commit 9 file shared: `AGENTS.md`, `packages/web/package.json`,
   `pyproject.toml`, `requirements.txt`, `package-lock.json`,
   `docker-compose*.yml`, `.env*`. *(ledger đã được gỡ khỏi deny-list — được append bình thường)*
4. Không `npm install` / `pip install` khi chưa hỏi (junction `node_modules` dùng chung).
5. Không tự đặt số migration.
6. **Không báo PASS cho thứ chưa chạy** — ghi `CHƯA CHẠY`.

## 8. Gate phải chạy sau khi sửa code

```powershell
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src   # phải KHÔNG tăng
npm run check:uiux                                                 # budget 246, FAIL nếu rule mới
npm run test:components                                            # baseline 747/747, 110 file
npx tsc --noEmit                                                   # baseline 0
npm run build                                                      # baseline 0
```

Baseline: **246 = P0 0 · P1 123 · P2 121 · P3 2**. Budget gate **cho phép giảm,
chặn tăng/thêm rule mới**. Test mới phải fail-trước → pass-sau.

---

## 9. Bài học phải nhớ (đã commit)

Đọc `docs/LESSONS/` — skill `project-lessons` tự nạp theo tag trong `INDEX.md`.

| Mã | Bài học | Liên quan trực tiếp |
|---|---|---|
| **L-G04** | **Con số đếm được ≠ con số lỗi. Phân loại mức độ trước khi báo cáo. Đọc kiến trúc trước khi đếm.** | 4/5 con số ở §0 sai vì không làm điều này |
| **L-G05** | `git diff --stat` deletions bất thường = triệu chứng | tôi làm `soc.components.css` 3482→1 dòng |
| **L-G06** | Revert theo lô kéo mất fix ở file khác | `AIUsageDashboard.tsx` mất 2 điểm |
| **L-F04** | **KHÔNG** `Get-Content \| Set-Content` để sửa file nhiều dòng | tôi làm `INDEX.md` 52→1 dòng **ngay sau khi viết bài học này** |
| L-F06 | Quét theo cửa sổ ±N dòng tạo false positive | §2c, §3 |
| L-F08 | **Màu VN giống Bloomberg: xanh = tăng, đỏ = giảm.** Owner chốt 2026-10-08 | token hiện tại **đã đúng**, đừng đảo |
