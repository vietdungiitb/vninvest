# AUDIT 2 — FEASIBILITY + ACCEPTANCE CRITERIA của `docs/PLAN_UIUX_WAVE4.md`

- **Auditor**: audit độc lập, READ-ONLY (không sửa product code)
- **Ngang hàng với**: `docs/PLAN_AUDIT_UIUX_WAVE4.md` (auditor kia verify số thô + citation)
- **Phạm vi của tôi**: *slice này có build được không, và AC có thật sự test điều nó nói không*
- **Đo tại**: cwd = repo root `C:\Mujoco Projects\vninvest`, branch `dev`, HEAD `ea0002d00` (đã xác nhận `git rev-parse HEAD`)
- **Ngày**: 2026-10-09

> Mọi khẳng định kèm `file:line` + lệnh tái lập. Không verify được thì ghi
> `KHÔNG VERIFY ĐƯỢC` + lý do.

---

## Verdict: **NEED_REVISION**

**confidence: high**

Lý do ngắn: S1 và S4 có **blocker thật, không phải sắc xích** — S1 không thể xanh vì
slice không sửa gì làm touch-target vượt 44px; S4 thống kê sai số trung tâm (111 →
đúng ra 108) và điều đó làm **STOP condition #2 của chính plan** bắn ngay. S2 có
1 blocker (1 trong 6 trang **render ra 2 `<h1>`**, nên AC-2.2 buộc phải sửa product
code ⇒ vi phạm AC-2.3). S3 có 1 blocker (AC-3.1 trích field không tồn tại).

---

## Bảng per-slice

| Slice | Verdict | Blockers | Majors |
|---|---|---|---|
| **S1** Mobile Playwright | **NEED_REVISION** | 2 | 1 |
| **S2** 6 trang `<h1>` | **NEED_REVISION** | 1 | 2 |
| **S3** `check-h1-graph.mjs` | **NEED_REVISION** | 1 | 2 |
| **S4** Major 1 + Major 2 + AC-2.4 | **NEED_REVISION** | 1 | 3 |
| **S5** docs wave 2 | **AGREE (có sửa nhỏ)** | 0 | 1 |
| **TỔNG** | | **5** | **9** |

---

## S1 — PUBLIC ROUTES (danh sách concrete, kèm file:line)

App dùng **BrowserRouter + guard cấp gốc**, không có route công khai nào ngoài 4
route auth. Bằng chứng cấu trúc:

| Route | file:line | Có auth? |
|---|---|---|
| `/login` | `packages/web/src/main.tsx:130` | **KHÔNG** — khai báo **ngoài** `ProtectedRoute` |
| `/register` | `packages/web/src/main.tsx:131` | **KHÔNG** |
| `/verify-email` | `packages/web/src/main.tsx:132` | **KHÔNG** |
| `/reset-password` | `packages/web/src/main.tsx:133` | **KHÔNG** |

Mọi route còn lại nằm **bên trong** `<Route path="/" element={ProtectedRoute}>`
(`main.tsx:137`) — tức bị guard. Guard lệch về `/login` khi không có token:

```
main.tsx:79   const hasStoredTokens = authTokenStorage.hasTokens();
main.tsx:80   if (!isAuthenticated || !hasStoredTokens) {
main.tsx:81     return createElement(Navigate, { to: '/login', replace: true, ... });
```

Route bắt-anything cũng không cứu được: `main.tsx:207` `path: '*'` →
`Navigate to '/dashboard'` → rơi vào `ProtectedRoute` → `/login`.

**Xác nhận bằng runtime** (không chỉ đọc code): `npx vite preview --port 4173`
(đã có `dist`), Playwright chromium `393×851`, `hasTouch`, storageState rỗng:

| Đường dẫn vào | URL cuối cùng sau redirect | h1 | console error | request fail |
|---|---|---|---|---|
| `/login` | `/login` | 1 (`VNInvest`) | 0 | 0 |
| `/register` | `/register` | 1 | 0 | 0 |
| `/verify-email` | `/verify-email` | 1 | 0 | 0 |
| `/reset-password` | `/reset-password` | 1 | 0 | 0 |
| `/support` | **`/login`** | 1 | 0 | 0 |
| `/` | **`/login`** | 1 | 0 | 0 |

Lệnh tái lập: `npx vite preview --port 4173` (cwd `packages/web`) rồi chạy
`node probe.cjs` với `playwright-core` + `chromium.launch()`, context
`{viewport:{width:393,height:851}, hasTouch:true, storageState:{cookies:[],origins:[]}}`.

**Kết luận S1 về mặt "route có tồn tại không"**: slice **KHÔNG** chết vì lý do mà
plan lo sợ nhất. 4 route public thật, render sạch, **không cần backend** (0 request
fail — bootstrap của `PortfolioProvider` không bắn khi không có token).

---

## Objection 1 — BLOCKER S1: AC-1.2 không bao giờ xanh, và AC-1.2(i) đã xanh sẵn

**AC-1.2** yêu cầu spec assert 2 điều *"có fail-trước"*:
(i) `scrollWidth <= innerWidth`, (ii) mọi control ≥ 44×44.

Đo thật trên cả 4 route public, viewport `393×851`:

| Tiêu chí | Kết quả |
|---|---|
| (i) `documentElement.scrollWidth (393) <= innerWidth (393)` | **ĐÃ PASS** trên cả 4 route |
| (ii) control có vùng chạm ≥ 44×44 | **FAIL 22/22** — chiều cao lớn nhất **38.4px** |

Bảng chi tiết 22 control (`node probe3.cjs`):

```
route            tag       w        h  shortH  id
/login           A       151.7    38.4   true    skip-link
/login           INPUT    295      38     true    auth-login-username
/login           INPUT    295      38     true    auth-login-password
/login           BUTTON   295      36     true    (w-full bg-brand-600 …)
/login           A         83.7    20     true    (link "Tạo tài khoản")
/login           A        101.5    20     true    (link "Quên mật khẩu?")
/register        INPUT    295      38     true    auth-register-{username,email,password,password-confirm}
/register        INPUT    1        1     true    invisible-honeypot      <-- honeypot, 1×1
/register        BUTTON   295      36     true
/verify-email    INPUT    295      38     true    auth-resend-email
/reset-password  INPUT    295      38     true    auth-reset-email
… tổng 22 control, shortH = 22/22
```

**Vấn đề 1 (blocker)**: §1 hứa *"G18 chỉ hứa sau khi S1 xong"*, còn §5 STOP #5 nói
"G18 đỏ vì auth chứ không vì 2 tiêu chí ⇒ dừng". Nhưng S1 **không sửa gì để làm
(ii) xanh**: AC-1.4 ghi rõ *"Chỉ sửa comment"* trong `src/index.css`. Không có AC
nào thêm `min-height: 44px`. ⇒ **G18 đỏ vĩnh viễn vì chính tiêu chí (ii)**, tức
đúng loại đỏ mà STOP #5 mô tả. Slice không thể đóng.

Cách thoát duy nhất mà plan chưa nói: `test.fail()` / `test.fixme()` cho (ii), hoặc
thêm min-height vào `src/index.css` (file **có** nằm trong file set của S1, nhưng
AC-1.4 cấm).

**Vấn đề 2 (major)**: (i) **không** phải fail-trước — nó xanh sẵn ở `dev`. AC-1.2
mô tả cả hai là "fail-trước" ⇒ mô tả sai một nửa.

**Vấn đề 3 (minor, ghi để worker tránh)**: honeypot `invisible-honeypot` là
`1×1px`, `display:block`, `visibility:visible` — selector naò sẽ bắt nó. Cần loại
`[aria-hidden]` / honeypot khỏi tập đo, nếu không AC trở thành "đỏ vì honeypot".

---

## Objection 2 — BLOCKER S1: `dist` không tồn tại trong worktree của agent

`webServer` của Playwright chạy `npm run preview` (`playwright.config.ts:54`).
Tôi đã **chứng minh** `vite preview` **hard-fail** khi không có `dist`:

```
$ node node_modules/vite/bin/vite.js preview --port 4398     # trong thư mục không có dist/
error when starting preview server:
Error: The directory "dist" does not exist. Did you build your project?
```

Hiện tại `packages/web/dist` **có** (118 file, build 10/8 22:25) — nhưng:

```
$ git check-ignore -v packages/web/dist
.gitignore:9:dist/       packages/web/dist
$ git ls-files packages/web/dist | Measure-Object | % Count
0
```

Tức `dist` **gitignored, 0 file được track**. Mà `docs/AGENT_PROTOCOL.md:179` bắt
agent tạo worktree riêng: `git worktree add ../agent-<tên> -b feat/<feature> dev`
⇒ worktree mới **không có `dist`** ⇒ `npm run preview` fail ⇒ G18 đỏ với lý do sai.

§1 có G17 `npm run build` nhưng **không nói thứ tự**. Cần ghi rõ: *G18 chạy sau
`npm run build`*, hoặc thêm `command: 'npm run build && npm run preview'`.

---

## Objection 3 — BLOCKER S2: `ShellStockDetailPage` render **2 `<h1>`**, AC-2.2 bắt buộc 1

AC-2.3 khẳng định *"6 trang **đã có** đúng 1 h1 (qua `WorkstationShell.tsx:53` và
`WhaleAdvisoryBentoHeader.js:44`)"*. Câu này **chỉ đúng 5/6**.

`market/ShellStockDetailPage.js` nest **2 cây h1**:

```
ShellStockDetailPage.js:31-35   e(WorkstationShell, { symbol, eyebrow, title }, e(StockDetailPage, ...))
WorkstationShell.tsx:53         e("h1", { id: titleId, ... }, displayTitle)          <-- h1 #1 (luôn render)
StockDetailPage.tsx:330         e(StockDetailHeader, { ..., loading: loadingBlocking })
StockDetailHeader.js:76         loading ? skeleton : e("h1", { className: "sdp-company-name" }, companyName)   <-- h1 #2
```

Trạng thái **settled** (`loadingBlocking === false`) ⇒ **2 h1** ⇒ AC-2.2
`toHaveLength(1)` **đỏ**. Chỉ khi `loading === true` mới tạm được 1 (h1 #2 bị thay
bằng skeleton `div`).

Để về 1 h1 phải **đổi product code** (hạ `StockDetailHeader.js:76` từ `h1` xuống
`h2`) ⇒ **vi phạm AC-2.3** ("Không thêm `<h1>` mới" — và cũng không được phép bỏ).
Đây là blocker: slice không thể vừa giữ AC-2.2 vừa giữ AC-2.3.

Ghi chú: comment cũ ở `page-heading-fu02c.component.test.tsx:218` nói
"`market/ShellStockDetailPage` → `WorkstationShell.tsx:53` là component con, cần
cây provider khác" — mô tả **thiếu** mắt xích thứ 2 (`StockDetailHeader`).

---

## Objection 4 — MAJOR S2: "cây provider đầy đủ" **không đủ** — 2/6 trang cần mock adapter

Plan AC-2.1 đáp lời *"Cần một `renderRoutePage()` dùng chung cho cây provider đầy
đủ"*. Tôi đọc import + hook từng trang; yêu cầu thật **mỗi trang một**:

| Trang | h1 từ đâu | Provider bắt buộc | **Cần thêm ngoài provider** | Nếu thiếu → h1 = ? |
|---|---|---|---|---|
| `UpgradePage` | `UpgradePage.tsx:54` (trong return duy nhất `:51`) | PortfolioProvider (`usePortfolio` **throw**, `PortfolioContext.js:718-722`), Router (`Link` `:2`) | — | 1 ✅ |
| `SupportPage` | `SupportPage.tsx:311` (trong return duy nhất `:309`) | PortfolioProvider (`:46`), Router (`useSearchParams` `:47`) | adapter bị nuốt lỗi (`:88` catch) — **không chặn** | 1 ✅ |
| `TransactionsPage` | `TransactionsPage.tsx:194` — **chỉ nhánh return thứ 3** | — (không dùng context) | **mock `coreApiAdapter.getPortfolios` trả ≥1 portfolio** | **0** ❌ |
| `UserSettingsPage` | `UserSettingsPage.tsx:182` — **chỉ nhánh return thứ 4** | LangProvider (tuỳ chọn, `LangContext.js:93-95` có fallback) | **mock `getUserProfile` resolve**, **ConfirmProvider**, mock broker API | **0** ❌ |
| `ShellStockDetailPage` | 2 h1 (Objection 3) | Router `/stocks/:symbol`, RealtimeContext | mock `useStockDetailPageModel`, workstation hooks, `VNStockChartPanel` (import `vninvestcharts-widget/dist/index.css` + dynamic `import('vninvestcharts-widget')`), `WhaleBubbleChart` (echarts) | 2 ❌ |
| `WhaleAdvisoryPage` | `WhaleAdvisoryBentoHeader.js:44` (trong header luôn render) | PortfolioProvider (`:101`), ConfirmProvider (`useConfirm` throw), Router (`useLocation` `:2`) | mock `useWhaleAdvisoryData` | 1 ✅ (nếu mock) |

Bằng chứng cụ thể cho `TransactionsPage`:

```
TransactionsPage.tsx:181  if (portfoliosLoading) return … <p className="core-loading">   → KHÔNG h1
TransactionsPage.tsx:185  if (!portfolioId && portfolios.length === 0) return … <p>/<a>  → KHÔNG h1
TransactionsPage.tsx:192  return e("div", …, e("header", …, e("h1", null, "Giao dịch")     → CÓ h1
```

Không mock adapter ⇒ `getPortfolios()` reject ⇒ `setPortfolios([])` (`:74`) ⇒ rơi
vào nhánh `:185` ⇒ **0 h1** ⇒ AC-2.2 đỏ. Đây đúng là kiểu lỗi comment cũ mô tả.

Tương tự `UserSettingsPage`: `if (loading) return` (`:170`), `if (error) return`
(`:174`), `if (!form) return null` (`:178`) — cả 3 nhánh **không h1**. Cần
`getUserProfile()` resolve để `setForm` chạy (`:102-112`). Ngoài ra nó render
`BrokerSettingsSection` (`:253`) ⇒ `useConfirm` (BrokerSettingsSection.tsx:66) và
5+ endpoint broker.

**Đánh giá câu trả lời của plan**: một helper có thể *chứa* provider + adapter-mock
mặc định, nhưng **không thể chỉ có provider**. Cần API kiểu
`renderRoutePage({ Component, path, adapterMocks, extraMocks })`. Đây là **major,
không phải blocker** — vì worker vẫn làm được, chỉ là AC-2.1 mô tả thiếu.

---

## Objection 5 — MAJOR S2: `WhaleAdvisoryPage` có tiền lệ đã chạy thật (tốt), nhưng
AC-2.5 bị đặt sai chỗ

`src/components/__tests__/whale-advisory-route.component.test.tsx` **đã render
được** `WhaleAdvisoryPage` với đúng 4 mock. Tôi chạy thật:

```
$ npx vitest run src/components/__tests__/whale-advisory-route.component.test.tsx
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  51.80s
```

Nhưng file đó `await import(...)` **bên trong** hàm (`:40`) — chính là anti-pattern mà
AC-2.5 (`:178-179`) cấm. AC-2.5 đúng hướng nhưng nên nói rõ: bắt buộc 6 trang
dùng import ở module scope **và** `test:components` phải chạy **chung với 117
file** (không phải `-t` lọc), vì lý do flake 27.5 s mà AC-2.5 trích là lý do *runtime
của full suite*.

---

## Objection 6 — BLOCKER S3: AC-3.1 trích `build.rollupOptions.input` — field **không tồn tại**

`packages/web/vite.config.ts` **không** khai `build.rollupOptions.input`:

```
$ Select-String -Path vite.config.ts -Pattern "input"   # packages/web
0 kết quả
```

`build.rollupOptions` chỉ có `output.manualChunks` (`vite.config.ts:49-105`) — đó là
**chunking**, không phải **entry point**. Vite default input là `index.html`, và
`index.html:27` chỉ có `<script type="module" src="/src/main.tsx">`.

⇒ AC-3.1 như viết **không implementable**. Nguồn entry thật, trung thực:
`index.html` → `/src/main.tsx` → module graph (`pageRegistry.js` dynamic import +
`main.tsx` static import). AC-3.1 phải viết lại theo nguồn này.

*(Ghi chú cho auditor kia: `docs/PLAN_UIUX_WAVE4.md:185` trích đúng
`vite.config.ts build.rollupOptions.input` nhưng citation đó **sai** — không có
dòng nào.)*

---

## Objection 7 — MAJOR S3: AC-3.6 trích sai đường dẫn `pageRegistry.js`

AC-3.6 (`:193`) và cả brief của tôi đều ghi `src/app/pageRegistry.js`.
File thật:

```
$ Get-ChildItem packages/web/src -Recurse -File -Filter "*egistry*"
packages\web\src\pages\pageRegistry.js      <-- pages/, KHÔNG phải app/
```

`src/app/` chỉ có `navigationCatalog.js` + `routeCatalog.js`. Worker a3 sẽ tìm
nhầm hoặc phải tự dò.

## Objection 8 — MAJOR S3: glob `Portfolio*Page.tsx` khớp **6** file, không phải 5

Plan (`:194`) nói *"5 file `pages/portfolio/Portfolio*Page.tsx` là tab con"*. Thư mục
thực tế:

```
$ Get-ChildItem src/pages/portfolio -Filter "Portfolio*Page.tsx"
PortfolioActivityPage.tsx     PortfolioHoldingsPage.tsx    PortfolioWorkspacePage.tsx
PortfolioAllocationPage.tsx   PortfolioOverviewPage.tsx
PortfolioAnalyticsPage.tsx
→ 6 file
```

5 file là tab con (đúng ý plan), nhưng **`PortfolioWorkspacePage.tsx` là entry thật**
(`pageRegistry.js:214-215`) — và nó **không** khớp regex `Portfolio[A-Za-z]*Page` mà
AC-3.6 dùng để *loại* tab. Nếu script dùng "loại file có tên khớp glob" thì nó loại
cả entry thật. Script phải exclude theo **cách import** (component không nằm trong
`pageRegistry` dynamic import), không theo tên file — đúng tinh thần hazard 7 mà
plan tự nhắc.

*(Số đo thật, để auditor kia đối chiếu: `pageRegistry.js` có **63** lần
`makePageEntry(`, trong đó **62** lần có routeId dạng chuỗi — lần thứ 63 là chính
dòng định nghĩa hàm `makePageEntry(routeId, status, loadComponent)` tại
`pageRegistry.js:167`; **62** target dynamic import khác nhau.)*

---

## Objection 9 — AC-3.5 implementable được, và bề mặt false-negative rất nhỏ

Tôi grep **case-sensitive** toàn repo cho `createElement|e|renderElement` với tham số
đầu **không phải literal**:

```
$ Get-ChildItem src -Recurse -Include *.ts,*.tsx,*.js,*.jsx | Select-String -CaseSensitive `
    -Pattern '\b(createElement|e|renderElement)\(\s*[a-z][\w$]*\s*[,)]'
src\components\ShellPageTemplate.js:4    function renderElement(type, props, ...children)
src\components\ShellPageTemplate.js:5      return createElement(type, props, ...children)
src\pages\coreShellPageHelpers.js:10      export function renderElement(type, props, ...children)
src\pages\coreShellPageHelpers.js:11        return createElement(type, props, ...children)
src\pages\pageRegistry.js:33                return createElement(resolvedComponent, props)
→ chỉ 5 dòng
```

⇒ "phần động" của AC-3.5 **liệt kê được, không phải mâu thuẩn**. 3 call-site động đó
phải được in ra. `ShellPageTemplate.js:119` gọi `renderElement("h1", …)` — literal
nên vẫn bắt được. `WhaleAdvisoryBentoHeader.js:44` có `'h1'` một mình trên dòng riêng
⇒ cần đúng yêu cầu multiline của AC-3.3.

**False-negative còn lại (không giải quyết được bằng static)**: `h1` đến từ
`children` truyền xuống qua component trung gian, hoặc từ thư viện ngoài
(`vninvestcharts-widget`). Static script **không** bắt được — nhưng AC-3.5 đã thừa
nhận bằng cách yêu cầu in phần động. Đánh giá: AC-3.5 **đủ**, không cần thêm.

---

## Objection 10 — BLOCKER S4: escape cấp biến đúng ⇒ `counted = 108`, **không phải 111**

Đây là objection nghiêm trọng nhất của wave.

**Tái lập baseline của plan (tôi chạy lại, KHỚP):**

```
$ node nav1probe.mjs packages/web/src
counted=99 suppressed=12 total=111
```

7 file bị che, `hasHook=false` cả 7 — **khớp §0.4 của plan**.

**Nhưng escape cấp biến không thể cho 111.** Lý do: **regex NAV-1 không bao giờ
nhìn thấy call-site `useUrlState` nào.**

Rule hiện tại (`scan-ui-guidelines.mjs:258`):

```js
const m = ctx.line.match(/const\s*\[\s*(\w*(filter|search|sort|page|tab|query|q)\w*)\s*,/i);
```

Sau `const [` regex **bắt buộc** một identifier `\w*`. Nhưng cả **6** call-site
`useUrlState` thật trong repo đều destructure **record**, tức ký tự ngay sau `[` là
`{`:

```
CoreDashboardPositionDeck.tsx:76    const [{ activeTab, pageSize, currentPage }, setUrlState] = useUrlState(
FactsFirstModularPositionDeck.jsx:38  const [{ activeTab, pageSize, currentPage }, setUrlState] = useUrlState(
AdminAuditPage.tsx:43                 const [{ page, tenantId, … }, setUrlState] =\n    useUrlState(…)
AdminBillingFleetPage.tsx:34         const [{ page, status, plan, search }, setUrlState] = useUrlState(
AdminCoreTenantsPage.tsx:32           const [{ search, status, page }, setUrlState] = useUrlState(
PortfolioHoldingsPage.tsx:96          const [{ search, sector, sortKey, sortDir }, setUrlState] = useUrlState(
TenantAdminMembersPage.tsx:87         const [{ searchQuery, roleFilter, activeTab }, setUrlState] = useUrlState(
```

⇒ **không call-site `useUrlState` nào tạo ra hit NAV-1** ⇒ escape cấp biến **không
có gì để escape** ở những file đó.

Dạng duy nhất **vừa nhìn thấy được vừa thật sự đã sync** là `useUrlValue("key", …)` —
và chỉ có **3** call-site, tất cả trong một file:

```
CampaignTable.jsx:64   const [sortCol,     setSortCol]     = useUrlValue("sort",    stringCodec, "");
CampaignTable.jsx:75   const [sortDesc,    setSortDesc]    = useUrlValue("sortDir", SORT_DIR_CODEC, "asc");
CampaignTable.jsx:89   const [globalFilter,setGlobalFilter]= useUrlValue("q",       stringCodec, "");
```

Ba cái này **thật sự đã đồng bộ URL** ⇒ escape cấp biến **bắt buộc** phải loại chúng.

Tôi cài lại đúng ý AC-4.1 và đo:

```
$ node pervar3.mjs packages/web/src
ESCAPED  src/features/advertising/components/CampaignTable.jsx:64  sortCol
ESCAPED  src/features/advertising/components/CampaignTable.jsx:75  sortDesc
ESCAPED  src/features/advertising/components/CampaignTable.jsx:89  globalFilter
NEW counted (file escape removed + per-var escape) = 108
```

**`counted = 108`, không phải 111.** Số 111 của plan (= 99 + 12) chỉ đúng nếu escape
**không bao giờ bắn** — tức trái với chính AC-4.1.

Hệ quả trực tiếp:
- **STOP condition #2** của plan (`§5.2`: "Sửa rule xong mà `NAV-1` ≠ 111 ⇒ **dừng**")
  sẽ bắn **ngay lập tức** khi worker làm đúng ⇒ worker buộc phải làm sai hoặc dừng.
- **AC-4.3** (`--write-baseline` 99→111) và **AC-4.8** (99→94) đều sai ⇒ **AC-2.4(a)
  "counted giảm ≥5"** cũng phải viết lại (đúng ra 108 → 103).

Số đúng cần ghi: **baseline `NAV-1 = 108`**, giảm **5** ⇒ `current = 103`.

*(Gửi auditor kia: con số `counted=99 / suppressed=12 / total=111` là **đúng** cho
rule *hiện tại*. Chỉ có phép suy diễn "sau khi đổi rule ⇒ 111" là sai.)*

---

## Objection 11 — MAJOR S4: alternative `q` trong regex NAV-1 sinh 12 false positive,
và plan đang định "sửa" 1 trong số đó

Cùng regex, bỏ nhánh `|q`:

| Cách khớp | Số hit |
|---|---|
| Khớp **không cần** nhánh `q` | 87 |
| Khớp **chỉ vì** nhánh `q` | **12** |

12 hit "chỉ vì `q`":

```
AdvisoryOrderTicket.js:14     quantity           <- số lượng mua, KHÔNG phải filter
DNSEConnectionPanel.js:78     orderQuantity      <- số lượng, KHÔNG phải filter
SocDataInventorySection.tsx   queueTiers{,Expanded,Loading,Error}
SocDataOpsMonitorSection.tsx  queueTiers, queueTiersError
useRealtimeFeedCore.js:447    quotesBySymbol     <- bảng giá, KHÔNG phải filter
BillingCenterPage.tsx:326     quota              <- hạn mức, KHÔNG phải filter
TenantAdminUsagePage.tsx:121  quotas             <- hạn mức, KHÔNG phải filter
AdminCoreAuditTracePage.tsx:71 selectedRequestId  <- chọn dòng, KHÔNG phải filter
```

AC-4.8 liệt kê `selectedRequestId` là 1 trong 5 hit "sửa được". Nhưng nó khớp
**chỉ vì chữ `q` trong `Request`**. Đồng bộ *hàng được chọn* vào URL là đổi hành vi
sản phẩm để làm một regex hài lòng — đúng loại "làm yếu gate / làm AC trông đạt"
mà `HANDOFF_UIUX_WAVE3_20261008.md §4.2` đã cảnh báo.

Cách chữa đúng cho 7 hit kia (quantity/orderQuantity/quota(s)/queueTiers*/quotesBySymbol)
là **siết regex** (bỏ nhánh `|q` đơn, hoặc yêu cầu `q` là từ đứng riêng), **không**
phải sửa code sản phẩm. Plan không cân nhắc.

---

## Objection 12 — MAJOR S4: escape theo "tên có trong spec" ⇒ false escape

AC-4.1 nói escape khi *"`v` thật sự là **key** trong spec của hook URL"*. Nếu implement
bằng cách *file-level* thu thập key của mọi spec rồi so tên, dính bẫy này:

```
$ node collide.mjs packages/web/src
src/components/dashboard/FactsFirstModularPositionDeck.jsx
   specKeys=["activeTab","pageSize","currentPage"]
src/features/advertising/components/CampaignTable.jsx
   specKeys=["sort","sortDir","q"]
src/pages/admin/AdminAuditPage.tsx          specKeys=[page, tenantId, actor, action, …]
src/pages/admin/AdminBillingFleetPage.tsx   specKeys=[page, status, plan, search]
src/pages/admin/AdminCoreTenantsPage.tsx    specKeys=[search, status, page]
src/pages/tenant-admin/TenantAdminMembersPage.tsx specKeys=[searchQuery, roleFilter, activeTab, parse, serialize]
```

Hai vấn đề cụ thể:

1. **`FactsFirstModularPositionDeck.jsx:47`** có `const [selectedSymbol,
   setSelectedSymbol] = useState(selectedSymbolProp || 'all')` — một state **không
   liên quan** nằm cùng file với `useUrlState`. Chưa va nhau (tên khác), nhưng nếu ai
   đó thêm `selectedSymbol` vào spec thì escape sẽ **giấu một `useState` thật sự
   chưa sync** — đúng thứ tai họa mà escape cấp file gây ra, chỉ chậm hơn.
2. **Parser của tôi bắt nhầm `parse`/`serialize`** thành key của
   `TenantAdminMembersPage` (`MEMBERS_URL_SPEC.roleFilter` dùng object literal chứa
   `parse:`/`serialize:` ở `TenantAdminMembersPage.tsx:23`) ⇒ chứng minh regex-over-
   object-literal **dễ ăn nhầm**, và ăn nhầm theo hướng **escape thừa**.

⇒ Escape phải **neo vào call-site** (`const [x, …] = useUrlValue/useUrlState/useUrlRecord(`
trên cùng statement), **không** gom key theo file. Đây là ràng buộc thiết kế bắt buộc
phải ghi vào AC-4.1.

---

## Objection 13 — S4 SKIP constraint: có thể làm được, và làm *behaviour-neutral*

AC-4.1 yêu cầu *"1 dòng comment chứa tên hook **không** được làm giảm hit nào"*.
Scanner **đã có** sẵn mảng `lines` đã lọc comment kèm số dòng thật
(`scan-ui-guidelines.mjs:320-325`):

```js
const kept = [];
raw.forEach((l, idx) => { if (!isCommentLine(l, cState)) kept.push({ t: l, n: idx + 1 }); });
const lines   = kept.map((k) => k.t);
const trueLine= kept.map((k) => k.n);
```

Lỗi hiện tại nằm đúng một chỗ: `scan-ui-guidelines.mjs:336` test trên **`txt`**
(file thô, **có** comment), không phải `lines`:

```js
fileHasUrlSync: /useSearchParams|URLSearchParams|useNavigate|useLocation/.test(txt),   // ← txt
```

Tôi đo cả hai nguồn để xem fix có đổi số không:

```
$ node nav1syncsrc.mjs packages/web/src
syncSource=txt:   counted=99 suppressed=12 total=111
syncSource=lines: counted=99 suppressed=12 total=111
  suppressed files: {TenantAdminCommandPalette.tsx:1, Header.tsx:1,
                     ShellOperationsCenterPage.tsx:2, AICommandCenterPage.tsx:2,
                     ScreenerPage.tsx:1, WhaleAdvisoryPage.tsx:3, SupportPage.tsx:2}
```

⇒ đổi `txt` → `lines.join("\n")` **không đổi số hôm nay** (không file nào dựa
vào comment để né) và **nghiêm ngặt hơn** ⇒ fix an toàn, đúng ý AC-4.1. AC-4.2 yêu
cầu 2 mẫu âm — mẫu (a) chính là case này.

---

## Objection 14 — MAJOR S4: AC-4.7 ("3 lần gọi ⇒ không phát sinh 3 entry") **không
quan sát được** qua harness hiện có

`useUrlState.ts:91` và `:131` hardcode `{ replace: false }` — thêm option thì dễ. Nhưng
AC-4.7 đòi assert *"3 setter call với `replace:true` ⇒ không phát sinh 3 entry;
mặc định ⇒ 3 entry"*.

Vấn đề: `createMemoryRouter` trả về `Router` mà `state` **không có** mảng history /
chỉ số entry:

```
node_modules/@remix-run/router/dist/router.d.ts:200-256
export interface RouterState {
  historyAction; location; matches; initialized; restoreScrollPosition;
  preventScrollReset; navigation; revalidation; loaderData; actionData;
  errors; fetchers; blockers;      ← không có `history`, không có `index`
}
```

Nên **không đếm được entry**. Cách duy nhất trong harness hiện tại là *đo bằng
hành vi*: `await router.navigate(-1)` lặp 3 lần và xem dừng ở đâu. Cách đó *kiểm
được* replace semantics nhưng **không** phát biểu được "3 entry" ⇒ AC-4.7 phải viết
lại thành hành vi (back N lần ⇒ quay về URL gốc).

Lựa chọn thay thế — import `createMemoryHistory` từ `@remix-run/router` để đọc
`history.index` — **vi phạm** ràng buộc không thêm dependency: `@remix-run/router`
**không** nằm trong `packages/web/package.json` (chỉ là transitive của
`react-router-dom`).

*(Gửi auditor kia: `packages/web/package.json` → `dependencies['@remix-run/router']`
= `NOT DIRECT`.)*

---

## Objection 15 — MAJOR S4: AC-4.4 tự mâu thuẫn với §2 về nơi đặt `useUrlRecord`

§2 (`:129`) liệt kê file mới: `packages/web/src/hooks/useUrlRecord.ts` (**mới**).
AC-4.4 (`:209-212`) nói: *"**Cùng file** `useUrlState.ts` để không sinh import vòng."*
Hai chỗ khác nhau. Worker sẽ phải đoán.

## Objection 16 — MAJOR S4: AC-4.8 "99 → 94" phải sửa thành "108 → 103"

Hệ quả trực tiếp của Objection 10. `§0.3(a)` (`:61`), `AC-2.4(a)` (`:63`) và `AC-4.8`
(`:224`) đều dựa trên `99`. Nếu `§0.3(c)` (`:67`, `current = 106`) được giữ thì
mâu thuẫn nội tại với `AC-4.8`.

---

## Objection 17 — S5: AC-5.1 đúng file, nhưng lỗi **đã hết**, nên AC sai nghĩa

AC-5.1 (`:229-232`) bảo sửa `docs/TEST_REPORT_UIUX_WAVE2.md:36` từ
`FactsFirstWhaleBubbleChart.jsx` sang `OrderFlowRadarPanel.js`.

Xác nhận mặt đúng: `TEST_REPORT_UIUX_WAVE2.md:36` ghi
`file: src/components/FactsFirstWhaleBubbleChart.jsx`, trong khi error thật là ở
`OrderFlowRadarPanel.js` — file đó có đúng comment W3-4 (`:154-156`) và deps đã
đúng: `}, [filteredCvdSeries, locale]);` (`OrderFlowRadarPanel.js:157`).

Nhưng lỗi **không còn**:

```
$ npx eslint src/components/FactsFirstWhaleBubbleChart.jsx src/components/OrderFlowRadarPanel.js
? 8 problems (0 errors, 8 warnings)
```

0 error. ⇒ AC-5.1 phải ghi *"đã hết ở W3-4"*, không chỉ đổi tên file. Nếu chỉ đổi
tên file thì report vẫn nói "1 error còn tồn tại" ⇒ **sai sự thật mới**.

**AC-5.2 phần verify được**: `TEST_REPORT_UIUX_WAVE2.md:25` **đúng** là ghi
`exit 0`, `116 file / 804 test`. Phần plan khẳng định *"thật ở `dev` @ `7aeef9503`:
exit 1, 2 failed / 802"* —
`KHÔNG VERIFY ĐƯỢC` (cần chạy full `npm run test:components`, ~hàng chục phút và
baseline đã ghi 602 test/10 failures ở `AGENTS.md`). Đề nghị plan ghi
*"chưa tái lập được, giữ con số cũ kèm chú thích"* thay vì thay bằng con số chưa kiểm.

---

## Objection 18 — S1: các mốc plan đã verify được (không phải objection, để chốt)

| Khẳng định của plan | Kết quả | Lệnh |
|---|---|---|
| Project `mobile-ergonomics` chưa tồn tại | **đúng** — `Error: Project(s) "mobile-ergonomics" not found. Available projects: "setup","chromium","firefox","webkit","mobile-chrome","mobile-safari"` | `npx playwright test --project=mobile-ergonomics --list` |
| Không có `testMatch` thì project nuốt hết spec có-auth | **đúng** — `tests/visual/` có **18** `*.spec.ts`; `npx playwright test --list` ⇒ `Total: 631 tests in 19 files` | `Get-ChildItem tests/visual -Filter *.spec.ts \| Measure-Object` |
| Chromium đã cài (không cần `playwright install`) | **đúng** — `ms-playwright/` có `chromium-1223`, `chromium-1228`, `chromium_headless_shell-*` | `ls %LOCALAPPDATA%/ms-playwright` |
| `AC-1.4`: comment `index.css:763-768` sai | **đúng** — comment (`:764`, `:768`) nói *"safe-area-inset-* = 0, touch-action = 0 …khong can media query"*, trong khi `:777-806` khai cả 3 | đọc `packages/web/src/index.css:760-806` |

---

## Đề xuất sửa (tối thiểu để plan thành NEED_REVISION → PASS)

1. **S1**: thêm AC-1.7 *"spec chấp nhận (ii) đỏ có chủ đích (`test.fail`) vì S1 không
   sửa touch-target"* **hoặc** mở rộng AC-1.4 để thêm `min-height` vào
   `src/index.css`. Sửa AC-1.2(i) thành *"regression guard, đang xanh"*.
2. **S1**: ghi rõ `G18` chạy **sau `npm run build`** (`dist` gitignored, worktree mới
   không có).
3. **S2**: AC-2.1 phải nói *"helper + **adapter mocks theo từng trang**"*, và AC-2.2
   phải ngoại lệ `ShellStockDetailPage` hoặc — tốt hơn — tách nó ra khỏi 6 trang và
   mở ticket riêng để hạ `StockDetailHeader.js:76` xuống `h2` (việc sửa product code,
   **không** làm trong wave này).
4. **S3**: viết lại AC-3.1 theo nguồn thật `index.html:27` → `/src/main.tsx`.
5. **S3**: sửa path `src/app/pageRegistry.js` → `src/pages/pageRegistry.js`;
   AC-3.6 loại tab theo **cách import**, không theo tên file.
6. **S4**: đổi mọi con số `111` → **`108`**, `99` → `108`, `94` → `103`;
   `§0.3(c) current=106` → **`103`**; sửa **STOP #2** thành `NAV-1 ≠ 108`.
7. **S4**: AC-4.1 phải ghi rõ *"escape **neo theo call-site**, không gom key theo
   file"* (chống `selectedSymbol` — Objection 12).
8. **S4**: AC-4.7 viết lại thành hành vi (`navigate(-1)` ×3) vì `RouterState` không
   lộ history (`router.d.ts:200-256`); bỏ mọi gợi ý import `@remix-run/router`.
9. **S4**: chốt một chỗ đặt `useUrlRecord` (§2 vs AC-4.4 đang mâu thuẫn).
10. **S4**: xem lại việc tính `selectedRequestId` là hit "sửa được" — nó chỉ khớp vì
    nhánh `|q`; 7 hit tương tự nên siết regex chứ không sửa product code.
11. **S5**: AC-5.1 ghi *"đã hết ở W3-4 (0 error đo 2026-10-09)"*; AC-5.2 phần
    `7aeef9503` ghi *"chưa tái lập được"*.

---

## Appendix — các probe đã dùng (tất cả read-only, không ghi vào repo)

| Probe | Nội dung |
|---|---|
| `nav1probe.mjs` | tái tạo `counted/suppressed/total` của NAV-1 → 99/12/111 |
| `nav1list.mjs` | in đủ 99 hit kèm `file:line` |
| `nav1q.mjs` | tách 12 hit chỉ-khớp-vì-nhánh `\|q` |
| `nav1hookfiles.mjs` | 4 hit nằm trong file dùng `useUrlState/useUrlValue` |
| `nav1syncsrc.mjs` | chứng minh `txt` vs `lines` cho **cùng** 99/12 |
| `pervar2/pervar3.mjs` | cài escape cấp biến ⇒ **108** |
| `collide.mjs` | phát hiện false-escape `selectedSymbol` + parser ăn nhầm `parse/serialize` |
| `shapes.mjs` | liệt kê shape của 6 call-site `useUrlState` (record destructure) |
| `probe1/probe2/probe3.cjs` | Playwright thật: public routes, h1, console error, 22 control, scrollWidth |

Không có file nào trong repo bị sửa. `git status --short` cuối phiên:

```
?? docs/PLAN_AUDIT_UIUX_WAVE4.md     (của auditor kia, không phải của tôi)
?? docs/PLAN_UIUX_WAVE4.md            (plan, có sẵn từ trước)
```