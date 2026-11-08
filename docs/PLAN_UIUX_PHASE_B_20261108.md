# Plan — Thực thi Phase B: states, i18n, a11y, form (UI/UX 2026-10-30)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện Phase B của `docs/PLAN_UIUX_REMEDIATION_20261030.md` (§5) trên branch `feat/uiux-phase-a`, với mỗi slice có fail-before → pass-after, gate local xanh, và verdict audit độc lập ghi thành file.

**Architecture:** Không đổi kiến trúc; tổng quát hoá 1 primitive dùng chung (`PageErrorBoundary`), gắn boundary cấp layout (1 chỗ phủ toàn bộ route authenticated), chuẩn hoá form auth bằng RHF+zod đã có trong `package.json` (RHF 7.81, zod 4.4), bổ states bằng `ShellSkeleton`/`ShellEmptyState` sẵn có, và a11y bằng `scope`/label/aria sẵn có. Mỗi slice = 1 commit riêng, 1 Entry ledger cuối wave.

**Tech Stack:** React 19.2.7 · Vite 5.4.21 · Tailwind v4 · Radix UI · react-hook-form 7.81 · zod 4.4 · Vitest · tsc.

**Spec:** `docs/PLAN_UIUX_REMEDIATION_20261030.md` (§5 slice B1/B2/B3/B4/B5/B6) + errata §3 E1–E10. Tổng hợp findings từ `docs/AUDIT_UIUX_FRONTEND_REAUDIT_20261030.md` §0 (đã errata: 91 page, 8 page hardcode thật, 2 `<img>` đều có `alt`, 155 hex thật/161 thô, widget đã `import()` động từ trước, `PageErrorBoundary` là bản StockDetail).

## Global Constraints

- Runtime: retail-first, phase 1 FREE — `MASTER_TRACKING:90-101` D8.
- AI = technical analysis only, NO BUY/SELL/HOLD, NO order placement (keep `paper` dry_run) — D2.
- Depth chart = "estimated" label everywhere (D6).
- Không `npm/pip install`; không migration; không chạm deny-list (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`).
- Token vào `soc.tokens.css`, class vào `soc.components.css`, KHÔNG `soc.module.css` (barrel 3 dòng).
- i18n: mọi chuỗi UI qua `t(key, { defaultValue })`; thêm key `vi.js` + `en.js` cùng lúc; key reuse xử lý bằng key namespace riêng.
- Màu tăng/giảm chuẩn Bloomberg (xanh=tăng/đỏ=giảm) — giữ nguyên (L-F08).
- Không đọc tiếng Việt qua console shell Windows (mojibake) — đọc file trực tiếp UTF-8.
- Gate không chạy được trên máy này → ghi `CHƯA CHẠY` + lý do. Cấm báo `PASS` cho thứ chưa chạy.
- Test env: VPS staging `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`); BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`, DB per agent `ag_<name>`.
- Không `git checkout --` / `git show > file` (L-A01); `git diff --numstat` sau mỗi lần ghi file phải khớp dự kiến.

## Review Focus

1. **Boundary reset khi đổi route:** trang đang ở error state → điều hướng sang route khác vẫn kẹt error (vì `key={pathname}` là lớp ánh xạ duy nhất; nếu quên `key` thì error không reset). Test: render `FullLayout` + `<Outlet>` thử nghiệm ở `/err` rồi navigate `/dashboard` → boundary reset.
2. **Copy cứng tiếng Việt trong boundary cũ:** `PageErrorBoundary.tsx:45` hardcode "Lỗi không xác định." và `retryLabel` "Thử lại" — sau tổng quát hoá, màn hình EN phải không còn chữ Việt. Test: render với locale `en` (qua `LangContext` giả) → không chứa chuỗi Việt.
3. **Form auth đổi hành vi:** schema RHF+zod không được thay đổi tập lỗi hoặc API payload so với `useState` cũ (`authPolicy.js` vẫn là SSOT rule). Test: submit sai → cùng tập lỗi vi/en; submit đúng → cùng `loginUser` payload.
4. **Focus về `#main-content`:** focus effect sau điều hướng không được cuộn vòng (giữ `tabIndex={-1}`, không `tabIndex=0` — `FullLayout.tsx:98-104`). Test: `document.activeElement` là `#main-content` sau navigate, không leo thang.
5. **Widget chunk không lọt vào initial:** sau C2, `dist/index.html` không preload `widget-*.js` (errata E1). Test: build + đọc `dist/index.html` — không chứa `widget`.

---

## Baseline đo lại 2026-11-08 (HEAD `feat/uiux-phase-a` @ `dd94fc3e1`)

| Gate (lệnh tại `packages/web`) | Kết quả đo thật |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm run lint` | 0 errors, 4506 warnings (khung `react/jsx-no-literals`) |
| `node scripts/check-tokens.mjs` | 0 — PASS (79 allowlisted hex) |
| `node scripts/check-contrast.mjs` | 0 — PASS 7 cặp × 2 mode ≥ 4.5:1 |
| `npm run check:dom-landmarks` | 0 — PASS 4 assertions (single `<main>`, overflow-auto) |
| `npm run test:components` | 173 files / 1189 tests PASS (0 failed) — sau fix 6 test đỏ (en.js paymentReturn → commercial, Breadcrumb bỏ `aria-current`, khôi phục encoding 18 file) |
| `npm run build` | CHƯA CHẠY lại sau commit `95647d8bd` (sẽ chạy ở Task 8) |
| BE test (`manage.py test`) | CHƯA CHẠY — cần VPS Postgres |
| FE route-contract trên VPS | CHƯA CHẠY — cần VPS staging |

Commit đã xong trước plan này (không tính lại):

| Commit | Slice | Trạng thái |
|---|---|---|
| `ff90ffb28` | Phase A foundation: check:tokens green + PaymentReturnPage useI18n + table scope a11y + i18n paymentReturn keys | ĐÃ LÀM (giữ) |
| `3b8c9a33c` | Phase C perf lazy-load VNStockChartPanel/PortfolioChart | ĐÃ LÀM (giữ; ảnh hưởng C2 một phần) |
| `55d6e80d7` | Phase B1.1 (theo tên session): `FormField` primitive + 5 tests | ĐÃ LÀM (giữ; map sang B6 bước 1) |
| `e6cbb744b` | Phase B3 a11y: `StaffRoute` toast guard, mobile drawer close, plan card `<button>`, quota `progressbar` role, `Breadcrumb` Link+aria-label | ĐÃ LÀM (giữ; map sang B5) |
| `2e8713c01`+`cff605cbc`+`c79659eb0`+`32fd49cf2` | Phase B2.4 (theo tên session): `ShellSkeleton` guards ở AIPolicy/Billing/Members/ServiceAccounts/SSO | ĐÃ LÀM (giữ; map sang B2) |
| `95647d8bd` | Fix regression do script ghi file: khôi phục encoding 18 file + `en.js` paymentReturn về `commercial` + Breadcrumb bỏ `aria-current` | ĐÃ LÀM (giữ) |

---

### Task 1 — B1 `uiux-page-error-boundary` (M) — tổng quát hoá primitive + wrapper ở layout

**Files:**
- Modify: `packages/web/src/components/PageErrorBoundary.tsx`
- Modify: `packages/web/src/layouts/full/FullLayout.tsx:89-103`
- Test: `packages/web/src/components/__tests__/page-error-boundary.component.test.tsx` (new)

**Interfaces:**
- Consumes: `PageErrorBoundaryProps { fallbackTitle?, errorMessage?, retryLabel?, onRetry? }` (props hiện hữu, giữ tương thích — `StockDetailPage.tsx:316-323` đang truyền `fallbackTitle`/`errorMessage`/`onRetry`).
- Produces: `PageErrorBoundary` không còn phụ thuộc StockDetail (không log `"[StockDetailPage]"`, không CSS `sdp-*`, copy qua caller/`t()` với `defaultValue`).

- [ ] **Step 1: Write the failing test**

```tsx
// Vitest; render trang con throw -> error shell có nút Thử lại;
// điều hướng (key đổi) -> boundary reset; EN không chứa chuỗi Việt cứng.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/page-error-boundary.component.test.tsx`
Expected: FAIL (primitive hiện tại dùng CSS `sdp-*` + copy cứng, log `"[StockDetailPage]"`)

- [ ] **Step 3: Implement B1.1 tổng quát hoá `PageErrorBoundary.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/page-error-boundary.component.test.tsx`
Expected: PASS

- [ ] **Step 5: Implement B1.2 bọc `<Outlet>` ở `FullLayout.tsx` với `key={location.pathname}` + focus `#main-content`**

- [ ] **Step 6: Run gates**

Run: `npx tsc --noEmit` (Expected 0) · `npm run lint` (Expected 0 errors) · `npm run check:dom-landmarks` (Expected PASS)

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/PageErrorBoundary.tsx packages/web/src/layouts/full/FullLayout.tsx packages/web/src/components/__tests__/page-error-boundary.component.test.tsx
git commit -m "feat(uiux): B1 uiux-page-error-boundary - generalize primitive + wrap Outlet in FullLayout with key=pathname + focus main"
```

---

### Task 2 — B2 `uiux-states-top12` (M) — bổ states thiếu cho 12 route ưu tiên

**Files:**
- Modify (đọc trước, sửa tối thiểu): `src/pages/DashboardPage.tsx`, `src/pages/StockDetailPage.tsx`, `src/pages/AlertCenterPage.tsx`, `src/pages/ScreenerPage.tsx`, `src/pages/PortfoliosPage.tsx`, `src/pages/UserSettingsPage.tsx`, `src/pages/admin/ShellOperationsCenterPage.tsx`, `src/pages/admin/AdminCoreTenantsPage.tsx`, `src/pages/commercial/BillingCenterPage.tsx`, `src/pages/signals/WhaleAdvisoryPage.tsx`
- Test: `src/pages/__tests__/uiux-states-top12.component.test.tsx` (new; đại diện 1 route, không sửa layout khi có dữ liệu)

**Interfaces:**
- Consumes: `ShellSkeleton`, `ShellEmptyState`, `PageErrorBoundary` (Task 1).
- Produces: 12 route có skeleton/empty/error tương ứng khi mạng chậm/lỗi/rỗng.

- [ ] **Step 1: Write the failing test (đại diện 1 route: `/dashboard` skeleton khi `isLoading` và không có data)**
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Bổ states thiếu cho 12 route (mỗi route 1 nhánh loading/empty/error, không đổi layout khi có dữ liệu)**
- [ ] **Step 4: Run — verify pass + `npx tsc --noEmit` = 0**
- [ ] **Step 5: Commit**

```bash
git add <12 files + test>
git commit -m "feat(uiux): B2 uiux-states-top12 - loading/empty/error for 12 priority routes"
```

---

### Task 3 — B3 `uiux-i18n-pages` (M) — bỏ hardcode ở 8 page còn lại

**Files:**
- Modify: 8 page ở errata E3 (`ShellMailConfigPage`, `VipLocalControlPage`, `BrokerHubPage`, `TransactionsPage`, `ShellAiCommandCenterPage`, `ShellSettingsPage`, `ShellSupportPage`, `PortfolioWorkspacePage`). `PaymentReturnPage` đã xong ở `ff90ffb28`.
- Modify: `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js` (thêm key cùng lúc; không đổi nghĩa toàn cục; key reuse xử lý bằng key namespace riêng)
- Test: `src/i18n/__tests__/uiux-i18n-pages.test.ts` (new; grep chuỗi Việt trong JSX 8 file → 0 hit trừ comment)

**Interfaces:**
- Consumes: `t(key, { defaultValue })` + `LangContext`.
- Produces: 8 page không còn chuỗi Việt hardcode trong JSX; đổi locale EN → không còn chữ Việt.

- [ ] **Step 1: Write the failing test (grep 8 file có chuỗi Việt trong JSX — chưa tính comment)**
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Thêm key vi/en + thay chuỗi hardcode bằng `t()`**
- [ ] **Step 4: Run — verify pass + `npm run i18n:scan:strict` (không thêm warning mới) + `node scripts/check-i18n-hardcoded.mjs <8 file>` = 0**
- [ ] **Step 5: Commit**

```bash
git add <8 pages + vi.js + en.js + test>
git commit -m "feat(uiux): B3 uiux-i18n-pages - remove hardcoded strings in 8 pages + shared paymentReturn keys"
```

---

### Task 4 — B4 `uiux-i18n-gate-scope` (S/M) — mở gate hardcoded khỏi 5 path

**Files:**
- Create: `packages/web/scripts/check-i18n-hardcoded-scope.mjs` (baseline JSON + `--all`)
- Modify: `scripts/pre-push-gate.mjs` (gọi wrapper; KHÔNG sửa `package.json` — deny-list)

**Interfaces:**
- Consumes: `node scripts/check-i18n-hardcoded.mjs` hiện hữu (5 path cố định).
- Produces: file mới/sửa thêm chuỗi Việt trong page mới → pre-push fail; baseline hiện tại → pass.

- [ ] **Step 1: Write the failing test (script với `--all` ở repo hiện tại → pass theo baseline; thêm fixture chuỗi Việt → fail)**
- [ ] **Step 2: Run — verify fail (script chưa tồn tại)**
- [ ] **Step 3: Implement wrapper + nối vào `pre-push-gate.mjs`**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/web/scripts/check-i18n-hardcoded-scope.mjs scripts/pre-push-gate.mjs
git commit -m "feat(uiux): B4 uiux-i18n-gate-scope - baseline wrapper for hardcoded i18n gate"
```

---

### Task 5 — B5 `uiux-a11y-quickwins` (M) — phần còn lại

**Files:**
- Modify: `src/components/soc/SocSchedulerBoard.tsx:366` (`aria-label: "Close"` → `t("common.close")`)
- Modify: icon-button ở 10 page đông tương tác (thêm `aria-label` qua `t()`; danh sách định nghĩa bằng grep `aria-label` trước khi sửa)
- Modify (nếu cần): `src/pages/auth/AuthLoginPage.tsx:129,141` — 2 nhánh `<main>` có điều kiện (giữ nguyên cấu trúc 2 nhánh; ghi chú trong code; không gộp nhánh)
- Test: `src/components/__tests__/uiux-a11y-quickwins.component.test.tsx` (new)

**Interfaces:**
- Consumes: `t()` + `LangContext`.
- Produces: `check:dom-landmarks` vẫn PASS (1 `<main>`/trang theo nhánh); `scope="col"` không giảm; axe scan 5 route 0 critical (ghi `CHƯA CHẠY` cho tới khi chạy trên VPS staging §12.3/12.4).

- [ ] **Step 1: Write the failing test (grep `aria-label: "Close"` hardcode; icon-button thiếu label ở 10 page)**
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Fix label hardcode + thêm `aria-label` cho icon-button**
- [ ] **Step 4: Run — verify pass + `npm run check:dom-landmarks` PASS**
- [ ] **Step 5: Commit**

```bash
git add src/components/soc/SocSchedulerBoard.tsx <icon-button files> src/components/__tests__/uiux-a11y-quickwins.component.test.tsx
git commit -m "feat(uiux): B5 uiux-a11y-quickwins - close label + icon-button aria-labels"
```

---

### Task 6 — B6 `uiux-forms-auth` (L) — chuẩn hoá form auth bằng RHF + zod

**Files:**
- Modify: `src/pages/auth/AuthLoginPage.tsx`, `src/pages/auth/AuthRegisterPage.tsx`, `src/pages/auth/AuthResetPasswordPage.tsx`, form đổi mật khẩu (nằm trong `AuthResetPasswordPage.tsx` hoặc `UserSettingsPage.tsx` — đọc code thật trước khi chốt)
- Modify: `src/components/ui/FormField.tsx` (nhận `error` từ RHF)
- Test: `src/pages/auth/__tests__/auth-forms-rhf.component.test.tsx` (new)

**Interfaces:**
- Consumes: `authPolicy.js` (SSOT rule: `PASSWORD_MIN_LENGTH = 10`, `USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/`, `normalizeUsername`, `isValidUsername`) + `authErrors.js` (`parseAuthError`) + `FormField` (Task đã xong ở `55d6e80d7`).
- Produces: 4 form dùng `useForm` + zod resolver; Given submit sai → cùng tập lỗi như trước; Given submit đúng → cùng `loginUser` payload; không đổi CSS layout.

- [ ] **Step 1: Write the failing test (submit sai → tập lỗi còn; submit đúng → payload `loginUser` không đổi; 4 form dùng `useForm`+zod)**
- [ ] **Step 2: Run — verify fail (form hiện tại dùng `useState` thủ công, không có `useForm`/`zodResolver`)**
- [ ] **Step 3: Migrate từng form: `useForm` + zod schema (lấy min/rule từ `authPolicy.js`) + `FormField` (map error) + giữ nguyên `parseAuthError` cho lỗi server**
- [ ] **Step 4: Run — verify pass + `npx tsc --noEmit` = 0 + `npm run test:components` (0 fail)**
- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/AuthLoginPage.tsx src/pages/auth/AuthRegisterPage.tsx src/pages/auth/AuthResetPasswordPage.tsx src/components/ui/FormField.tsx src/pages/auth/__tests__/auth-forms-rhf.component.test.tsx
git commit -m "feat(uiux): B6 uiux-forms-auth - RHF+zod for auth forms (authPolicy SSOT)"
```

*Ghi chú về Task 1–6:* mỗi task ≤ 1 commit; tối đa 3 vòng sửa/task (luật 3 lần thử — quá thì ghi `blocker` trong evidence và dừng slice đó, không thử sai làm nát code).

---

### Task 7 — C1+C2 `uiux-perf-baseline` + `uiux-chart-defer` (S/M, sau Phase B)

**Files:**
- Create: `docs/evidence/uiux-perf-20261108/route-graph.md` (mỗi route: danh sách chunk + KB + gzip)
- Modify: `src/components/VNStockChartPanel.js`, các nơi render panel (`StockDetailPage`, `PortfolioOverviewPage`, `PortfolioAnalyticsPage`, `WatchlistDetailPanel`)

- [ ] **Step 1: Đo C1:** chạy `node packages/web/scripts/measure-route-graph.mjs` cho `/dashboard`, `/stocks/FPT`, `/portfolios`, `/watchlist`; đọc `dist/.vite/manifest.json`; xác nhận widget KHÔNG nằm trong initial (errata E1).
- [ ] **Step 2: Implement C2:** IntersectionObserver defer mount `VNStockChartPanel` (rootMargin 200px); chuyển `import 'vninvestcharts-widget/dist/index.css'` vào nhánh động.
- [ ] **Step 3: Đo lại C1 (so trước/sau); ảnh chụp 2 theme (L-V03)**
- [ ] **Step 4: Commit**

```bash
git add src/components/VNStockChartPanel.js <4 render sites> docs/evidence/uiux-perf-20261108/
git commit -m "feat(uiux): C1+C2 uiux-perf-baseline/chart-defer - IntersectionObserver defer + CSS split"
```

---

### Task 8 — C3 `uiux-i18n-split` (L, sau D3) → D `uiux-responsive`+`uiux-axe` (M) → E `uiux-design-ssot`+`uiux-visual-regression` (M)

**Files:**
- C3: `src/i18n/locales/<ns>.js` (new), `src/i18n/vi.js` (giữ re-export tương thích), loader theo route/namespace
- D1: `soc.tokens.css` (`--bp-*`), fixed width → `min()/clamp()` (`soc.tokens.css:125-126`)
- D2: Playwright + axe trên 5 route ở 390×851 (VPS staging) — báo cáo `docs/evidence/uiux-axe-2026xx/`
- E1: `docs/DESIGN.md` mới; E2: baseline visual 5 route × 2 theme (staging)

- [ ] **Step 1: C3** — Given build, Then i18n initial ≤ 150 KB gzip; Given test import `vi.js`, Then vẫn pass; Given đổi ngôn ngữ, Then không missing key (test parity vi/en).
- [ ] **Step 2: D1** — Given 320px, Then không horizontal scroll ở 5 route chính; ảnh chụp 390×851.
- [ ] **Step 3: D2** — Given axe, Then 0 critical, 0 serious (ghi `CHƯA CHẠY` tới khi chạy trên VPS staging).
- [ ] **Step 4: E1/E2** — `docs/DESIGN.md` tồn tại; baseline visual pass trên staging.
- [ ] **Step 5: Commits tách nhỏ (mỗi bước 1 commit)**

---

### Task 9 — Bàn giao (B9) — claim `done` + ledger + PR

- [ ] **Step 1: `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate), rồi commit claim `uiux-phase-a` → `done`**
- [ ] **Step 2: Append 1 `## Entry N` (số tiếp 420) vào `docs/CODE_CHANGE_AUDIT_LEDGER.md` + 1 dòng index ở bảng cuối file (kế tiếp, không sửa/xoá Entry cũ)**
- [ ] **Step 3: Push + `pwsh -File scripts/agent-pr.ps1` → PR merge-commit (không squash)**
- [ ] **Step 4: Sau merge: `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/uiux-phase-a -Execute`**

---

## Gates & Definition of Done (mỗi task)

**Local (bắt buộc trước khi commit):**
`node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` · `npm run lint` · `npm run check:tokens` · `npm run check:contrast` · `npm run check:dom-landmarks` · `node scripts/pre-push-gate.mjs` · `node scripts/check-lessons.mjs` (nếu đụng LESSONS).

**VPS staging (§12.4; ghi CHƯA CHẠY tới khi chạy):** `npm run test:components` · `npm run build` · Playwright visual/axe · `deploy-staging.sh --verify`.

**DoD:** fail-before đo được · tsc 0 · lint 0 error · test 0 fail (hoặc `CHƯA CHẠY` có lý do) · i18n vi/en cùng số key · token vào `soc.tokens.css`, class vào `soc.components.css` (KHÔNG `soc.module.css`) · ảnh chụp 2 theme được mở ra xem (khi chạm theme/visual) · `git diff --numstat` khớp dự kiến · 1 Entry ledger · 1 PR merge-commit.

---
