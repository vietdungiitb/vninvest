# AUDIT PLAN — UI/UX SSOT program (Wave 0 → Wave 2)

> **Verdict: NEED_REVISION.** Không cấp worktree S1 và không bắt đầu S0-merge cho tới khi 5 blocker dưới đây được sửa trong plan.
> **5 finding nghiêm trọng nhất:** (1) test đỏ W0 là **xanh giả** — regex `\b${name}\s*:` match **0/13** khai báo thật, chính control `--bg-panel: red;` cũng false; (2) gỡ 13 token làm `check-theme-contrast` **exit 1 + 4 vi phạm mới** (dark `--text-muted` 3.75:1 / 4.24:1), trong khi handoff chờ exit 0; (3) D1 "chấp nhận delta" thiếu 4 nhóm delta thật (`--bg-panel` opacity, `--bg-panel-soft`, `--shadow-sm/md`, `--font-sans`) và mâu thuẫn với audit I.1 "giữ giá trị dark/light"; (4) light theme **bị tắt cứng** ở 2 nơi nên 8 ảnh light của W0 và QA 2 theme của W2 không thể chạy; (5) W0 test quét toàn file nhưng chỉ gỡ 13 khai báo base, còn **7 light override** trong `soc.tokens.css:144-153` → test không thể xanh.

- **Ngày**: 2026-11-19
- **Auditor**: phiên độc lập, read-only. Không claim, không sửa plan, không tạo worktree, không chạy code production.
- **Phạm vi**: `docs/handoffs/HANDOFF_2026-11-19_UIUX-SSOT.md` + 4 `docs/PLAN_UIUX_*_20261119.md`; đối chiếu `docs/AUDIT_UIUX_FULL_20261119.md`, code `packages/web/src`, gate/JSON baseline.
- **Base thật khi audit**: `dev@2b10b3016` (handoff ghi `69141ab93`; HEAD **hơn 6 commit**, trong đó có Entry 533).
- **Nguyên tắc**: mọi kết luận kèm `file:line`; không đoán; kết quả không chạy được ghi **CHƯA CHẠY**.
- **Lessons áp dụng**: [L-001, L-002, L-003, L-005, L-007, L-008, L-M02, L-A01, L-V01, L-V02, L-V03, L-V05, L-V06, L-G02, L-F03, L-F06, L-F11, L-T01].

---

## A. Bản đồ tài liệu đã audit

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---:|---|---|
| `docs/handoffs/HANDOFF_2026-11-19_UIUX-SSOT.md` | 88 | D1–D4, ma trận slice, baseline, DoD | Nguồn chính cho phê duyệt; có 7 chỗ số liệu sai/thiếu |
| `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md` | 186 | Gỡ 13 token, hạ baseline, ảnh staging | **Rủi ro cao nhất**; test đỏ và gate contrast đều sai |
| `docs/PLAN_UIUX_W1_CHROME_20261119.md` | ~150 | 5 route → `ShellPageChrome`, admin glass | Test 5/5 sai; prop `actions` không tồn tại |
| `docs/PLAN_UIUX_W1_A11Y_URL_20261119.md` | ~150 | Accessible name, 5 modal, 29 URL state, `<h1>` | Path/line modal sai; hook Radix bất khả thi |
| `docs/PLAN_UIUX_W2_EXPERIENCE_20261119.md` | ~100 | Density, Cmd+K, freshness, `DESIGN.md` | Cmd+K/density under-scoped; xung đột S3 |
| `docs/AUDIT_UIUX_FULL_20261119.md` | 300+ | Audit nguồn, I.1 Owner chốt | I.1:292 mâu thuẫn handoff D1 |
| `packages/web/scripts/check-*.mjs` + `check-ui-baseline/*.json` | — | Gate thật | 4/4 gate chính là **baseline-locked**, không phải "0 vi phạm" |

---

## B. Luồng đã trace

### B1. W0 — gỡ token và hệ quả cascade

1. `soc.tokens.css:5` khai báo base `:root`; 13 tên trùng với `theme/tokens.css:1`.
2. `soc.components.css` tiêu thụ: `--text-primary` 42, `--text-muted` 55, `--border-default` 33, `--accent-cyan` 30, `--bg-panel` 3, `--fs-*` 6, `--shadow-sm` 2 (đo lại bằng script, khớp plan:19).
3. Gỡ 13 dòng base → `theme/tokens.css` thắng ở mọi route **trừ** scope `.vnbConsole` (`soc.components.css:4341-4352`) vẫn tự khai 6 tên + `--bg-panel-soft`.
4. Delta thật: cyan `#22d3ee→#06b6d4`; muted dark `#94a3b8→#64748b`; border `rgba(80,120,168,.15)→#1e293b`; `--bg-panel` `rgba(8,23,52,.4)→#0f172a`; `--bg-panel-soft` `rgba(15,23,42,.3)→#0f172a` (do bug `theme/tokens.css:14`); shadow `0 2px 8px .15 → 0 1px 2px .05`; font `ui-sans-system… → "Inter","Segoe UI"…`; fs `0.68/0.75/0.85 → 0.75/0.8125/0.875`.
5. Hệ quả đo được: `--text-muted` dark `#64748b` trên `#081734` = **3.73:1**, trên `#0f172a` = **3.75:1**; ngưỡng WCAG AA 4.5:1.

### B2. W1 chrome — `<h1>` và detector

1. `ShellPageChrome` render `<h1>` tại `ShellPageTemplate.js:122`; props hiện có `eyebrow, title, description, badge, metrics, notice, error, children, className, id` (`:90-101`) — **không có `actions`**.
2. `DashboardPage.tsx:120` render `<h1>` bằng `renderElement("h1", …)`; `:110,117` chỉ là comment.
3. `AdminUsersPage.tsx:13-14` nhắc `<h1>` trong comment; `:21` dùng `AdminPageHeader`; `adminUi.tsx:24` mới là `<h1>` thật (allowlist `check-heading-contract.mjs:58`).
4. `check-heading-contract.mjs:82-83` chỉ nhận `<h1` JSX và `createElement("h1")`; **không nhận `renderElement("h1")`**; baseline 24 vi phạm.

### B3. W1 a11y — modal và runtime

1. Plan trỏ `TenantAdminReportsPage.tsx:244-245`; thực tế `:243-245` là nút **Xoá**; modal thật bắt đầu `:256-258` (`showCreateModal`).
2. Repo đã có wrapper Radix: `components/ui/dialog.tsx:5-48` và `components/ui/drawer.tsx:5-45`; focus trap nằm trong `DialogPrimitive.Content`, không phải props trả từ hook.
3. `check-a11y-runtime` đo 10 route cố định (`check-ui-baseline/check-a11y-runtime.json`), không có modal; exit 0 khi tập vi phạm ⊆ baseline 113 (`check-a11y-runtime.mjs:28`), và exit 0 cả khi `CHUA CHAY` (`:35`).

### B4. W2 — Cmd+K và density

1. `TenantAdminCommandPalette.tsx:9-25` hardcode **15 entry** tenant-admin + `subject` CASL; `:31` đọc `ability`; `:36-42` đã có Cmd+K/Escape.
2. Palette được mount trong `TenantAdminLayout.tsx:90`; route `tenant-admin` là **con của `/`** (`main.tsx:157,229`) nên nằm trong `FullLayout` (`FullLayout.tsx:12`).
3. Không có settings context: chỉ có `UserSettingsPage.tsx`, `i18n/locales/*/userSettings.js`; không có `*SettingsContext*`.

---

## C. CONTRADICTIONS (doc ↔ doc / doc ↔ code)

| # | Tài liệu nói | Thực tế | Tác động |
|---|---|---|---|
| C1 | `HANDOFF:12` D1: "chấp nhận delta cyan/muted/border/fs" | `AUDIT_UIUX_FULL_20261119.md:292` I.1: "**giữ giá trị dark/light hiện tại**" | Hai nguồn Owner chốt mâu thuẫn; plan W0 lấy D1 nhưng audit không cập nhật |
| C2 | `HANDOFF:48` `check-theme-contrast` "exit 0 baseline (1 mục parser-limited)" | Baseline thật: **32 vi phạm + 12 undecodable** (`check-theme-contrast.json`) | "exit 0" bị đọc thành "không có lỗi"; 32 cặp đã fail từ trước |
| C3 | `HANDOFF:51-52` focus/heading "exit 0 baseline" → DoD "0 baseline" | Baseline thật: focus **8**, heading **24** | DoD "0 `<h1>`" không đo bởi gate; gate chỉ chặn **mới** |
| C4 | `HANDOFF:54` `check-a11y-runtime` "CHƯA CHẠY (cần Chromium)" | Baseline **113 vi phạm**, đo `2026-10-21T02:11:57Z`, 10 route, build cũ | Đã từng chạy; "PASS" sau S3 sẽ chỉ là "không thêm vi phạm" |
| C5 | `PLAN_W0:37` test phải quét **cả 2 block**; `:106` chỉ xoá 13 dòng base | File có **20** dòng khai báo: 13 base + **7 light override** (`soc.tokens.css:144-153`) | Test quét toàn file không thể xanh sau khi chỉ gỡ 13 base |
| C6 | `PLAN_W0:72` `not.toMatch(new RegExp(\`\\b${name}\\s*:\`))` | Regex match **0/13**; control `--bg-panel: red;` = **false** | Test "đỏ" thực ra **xanh** ngay baseline; fail-before vô hiệu |
| C7 | `PLAN_W1_CHROME:63` "FAIL (5/5)" | Đo thực: **4/5 RED**, `ShellOperationsCenterPage` đã GREEN (`:4,91`) | Kỳ vọng sai; agent sẽ đi tìm lỗi không tồn tại |
| C8 | `PLAN_W1_CHROME:72` props có `actions` | `ShellPageTemplate.js:90-101` **không có** `actions` | Task 2 không implement được nếu không thêm API mới |
| C9 | `PLAN_W1_A11Y:37,97` modal ở `TenantAdminReportsPage.tsx:244-245` | `:243-245` là nút Xoá; modal thật `:256-258` | Test/Implement trỏ sai chỗ; path đầy đủ là `src/pages/tenant-admin/...` |
| C10 | `PLAN_W1_A11Y:95` hook trả `contentProps` để dùng Radix | Focus trap nằm trong `DialogPrimitive.Content` (`ui/dialog.tsx:31-47`) | Hook không thể cung cấp trap; "không tự viết trap" không đạt |
| C11 | `PLAN_W2:7` "TenantAdminCommandPalette làm nền Cmd+K" | Palette hardcode 15 entry tenant-admin (`:9-25`) + CASL | Không phải wrapper mỏng; generalize là viết registry mới |
| C12 | `PLAN_W2:67` "density từ settings context" | Không có settings context trong `packages/web/src` | Task 3 không có nguồn state; localStorage sẽ vi phạm chính plan |
| C13 | `HANDOFF:27` S4 phụ thuộc S1, S2 | S3 và S4 cùng sửa `CoreDashboardPositionDeck.tsx` + `PortfolioHoldingsPage.tsx` (`PLAN_A11Y:108`, `PLAN_W2:53`) | S3/S4 chạy song song sẽ đụng file; merge order không xác định |
| C14 | `HANDOFF:3` base `dev@69141ab93` | HEAD `2b10b3016`, **+6 commit** (có Entry 533) | Ledger bị mất Entry 533; line number dễ lệch |
| C15 | `PLAN_W0:7` `index.css @theme` owner cho `--shadow-*`; `:15` token owner = `theme/tokens.css` | `index.css:80-81` khai shadow; `theme/tokens.css` không khai | Hai owner trong cùng một plan; "1 SSOT" không rõ |
| C16 | `PLAN_W0` mục tiêu "một tên khai báo đúng 1 lần" | `.vnbConsole` (`soc.components.css:4341-4352`) khai lại 6 tên + soft/input/strong | Base-layer 0 ≠ toàn repo 0; delta không đồng nhất |

---

## D. FINDINGS — objections đánh số

### BLOCKER (phải sửa trước khi cấp S1)

**[O-01 | ERROR | BLOCKER] Test đỏ W0 là xanh giả**
- **Bằng chứng**: `PLAN_W0:72`, `:81`. Chạy control trên chính file thật: `planRe('--bg-panel')` trên literal `--bg-panel: red;` = **false**; trên `soc.tokens.css` = **0/13**. Regex `\b` đứng trước `-` không tạo word boundary khi ký tự trước là space/đầu dòng.
- **Tác động**: 13 assertion "expected FAIL" thực ra **PASS**; B6 fail-before không chứng minh gì; agent có thể gỡ token mà test vẫn xanh, hoặc tệ hơn là sửa test cho xanh.
- **Fix**: bỏ `\b`, dùng `(?<![-\w])`; **strip comment trước khi test**; giới hạn test vào base `:root` trước `:root[data-theme="light"]`; thêm control âm/dương (`--bg-panel: red;` phải match; `/* --bg-panel: … */` và `--soc-bg-panel:` phải không match); assert đúng **0** sau khi gỡ.

**[O-02 | ERROR | BLOCKER] W0 làm `check-theme-contrast` đỏ, không phải xanh**
- **Bằng chứng**: mô phỏng đúng W0 (bản sao 4 file token, xoá 13 khai báo base, `--no-runtime`, control 21.00/4.48 PASS): gate in **"36 cặp không đạt | baseline 32"**, **"4 VI PHẠM MỚI"** đều `@soc/dark`: `text-muted-on-bg-panel-token`, `text-muted-on-bg-panel`, `text-muted-on-bg-primary`, `text-muted-on-bg-secondary` — 3.75 / 3.75 / 4.24 / 3.75 (< 4.5) — **exit 1**. Nguyên nhân: `theme/tokens.css:3` `--text-muted: #64748b`, trong khi SOC cũ `#94a3b8` (6.93:1 trên `#081734`).
- **Tác động**: `PLAN_W0:180` và `HANDOFF:48` chờ exit 0; S1 sẽ chết ở gate cuối. Nếu dùng `--update-baseline` để xanh thì vi phạm R2 (`HANDOFF:71`) và che regression WCAG.
- **Fix**: đưa việc nâng `--text-muted` dark lên ≥ 4.5:1 vào **cùng** W0 (ví dụ `#94a3b8` hoặc giá trị đã đo), thêm test contrast cho cặp này; sửa `theme/tokens.css:14` `--bg-panel-soft` đang trỏ nhầm `--color-bg-panel`; ghi rõ "gate phải đỏ trước khi sửa, xanh sau khi sửa" trong plan.

**[O-03 | ERROR | BLOCKER] D1 chưa được Owner chốt đúng phạm vi delta**
- **Bằng chứng**: `HANDOFF:12` liệt kê 4 nhóm (cyan/muted/border/fs). Delta thật có thêm: `--bg-panel` `rgba(8,23,52,.4)→#0f172a` (`soc.tokens.css:12` vs `theme/tokens.css:13`); `--bg-panel-soft` `rgba(15,23,42,.3)→#0f172a` (`:19` vs `theme:14`); `--shadow-sm/md` (`soc:70-71` vs `index.css:80-81`); `--font-sans` (`soc:72-73` vs `theme:19`). Đồng thời `AUDIT:292` nói "giữ giá trị dark/light hiện tại".
- **Tác động**: ảnh before/after không có tiêu chí pass/fail; Owner có thể đã chấp nhận một tập delta khác tập sẽ xảy ra; 3 surface `--bg-panel-soft` (`soc.components.css:773,1068,4095`) thành **đục hoàn toàn** — thay đổi glassmorphism không được mô tả.
- **Fix**: cập nhật bảng D1 với **đủ 8 nhóm** + giá trị before/after; sửa `AUDIT:292` hoặc ghi rõ "D1 handoff thay thế I.1"; quyết định `--bg-panel-soft` là bug-fix hay delta; ghi 3 selector bị ảnh hưởng vào evidence.

**[O-04 | ERROR | BLOCKER] Light theme bị tắt cứng — không thể lấy ảnh light**
- **Bằng chứng**: `main.tsx:264-266` `removeAttribute('data-theme')` + `localStorage.setItem('vninvest-theme','dark')`; `UserSettingsPage.tsx:19-24` `applyUserTheme()` luôn dark. `PLAN_W0:178` yêu cầu **8 ảnh** 4 route × dark/light; `HANDOFF:82` yêu cầu ảnh dark/light 6 route; `PLAN_W2:71` yêu cầu QA 2 theme.
- **Tác động**: không thể nghiệm thu D1/D2 bằng ảnh light; nếu agent tự bật theme thì sửa code ngoài plan và có thể làm hỏng first-paint.
- **Fix**: chọn một trong hai — (a) thêm cơ chế **dev/staging-only** bật light (query param hoặc localStorage có guard) trong W0, kèm test và ghi rõ revert trước production; hoặc (b) bỏ light khỏi DoD W0/W2 và xin Owner chốt lại. Không được im lặng bỏ qua.

**[O-05 | ERROR | BLOCKER] W0 test quét toàn file nhưng chỉ gỡ 13 base — còn 7 light override**
- **Bằng chứng**: đo được **20** dòng khai báo: 13 trước `:root[data-theme="light"]` (`soc.tokens.css:143`) và **7** trong block light (`:144,145,146,147,149,151,153`). `PLAN_W0:37` yêu cầu test quét cả 2 block; `:106` chỉ xoá 13 dòng base.
- **Tác động**: test đúng (sau khi sửa O-01) sẽ **không bao giờ xanh**, hoặc agent buộc phải xoá 7 light override — làm light theme mất giá trị (và càng làm O-04/O-02 nặng hơn).
- **Fix**: tách `BASE_TOKENS` (13, phải = 0 trong base) và `LIGHT_OVERRIDES` (7, phải tồn tại **đúng 1 nơi**: `theme/tokens.css:65-82` light block, bổ sung `--accent-cyan` + `--text-muted` đang thiếu); test riêng từng block; nếu chọn "xoá light SOC" thì phải move giá trị sang theme light block trước, kèm ảnh.

### MAJOR (phải sửa trước khi merge slice tương ứng)

**[O-06 | GAP | MAJOR] W1-chrome: không phải 5/5 đỏ; detector `<h1>` bỏ sót `renderElement`**
- **Bằng chứng**: chạy đúng 2 assertion của plan: `ShellOperationsCenterPage` = GREEN (`:4,91`); 4 file RED. `DashboardPage:120` dùng `renderElement("h1")` — regex `/<h1[\s>]/` không thấy; comment `:110,117` lại match. `AdminUsersPage:13-14` comment match; `<h1>` thật ở `adminUi.tsx:24` (allowlist). `check-heading-contract.mjs:82-83` cũng không nhận `renderElement`.
- **Tác động**: "5/5 red" sai; test có thể **xanh sau khi thêm ShellPageChrome nhưng vẫn còn `<h1>` thật** → double h1; gate heading không bắt được.
- **Fix**: mở rộng detector cho `renderElement("h1")` + strip comment; dùng chung một hàm detect với gate; bỏ route đã xanh khỏi danh sách "red" (hoặc chuyển thành test hồi quy); thêm positive control có `<h1>` thật.

**[O-07 | GAP | MAJOR] `ShellPageChrome` không có prop `actions`**
- **Bằng chứng**: `ShellPageTemplate.js:90-101`; `PLAN_W1_CHROME:72,74` yêu cầu `{eyebrow,title,description,actions,metrics}` và "đặt actions vào prop `actions`".
- **Tác động**: Task 2 phải sửa shared component API (không có trong Files/Interfaces); nếu nhét action vào `description` thì sai semantics/a11y.
- **Fix**: thêm `actions` vào `ShellPageChrome` + `ShellPageTemplate.d.ts:40-57` + test render; hoặc dùng `badge`/`children` với pattern được ghi rõ. Cập nhật plan trước khi code.

**[O-08 | GAP | MAJOR] D2 "glass" dùng token đục — test không phân biệt được glass với card phẳng**
- **Bằng chứng**: `HANDOFF:13`, `PLAN_W1_CHROME:83-88`; test chỉ assert **không** có `bg-white`/`ring-black/5` và **có** `var(--bg-panel`; `theme/tokens.css:13` `--bg-panel: #0f172a` (opaque); `adminUi.tsx:48,71` đang `bg-white ... dark:bg-slate-900`. Không có assert `backdrop-filter`/alpha.
- **Tác động**: một card `bg-[var(--bg-panel)]` đục 100% vẫn **PASS** nhưng không phải glass; sau W0, SOC `--bg-panel` biến mất nên không còn token glass nào.
- **Fix**: định nghĩa token/class glass thật (alpha < 1 + `backdrop-filter` hoặc `color-mix`) trong owner; test bằng computed style trên staging (alpha, backdrop-filter), không source-scan; hoặc đổi D2 thành "surface token" nếu Owner không cần glass.

**[O-09 | ERROR | MAJOR] W1-a11y: path/line modal sai**
- **Bằng chứng**: `PLAN_W1_A11Y:37,97` trỏ `TenantAdminReportsPage.tsx:244-245`; thực tế là nút Xoá (`:243-245`), modal thật `:256-258`; path đúng `src/pages/tenant-admin/TenantAdminReportsPage.tsx`. `MuteModal` ở `src/components/alert-center/`; `OptimizationModal.jsx` ở `src/components/dashboard/`; `CampaignDetailDrawer.jsx` ở `src/features/advertising/components/`.
- **Tác động**: `MODAL_TARGETS` đọc sai file/line → test đỏ giả hoặc sửa nhầm nút; B6 không chạy được.
- **Fix**: grep lại và pin **full path + symbol**, không dùng line number; thêm `ConfirmModal.tsx` (đang dùng `useConfirm` ở chính reports page) và `SocScreenerRuleModal` vào inventory nếu chưa có trap.

**[O-10 | ERROR | MAJOR] `useModalA11y()` không thể cung cấp focus trap của Radix**
- **Bằng chứng**: `PLAN_W1_A11Y:93-95` thiết kế hook trả `{open,onOpenChange,contentProps}`; `ui/dialog.tsx:5-48` và `ui/drawer.tsx:5-45` đã wrap `DialogPrimitive.Content`/`Portal` — trap nằm ở component, không phải props. Hook chỉ có thể trả `aria-modal`/`onKeyDown`, tức là **tự viết trap** hoặc không có trap.
- **Tác động**: mục tiêu "không tự implement trap" không đạt; test source-scan `aria-modal` sẽ xanh dù không trap.
- **Fix**: dùng trực tiếp `Dialog`/`Drawer` wrappers (`DialogContent`, `DrawerContent`), hoặc hook trả **component** `renderModal()` bọc `Dialog.Root`+`Content`; test hành vi Tab/Shift+Tab/Escape/focus-return.

**[O-11 | GAP | MAJOR] Test modal xanh sẵn 2/5 — `aria-modal` không chứng minh focus trap**
- **Bằng chứng**: chạy regex của plan trên 5 target: `MuteModal.tsx` có `role="dialog"` + `aria-modal="true"` → **MATCH**; `TenantAdminCommandPalette.tsx` có `aria-modal` + Escape (`:36-42`) → **MATCH**; chỉ `OptimizationModal`, `CampaignDetailDrawer`, reports modal là red.
- **Tác động**: "red test 5/5" sai; 2 target không cần sửa vẫn xanh; focus trap vẫn có thể thiếu.
- **Fix**: test hành vi (focus trap + focus return), không scan `aria-modal`; khai báo expected red **theo từng target**; thêm case dương tính (modal đã đúng phải pass) và case âm tính (modal chỉ có aria-modal phải fail).

**[O-12 | GAP | MAJOR] Mục tiêu focus baseline 0 không được file list của S3 bao phủ**
- **Bằng chứng**: `check-focus-ring.json` có **8** ID: `TenantAdminCommandPalette`, `PortfolioHeatmap.js`, `ScreenerFilterBuilder`, `ScreenerSchedulePanel`, `SocScreenerConfigForm`, `SocScreenerRuleModal`, `Sidebar.tsx`, `ScreenerPage.tsx`. `PLAN_W1_A11Y:77-80,93` chỉ sửa `ui/command`, `PaginationBar`, alert-center, advertising, 5 modal — **6 file baseline không có trong list**.
- **Tác động**: `HANDOFF:51` "0 baseline" không thể đạt; S3 báo xanh nhưng còn 6 vi phạm cũ.
- **Fix**: thêm 6 file vào S3 (hoặc tách ticket riêng và sửa handoff/DoD); đo lại sau W0/W1 vì line drift; test focus thật trên staging.

**[O-13 | ERROR | MAJOR] `check-a11y-runtime` baseline 113 và không đo modal — "PASS" không xác minh mục tiêu 5 modal**
- **Bằng chứng**: JSON `measuredAt: 2026-10-21T02:11:57Z`, `routesMeasured` 10 route, **113 violations**, build cũ; script `:28` exit 0 khi vi phạm ⊆ baseline; `:35` `CHUA CHAY` exit 0. Không route nào mở modal.
- **Tác động**: `PLAN_W1_A11Y:99` "chạy check-a11y-runtime → PASS" có thể PASS dù 5 modal vẫn không trap; baseline cũ che regression mới trên route mới.
- **Fix**: ghi baseline 113 rõ trong handoff; thêm modal state vào runtime script hoặc dùng component test cho modal; yêu cầu baseline gắn build hash mới; không báo PASS nếu `CHUA CHAY`.

**[O-14 | ERROR | MAJOR] Bảng baseline/DoD đang mô tả sai gate baseline-locked**
- **Bằng chứng**: heading **24**, focus **8**, theme **32 + 12 undecodable**, a11y **113**; `HANDOFF:48` ghi "1 mục parser-limited"; `:51-52` ghi "exit 0 baseline"; DoD `:81` ghi "0 `<h1>`" và "0 baseline".
- **Tác động**: "exit 0" ≠ "0 vi phạm"; DoD không đo được; dễ tuyên bố xanh giả.
- **Fix**: viết lại bảng baseline với số thật + nghĩa "exit 0 = không mới"; tách cột "hiện tại / mục tiêu / cách đo"; cập nhật DoD theo số.

**[O-15 | RISK | MAJOR] `.vnbConsole` là owner thứ 3 của 6 token — "1 tên 1 lần" không đúng toàn repo**
- **Bằng chứng**: `soc.components.css:4341-4352` khai lại `--text-primary/secondary/muted`, `--bg-panel`, `--border-default`, `--accent-cyan`, `--bg-panel-soft`, `--bg-panel-solid`, `--bg-input`, `--border-strong`; `check-token-conflict.mjs:70` bỏ qua block không phải `:root`/`@theme` nên gate không thấy.
- **Tác động**: W0 test trên `soc.tokens.css` xanh nhưng vnb console vẫn dùng giá trị cũ; delta không đồng nhất; "SSOT" chỉ đúng ở base layer.
- **Fix**: ghi `.vnbConsole` là ngoại lệ có chủ đích (dark-first console) + test allowlist; hoặc migrate sang `--soc-*` raw; thêm scope này vào D1/evidence.

**[O-16 | GAP | MAJOR] W2 Cmd+K under-scoped + mount trùng**
- **Bằng chứng**: `TenantAdminCommandPalette.tsx:9-25` hardcode 15 entry + `subject`; `:31` CASL; mount ở `TenantAdminLayout.tsx:90`; route tenant-admin là con của `/` (`main.tsx:157,229`) nên `FullLayout` bao ngoài; `PLAN_W2:65` mount `AppCommandPalette` trong `FullLayout`.
- **Tác động**: `/tenant-admin/*` sẽ có **2 palette** và 2 listener Cmd+K; palette toàn app cần registry route + filter ability, không phải "wrapper mỏng".
- **Fix**: tách `CommandRegistry` (entry + quyền), mount **một lần** ở `AppShell`/`FullLayout`, bỏ mount ở `TenantAdminLayout`; test đếm `role="dialog"`/listener trên `/tenant-admin`; thêm entry ngoài tenant-admin.

**[O-17 | GAP | MAJOR] W2 density không có settings context**
- **Bằng chứng**: `PLAN_W2:67` "density từ settings context"; repo chỉ có `UserSettingsPage.tsx` + i18n `userSettings.js`, **không có** `*SettingsContext*` (tìm recursive).
- **Tác động**: Task 3 không có nguồn state; nếu dùng `localStorage` rời rạc thì vi phạm chính Review Focus #3 (`PLAN_W2:35`).
- **Fix**: tạo `SettingsProvider` (theo pattern `LangContext`) trong W2 + persistence + test; hoặc hạ density xuống Wave 3 và bỏ khỏi DoD W2.

**[O-18 | RISK | MAJOR] S3 và S4 cùng sửa 2 file, dependency matrix thiếu S4←S3**
- **Bằng chứng**: `PLAN_W1_A11Y:108` modify `CoreDashboardPositionDeck.tsx` + `PortfolioHoldingsPage.tsx`; `PLAN_W2:53` cùng 2 file; `HANDOFF:27` S4 chỉ phụ thuộc S1, S2.
- **Tác động**: 2 agent sửa cùng file khi chạy song song; merge conflict hoặc mất hunk; "file ownership" của D3 không được bảo đảm.
- **Fix**: thêm S4←S3 vào handoff/plan; hoặc split ownership rõ (S3 giữ a11y attributes, S4 chỉ thêm `FreshnessBadge` ở component riêng) + ghi bảng file ownership.

### MINOR (sửa trước khi merge docs, không chặn code)

**[O-19 | ERROR | MINOR] Ledger mất Entry 533 và lệch số**
- **Bằng chứng**: HEAD có `## Entry 533`; working copy **0**; `git diff --numstat` = `26 11`; planner thêm `Entry 532/531` trong khi Entry 533 ghi rõ "531/532 đang do agent khác soạn → dùng 533 để tránh trùng"; base lệch 6 commit.
- **Tác động**: mất lịch sử alert-card; nguy cơ trùng số khi agent kia merge; audit trail sai.
- **Fix**: khôi phục nguyên văn Entry 533 từ HEAD; đánh lại 2 entry mới thành **534/535**; audit này là **536** (đã làm trong cùng commit); rebase docs lên `2b10b3016`.

**[O-20 | GAP | MINOR] Plan yêu cầu sub-skill không tồn tại**
- **Bằng chứng**: cả 4 plan dòng 3 "REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`"; danh sách skill của session không có `superpowers`.
- **Tác động**: plan không thực thi đúng như văn bản; agent phải tự thay bằng skill repo.
- **Fix**: thay bằng `workflow-dev-loop` + `writing-plans`, hoặc cài có phê duyệt; không để "REQUIRED" trỏ vào thứ không nạp được.

**[O-21 | GAP | MINOR] `impeccable document` không phải lệnh chạy được**
- **Bằng chứng**: `PLAN_W2:78,80`; `Get-Command impeccable` = null; không có trong `node_modules/.bin` hay `package.json`.
- **Tác động**: Task 4 không chạy như plan.
- **Fix**: dùng skill `impeccable` qua skill tool với procedure ghi rõ, hoặc viết `DESIGN.md` thủ công từ token; bỏ "CLI".

**[O-22 | GAP | MINOR] "timeout 300s" của scanner không tồn tại**
- **Bằng chứng**: `PLAN_W1_A11Y:35` nói scanner timeout 300s; `scan-ui-guidelines.mjs` không có timeout; `check-uiux-budget.mjs:40` `execFileSync` không timeout; lần chạy thật ~6.2 phút.
- **Tác động**: thấp, nhưng "tăng lên 600s" không giải quyết nguyên nhân; dễ hiểu sai.
- **Fix**: ghi thời gian chạy thật; nếu cần cap thì thêm timeout ở wrapper; không mô tả sai cơ chế.

**[O-23 | RISK | MINOR] S0 "release 2 claim stale" có thể đã xong; `CLAIMS.md` có NUL byte**
- **Bằng chứng**: `HANDOFF:33-35` trỏ `CLAIMS.md:1610,1679` (in-progress), nhưng các dòng sau `:1629` (`ai-cc-uiux`) và `:1697` (`vnbroker-console`) đều `done`; `check-multi-agent` = 0 lỗi PASS; `CLAIMS.md` có NUL tại byte 269127 (dòng ~1956), nhiều cảnh báo "file không tồn tại" do parser dính `(edit)`.
- **Tác động**: append `released` có thể tạo nhiễu/trùng; NUL làm một số tool đọc file như binary.
- **Fix**: xác nhận `done` trước; nếu đã done thì ghi "already done" thay vì release lần 2; normalize NUL bằng byte-edit riêng, verify `git diff --numstat` = 1/1; không dùng `Get-Content|Set-Content` cho file tiếng Việt.

---

## E. Quality gates — chạy thật trong phiên audit

| Gate / phép đo | Kết quả | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **0 lỗi, 0 trùng migration — PASS**, exit 0 | Nhiều cảnh báo claim path do parser; không chặn |
| `node packages/web/scripts/check-uiux-budget.mjs` | **exit 1** — tổng **129**, `CSS-2 55`, `A11Y-9 16` | Chạy trong phiên, ~6.2 phút; khớp handoff:53 |
| `check-token-conflict.json` | **13** vi phạm; root-only **11** | Khớp W0:30 |
| `check-heading-contract.json` | **24** vi phạm | Không phải "0"; gate baseline-locked |
| `check-focus-ring.json` | **8** vi phạm | 6 file không có trong S3 |
| `check-theme-contrast.json` | **32** vi phạm + **12** undecodable | Không phải "1 mục parser-limited" |
| `check-a11y-runtime.json` | **113** vi phạm, 10 route, `2026-10-21` | Không có modal; build cũ |
| Regex W0 (control) | planRe **0/13**, fixedRe **13/13**, control `--bg-panel: red;` = **false** | Bằng chứng O-01 |
| Mô phỏng W0 trên bản sao token | `check-theme-contrast` **exit 1**, **4 vi phạm mới** `@soc/dark` | Bằng chứng O-02; control 21.00/4.48 PASS |
| Test chrome theo đúng plan | **4/5 RED**, `ShellOperationsCenterPage` GREEN | Bằng chứng O-06 |
| Test modal theo đúng plan | **2/5 MATCH** (MuteModal, CommandPalette) | Bằng chứng O-11 |

**CHƯA CHẠY**: deploy/staging, browser/Chromium, E2E Playwright, `npm run test`/`test:components`, `npm run build`, BE test, ảnh before/after. Không có kết luận nào dựa trên các mục này.

---

## F. Câu hỏi cần Owner/coordinator chốt

1. **D1**: chấp nhận **đủ 8 nhóm delta** (thêm `--bg-panel` opacity, `--bg-panel-soft`, `--shadow-sm/md`, `--font-sans`) hay chỉ 4 nhóm như handoff? Dark `--text-muted` 3.73:1 có được phép, hay W0 phải nâng lên ≥4.5:1?
2. **Light theme**: bật lại có kiểm soát trong W0 để lấy ảnh, hay bỏ toàn bộ QA light khỏi DoD W0/W2?
3. **W1-chrome**: scope thật là 5 route hay 100% route như DoD:81? Nếu 100%, slice nào sở hữu phần còn lại?
4. **W2**: "glass" là yêu cầu bắt buộc hay chỉ cần surface token? Cmd+K toàn app làm ngay hay defer sang Wave 3 sau khi có command registry?
5. **S0**: 2 claim đã có dòng `done` — bỏ bước release lần 2 và chỉ merge docs, hay vẫn append `released` để đóng dấu?

---

## G. Đánh giá tổng thể

- **Hướng đi đúng**: hội tụ token owner, một chrome, a11y có gate, W2 tái dùng tài sản — phù hợp audit nguồn và `ponytail`.
- **Nhưng W0 chưa implementable**: test đỏ xanh giả (O-01), gate contrast đỏ (O-02), delta chưa chốt (O-03), light không chạy được (O-04), test 20-vs-13 (O-05). Đây là **5 blocker**, không phải "reservation".
- **W1-chrome/W1-a11y sửa được** nhưng phải sửa test trước (O-06, O-09, O-10, O-11), nếu không sẽ tạo xanh giả đúng loại repo đã trả giá (L-V04, L-V05).
- **W2 nên tách nhỏ**: Cmd+K là dự án con (registry + CASL + mount một lần), density cần context mới; gộp 3 năng lực trong 1 slice là under-scoped.
- **Ưu tiên**: (1) sửa O-01..O-05 + audit lại W0; (2) sửa O-06..O-14 trước khi cấp S2/S3; (3) làm O-16..O-18 trước S4; (4) O-19..O-23 dọn trước merge docs.
- **Không cấp worktree, không S0-merge** cho tới khi W0 đạt `PASS`/`AGREE` ở vòng audit 2.

---

## H. Verdict từng slice

| Slice | Verdict | Objection chặn |
|---|---|---|
| W0 `feat/uiux-ssot-w0` | **NEED_REVISION** | O-01, O-02, O-03, O-04, O-05 |
| W1 chrome `feat/uiux-chrome-w1` | **NEED_REVISION** | O-06, O-07, O-08 (+ O-12/O-14 cho DoD) |
| W1 a11y `feat/uiux-a11y-w1` | **NEED_REVISION** | O-09, O-10, O-11, O-12, O-13, O-14 |
| W2 `feat/uiux-exp-w2` | **NEED_REVISION** | O-16, O-17, O-18 (+ O-21) |

---

## I. Tái tạo kết quả

Các phép đo chính (chạy trong repo, không sửa working tree):

```js
// 1) Regex W0 + control
const fs = require('fs');
const src = fs.readFileSync('packages/web/src/components/soc/soc.tokens.css', 'utf8');
const names = ['--text-primary','--text-secondary','--text-muted','--accent-cyan','--bg-panel','--bg-panel-soft','--border-default','--font-sans','--fs-xs','--fs-sm','--fs-md','--shadow-sm','--shadow-md'];
const planRe = (n) => new RegExp('\\b' + n + '\\s*:');
const fixedRe = (n) => new RegExp('(?<![-\\w])' + n + '\\s*:');
console.log('plan', names.filter(n => planRe(n).test(src)).length);   // 0
console.log('fixed', names.filter(n => fixedRe(n).test(src)).length); // 13
console.log('control', planRe('--bg-panel').test('--bg-panel: red;'));// false
```

```js
// 2) Chrome test theo đúng plan
const fs = require('fs');
const targets = ['src/pages/admin/ShellOperationsCenterPage.tsx','src/pages/AICommandCenterPage.tsx','src/pages/DashboardPage.tsx','src/pages/portfolio/PortfolioOverviewPage.tsx','src/pages/admin/AdminUsersPage.tsx'];
for (const rel of targets) {
  const s = fs.readFileSync('packages/web/' + rel, 'utf8');
  console.log(rel, /ShellPageChrome/.test(s) && !/<h1[\s>]/.test(s) ? 'GREEN' : 'RED');
}
```

```js
// 3) Modal test theo đúng plan
const fs = require('fs');
const re = /aria-modal|Dialog\.(Content|Portal)|onEscapeKeyDown|onKeyDown/;
for (const f of [
  'packages/web/src/components/alert-center/MuteModal.tsx',
  'packages/web/src/components/dashboard/OptimizationModal.jsx',
  'packages/web/src/features/advertising/components/CampaignDetailDrawer.jsx',
  'packages/web/src/components/TenantAdminCommandPalette.tsx',
]) console.log(f, re.test(fs.readFileSync(f, 'utf8')) ? 'MATCH' : 'NO');
```

```js
// 4) Baseline counts
for (const f of ['check-token-conflict','check-token-conflict.root-only','check-heading-contract','check-focus-ring','check-theme-contrast','check-a11y-runtime']) {
  const j = require('./packages/web/scripts/check-ui-baseline/' + f + '.json');
  console.log(f, (j.violations||[]).length, (j.undecodable||[]).length);
}
```

**Mô phỏng W0 (O-02)** — không sửa working tree:
1. Copy `index.css`, `theme/tokens.css`, `theme/light-theme.css`, `soc.tokens.css` + baseline JSON vào một temp repo.
2. Xoá đúng 13 dòng khai báo base (trước `:root[data-theme="light"]`) khỏi bản sao `soc.tokens.css`; giữ 7 light override.
3. `node packages/web/scripts/check-theme-contrast.mjs --repo <temp> --no-runtime`.
4. Kết quả đã ghi: control PASS, **exit 1**, 4 vi phạm mới `@soc/dark`.

---

## J. Những gì audit này CHƯA xác minh

- Không deploy staging, không mở browser, không chạy Playwright/E2E.
- Không chạy `npm run test`, `test:components`, `npm run build`, BE test.
- Không đo computed style thật của admin cards/SOC surfaces sau W0; O-02/O-03 là mô phỏng static + phép tính WCAG, chưa phải ảnh staging.
- Không xác minh `check-a11y-runtime` trên build hiện tại; chỉ đọc baseline JSON 2026-10-21.
- Không xác minh light theme sau khi bật (vì hiện bị tắt cứng).
- Không kiểm tra migration/BE (program này FE/docs-only).

---

**Kết luận**: **NEED_REVISION**. Sửa 5 blocker của W0 và 9 major của W1/W2, rồi audit vòng 2. Chưa merge docs, chưa cấp worktree, chưa có dòng code production nào bị sửa bởi audit này.
