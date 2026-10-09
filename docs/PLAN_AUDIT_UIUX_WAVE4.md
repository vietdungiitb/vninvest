# AUDIT ĐỘC LẬP — `docs/PLAN_UIUX_WAVE4.md` (rev 1)

- **Đối tượng**: `docs/PLAN_UIUX_WAVE4.md` (268 dòng, untracked tại `dev`)
- **Base**: `ea0002d00` · nhánh `dev` · `git status --short` = chỉ `?? docs/PLAN_UIUX_WAVE4.md`
- **Ngày audit**: 2026-10-09 · auditor độc lập, read-only (chỉ ghi file báo cáo này)
- **Phương pháp**: tự viết lại NAV-1 từ đầu (`%TEMP%\uiuxaudit\nav1-verify.mjs`), chạy lại toàn bộ gate, đọc từng `file:line` được trích.

## Verdict

**NEED_REVISION**

**confidence: high**

Tóm tắt: **NAV-1 numbers của plan ĐÚNG TUYỆT ĐỐI** (99/12/111, đúng từng dòng `file:line`, `hasHook=false` cả 7 file) — đây là phần plan làm tốt nhất và tôi không tìm được sai số nào. Phần còn lại có **2 blocker**: AC-3.1 trích **cấu hình không tồn tại** (`vite.config.ts` không có `build.rollupOptions.input`) kèm AC-3.6 trích **đường dẫn không tồn tại** (`src/app/pageRegistry.js` — thật là `src/pages/pageRegistry.js`), và AC-2.3/AC-2.2 dựa trên tiền đề sai rằng cả 6 trang đều lấy h1 từ `WorkstationShell`/`WhaleAdvisoryBentoHeader` — thực đo cho thấy **4/6 trang tự có `e("h1",…)` ngay trong file**. Ngoài ra có một mâu thuẫn nội tại giữa AC-4.3 (baseline `NAV-1 = 111`) và AC-4.8 (`counted` 99 → 94) mà STOP condition #2 sẽ bắt nhầm.

---

## 1. Kết quả NAV-1 — khớp plan 100%

Lệnh tái lập (script của tôi, độc lập với `scan-ui-guidelines.mjs`):

```
node %TEMP%\uiuxaudit\nav1-verify.mjs "C:\Mujoco Projects\vninvest\packages\web\src"
```

| Số | Plan | Tôi đo | Kết luận |
|---|---|---|---|
| `counted` | 99 | **99** | khớp |
| `suppressed` | 12 | **12** | khớp |
| `total` | 111 | **111** | khớp |
| `hasHook=false` | 7/7 file | **7/7 file** | khớp |

Gate thật cũng xác nhận: `## [P1] NAV-1 — 99 hit`, `TONG = 172 P0=0 P1=107 P2=63 P3=2`.

Phân rã 9 hit 4 file P1 (§0.2) — **từng dòng đều đúng**:

```
src/pages/admin/AdminCoreAuditTracePage.tsx:68  var=filtersDraft       ✓
src/pages/admin/AdminCoreAuditTracePage.tsx:69  var=filters            ✓
src/pages/admin/AdminCoreAuditTracePage.tsx:71  var=selectedRequestId  ✓
src/pages/admin/AdminCoreJobsPage.tsx:52        var=filtersDraft       ✓
src/pages/admin/AdminCoreJobsPage.tsx:53        var=filters            ✓
src/pages/admin/AdminCorePATsPage.tsx:25        var=filtersDraft       ✓
src/pages/admin/AdminCorePATsPage.tsx:32        var=filters            ✓
src/pages/admin/AdminCoreServiceAccountsPage.tsx:23 var=filtersDraft   ✓
src/pages/admin/AdminCoreServiceAccountsPage.tsx:30 var=filters        ✓
src/pages/admin/AdminCoreTenantsPage.tsx:27     var=searchDraft       ✓
```

⇒ **4 `filtersDraft` + 4 `filters` + 1 `selectedRequestId` = 9**. Plan đúng; handoff thiếu là đúng.

---

## 2. Objections

| ID | Sev | Claim trong plan | Tôi đo được | Lệnh tái lập | Impact |
|---|---|---|---|---|---|
| **O1** | **blocker** | AC-3.1 (L183-185): *"entry point lấy từ **build config** (`vite.config.ts` `build.rollupOptions.input`)"* | **`input` không tồn tại.** `vite.config.ts:49` chỉ có `rollupOptions: { output: { manualChunks… } }`. Entry thật là `index.html` (default Vite). | `Select-String -Path packages\web\vite.config.ts -Pattern "input"` → **0 match**; `Get-Content packages\web\vite.config.ts -Encoding utf8 -Raw \| Select-String '\binput\s*:'` → `False` | Worker a3 viết script theo AC này sẽ **đọc `undefined` rồi crash**, hoặc tự chế entry point khác ⇒ vi phạm chính hazard 7 mà AC này sinh ra để chống. Sửa: AC-3.1 phải chỉ `index.html` làm entry (rollupOptions.input **không** khai báo). |
| **O2** | **blocker** | AC-3.6 (L193): *"Đối chiếu `src/app/pageRegistry.js`"* | **KHÔNG TỒN TẠI.** Registry thật ở `src/pages/pageRegistry.js` (+ `pageRegistry.d.ts`). Không có thư mục `src/app/` nào chứa file này. | `Get-ChildItem packages\web\src -Recurse -Filter "*pageRegistry*"` → `src\pages\pageRegistry.js`, `src\pages\pageRegistry.d.ts` | Hazard 3 vi phạm ngay trong AC: worker đọc file không tồn tại, hoặc bỏ nhánh đối chiếu registry ⇒ bỏ sót false positive `*Page.tsx` (AC này sinh ra chính để chặn). Sửa: đổi thành `src/pages/pageRegistry.js`. |
| **O3** | **major** | AC-2.3 (L174-176): *"6 trang **đã có** đúng 1 h1 (qua `WorkstationShell.tsx:53` và `WhaleAdvisoryBentoHeader.js:44`)"* | **Tiền đề sai 4/6.** Chỉ 2 trang dùng shell: `ShellStockDetailPage.js:3,33` → `WorkstationShell`; `WhaleAdvisoryPage.tsx` → `WhaleAdvisoryBentoHeader`. 4 trang còn lại có h1 **ngay trong file**: `SupportPage.tsx:311`, `TransactionsPage.tsx:194`, `UserSettingsPage.tsx:182`, `UpgradePage.tsx:54` — tất cả `e("h1", …)`. | `Select-String -Path packages\web\src\pages\SupportPage.tsx -Pattern 'h1'` → `line 311`; tương tự 3 file kia. `Select-String -Path <4 file> -Pattern 'WorkstationShell'` → **0 match** | AC-2.3 nói "không thêm h1 mới" — kết luận vẫn **đúng** (6 trang đều có 1 h1), nhưng lý do được nêu sai. Nguy hiểm thật: nếu 4 trang kia **không** có h1, AC-2.2 sẽ fail và plan không có AC nào dự phòng. Sửa: sửa câu "qua …" thành "4 trang tự có `e("h1")` trong file + 2 trang qua shell". |
| **O4** | **major** | AC-4.3 (L206-208) `NAV-1` 99 → **111**; AC-4.8 (L223) *"Sau khi sửa 4 file P1: `NAV-1 counted` 99 → 94"* | **Mâu thuẫn nội tại.** Sau khi rule đổi, `counted` = 111 (không phải 99). Giảm 5 ⇒ **106**. Plan vừa nói 111 vừa nói 99→94 ở hai AC cùng slice. §0.3(c) tự thừa nhận: *"baseline NAV-1 = 111 ⇒ current = 106"* — mâu thuẫn AC-4.8. | `node %TEMP%\uiuxaudit\nav1-verify.mjs packages\web\src` (counted 99 + suppressed 12 = 111; 111−5 = 106) | STOP condition #2 (L263): *"Sửa rule xong mà `NAV-1` ≠ 111 ⇒ dừng"*. Worker làm đúng AC-4.3 rồi đọc AC-4.8 sẽ thấy 106 ≠ 94 và **dừng nhầm**, hoặc tự hạ AC cho khớp. Sửa AC-4.8 thành "111 → 106". |
| **O5** | **major** | §0.4 (L75-79): *"Sửa escape … làm lộ **12 hit** mà escape đang giấu"* + §4.1 *"chỉ để lộ, không sửa"* | Số 12 đúng, nhưng **ít nhất 6/12 là false positive thật**, không phải "việc để lộ trung thực". Đo từng biến: `ShellOperationsCenterPage.tsx:40 searchParams` = `useRouterSearchParams()` **đã là biến URL**; `:52 activeTab` đã sync qua `useEffect:54-56` đọc `searchParams.get("tab")`; `ScreenerPage.tsx:158 searchParams` = `useSearchParams()`; `SupportPage.tsx:47 searchParams` = `useSearchParams()`; `AICommandCenterPage.tsx:43-44 pageError/pageNotice` **không phải filter/pagination** (chỉ trùng regex vì chứa chữ `p`+`q`… thực ra do `page` — chúng là message lỗi/thông báo). | Đọc `packages\web\src\pages\admin\ShellOperationsCenterPage.tsx:40,52-56`; `packages\web\src\pages\ScreenerPage.tsx:2,158`; `packages\web\src\pages\SupportPage.tsx:2,47`; `packages\web\src\pages\AICommandCenterPage.tsx:41,43,44`. Regex: `scan-ui-guidelines.mjs:258` | Nâng baseline lên 111 có thể **hợp thức hoá 6 lỗi giả** vĩnh viễn (baseline chặn thoái lùi, không tự thu hồi). §0.4 nói "không file nào đã sửa" — đúng về `useUrl*`, nhưng bỏ qua `useSearchParams`/`useRouterSearchParams` vốn **cũng là đồng bộ URL**. AC-4.1 cần nêu rõ escape cấp biến phải nhận diện `searchParams`/`activeTab` đã sync, nếu không S4 sẽ tạo ra nợ giả. |
| **O6** | **minor** | §1 G1: *"`scan-ui-guidelines.mjs` mất **211 s**"*, kèm cảnh báo "đừng timeout 30 s" | Chạy thật: **311.7 s** (exit 0). G2 (`check-uiux-budget`, có `execFileSync` scanner tại `check-uiux-budget.mjs:40`) = **224.2 s**. Con số 211 s không tái lập được trên máy này. | `$sw=[Diagnostics.Stopwatch]::StartNew(); node docs\audit-uiux\scripts\scan-ui-guidelines.mjs packages\web\src; $sw.Elapsed.TotalSeconds` | Nội dung cảnh báo ("đừng kết luận script hỏng") là **đúng và hữu ích** — tôi cũng suýt kết luận sai khi timeout 180 s. Nhưng nếu worker đặt timeout 300 s theo con số 211 s thì vẫn có nguy cơ đỏ giả trên máy chậm. Sửa: ghi "≥ 300 s, đo được 311.7 s". |
| **O7** | **minor** | AC-1.1 (L148-149): *"không có `testMatch`, project nhận cả **18** `*.spec.ts` chụp có-auth"* | **18 là đúng.** `tests\visual\*.spec.ts` = 18 file. | `(Get-ChildItem packages\web\tests\visual -Filter *.spec.ts).Count` → `18` | Không có objection — ghi vào mục REFUTED bên dưới. |
| **O8** | **minor** | AC-1.1 (L144-147): viewport `393×851`, không `devices[...]` | `playwright.config.ts` hiện có 5 project (`setup`, `chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`), **không có** `mobile-ergonomics`. Các project có-auth đều khai `storageState: authFile` — nên AC yêu cầu `storageState: {cookies:[],origins:[]}` là chính đáng. | `Get-Content packages\web\playwright.config.ts -Encoding utf8` (dòng 19-48) | Không có objection về số; nhưng **không** ai đã kiểm `iPhone 12` viewport để tránh trùng `mobile-safari`. Minor. |
| **O9** | **minor** | Hazard 6 (L87): bảng baseline "đo thật" | **19/19 gate khớp exit code**, kể cả các gate tôi không chạy hết cũng tồn tại. Chi tiết mục 3. | xem bảng §3 | Không có objection về exit code. |
| **O10** | **minor** | Hazard 9 (L87): không tên lệnh không tồn tại | `node packages/web/scripts/check-uiux-budget.mjs` — đúng tên thật ✓. **NHƯNG** `docs/audit-uiux/scripts/nav1-report.mjs` **không tồn tại** và plan trích nó như lệnh đã chạy ở §0.1 (L26). | `Test-Path docs\audit-uiux\scripts\nav1-report.mjs` → `False` | Plan ghi *"Lệnh (giữ lại trong `nav1-report.mjs`, commit cùng wave)"* — tức là script **chưa tồn tại**, số liệu §0.1 **không tái lập được bằng lệnh plan đưa ra**. Sửa: ghi rõ script chưa có, hoặc commit nó trước khi audit. (Số liệu thì đúng — tôi đã tái lập bằng script riêng.) |

---

## 3. Bảng baseline §1 — đối chiếu đầy đủ

| # | Lệnh | Plan | Tôi đo | Verdict |
|---|---|---|---|---|
| G1 | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | 0 · `TONG = 172 P0=0 P1=107 P2=63 P3=2` · 211 s | **exit 0** · **TONG = 172 P0=0 P1=107 P2=63 P3=2** · **311.7 s** | ✅ số · ❌ thời gian (O6) |
| G2 | `node packages/web/scripts/check-uiux-budget.mjs` | 0 · 246 → 172 (−74) | **exit 0** · `baseline 2026-10-07 = 246, hien tai = 172 (-74)` | ✅ |
| G3 | `… --self-test` | 0 · 1 trường hợp tăng | **exit 0** · `self-test PASS (1 truong hop tang bi phat hien)` | ✅ |
| G4 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | 0 · 59 nhóm trùng | **exit 0** · `59 so trung` | ✅ |
| G5 | `… --next-entry` | 0 · in **257** | **exit 0** · in `257` | ✅ |
| G6 | `node packages/web/scripts/check-multi-agent.mjs` | 0 · ~66 cảnh báo | **exit 0** · `CẢNH BÁO (66)` | ✅ |
| G7 | `npm run check:tokens` | 0 | **exit 0** | ✅ |
| G8 | `npm run check:contrast` | 0 | **exit 0** | ✅ |
| G9 | `npm run check:dom-landmarks` | 0 | **exit 0** | ✅ |
| G10 | `npm run check:ts-imports` | 0 | **exit 0** | ✅ |
| G11 | `npm run check:i18n-hardcoded` | 0 | **exit 0** | ✅ |
| G12 | `npm run check:admin-spa-routes` | 0 | **exit 0** | ✅ |
| G13 | `npm run check:shell` | 0 | **exit 0** (33.9 s) | ✅ |
| G14 | `npx tsc --noEmit` (cwd = `packages/web`) | 0 | **exit 0** (44.9 s) | ✅ *(xem caveat bên dưới)* |
| G15 | `npm run lint` | 0 · 3743 problems / **0 error** | **exit 0** · `✖ 3743 problems (0 errors, 3743 warnings)` | ✅ **khớp tuyệt đối** |
| G16 | `npm run test:components` | 0 · 117 file / 817 test | **exit 0** · `Test Files 117 passed (117)` / `Tests 817 passed (817)` | ✅ **khớp tuyệt đối** |
| G17 | `npm run build` | 0 | **exit 0** · `✓ built in 33.92s` | ✅ |
| G18 | `npm run test:visual --project=mobile-ergonomics` | CHƯA CHẠY | project không tồn tại — `playwright.config.ts` chỉ có 5 project, không có `mobile-ergonomics` | ✅ **plan khai báo CHƯA CHẠY là trung thực** |
| G19 | `python manage.py makemigrations --check --dry-run` | N/A | `manage.py` thật ở `packages/core/backend/manage.py`; plan không tạo migration ⇒ N/A hợp lệ | ✅ |

**Caveat G14**: `npx tsc --noEmit -p packages/web/tsconfig.json` từ repo root **exit 1** với `This is not the tsc command you are looking for` — vì `npx` không resolve được `typescript` khi không có cwd vào package. Chạy đúng `workdir=packages/web` thì **exit 0**. Plan ghi *"Đo tại: cwd = repo root, trừ khi ghi `cd packages/web`"* nhưng **không ghi `cd packages/web` cho G14** ⇒ lệnh nguyên văn của plan chạy từ root sẽ đỏ giả. Sửa: thêm `cd packages/web` vào G14/G15/G16/G17 hoặc ghi chú chung.

---

## 4. Citation existence (hazard 3)

| Citation plan | Nội dung plan nói | Đọc thật | Verdict |
|---|---|---|---|
| `scan-ui-guidelines.mjs:348-357` | `selectorName` chạy regex O(40·n) mỗi dòng CSS | `348: selectorName: isCss ? (() => {` … `357: })() : null,` — đúng vị trí, đúng nội dung | ✅ |
| `useUrlState.ts:9-11` | `*Draft` không đồng bộ vì `useEffect` loop | `9: * AC-4: chỉ đồng bộ state **đã áp dụng**. State \`*Draft\`…` / `10: …nếu đồng bộ cả hai sẽ \`useEffect\` loop.` | ✅ |
| `src/index.css:763-768` | comment cũ: *"safe-area-inset-* = 0, touch-action = 0, overscroll-behavior = 0"* + *"khong can media query"* | `763: Do bang Get-ChildItem \| Select-String trong src/:` / `764: safe-area-inset-* = 0, touch-action = 0, overscroll-behavior = 0` / `768: Bien env() = 0px tren desktop nen an toan, khong can media query.` | ✅ |
| `src/index.css:777-806` | chính `:777-806` đã khai cả 3 | `777-789` `touch-action: manipulation`; `793-799` `overscroll-behavior: contain`; `803-806` `padding-left/right: env(safe-area-inset-…)` — **cả 3 đều có** | ✅ (file dài đúng 806 dòng) |
| `WhaleAdvisoryBentoHeader.js:44` | `'h1'` nằm trên dòng riêng | `43: e(` / **`44:   'h1',`** / `45: { className: … }` | ✅ *(đường dẫn thật: `src/components/advisory/WhaleAdvisoryBentoHeader.js`, plan không ghi path nên không sai)* |
| `WorkstationShell.tsx:53` | h1 đến từ shell | `53: e("div", null, e("h1", { id: titleId, className: styles.title }, displayTitle),` | ✅ |
| `AdvisoryOrderTicket.js:14` | `quantity` là ô nhập form cố ý giữ | `14: const [quantity, setQuantity] = useState('100');` | ✅ |
| `DNSEConnectionPanel.js:78` | `orderQuantity` là ô nhập form cố ý giữ | `78: const [orderQuantity, setOrderQuantity] = useState("");` | ✅ |
| `AdminCoreTenantsPage.tsx:27` | `searchDraft` | `27: const [searchDraft, setSearchDraft] = useState('');` | ✅ |
| `AdminCoreAuditTracePage.tsx:68/69/71` | `filtersDraft`/`filters`/`selectedRequestId` | `68/69/71` — cả 3 khớp | ✅ |
| `AdminCoreJobsPage.tsx:52/53` | `filtersDraft`/`filters` | `52/53` khớp | ✅ |
| `AdminCorePATsPage.tsx:25/32` | `filtersDraft`/`filters` | `25: const [filtersDraft, setFiltersDraft] = useState({` / `32: const [filters, setFilters] = useState({` | ✅ |
| `AdminCoreServiceAccountsPage.tsx:23/30` | `filtersDraft`/`filters` | `23` / `30` khớp | ✅ |
| `TEST_REPORT_UIUX_WAVE2.md:36` | ghi sai `FactsFirstWhaleBubbleChart.jsx` | `36: file: src/components/FactsFirstWhaleBubbleChart.jsx` | ✅ (AC-5.1 đúng; file thật `OrderFlowRadarPanel.js` **có tồn tại**) |
| `TEST_REPORT_UIUX_WAVE2.md:25` | ghi `exit 0, 116/804` | `25: \| npm run test:components \| **0** \| **116 file / 804 test PASS** \|` | ✅ (AC-5.2 đúng) |
| `PLAN_UIUX_WAVE3.md:482` | AC-2.4 cũ *"giảm ≥ 26"* | `482: ### AC-2.4 \`NAV-1\` gi?m **≥ 26 hit**, \`check-uiux-budget\` exit 0` | ✅ |
| `HANDOFF_UIUX_WAVE3_20261008.md` §4.2 / §5 | — | `197: ### 4.2 …` / `246: ## 5. …` | ✅ |
| `Entry 256` | ledger | `CODE_CHANGE_AUDIT_LEDGER.md:1: ## Entry 256: UI/UX wave 3 …` | ✅ |
| **`src/app/pageRegistry.js`** (AC-3.6) | registry route | **KHÔNG TỒN TẠI** — thật là `src/pages/pageRegistry.js` | ❌ **O2** |
| **`vite.config.ts build.rollupOptions.input`** (AC-3.1) | entry point | **KHÔNG KHAI BÁO** — `rollupOptions` chỉ có `output` | ❌ **O1** |

Tỉ lệ citation đúng: **18/20**. Hai cái sai đều nằm ở S3 — cùng một slice, cùng một kiểu lỗi (trích nhầm đường dẫn có vẻ hợp lý).

---

## 5. AC-2.4 feasibility (§0.3) — phần plan ĐÚNG, nhưng lập luận cần chỉnh

Plan nói: *"5/9 sửa được vì 4 là `*Draft`"*. Đo lại logic apply của cả 4 file:

```
AdminCoreAuditTracePage.tsx     184: setFilters({ ...filtersDraft });   188: setFiltersDraft(DEFAULT_FILTERS);
AdminCoreJobsPage.tsx            122: setFilters({ ...filtersDraft });   126: setFiltersDraft(DEFAULT_FILTERS);
AdminCorePATsPage.tsx           107: setFilters({ ...filtersDraft });   118: setFiltersDraft(clearedFilters);
AdminCoreServiceAccountsPage.tsx 100: setFilters({ ...filtersDraft });  111: setFiltersDraft(clearedFilters);
```
Lệnh: `Select-String -Path packages\web\src\pages\admin\AdminCore{names}.tsx -Pattern "filtersDraft|setFilters" -Encoding utf8`

**Kết luận: `filtersDraft` buộc phải ở local — plan ĐÚNG.** Draft chỉ được ghi bởi `onChange` của input (5 input/trang) và bị reset bởi nút Reset; nó **không bao giờ** được đọc từ URL và không có đường nào đẩy giá trị URL về draft. Nếu đưa `filtersDraft` vào `useUrlState` thì mỗi ký tự gõ sẽ ghi URL, và khi URL đổi (back/forward) `value` sẽ ghi đè draft đang soạn ⇒ đúng loop mà `useUrlState.ts:9-11` cảnh báo. Precedent đã có: `AdminCoreTenantsPage.tsx:27-28` giữ `searchDraft`/`statusDraft` local, chỉ `search`/`status`/`page` (dòng 32-35) mới vào URL.

**Có thể đồng bộ draft trung thực không?** Có một cách hợp lệ mà plan chưa nêu: **one-way hydrate** — `useEffect` set draft **một lần** khi mount từ giá trị URL ban đầu (deep-link vào trang với `?search=abc` thì ô nhập phải hiện `abc`, không phải rỗng). Đây không phải loop vì chỉ chạy 1 lần và không ghi ngược URL. Nhưng kể cả vậy, nó **không giảm thêm hit NAV-1** (`filtersDraft` vẫn là `useState`) ⇒ **không đổi con số 5**. Vậy nên kết luận của plan về con số vẫn đúng; chỉ có lý do "buộc phải local" là hơi quá tuyệt đối — nên nói "giữ local; có thể hydrate một chiều khi mount nhưng không giảm hit".

---

## 6. Hazard 6 & 9 — không vi phạm

- **Hazard 6** (plan đòi PASS từ gate đang đỏ): **không có**. Tôi đã chạy 17/19 gate, tất cả exit 0. G18 được plan dán nhãn `CHƯA CHẠY` trung thực, G19 `N/A` có cơ sở (0 file `.py`). Đây là điểm plan làm tốt.
- **Hazard 9** (tên lệnh không tồn tại): **1 vi phạm nhỏ** — `nav1-report.mjs` (O10). Tên script budget `check-uiux-budget.mjs` plan ghi **đúng** (tên sai là `check-multiux-budget.mjs`, plan không mắc lỗi này). Mọi npm script plan ghi (`check:tokens`, `check:contrast`, `check:dom-landmarks`, `check:ts-imports`, `check:i18n-hardcoded`, `check:admin-spa-routes`, `check:shell`, `lint`, `test:components`, `build`, `test:visual`) đều tồn tại trong `packages/web/package.json`.

---

## 7. REFUTED — những điều tôi đã thử phá mà KHÔNG vỡ

1. **"99/12/111 là sai"** — không. Tái lập độc lập ra đúng 99/12/111, khớp cả 10 `file:line` ở §0.2.
2. **"Arithmetic §0.4 sai (111 ≠ 99+12)"** — không. `99 + 12 = 111` ✓, `172 + 12 = 184` ✓.
3. **"Một file trong 7 file bị che CÓ dùng `useUrlState`/`useUrlValue`, nên count < 111"** — không. `hasHook=false` **cả 7/7**: `TenantAdminCommandPalette.tsx`, `Header.tsx`, `ShellOperationsCenterPage.tsx`, `AICommandCenterPage.tsx`, `ScreenerPage.tsx`, `WhaleAdvisoryPage.tsx`, `SupportPage.tsx`. Số 111 đứng vững.
4. **"Bảng baseline §1 bịa số"** — không. 17 gate chạy thật, **17/17 khớp exit code**; `3743 problems (0 errors)` và `117 files / 817 tests` khớp **tuyệt đối**.
5. **"Script scan bị treo / hỏng"** — không. Exit 0 sau 311.7 s. Cảnh báo hazard 4 của plan là **đúng và đáng giữ**.
6. **"AC-2.4 bất khả thi vì `filtersDraft` buộc phải local"** — phần đúng, nhưng con số 5 vẫn đúng vì draft không giảm hit.
7. **"`AdvisoryOrderTicket.js:14` / `DNSEConnectionPanel.js:78` là false positive"** — chúng **có thật** trong NAV-1 và là ô nhập form, plan gọi đúng là "cố ý giữ".
8. **"`18 *.spec.ts` là con số bịa"** — không. Đếm đúng 18 file trong `packages/web/tests/visual/`.
9. **"Hazard 6 bị vi phạm ở đâu đó"** — không. G18 `CHƯA CHẠY` được ghi trung thực.

---

## 8. Đề xuất (chỉ để tham khảo — auditor không sửa gì)

Sửa tối thiểu trước khi dispatch:

1. **O1** — AC-3.1: thay "`vite.config.ts` `build.rollupOptions.input`" bằng `index.html` (entry thật), và ghi rõ phải fail-safe nếu không tìm thấy entry.
2. **O2** — AC-3.6: `src/app/pageRegistry.js` → `src/pages/pageRegistry.js`.
3. **O4** — AC-4.8: "99 → 94" → "111 → 106", khớp §0.3(c) và STOP #2.
4. **O3** — AC-2.3: sửa lý do "qua shell" (chỉ 2/6 trang), nêu 4 `file:line` thật của h1 trực tiếp.
5. **O5** — AC-4.1: yêu cầu escape cấp biến **không** tính `searchParams` từ `useSearchParams`/`useRouterSearchParams` và `activeTab` đã sync qua `useEffect` là hit; nếu không sẽ hợp thức hoá ~6 lỗi giả vào baseline 111.
6. **O6/O10/Caveat G14** — sửa "211 s" → "≥ 300 s (đo 311.7 s)", ghi `nav1-report.mjs` **chưa tồn tại**, thêm `cd packages/web` cho G14.
