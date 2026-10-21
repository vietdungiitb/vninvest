# PLAN — UI Standardization W0 (nền tảng cho chuẩn hoá toàn dự án) — **v1.3**

> **Agent:** `uistandard` (supervisor) · **Base:** `dev` @ `e7b008f25` · **Ngày:** 2026-10-20 · **Lần sửa:** v1.3
> **Nguồn:** `docs/PLAN_UI_STANDARDIZATION_20261020.md` (audit toàn dự án) · `docs/AUDIT_VNBROKER_CONSOLE_20261019.md` §J · `docs/HANDOVER_VNBROKER_CONSOLE_20261020.md`
> **Audit plan:** v1.0 → `%TEMP%\opencode\PLAN_AUDIT_W0.md` (`NEED_REVISION`, O1–O9) · v1.1 → `%TEMP%\opencode\PLAN_AUDIT_W0_v11.md` (`NEED_REVISION`, O10–O19) · v1.2 → `%TEMP%\opencode\PLAN_AUDIT_W0_v12.md` (**`AGREE`**) ⇒ **Gate 1→2 MỞ**
> **Claim:** `docs/CLAIMS.md` — **tên agent PHẢI khớp hậu tố nhánh** (`agent-preflight.mjs:167-188` nhận diện claim của tôi theo đúng tên đó, khác thì `[claim-identity]` chặn commit đầu tiên — L-M02, ledger Entry 375/376/377)

## 0.3 Delta v1.2 → v1.3 (đóng reservation của audit v1.2 + N1/N2/N12)

| # | Vấn đề | Cách đóng trong v1.3 |
|---|---|---|
| **N12** (chặn) | Tên agent trong plan (`uistd-a1/a2/a3`) ≠ hậu tố nhánh (`uistd-w0-tokens\|template\|gates`) ⇒ `agent-preflight` **không** nhận "claim của tôi" ⇒ `[claim-identity]` **chặn commit đầu tiên** (L-M02) | **Đổi tên agent theo đúng hậu tố nhánh**: S1 = `uistd-w0-template` · S2 = `uistd-w0-gates` · S3 = `uistd-w0-tokens`. Bảng SCOPE + claim dùng đúng tên này |
| **N1** (major) | `CHƯA CHẠY` không có exit code, mà `pre-push-gate.mjs:307` coi **exit ≠ 0 là FAIL** ⇒ hoặc chặn push ở máy không staging, hoặc exit 0 = xanh giả (vi phạm L-G02) | AC-2 ghi rõ: gate phụ thuộc staging, khi **không** chạy được ⇒ **exit 0** + in `CHƯA CHẠY: <lý do>` (vì pre-push coi exit≠0 là FAIL); khi **chạy được** mà phát hiện vi phạm ⇒ **exit 1**. Cấm trường hợp "exit 0 dù có vi phạm" |
| **N2** (major) | S1 tạo CSS/JSX mới **không bị rào** theo `check:tokens` (hex cứng) + `check-focus-ring` ⇒ S1 tự làm AC-4 đỏ | AC-3 (S1) thêm: *"CSS/JSX mới **không** chứa hex cứng (gate `check:tokens`) và **không** dùng `focus:outline-none` mà thiếu ring thay thế (gate `check-focus-ring`)"* |
| **R-4/R-5** | Tham chiếu "AC-6" cũ; "%TEMP% còn ở :60" | Đã đổi tên nhất quán **AC-1..AC-5**; lệnh tái lập **đưa vào repo** (S2/S3) nên không phụ thuộc `%TEMP%` |
| **R-3 / N4** | "46/44" class trùng **không tái lập** (auditor đo **60/58** bằng postcss) | Số này **không** nằm trong bất kỳ AC nào ⇒ **bỏ khỏi** §Số liệu (giữ nguyên quy tắc: số không có lệnh tái lập thì không nhận) |
| **R-6, R-10, R-12, R-13** | Ghim scope gate; sha staging ≠ sha merge; đo baseline sau rebase; so tập thay vì so số | Ghi vào AC-2/AC-4: scope gate **ghim theo file**; baseline đo **lại sau khi rebase lên `dev`**; so **tập vi phạm** (set) chứ không so số |
| **R-7, R-8** | `aria-busy` vs vùng live; fail-before của file mới | AC-3: vùng trạng thái có `aria-busy` **và** `aria-live` ở **node khác** vùng live (tránh đọc 2 lần); fail-before của file mới = chạy test **trước khi viết component** (test import file chưa tồn tại ⇒ đỏ) |
| **R-9** | Worker không thấy plan (plan chưa có trên `dev`) | Supervisor **copy** plan + 3 tài liệu nguồn vào `docs/` **mỗi worktree** trước khi spawn worker (O14) |
| **R-1, R-2, R-11, R-14, R-15** | Xem bảng reservation của audit v1.2 | Ghi vào §AC-2/§AC-3/§AC-4 bên dưới |


## Lessons áp dụng (bắt buộc theo `AGENTS.md` §0 bước 0 + `project-lessons` Step 5)

- **[L-V01]** mọi script đo phải qua **≥1 control có đáp án biết trước** (`#fff/#000 = 21.00`) trước khi tin kết quả.
- **[L-V02]** *mọi* claim của người khác phải **tự phản chứng bằng công cụ khác** trước khi dùng ⇒ R9 (audit v1.0) **SAI**, đã bị audit v1.1 bác bằng đo staging ⇒ **đã gỡ khỏi scope** (xem O10).
- **[L-V06]** parser màu trả `null` = **"không đọc được"**, không phải "trong suốt" ⇒ mọi phép đo màu phải composite nhiều lớp + ép `oklch` → `rgb()`.
- **[L-F06]** không kết luận bằng quét "cửa sổ dòng" ⇒ phải đếm bằng script + đối chiếu bằng cách khác.
- **[L-V04 / L-F03]** gate phải **bắt được lỗi thật** (`--self-test`), không được "tồn tại là được" (hazard 9); gate không có **điểm gọi** thì là trang trí ⇒ mọi gate mới **phải** được gọi từ `scripts/pre-push-gate.mjs`.
- **[L-T01 / L-T03]** mọi file ghi bằng script phải kiểm `git diff --numstat` trước khi stage.
- **[L-002 / L-008]** claim **trước**, sửa **sau**; không commit thẳng vào `dev`.
- **[L-G02]** không báo PASS cho gate chưa chạy; `CHƯA CHẠY` là kết quả hợp lệ.

## 0.2 Delta v1.1 → v1.2 (đóng O10–O19 của audit v1.1)

| # | Objection (audit v1.1) | Cách đóng trong v1.2 |
|---|---|---|
| **O10** (blocker) | **R9 của tôi SAI**: route duy nhất render `.pfm-modal__panel`/`.pfm-drawer__panel` là `/portfolios/manage` (`PortfolioFormDialog.tsx:94`, `PortfolioManageDrawer.tsx:251`) và nó **ĐÃ** nạp SOC chunk ⇒ panel **đã đục** (đo: contrast 16.21:1 dark / 17.85:1 light) ⇒ **S3 là no-op**; `theme.module.css:260` là **CSS chết** (`WorkstationShell.tsx` chỉ `void theme`) | **R9 gỡ khỏi plan** (ghi lại là **SAI** + bằng chứng) ⇒ **S3 KHÔNG sửa token**; AC-1 câu 3–4 **bỏ**; S3 thành **docs-only**: ADR + script đo |
| **O11** (blocker) | S3 thêm `--bg-panel-solid: rgb(8 23 52)` ⇒ **tạo conflict 13→14** ⇒ gate baseline-locked **đỏ** sau merge | S3 **không** chạm `theme/tokens.css` ⇒ conflict giữ **13**; AC-6 ghi rõ "không được tăng baseline để làm gate xanh" |
| **O12** (major) | 5 gate **không có điểm gọi** ⇒ trang trí | S2 thêm **điểm gọi** vào `scripts/pre-push-gate.mjs` — **KHÔNG** nằm trong deny list §2 (đã verify `docs/AGENT_PROTOCOL.md` §2); npm alias để **coordinator** thêm sau (ghi claim note) |
| **O13** (major) | staging chạy `6a127002e` ≠ `dev@e7b008f25` ⇒ baseline đo **app khác app merge** | Gate A11Y runtime có **chế độ `CHƯA CHẠY`** khi không có staging/Docker ⇒ **không** đỏ giả; quy trình đo baseline ghi rõ **sha đang chạy trên staging** + bước **deploy staging trước khi chạy gate** |
| **O14** (major) | plan + 3 tài liệu nguồn **không có trên `dev`** ⇒ worker trong worktree **không thấy** plan | Supervisor **copy** plan + 3 tài liệu nguồn vào `docs/` của **mỗi worktree** trước khi spawn worker; worker đọc plan từ **worktree của chính nó** (đường dẫn tuyệt đối trong prompt) |
| **O15** (minor) | baseline heading-contract 26 vs 25 (allowlist) + scope chưa định nghĩa | Dùng **25/99** (theo allowlist đã định nghĩa ở C2) + ghi rõ scope lệnh |
| **O16** (minor) | cả 2 focus-ring vi phạm **ngoài scope** | baseline focus-ring = **2**, ghi rõ **2/2 ngoài scope S3** ⇒ owner = W1–W3 |
| **O17** (minor) | citation R4 `:73,:89` sai dòng | sửa thành `adminUi.tsx:24` + `adminUi.tsx:48` (đã verify nội dung) |
| **O18** (minor) | 73 / 46-44 **không tái lập** | **bỏ** khỏi §Số liệu; chỉ giữ số **có lệnh tái lập** |
| **O19** (minor) | "AC-6" cũ (đã thành AC-5 ở v1.1) + lệnh trỏ `%TEMP%` | Đổi tên nhất quán **AC-1..AC-5**; **mọi script tái lập được đưa vào repo** (`packages/web/scripts/measure-*.mjs` của S3 + baseline JSON của S2) ⇒ **không** phụ thuộc `%TEMP%` |

> **O1–O9 (audit v1.0)**: O2, O3, O4, O5, O8, O9 **đóng** ở v1.1 và giữ nguyên ở v1.2. O1, O6, O7 **đóng một phần** ở v1.1; phần còn lại đã được xử lý tiếp ở v1.2: O1 (light theme) ⇒ **được đẩy hẳn ra khỏi W0** (chỉ đo + ADR + câu hỏi chặn Owner) — xem W0.2'; O6 (AC h1) + O7 (số liệu) ⇒ sửa ở v1.2.

---

## SCOPE (file duy nhất mỗi slice được chạm)

| Slice | Agent | File | Rủi ro rendering |
|---|---|---|---|
| **S1 — template chuẩn** | `uistd-w0-template` | `packages/web/src/components/commercial/**` (mới)<br>`packages/web/src/components/__tests__/commercial-page.component.test.tsx` (mới) | **0** (file mới, chưa route nào import) |
| **S2 — 5 gate máy + điểm gọi** | `uistd-w0-gates` | `packages/web/scripts/check-theme-contrast.mjs`<br>`packages/web/scripts/check-token-conflict.mjs`<br>`packages/web/scripts/check-focus-ring.mjs`<br>`packages/web/scripts/check-heading-contract.mjs`<br>`packages/web/scripts/check-a11y-runtime.mjs`<br>`packages/web/scripts/check-ui-baseline/*.json` (mới)<br>`scripts/pre-push-gate.mjs` (**sửa** — **KHÔNG** nằm trong deny list §2) | **0** (gate mới chưa ai gọi; `pre-push-gate` chỉ **thêm** lời gọi) |
| **S3 — theme: ĐO + ADR (docs-only)** | `uistd-w0-tokens` | `packages/web/scripts/measure-theme-tokens.mjs` (mới — **chỉ đo**, không sửa token)<br>`docs/ADR_THEME_LIGHT_20261020.md` (mới) | **0** (không chạm CSS) |

**Không slice nào chạm** `packages/web/package.json` (deny-list §2) · `packages/web/src/index.css` · `packages/web/src/components/soc/**` (PR #271 chưa merge ⇒ tránh xung đột) · `packages/web/src/theme/tokens.css` · `docs/CLAIMS.md` (ngoài dòng claim của chính worker) · `docs/CODE_CHANGE_AUDIT_LEDGER.md` (coordinator).

**Disjointness (liệt kê file, không đoán):** S1 = `src/components/commercial/**` + `src/components/__tests__/commercial-page.component.test.tsx` · S2 = `scripts/check-*.mjs` + `scripts/check-ui-baseline/**` + `scripts/pre-push-gate.mjs` · S3 = `scripts/measure-theme-tokens.mjs` + `docs/ADR_THEME_LIGHT_20261020.md`. ⇒ **không giao nhau.**

## LIMIT

- **≤3 worker + 1 supervisor** (skill §0.5).
- **Retry cap = 3** mỗi bước (reason + evidence + "fix this step only"). Quá 3 ⇒ ghi `blocker` + trả **partial state**.
- **Timeout mỗi slice: 30 phút** ⇒ supervisor thu hồi worktree + re-slice.
- **Không merge wave sau khi wave trước chưa merge.**
- **Mỗi worker ghi đúng 1 dòng claim** (append cuối `docs/CLAIMS.md`, commit riêng, **trước dòng code đầu tiên**).

## Baseline (ĐO THẬT trên `dev` @ `e7b008f25`, worktree sạch `C:\MujocoProjects\agent-uistd-a1`)

> Lệnh tái lập: `node %TEMP%\opencode\baseline.cjs` (ghi `%TEMP%\opencode\baseline-w0.json`).
> **AC KHÔNG được đòi PASS từ gate đang đỏ** (hazard 6) ⇒ các gate đỏ được đánh dấu **delta-only** (chỉ so delta so với baseline, không đòi PASS).
> Định dạng dòng dưới đây là định dạng mà gate `check-baseline-gates.cjs` của skill đọc được (`- \`name\` EXIT=n`).

- `tsc` EXIT=0 — `npx tsc --noEmit`: 0 lỗi
- `lint` EXIT=0 — `npm run lint`: 0 error / 4191 warning
- `test` EXIT=1 — delta-only, chỉ so delta so với baseline: `npm run test` (jest) = **3 suite FAIL / 9 test FAIL** (nền)
- `test:components` EXIT=0 — `npm run test:components` (vitest): **168 file / 1142 test PASS** (đo lại 2 lần, ổn định)
- `build` EXIT=0 — `npm run build`: PASS
- `check:dom-landmarks` EXIT=0 — `npm run check:dom-landmarks`: PASS (static)
- `check:contrast` EXIT=0 — `npm run check:contrast`: PASS — **không đọc file CSS** (`check-contrast.mjs:26`) ⇒ **không** dùng làm bằng chứng
- `check:tokens` EXIT=1 — delta-only, chỉ so delta so với baseline: `npm run check:tokens` = **1 lỗi nền** (`brokerData.css #c4b5fd`); **không quét** `.tsx/.jsx` (`check-tokens.mjs:40`)
- `test:visual` EXIT=0 — `npm run test:visual`: **CHƯA CHẠY** trong phiên này ⇒ AC-4 dùng "không có test visual mới đỏ"
- `i18n-scan-strict.mjs` EXIT=0 — `node scripts/i18n-scan-strict.mjs`: PASS
- `check-lessons.mjs` EXIT=0 — `node scripts/check-lessons.mjs`: 45/60 lesson (dev)
- `check-multi-agent.mjs` EXIT=0 — `node packages/web/scripts/check-multi-agent.mjs`: PASS
- `check-theme-contrast.mjs` EXIT=0 — `node scripts/check-theme-contrast.mjs`: **CHƯA CHẠY** (gate mới, S2 tạo) — baseline-locked
- `check-token-conflict.mjs` EXIT=0 — `node scripts/check-token-conflict.mjs`: **CHƯA CHẠY** (gate mới, S2 tạo) — baseline-locked
- `check-focus-ring.mjs` EXIT=0 — `node scripts/check-focus-ring.mjs`: **CHƯA CHẠY** (gate mới, S2 tạo) — baseline-locked
- `check-heading-contract.mjs` EXIT=0 — `node scripts/check-heading-contract.mjs`: **CHƯA CHẠY** (gate mới, S2 tạo) — baseline-locked
- `check-a11y-runtime.mjs` EXIT=0 — `node scripts/check-a11y-runtime.mjs`: **CHƯA CHẠY** (gate mới, S2 tạo) — baseline-locked, có chế độ `CHƯA CHẠY` khi không có staging

## Số liệu dùng trong AC (mỗi số kèm lệnh tái lập — lệnh sẽ **nằm trong repo** sau S2/S3)

| Số | Giá trị | Lệnh tái lập |
|---|---|---|
| token conflict mode B (`:root` + `@theme`) | **13** | `node packages/web/scripts/check-token-conflict.mjs --print-count` (S2) |
| token conflict mode A (`:root` thuần) | **11** | cùng lệnh, `--scope root-only` |
| file page tự dựng `<h1>` (allowlist đã định nghĩa ở C2) | **25 / 99** | `node packages/web/scripts/check-heading-contract.mjs --print-violations` (S2) |
| `focus:outline-none` không có ring thay thế | **2** (2/2 **ngoài scope S3**) | `node packages/web/scripts/check-focus-ring.mjs --print-violations` (S2) |
| H1 `/admin/users` light | **1.01:1** (vô hình) | `node packages/web/scripts/measure-theme-tokens.mjs` (S3, có control 21.00) |
| route duy nhất render `.pfm-modal__panel`/`.pfm-drawer__panel` | `/portfolios/manage` — **ĐÃ** nạp SOC chunk ⇒ panel **đã đục** (16.21:1 dark / 17.85:1 light) | `node packages/web/scripts/measure-theme-tokens.mjs` (S3) |

## Nguyên nhân gốc đã verify (trích nguyên văn, kèm sha)

| # | Sự kiện | Bằng chứng |
|---|---|---|
| R1 | Canvas **không bao giờ** chuyển sáng: `--color-bg-primary: #020617` không có override light | `packages/web/src/index.css:53 @ e7b008f25` |
| R2 | Nhưng **chữ** thì đảo: `--text-primary` → `#0f172a` ở light | `packages/web/src/theme/tokens.css:2` + `:65`; `packages/web/src/components/soc/soc.tokens.css:7` + `:124 @ e7b008f25` |
| R3 | ⇒ chữ tối trên nền tối; đo pixel thật: `/admin/users` H1 = **1.01:1** | `measure-theme-tokens.mjs` (S3, control 21.00) |
| R4 | H1 admin dùng `text-slate-950` (cứng) ⇒ **đổi `--text-primary` không sửa được**; đổi `text-slate-950` toàn cục ⇒ phá ≥8 trang admin (20.17:1 → 1.0955:1) | `packages/web/src/pages/admin/adminUi.tsx:24` + `:48 @ e7b008f25` |
| R5 | Sidebar render `<h1>` + `<h3>` ⇒ 2 h1 ở route có h1 riêng + nhảy cấp h1→h3 | `Sidebar.tsx:81` + `:150 @ e7b008f25` |
| R6 | `<main>` lồng ở 18 route tenant-admin | `FullLayout.tsx:90` + `TenantAdminLayout.tsx:82 @ e7b008f25` |
| R7 | `/transactions` có `<h1>` **hardcode tiếng Việt** | `TransactionsPage.tsx:194 @ e7b008f25` |
| R8 | `ShellPageChrome` đã có `<h1>` sẵn (`useId()`) + dùng `<div role="region">` (KHÔNG render `<main>`) | `ShellPageTemplate.js:90/102/122 @ e7b008f25` |
| R9 | ~~`--bg-panel-solid` chỉ có trong SOC chunk ⇒ panel trong suốt~~ ⇒ **SAI, đã gỡ** (O10): route duy nhất render panel đó **ĐÃ** nạp SOC chunk ⇒ **đã đục**; `theme.module.css:260` là **CSS chết** | `soc.tokens.css:18` · `portfolioManage.css:405,407,504` · `theme.module.css:260` @ `e7b008f25` |
| R10 | Token conflict **có hệ quả runtime**: `--bg-panel` = `#0f172a` ở `/dashboard` nhưng `rgba(8 23 52/.4)` ở `/admin/users` — cùng dark theme, khác giá trị theo route | đo bằng probe khác route (audit v1.0 §4.5) |

## Hợp đồng dùng chung (contract-first ⇒ 3 slice phát triển song song được)

**C1 — `CommercialPage` (S1 cung cấp)** — 6 vùng:
```
props: eyebrow, title, description, badge, metrics, notice, error,
       toolbar, actions, children, meta, className, id
```
- **KHÔNG** render `<main>` (mẫu `ShellPageChrome` → `<div role="region">`; `<main>` của `FullLayout.tsx:90`).
- đúng **1** `<h1>`; `<div role="region" aria-labelledby={titleId}>`; `useId()` sinh id (mẫu `ShellPageTemplate.js:102`).
- 4 primitive: `CommercialToolbar` · `CommercialState` (loading/empty/error) · `CommercialTable` (caption + `scope`) · `CommercialMeta`.
- CSS: `packages/web/src/components/commercial/CommercialPage.module.css` — tiền tố **`.cm-` duy nhất**.
- Vùng trạng thái: skeleton `aria-hidden` + vùng `aria-busy`; empty = "—" + lý do + CTA; error = `role="alert"` + **nút Retry** + hướng khắc phục; **vùng live mount sẵn** (không render động).
- **Khi migrate route (W1–W3): gỡ `<h1>` (và heading thừa) của route** — nếu không sẽ thành 2 h1.

**C2 — 5 gate (S2 cung cấp)** — chạy `node packages/web/scripts/<name>.mjs` (**không** thêm npm alias ⇒ **không** chạm `package.json`; **coordinator** thêm alias sau).
**Mẫu chung: BASELINE-LOCKED** (mẫu `scripts/check-lessons.mjs` sẵn có trong repo):
```
baseline lưu ở packages/web/scripts/check-ui-baseline/<gate>.json
exit 0  ⇔  vi phạm hiện tại <= baseline đã ghi     (và in danh sách vi phạm)
exit 1  ⇔  vi phạm TĂNG so với baseline          (hồi quy ⇒ chặn)
--self-test : chèn 1 vi phạm đã biết ⇒ exit ≠ 0    (chứng minh gate bắt được)
```
| Gate | Soi cái gì | Baseline (đo) | Owner + wave đóng |
|---|---|---|---|
| `check-theme-contrast.mjs` | mọi cặp text/bg đọc từ **file thật** ở 2 theme (canvas đọc bằng `getComputedStyle`) | đo ở S2 (có control 21.00) | S3 + W0.2' |
| `check-token-conflict.mjs` | **scope mode B**: 3 file (`src/index.css` khối `@theme` **+** mọi khối `:root`; `src/theme/tokens.css`; `src/components/soc/soc.tokens.css`); **KHÔNG** tính block `:root[data-theme="light"]` | **13** | S3 + W0.3 |
| `check-focus-ring.mjs` | `focus:outline-none` không có ring/shadow/border thay thế | **2** (2/2 **ngoài scope S3**) | W1–W3 |
| `check-heading-contract.mjs` | file tự dựng `<h1>`; allowlist = `src/components/commercial/**` + `src/components/ShellPageTemplate.js` + `src/pages/admin/adminUi.tsx` | **25 / 99** | W1–W3 |
| `check-a11y-runtime.mjs` | runtime: h1>1 trong main · main lồng · thiếu accessible name · mất focus ring · contrast fail · target<24px · tràn 320px. **Chế độ `CHƯA CHẠY`** khi không có staging/Docker (O13) | đo ở S2 (26 lần đo staging, ghi sha staging đang chạy) | W1–W3 |

**Điểm gọi (O12):** S2 thêm 5 lời gọi vào `scripts/pre-push-gate.mjs` (file này **KHÔNG** nằm trong deny list §2 — đã verify `docs/AGENT_PROTOCOL.md` §2) ⇒ **mọi gate có điểm gọi thật**; `pre-push-gate` chỉ **thêm** lời gọi, không sửa gate cũ.

## Acceptance criteria (Given / When / Then) — **viết TRƯỚC edit đầu tiên**

### AC-1 (S3) — light theme: **đo và ghi nhận**, KHÔNG sửa
- **Given** app ở `data-theme="light"`, **When** chạy `node packages/web/scripts/measure-theme-tokens.mjs`, **Then** script in ra: `--text-primary` / `--color-bg-primary` / canvas thật + **contrast thật của H1 trên ≥2 route** + **control `#fff/#000 = 21.00`** ⇒ bằng chứng tái lập được **trong repo**, **không** kết luận "đã sửa".
- **Given** báo cáo đó, **When** lưu `docs/ADR_THEME_LIGHT_20261020.md`, **Then** ADR có: nguyên nhân gốc (R1–R4), **2 phương án (a)/(b)**, **số đo của (a) để Owner chọn**, và **câu hỏi chặn** ⇒ light theme **không** được "sửa nửa" trong W0.
- **Given** không có thay đổi nào trong `theme/tokens.css` / `index.css` / `components/soc/**`, **When** đếm lại token conflict, **Then** vẫn **13** ⇒ **không** sinh conflict mới.

### AC-2 (S2) — gate bắt được lỗi thật, không xanh giả, và **có điểm gọi**
- **Given** mỗi gate, **When** chạy `--self-test`, **Then** exit **≠ 0** với thông điệp chứng minh (case đã biết).
- **Given** repo ở trạng thái `dev`, **When** chạy gate, **Then** exit **0** (vi phạm **≤** baseline) **và** script **in ra** danh sách vi phạm + số baseline ⇒ **không** phải gate im lặng.
- **Given** tôi chèn 1 vi phạm (vd thêm `--text-primary` giá trị khác vào `soc.tokens.css`; thêm `focus:outline-none` không ring vào 1 file), **When** chạy gate tương ứng, **Then** exit **≠ 0** ⇒ chứng minh gate **không** xanh giả (kể cả case `--shadow-sm` xung đột giữa `@theme` và `:root`).
- **Given** gate chạy bằng `node scripts/<name>.mjs`, **When** đổi thành npm alias, **Then** exit code **giống hệt** (gate độc lập môi trường — hazard 17).
- **Given** gate phụ thuộc staging (A11Y runtime) mà máy **không** có staging/Docker, **When** chạy, **Then** exit **0** + in `CHƯA CHẠY: <lý do>` (vì `pre-push-gate.mjs:307` coi exit ≠ 0 là FAIL ⇒ gate sẽ chặn push oan); **cấm** trường hợp "exit 0 dù có vi phạm" (L-G02).
- **Given** `scripts/pre-push-gate.mjs`, **When** chạy, **Then** nó **gọi** cả 5 gate mới (in ra tên gate + exit code) ⇒ **không** có gate mà không ai gọi.
- **Given** scope của mỗi gate, **When** chạy, **Then** gate chỉ soi **đúng file trong scope của nó** (ghim danh sách file, **không** quét cả repo) ⇒ không bị vi phạm ngoài scope làm gate đỏ.

### AC-3 (S1) — template render đúng 6 vùng
- **Given** `CommercialPage` đủ props, **When** render, **Then**: đúng **1** `<h1>`; **1** `role="region"`; **0** `<main>`; vùng trạng thái **có node trong DOM dù rỗng**; `id` sinh bằng `useId()`.
- **Given** `error` khác rỗng, **When** render, **Then** có `role="alert"` + **nút "Thử lại"** + text hướng khắc phục.
- **Given** `loading`, **When** render, **Then** skeleton có `aria-hidden="true"` và vùng có `aria-busy="true"`.
- **Given** 1 route đã có `<h1>` riêng, **When** bọc bằng `CommercialPage` **mà không gỡ h1 cũ**, **Then** có **2** `<h1>` ⇒ test phải **bắt được** trường hợp này (AC "gỡ h1 cũ").
- **Given** CSS/JSX **mới** của S1, **When** chạy `npm run check:tokens` + `node scripts/check-focus-ring.mjs`, **Then** S1 **không** làm tăng số vi phạm so với baseline ⇒ S1 **không** tự làm AC-4 đỏ (hex cứng cấm; `focus:outline-none` phải có ring thay thế).
- **Given** vùng trạng thái, **When** render, **Then** `aria-busy` nằm ở **node khác** vùng live (`aria-live`) ⇒ không đọc 2 lần; vùng live **luôn** có trong DOM dù rỗng.
- Lệnh tái lập: `npx vitest run src/components/__tests__/commercial-page.component.test.tsx` — **fail-before**: chạy test **trước khi** viết component (import file chưa tồn tại ⇒ **đỏ**); **pass-after**: xanh.

### AC-4 (tất cả slice) — không làm hỏng gì
- **Given** 3 slice đã merge, **When** chạy lại **toàn bộ** baseline, **Then**:
  - `tsc` 0 · `lint` 0 error · `vitest` 0 fail · `build` 0 · `check:dom-landmarks` **0** · `check:contrast` 0 · `i18n-scan-strict` 0 · `check-lessons` 0 · `check-multi-agent` 0
  - `jest`: **không tăng** số suite FAIL so với baseline **3**
  - `check:tokens`: **không tăng** số lỗi so với baseline **1**
  - `test:visual`: **không có** test visual mới đỏ
  - **5 gate mới**: exit **0** (baseline-locked) **và** in ra baseline + **tập** vi phạm hiện tại; so **tập** (set) chứ không so số ⇒ không "làm xanh" bằng cách đổi cách đo; **baseline KHÔNG được nâng** để làm gate xanh; baseline đo **lại sau khi rebase lên `dev`** (R-12)
  - `git diff --numstat` (mỗi file so với `HEAD` của nó): **không** file nào bị viết lại toàn bộ (hazard 16)

## Non-goals

- **NG-1** **KHÔNG** sửa light theme (canvas hay token) trong W0 — cần Owner chốt (a)/(b) ⇒ W0.2'.
- **NG-2** **KHÔNG** migrate route nào sang template mới (41 route = W1–W3).
- **NG-3** **KHÔNG** sửa `packages/web/package.json` (deny-list §2) ⇒ 5 gate chạy bằng `node scripts/...`; **coordinator** thêm npm alias sau.
- **NG-4** **KHÔNG** sửa `packages/web/src/index.css` (nhóm `--color-*` của Tailwind) trong W0.
- **NG-5** **KHÔNG** sửa `packages/web/src/components/soc/**` (PR #271 chưa merge ⇒ tránh xung đột).
- **NG-6** **KHÔNG** sửa `packages/web/src/theme/tokens.css` trong W0 (thêm token mới sẽ **tạo** conflict 13→14, xem O11).
- **NG-7** Mỗi worker **tự append 1 dòng claim** vào `docs/CLAIMS.md` (append cuối file, **commit riêng**, **trước dòng code đầu tiên** — `docs/AGENT_PROTOCOL.md` §3). **Coordinator** ghi ledger (đã **không** còn trong deny-list §2 từ 2026-10-03).
- **NG-8** **KHÔNG** xoá 7 file `Shell*Page` legacy (W5).

## Rollback (từng slice độc lập)

| Slice | Rollback |
|---|---|
| S1 | xoá `src/components/commercial/` + file test (file mới, chưa route nào import) |
| S2 | bỏ 5 lời gọi trong `scripts/pre-push-gate.mjs` + xoá 6 file script + `scripts/check-ui-baseline/` |
| S3 | xoá `scripts/measure-theme-tokens.mjs` + `docs/ADR_THEME_LIGHT_20261020.md` |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi token toàn cục làm đổi mọi màn hình | W0 **không** đổi token (NG-1, NG-6) ⇒ rủi ro = 0 |
| PR #271 (VNBroker) **chưa merge** và đụng `soc.tokens.css` | W0 **không** sửa `components/soc/**` (NG-5) ⇒ không xung đột |
| 2 worker ghi cùng `docs/CLAIMS.md` | Worker ghi **1 dòng riêng**, append cuối file, commit riêng; `merge=union` đã cấu hình; **self-check disjoint** trước khi stage |
| Gate mới chặn nhầm PR khác | **Baseline-locked** ⇒ chỉ chặn khi vi phạm **TĂNG**; `--self-test` bắt buộc |
| Gate A11Y runtime cần staging mà CI không có | **chế độ `CHƯA CHẠY`** ⇒ không đỏ giả (O13) |
| Worker đọc không thấy plan (plan chưa có trên `dev`) | Supervisor **copy** plan + 3 tài liệu nguồn vào `docs/` của **mỗi worktree** trước khi spawn worker (O14) |

## Kế hoạch thực thi

```
S1 (template)  ∥  S2 (gate + điểm gọi)  ∥  S3 (đo + ADR)     ← 3 worktree, file disjoint
   → merge: S3 → S1 → S2   (S2 hiệu chỉnh baseline sau khi S1/S3 merge)
   → chạy lại toàn bộ baseline → PR
```

**Lệnh tái lập baseline (sẽ nằm trong repo):** `node packages/web/scripts/measure-ui-baseline.mjs` (S2) · `node packages/web/scripts/measure-theme-tokens.mjs` (S3)
**Gate của skill:** `node $HOME/.opencode/skills/multi-agent-workflow/scripts/check-citations.cjs docs/PLAN_UI_STANDARDIZATION_W0.md --roots .` · `…/check-baseline-gates.cjs docs/PLAN_UI_STANDARDIZATION_W0.md`
