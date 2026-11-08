# PLAN — Khắc phục UI/UX frontend sau audit 2026-10-30

> **Trạng thái:** ĐỀ XUẤT (PROPOSED) — **đã audit độc lập (subagent, AGREE, 3 objection đã xử lý)**, chưa claim, chưa sửa code.
> **Ngày:** 2026-10-30 · **Base:** `dev` @ `983b8c2` + 4 file docs chưa commit (3 audit + ledger).
> **Phạm vi:** `packages/web` (React 19 + Vite 5 + Tailwind v4). Không đổi BE trong các slice FE.
> **Nguồn handoff:** không có file `HANDOFF_20261030.md`. Handoff thực tế của phiên trước =
> `docs/AUDIT_UIUX_FRONTEND_20261030.md` (Entry 417) + `AUDIT_UIUX_FRONTEND_DEEP_20261030.md` (Entry 418)
> + `AUDIT_UIUX_FRONTEND_REAUDIT_20261030.md` (Entry 419, bản definitive) + §12 của bản REAUDIT.
> Handoff chính thức gần nhất vẫn là `docs/HANDOFF_20261028_POST299.md` (4 việc BE, xem §5 Track 2).
> **Lessons áp dụng:** L-001, L-002, L-003, L-007, L-008, L-M02, L-V01, L-V02, L-V03, L-F01,
> L-F03, L-F06, L-F08, L-F11, L-G01, L-G02, L-G04, L-G05, L-G07, L-A01.

---

## 0. Tóm tắt điều hành

1. Phiên trước **làm đúng hướng nhưng để lại 4 file chưa commit** và **3 lỗi số liệu/citation** trong audit
   (widget "eager", "100 trang", "100/100 không alt"). Phải đóng gói + errata **trước** khi dùng audit làm AC.
2. **P0 lớn nhất không phải bundle widget.** Widget đã được `import()` động từ trước
   (`VNStockChartPanel.js:54`), `dist/index.html` **không** preload chunk widget. Vấn đề thật là
   **2,2 MB tải khi mở trang chart** + **i18n 513 KB preload mọi route** (`dist/index.html` có
   `i18n-CCdYDQcA.js`) + **155 hard-hex thật** (161 thô, 6 nằm trong comment) làm `check:tokens` đỏ.
3. **Light theme đang bị chặn bởi quyết định Owner**, không phải bởi code: `ADR_THEME_LIGHT_20261020.md`
   §4 đưa 2 phương án (a) sửa thật (89 file/497 chỗ + 36 file) và (b) tắt option Sáng (~3 dòng).
   Không chốt (a)/(b) thì Phase A không thể có AC đúng.
4. Đề xuất thứ tự: **Phase 0 (đóng gói audit) → A1 (token gate) → B1 (error boundary cấp layout)
   → B3/B4 (i18n + gate) → C1/C2 (đo + defer chart) → C3 (split i18n) → D → E**.
   Track BE (22 fail migration-harness) chạy **song song** bằng agent khác.
5. **Không** đưa vào kế hoạch này: redesign giao diện, thêm chart lib, đổi màu tăng/giảm (L-F08),
   sửa `soc.module.css` (L-F03/L-F11), thêm dependency mới.

---

## 1. Trạng thái phiên trước (đã kiểm chứng)

### 1.1 Đã làm

| Việc | Bằng chứng | Trạng thái |
|---|---|---|
| 3 báo cáo audit UI/UX | `docs/AUDIT_UIUX_FRONTEND_20261030.md` (19,9 KB), `..._DEEP_...` (24,6 KB), `..._REAUDIT_...` (69,5 KB) | **chưa commit** (`??`) |
| 3 Entry ledger 417–419 | `docs/CODE_CHANGE_AUDIT_LEDGER.md` +40 dòng | **chưa commit** (`M`) |
| Gate chạy thật (theo audit) | tsc 0 · lint 0 err/4417 warn · check:tokens FAIL · contrast PASS · build PASS | đã chạy lại một phần, xem §2 |
| Inventory định lượng + bundle metrics | bảng §1 REAUDIT | có số, nhưng 3 số sai → §3 |

### 1.2 Chưa làm

- Chưa có claim trong `docs/CLAIMS.md` cho phiên audit (doc-only, không chặn).
- Chưa audit độc lập kế hoạch (B3) và chưa re-audit code (B8).
- Chưa sửa một dòng code nào.
- Chưa đóng 2 claim cũ trông như `in-progress` (`pf-manage-rebuild` từ 2026-10-13,
  `master-roadmap-2026q4`) — cần xác minh trước khi chạm `pages/portfolio*`.

### 1.3 Rủi ro mất mát

3 file audit + 40 dòng ledger là **toàn bộ artefact** của phiên trước và đang untracked.
`git checkout --` hoặc reset sẽ xoá sạch (L-A01). **Phase 0 phải commit trước mọi việc khác.**

---

## 2. Baseline cổng — đo lại 2026-10-30

Chạy tại `packages/web` trên máy local (trừ build/test: xem ghi chú).

| Cổng | Lệnh | Exit | Kết quả thật |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` | 0 | PASS, 0 lỗi |
| Lint | `npm run lint` | 0 | **0 error / 4417 warning** (`react/jsx-no-literals` chiếm đa số) |
| Token | `node scripts/check-tokens.mjs` | **1** | **161 vi phạm** (thô): `theme/light-theme.css` 149 · `soc.components.css` 11 · `brokerData.css` 1. **Sau khi bỏ hex trong comment: 155** (6 false positive — gate chưa strip `/* */`) |
| Contrast | `node scripts/check-contrast.mjs` | 0 | PASS 7 cặp × 2 mode ≥ 4.5:1 |
| Light-theme coverage | `node scripts/check-light-theme.mjs` | 0 | PASS **227 màu / 424 file** |
| i18n strict | `npm run i18n:scan:strict` | 0 | PASS nhưng warning key reuse: `cancel`, `delete`, `loadError`, `saving`, … |
| i18n hardcoded | `npm run check:i18n-hardcoded` | — | Script chỉ quét **5 path** cố định (`package.json:33`) |
| DOM landmarks | `npm run check:dom-landmarks` | — | **CHƯA CHẠY LẠI** (audit báo PASS) |
| Build | `npm run build` | — | **CHƯA CHẠY LẠI** và **không có `dist/` trong tree** (đã xoá/ignore). Claim về preload trong §1 dựa trên build của phiên trước (audit-reported) — **phải chạy lại ở C1** để có bằng chứng thật |
| FE test | `npm run test` / `test:components` | — | **CHƯA CHẠY** (quy định §12.4: chạy trên VPS staging) |
| BE test | `manage.py test` | — | **CHƯA CHẠY** (VPS `vninvest-core-api`) |

> Sau khi chạy gate: `git status` vẫn chỉ có 4 file docs ⇒ **không** có file tracked bị gate ghi đè (L-V03).

**Số đo bundle lấy từ build của phiên trước (đọc `dist/`, không chạy lại):**
`widget` 2 217 KB (557 KB gzip) · `echarts` 728 KB · `i18n` 513 KB (167 KB gzip) · `xlsx` 429 KB
· `react-vendor` 305 KB. `dist/index.html` preload: vite-helpers, react-vendor, adapters, casl,
**i18n**, tanstack, utils, hooks, context, icons, ui — **không có widget**.

---

## 3. Rà soát audit: errata bắt buộc trước khi dùng làm AC

| # | Audit nói | Kiểm chứng | Kết luận |
|---|---|---|---|
| E1 | P0-1 "Bundle `widget` 2.2 MB **eager** kéo vào StockDetail/Portfolio…" (`StockDetailPage.tsx:20`) | `StockDetailPage.tsx:20` là `PageErrorBoundary`, **không** import widget. Widget được `import('vninvestcharts-widget')` **động** tại `components/VNStockChartPanel.js:54`; `dist/index.html` không preload widget. Chỉ **CSS** `vninvestcharts-widget/dist/index.css` được import tĩnh (`:1`, 189 KB) | **SAI một phần**. Hạ P0-1 → **P1**; đổi fix thành "defer mount + tách CSS", không phải "dynamic import" (đã có) |
| E2 | "100 trang prod" | `src/pages` có **91 file** (86 `.tsx` + 5 `.js`, loại `__tests__`) | Dùng **91**, không dùng 100 |
| E3 | "28 trang không `t()`, 9 trang thật" (`ShellOperationsCenterPage` nằm trong danh sách) | **18 file** không có `t(`; 13 là page thật; **8 page có text hardcode thật**; `ShellOperationsCenterPage.tsx` **có 2** `t(` | Dùng danh sách 8 page: `ShellMailConfigPage`, `VipLocalControlPage`, `BrokerHubPage`, `TransactionsPage`, `ShellAiCommandCenterPage`, `ShellSettingsPage`, `ShellSupportPage`, `PortfolioWorkspacePage` |
| E4 | "100/100 không `alt`" (P1-8) | Toàn `src` chỉ có **2** `<img>`, **cả hai đều có `alt`** (`CampaignDetailDrawer.jsx:76`, `CampaignForm.jsx:171`) | **Bỏ finding alt**; giữ finding `aria-label` (cần đo lại trên 91 page) |
| E5 | "141+ hard hex" | Chạy lại: **161** thô (149 + 11 + 1); **155** sau khi bỏ 6 hex nằm trong comment CSS (gate chưa strip comment — bug của gate) | Dùng **155 vi phạm thật**; sửa gate strip comment |
| E6 | Phase A "chạy `check:light-theme` (nếu có)" | Script **tồn tại** (`scripts/check-light-theme.mjs`), chạy **PASS** 227/424, **chưa** nối vào `check:shell` | Đưa vào gate bắt buộc Phase A |
| E7 | P0-2 "token swap thật sự" | `ADR_THEME_LIGHT_20261020.md` §4: light theme hỏng vì canvas không có token light; (a) = 89 file/497 chỗ + 36 file, (b) = tắt option ~3 dòng. **Owner chưa chốt** | **Blocker quyết định**, không phải blocker code |
| E8 | `PaymentReturnPage.tsx:4-31` | File thật: `src/pages/commercial/PaymentReturnPage.tsx:4-31`, tự định nghĩa `useI18n()` trả map tiếng Việt cứng | **ĐÚNG**, chỉ thiếu đường dẫn |
| E9 | "97% không ErrorState" | `PageErrorBoundary` chỉ xuất hiện ở **3/91 page**. Primitive hiện là bản riêng của StockDetail: log `"[StockDetailPage]"` (`PageErrorBoundary.tsx:30`), CSS `sdp-*`, copy tiếng Việt cứng | **ĐÚNG hướng**, nhưng fix phải bắt đầu bằng **tổng quát hoá primitive + gắn ở layout**, không sửa 91 page |
| E10 | "19 component >500 dòng" | Chưa đếm lại toàn bộ; các file được nêu đều tồn tại (`SocSignalsPanel.tsx` 2454 dòng, …) | Giữ là **audit-reported**, cần script đếm trước khi thành AC |

**Kết luận rà soát:** audit đủ tốt để làm **bản đồ vấn đề**, nhưng **không đủ** để làm acceptance criteria
nguyên văn. Mọi slice dưới đây dùng số đã kiểm chứng lại và ghi lệnh tái tạo.

---

## 4. Quyết định cần Owner chốt (chặn Phase A/B)

| ID | Câu hỏi | Phương án | Đề xuất |
|---|---|---|---|
| **D1** | Light theme: sửa thật hay tắt? | (a) sửa: 89 file/497 chỗ + 36 file, 1 wave riêng · (b) tắt option Sáng, ép dark (~3 dòng) | **(b) ngay** để đóng P0-2/P0-3 trong 1 slice; (a) mở wave riêng sau |
| **D2** | Gỡ `recharts` sau khi migrate 12 file? | Có / Không / Để sau | **Để sau** — không phải P0, rủi ro cao |
| **D3** | Split i18n: lazy namespace hay giữ monolith + giảm key? | Lazy namespace (giữ `vi.js` làm barrel tương thích) / chỉ dedup key | **Lazy namespace + barrel**; dedup key làm trước (B3) |
| **D4** | Ưu tiên FE UI/UX hay BE backlog POST299? | FE trước / BE trước / song song 2 agent | **Song song**: FE `uiux-fe`, BE `be-vet` (file rời nhau) |

> Không có D1 thì **không** bắt đầu A2. A1 (token gate) và toàn bộ Phase B/C **không** phụ thuộc D1.

---

## 5. Kế hoạch slice

**Quy ước effort:** S ≤ 0,5 ngày · M 1–2 ngày · L 3–5 ngày (1 agent).
Mỗi slice: 1 branch `feat/<agent>`, 1 claim, 1 PR merge-commit, 1 Entry ledger.

### Phase 0 — Đóng gói artefact phiên trước (bắt buộc, làm ngay)

#### P0.1 `uiux-audit-closeout` — S — doc-only

- **Mục tiêu:** đưa 3 audit + 3 Entry ledger vào git, kèm errata §3 để người sau không dùng số sai.
- **File:** 3 `docs/AUDIT_UIUX_FRONTEND_*_20261030.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
  thêm mục `## Errata 2026-10-30` vào đầu bản REAUDIT (hoặc file `docs/AUDIT_UIUX_FRONTEND_ERRATA_20261030.md`).
- **Bước:** `git switch -c feat/uiux-audit-closeout` → thêm errata → `git add` đúng 4 file →
  kiểm `git diff --cached --stat` → commit → push → PR.
- **AC:**
  - Given working tree đang có 3 file `??`, When merge PR, Then `git log dev` chứa 3 file và Entry 417–419.
  - Given đọc REAUDIT, When thấy P0-1, Then có ghi chú "đã hạ P1" + bằng chứng `VNStockChartPanel.js:54`.
- **Gate:** `node scripts/pre-push-gate.mjs` · `node scripts/check-lessons.mjs` · encoding/EOL ·
  `git status` sạch sau commit.

---

### Phase A — Token & theme (đóng P0-2/P0-3)

#### A1 `uiux-token-gate` — M — **không phụ thuộc D1**

- **Mục tiêu:** `check:tokens` exit 0 mà không nới allowlist bừa.
- **File:** `packages/web/scripts/check-tokens.mjs`, `src/components/soc/soc.components.css`,
  `src/components/brokerData/brokerData.css`, `src/theme/light-theme.css` (chỉ đọc).
- **Bước:**
  1. **Sửa false positive của gate:** strip `/* … */` trước khi match hex → 161 giảm còn **155**
     (6 hex nằm trong comment, ví dụ `#081734`, `#020b73` ở `soc.components.css:4454,4482`).
  2. `light-theme.css` là file **sinh tự động** bởi `check-light-theme.mjs --update` (property-scoped
     override). Xử lý như `theme/tokens.css`: thêm vào danh sách "pure definition", có comment + test
     rằng file này do script sinh (không phải nơi vá tay) → giảm **149**.
  3. **5 hex còn lại** trong `soc.components.css` (`:root[data-theme="light"] .statusBadge*`, dòng 4379-4395):
     map về token đã có (emerald-700/cyan-700/amber-700/red-700) → thêm vào allowHex với comment (cùng nhóm semantic "status"); migration sang token là A2b (optional, sau D1).
     **thêm token** vào `soc.tokens.css` (L-F03) → thay bằng allowHex (xem trên).
     Nếu D1=(b): xoá cả block light-mode thay vì allowlist.
  4. 1 hex `#c4b5fd` trong `brokerData.css`: map về token tím hiện có.
  5. Nối `check-light-theme` vào chuỗi gate. **Không sửa `package.json` (deny-list)** — thêm lời gọi
     vào `scripts/pre-push-gate.mjs` hoặc `scripts/check-shell.mjs`.
- **AC:**
  - Given `node scripts/check-tokens.mjs`, When chạy, Then exit 0, in "0 violations".
  - Given `node scripts/check-light-theme.mjs`, When chạy, Then vẫn exit 0 (227 màu/424 file).
  - Given một hex mới thêm vào `soc.components.css`, When chạy gate, Then fail (self-test bằng hex giả).
- **Gate:** `check:tokens` · `check-light-theme` · `check:contrast` · `check:shell` · `tsc` · `lint`.
- **Rollback:** revert PR; không đổi runtime CSS ngoài 12 hex.

#### A2 `uiux-light-theme-off` — S — **chỉ sau D1 = (b)**

- **Mục tiêu:** tắt option "Sáng" để không còn trạng thái vô hình, giữ dark ổn định.
- **File:** `src/pages/UserSettingsPage.tsx:206-209`, `src/main.tsx:259-270`,
  `src/pages/UserSettingsPage.tsx:109` (fallback `profile.theme ?? "light"`).
- **Bước:** bỏ option Sáng → ép `dark` khi boot → fallback `profile.theme ?? "dark"` →
  giữ `light-theme.css` nguyên trạng cho wave (a) sau này (A1 đã exclude khỏi token gate).
- **AC:** Given user đã lưu `theme=light`, When reload, Then UI dark, không flash light;
  Given mở Settings, Then không còn option Sáng.
- **Gate:** tsc · lint · `check:dom-landmarks` · test Settings (nếu có) trên VPS.

#### A2b `uiux-light-theme-fix` — L — **chỉ sau D1 = (a)**, ngoài cam kết của plan này

- Theo ADR §4a: sửa 89 file/497 chỗ màu chữ cứng + 36 file nền tối cứng; đo lại 4 route bằng
  `scripts/measure-theme-tokens.mjs`; mỗi nhóm file 1 PR nhỏ.

#### A3 `uiux-token-tsx` — L — sau A1

- **Mục tiêu:** mở `check:tokens` sang `.tsx/.js/.jsx` (P1-19; ADR đo 497 chỗ hardcode màu trong tsx).
- **Cách:** baseline file `scripts/check-tokens-baseline.json` (đếm theo file + hex) → gate chỉ fail
  khi **tăng** vi phạm; migrate dần theo feature, không big-bang.
- **AC:** Given thêm 1 hex mới trong `.tsx`, When chạy gate, Then fail; Given code hiện tại, Then exit 0.

---

### Phase B — States, i18n, a11y, form

#### B1 `uiux-page-error-boundary` — M — **ưu tiên cao nhất Phase B**

- **Mục tiêu:** 100% route có ErrorState + reset khi điều hướng, không sửa 91 page.
- **File:** `src/components/PageErrorBoundary.tsx`, `src/layouts/full/FullLayout.tsx:89-103`,
  `src/locales`/i18n key mới, test mới.
- **Bước:**
  1. Tổng quát hoá primitive: bỏ log `"[StockDetailPage]"`, bỏ CSS `sdp-*`, dùng
     `ShellPageTemplate`/`ShellPanel` + `t("common.errorTitle")`, nhận `title/message/onRetry`.
  2. Trong `FullLayout`, bọc `e(Outlet)` bằng `PageErrorBoundary` với `key={location.pathname}`
     (reset khi đổi route) — 1 chỗ phủ toàn bộ layout authenticated.
  3. Thêm `useLocation` effect: đóng mobile drawer khi path đổi (P2-28) + đưa focus về `#main-content`.
  4. Giữ `PageErrorBoundary` cũ ở trang StockDetail/Dashboard/AlertCenter (không xoá) để không đổi hành vi.
- **AC:**
  - Given một page con throw, When render, Then hiện error shell (không trắng trang), có nút Thử lại.
  - Given đang ở error state, When điều hướng sang route khác, Then boundary reset.
  - Given mobile drawer mở, When đổi route, Then drawer đóng.
- **Gate:** tsc · lint · `check:dom-landmarks` · vitest component test mới · ảnh chụp 2 theme (L-V03).

#### B2 `uiux-states-top12` — M — sau B1

- **Mục tiêu:** 12 route có đủ loading/empty/error.
- **Route ưu tiên:** dashboard, stocks/:symbol, watchlist, alert-center, screener, portfolios,
  portfolios/manage, settings, operations-center, admin/tenants, billing, ai-advisory.
- **Cách:** dùng `ShellSkeleton` + `ShellEmptyState` sẵn có; nếu page đã có thì chỉ bổ sung state thiếu.
- **AC:** Given 12 route, When mạng chậm/lỗi/rỗng, Then có skeleton/empty/error tương ứng;
  test đại diện 1 route; không đổi layout khi có dữ liệu.

#### B3 `uiux-i18n-pages` — M

- **Mục tiêu:** bỏ hardcode ở 8 page + `PaymentReturnPage` (E3/E8).
- **File:** 8 page ở §3 E3 + `src/pages/commercial/PaymentReturnPage.tsx:4-31` (xoá `useI18n` cục bộ,
  dùng `LangContext`).
- **Bước:** thêm key `vi.js` + `en.js` cùng lúc; sửa `defaultValue`; xử lý key reuse
  (`cancel/delete/loadError/saving`) bằng key namespace riêng, không đổi nghĩa toàn cục.
- **AC:** Given quét 9 file, When grep chuỗi tiếng Việt trong JSX, Then 0 hit (trừ comment);
  Given đổi ngôn ngữ EN, Then không còn chữ Việt; `i18n:scan:strict` không thêm warning mới.
- **Gate:** `i18n:scan:strict` · `check:i18n-hardcoded <9 file>` · vitest i18n.

#### B4 `uiux-i18n-gate-scope` — S/M

- **Mục tiêu:** mở `check:i18n-hardcoded` khỏi 5 path (`package.json:33`).
- **Cách:** thêm wrapper `scripts/check-i18n-hardcoded-scope.mjs` (baseline JSON + `--all`),
  gọi từ `scripts/pre-push-gate.mjs`; **không sửa `package.json`** (deny-list).
- **AC:** Given thêm 1 chuỗi Việt trong page mới, When pre-push, Then fail; Given baseline hiện tại, Then pass.
- **Lưu ý:** baseline sẽ lớn (4417 warning lint cùng nguồn) — chỉ khóa **file mới/sửa**, không đòi 0 toàn repo.

#### B5 `uiux-a11y-quickwins` — M

- **Mục tiêu:** các lỗi a11y rẻ, đo được.
- **Việc:** `<th scope="col">` cho 14 bảng admin/tenant + 3 bảng SOC; **hai nhánh `<main>` có điều kiện**
  ở auth (`AuthLoginPage.tsx:129` session-check, `:141` form — landmark count >1 theo nhánh);
  `aria-label` cho icon-button ở 10 page đông tương tác; `aria-label: "Close"` hardcode (`SocSchedulerBoard.tsx:366`).
- **AC:** Given `check:dom-landmarks`, Then 1 `<main>`/trang; Given grep `scope="col"`, Then tăng đúng số bảng;
  axe scan 5 route 0 critical (D2).

#### B6 `uiux-forms-auth` — L — sau B3

- **Mục tiêu:** chuẩn hoá form auth bằng RHF + zod (đã có trong `package.json`: RHF 7.81, zod 4.4).
- **File:** `src/pages/auth/AuthLoginPage.tsx`, `AuthRegisterPage.tsx`, `AuthResetPasswordPage.tsx`,
  form đổi mật khẩu; primitive `FormField` mới.
- **Bước:** viết test validation hiện tại (fail-before) → migrate từng form → giữ nguyên `authPolicy.js`
  làm SSOT rule → so sánh thông báo lỗi vi/en.
- **AC:** Given submit sai, Then cùng tập lỗi như trước; Given submit đúng, Then gọi API như trước;
  4 form dùng `useForm` + zod resolver; không đổi CSS layout.
- **Không làm:** migrate 100 trang; chỉ auth trước, portfolio/settings ở slice sau.

---

### Phase C — Performance

#### C1 `uiux-perf-baseline` — S

- **Mục tiêu:** thay số audit bằng số đo tái tạo được, sửa P0-1.
- **Cách:** chạy `node packages/web/scripts/measure-route-graph.mjs` cho `/dashboard`,
  `/stocks/FPT`, `/portfolios`, `/watchlist`; đọc `dist/.vite/manifest.json`; bảng initial vs route.
- **AC:** Given báo cáo, Then mỗi route có danh sách chunk + KB + gzip; khẳng định widget
  **không** nằm trong initial; ghi rõ route nào tải widget.

#### C2 `uiux-chart-defer` — M — sau C1

- **Mục tiêu:** không tải 2,2 MB widget khi chart chưa vào viewport; tách CSS 189 KB.
- **File:** `src/components/VNStockChartPanel.js:1,52-64`, nơi render panel
  (`StockDetailPage`, `PortfolioOverviewPage`, `PortfolioAnalyticsPage`, `WatchlistDetailPanel`).
- **Bước:** IntersectionObserver → chỉ mount `VNStockChartPanel` khi visible (rootMargin 200px);
  chuyển `import 'vninvestcharts-widget/dist/index.css'` vào nhánh động (hoặc inject sau mount);
  prefetch khi idle nếu route có khả năng mở chart.
- **AC:** Given mở `/dashboard`, When xem Network, Then **không** có `widget-*.js`;
  Given mở `/stocks/FPT` và chart trong viewport, Then widget tải; đo lại bằng C1.
- **Rủi ro:** CSS động gây FOUC — phải chụp ảnh trước/sau, cả 2 theme (L-V03).

#### C3 `uiux-i18n-split` — L — sau D3

- **Mục tiêu:** giảm chunk i18n 513 KB (167 KB gzip) đang preload mọi route.
- **Cách:** tách `vi.js`/`en.js` thành `src/i18n/locales/<ns>.js`; `vi.js` giữ re-export để test cũ
  không vỡ; loader theo route/namespace; common bundle nhỏ.
- **AC:** Given build, Then i18n initial ≤ 150 KB gzip; Given test import `vi.js`, Then vẫn pass;
  Given đổi ngôn ngữ, Then không missing key (test parity vi/en).
- **Rollback:** giữ nguyên file monolith, chỉ đổi điểm import.

#### C4 `uiux-recharts-removal` — L — **chỉ sau D2 = có**

- Migrate 12 file dùng recharts sang widget/echarts, đo lại bundle, xoá dependency (cần sửa
  `package.json` — deny-list, cần Owner duyệt).

---

### Phase D — Responsive & a11y

#### D1 `uiux-responsive` — M

- Gom 22 breakpoint về token (`--bp-*`), thay fixed token width bằng `min()/clamp()`
  (`soc.tokens.css:125-126` — `--vnb-tile-min: 260px`, `--vnb-kpi-min: 150px`), test 320/390/768.
- **AC:** Given 320px, Then không horizontal scroll ở 5 route chính; ảnh chụp 390×851.

#### D2 `uiux-axe` — M

- Playwright + axe trên 5 route (login, register, dashboard, settings, operations-center) ở 390×851,
  chạy trên **VPS staging** (`test:visual` + script mới).
- **AC:** 0 critical, 0 serious; báo cáo HTML/JSON lưu `docs/evidence/uiux-axe-2026xx/`.

---

### Phase E — SSOT & regression

#### E1 `uiux-design-ssot` — M

- Sinh `docs/DESIGN.md` từ `soc.tokens.css` + `theme/tokens.css` + primitives (adminUi, Commercial,
  ShellPageTemplate); bảng token → class → màn hình dùng.

#### E2 `uiux-visual-regression` — M

- Baseline Playwright visual cho 5 route × 2 theme trên staging; cập nhật baseline sau mỗi PR theme
  (L-V03: mở ảnh xem trước khi commit).

---

### Track 2 — BE backlog từ `HANDOFF_20261028_POST299.md` (song song)

| ID | Việc | Effort | AC | Ghi chú |
|---|---|---|---|---|
| **T1** | `user_workspace.tests` 22 fail: ledger backfill thiếu cột `kind`, schema/recorder leaf, capability count, abort | M | 22 → 0; baseline 427+620+1074+508+314+32 không đổi | Fail-before từng file trên VPS; pattern fix 0008-provider |
| **T2** | God-file split pilot: OHLCV block `stock_mgmt` 3893–4270 | M | 1 block/PR, re-export shim, test file liên quan xanh | Theo `AUDIT_CODEBASE_20261028.md` §8 |
| **T3** | Ruff defer: RUF012, FURB157, BLE001/S110, SIM117/RUF059/F841/F811 | M | Từng nhóm nhỏ có test; **không** đụng UP017 | Chạy `manage.py check` sau ruff |
| **T4** | Release staging: build image từ `dev`, deploy, verify | S/M | `deploy-staging.sh --verify` xanh, health 200 | Sau T1 |

---

## 6. Thứ tự & song song

```
Tuần 1   P0.1 ──► D1 (Owner) ──► A1 ──► A2 (nếu b)      T1 ──► T4
Tuần 2   B1 ──► B3 ──► B5                                T2
Tuần 3   B2 ──► B4 ──► C1 ──► C2                         T3
Tuần 4   C3 ──► D1 ──► D2 ──► E1 ──► E2
Sau D2   C4 (recharts) — chỉ khi Owner đồng ý
```

- **2 agent tối đa:** `uiux-fe` (FE) + `be-vet` (BE), file rời nhau.
- Mỗi agent 1 worktree + DB riêng (BE), claim trước dòng code đầu tiên (L-002), tên claim = tên
  branch bỏ `feat/` (L-M02).
- Trước khi chạm `pages/portfolio*`: xác minh claim `pf-manage-rebuild` (đang thấy `in-progress`
  từ 2026-10-13) — nếu stale thì đóng bằng 1 dòng `done`/`released` trước.

---

## 7. Gates & Definition of Done (mỗi slice)

**Local (bắt buộc):**
`node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` · `npm run lint` ·
`npm run check:tokens` · `node scripts/check-light-theme.mjs` · `npm run check:contrast` ·
`npm run i18n:scan:strict` · `node scripts/check-experiment-env.mjs` · `node scripts/normalize-eol.mjs` ·
`node scripts/pre-push-gate.mjs` · `node scripts/check-lessons.mjs` (nếu đụng LESSONS).

**VPS staging (§12.4):** `npm run test:components` · `npm run build` · Playwright visual/axe ·
`deploy-staging.sh --verify` khi slice chạm runtime.

**DoD:** fail-before đo được · tsc 0 · lint 0 error · test 0 fail (hoặc `CHƯA CHẠY` có lý do) ·
i18n vi/en cùng số key · token vào `soc.tokens.css`, class vào `soc.components.css`
(**không** `soc.module.css`) · ảnh chụp 2 theme được mở ra xem · `git diff --numstat` khớp dự kiến ·
1 Entry ledger · 1 PR merge-commit.

---

## 8. Rollback

| Slice | Cách lùi |
|---|---|
| P0.1 | revert commit docs (không ảnh hưởng code) |
| A1 | revert PR; 12 hex trở lại, gate đỏ như cũ |
| A2 | khôi phục 3 dòng option Sáng + fallback |
| B1 | bỏ wrapper trong `FullLayout`, giữ primitive mới |
| B3 | key mới nằm trong vi/en; revert PR là đủ |
| C2 | bỏ IntersectionObserver, mount trực tiếp như cũ |
| C3 | giữ `vi.js` monolith; đổi điểm import về cũ |

---

## 9. Rủi ro & checklist lesson

| Rủi ro | Lesson | Cách chặn |
|---|---|---|
| Tin số audit rồi làm sai AC | L-V02 | Dùng §3 errata; mỗi số có lệnh tái tạo |
| Sửa `package.json` (deny-list) khi nối gate | L-001/L-002 | Nối qua `scripts/pre-push-gate.mjs`; nếu buộc phải sửa → Owner duyệt + `Claim-Deny-List` |
| Gate chạy trước rebase | L-003/L-G01 | `agent-sync.ps1` rồi mới gate |
| Visual regression ghi đè file tracked | L-V03 | `git status` sau mỗi lần chạy; mở ảnh xem |
| Kết luận CSS module từ file nguồn | L-F11 | Đọc CSS đã build trước khi kết luận |
| Đổi màu tăng/giảm | L-F08 | Giữ xanh=tăng/đỏ=giảm; không "sửa" |
| Đếm file theo registry | L-G07 | Đếm theo tên file, ghi lệnh |
| Báo PASS cho thứ chưa chạy | L-G02 | Ghi `CHƯA CHẠY` |
| Mất artefact chưa commit | L-A01 | Phase 0 commit trước |

**Checklist bắt buộc trước khi claim slice đầu tiên:**

- [ ] Đã merge P0.1 (3 audit + ledger + errata).
- [ ] Owner chốt D1 (a/b) — chỉ cần trước A2; A1/B/C không cần.
- [ ] `git status` sạch; claim `uiux-fe` đã append + commit riêng.
- [ ] `check-multi-agent.mjs` PASS.
- [ ] Đã đọc `docs/CLAIMS.md` dòng `pf-manage-rebuild`.
- [ ] Plan này đã được **audit độc lập (B3)** và verdict `PASS/AGREE` ghi thành file.

---

## 10. Câu hỏi mở / việc tiếp theo

1. **Owner:** chốt D1 (light theme a/b) — chặn A2; ảnh hưởng lớn tới khối lượng Phase A.
2. **Owner:** chốt D2 (recharts) — chỉ chặn C4.
3. **Coordinator:** audit độc lập plan này (B3) trước khi claim; verdict lưu
   `docs/evidence/uiux-remediation/AUDIT_PLAN_20261030.md`.
4. **Coordinator:** xác minh/đóng claim `pf-manage-rebuild` trước khi chạm portfolio.
5. **Chưa chạy:** build/test FE, BE suite, E2E/axe, deploy staging — ghi `CHƯA CHẠY` cho tới khi chạy trên VPS.

---

*Kế hoạch này thay thế phần "Recommended Actions/Roadmap" của 2 bản audit trước; bản REAUDIT vẫn là
nguồn findings chi tiết. Mọi số trong §2 có lệnh tái tạo tại chỗ; số nào chưa chạy lại đã ghi rõ.*
