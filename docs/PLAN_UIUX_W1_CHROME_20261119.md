# UI/UX W1-Chrome — Một template cho mọi route Implementation Plan (rev4 — AGREE vòng 4)

> Thực thi theo skill repo `workflow-dev-loop` + `writing-plans`; từng step checkbox `- [ ]`. Không dùng `superpowers:*` (O-20).

**Goal:** 4 route còn RED vào `ShellPageChrome`; detector nhận `renderElement("h1")`; `ShellPageChrome` có prop `actions`; admin card là **glass thật** (alpha + backdrop-filter); loading/empty/error gom về 1 kit.

**Architecture:** `ShellPageChrome` (`ShellPageTemplate.js:90-152`) là chrome duy nhất, render `<h1>` tại `:122`. Thêm prop `actions` + cập nhật `ShellPageTemplate.d.ts:40-57`. Token glass mới trong owner (`theme/tokens.css`) có alpha <1 + `backdrop-filter`, dùng cho `AdminPanel`/`AdminMetricCard`. `components/feedback/*` wrap `components/ShellEmptyState.js` hiện có.

**Tech Stack:** React 19, CSS module, Vitest (detector có control), Playwright computed style.

**Spec:** `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-06/O-07/O-08) · handoff rev2 D2/D6. **Base** `dev@2b10b3016`.

## Global Constraints

- Scope = **4 route RED** (O-06): `AICommandCenterPage.tsx`, `DashboardPage.tsx`, `PortfolioOverviewPage.tsx`, `AdminUsersPage.tsx`. `ShellOperationsCenterPage.tsx` **đã GREEN** → chỉ làm regression test, không đưa vào "red list".
- Detector: strip comment + nhận `renderElement("h1")` + `createElement("h1")` + `<h1`; có positive control (`<h1>` thật → FAIL) và negative control (comment → PASS).
- `actions` phải là prop thật, **không** nhét vào `description` (O-07).
- Glass = alpha < 1 **và** `backdrop-filter` (hoặc `color-mix`), đo bằng computed style; source-scan `var(--bg-panel` là **không đủ** (O-08).
- Không sửa `vi.js`/`en.js`; tạo `locales/{vi,en}/uiuxChrome.js`.
- Không đụng file của S3/S4 theo ownership trong handoff §2.

**Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-008, L-M02, L-A01, L-T01, L-F03, L-F06, L-F11, L-F12, L-G02, L-V04, L-V05]
**Checklist đã tick:** [x] đo 4/5 RED thực tế · [x] đọc `ShellPageTemplate.js:90-101` · [x] đọc `DashboardPage.tsx:120 renderElement("h1")` · [x] glass test bằng computed style · [x] baseline heading = 24.

## Baseline

| Gate | Trước | Mục tiêu |
|---|---|---|
| `check-heading-contract.mjs` | 24 vi phạm; detector bỏ sót `renderElement` | **không có vi phạm mới**; 4 route sửa; detector mới có control |
| `check-dom-landmarks.mjs` (cwd `packages/web`) | 0 | 0 |
| `check:contrast` / `check-theme-contrast` | 0 / 32+12 (không mới) | không mới |

---

### Task 1: Detector có control (đỏ đúng 4/4)

**Files:** Create `packages/web/src/components/__tests__/uiux-chrome-w1.component.test.ts`

**Interfaces:** Produces `detectH1(src)` dùng chung cho test và gate `check-heading-contract.mjs` (cập nhật trong Task 2 của chính slice này, không chờ approve riêng). Gate là **baseline-locked**: nếu detector mới sinh vi phạm ngoài 4 route scope thì S2 phải sửa các file đó hoặc **dừng báo blocker** — tuyệt đối không nâng baseline (C4 minor).

- [ ] **Step 1: Viết detector**

```ts
const detectH1 = (src: string) => {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return /<h1[\s>]/.test(s) || /createElement\(\s*["']h1["']/.test(s)
      || /renderElement\(\s*["']h1["']/.test(s);
};
expect(detectH1('<h1>x</h1>')).toBe(true);                 // dương
expect(detectH1('renderElement("h1", …)')).toBe(true);      // dương (Dashboard:120)
expect(detectH1('// <h1> comment\nconst x=1')).toBe(false);  // âm
```

- [ ] **Step 2:** Assert status từng route: `ShellOperationsCenterPage` = **GREEN** (regression), 4_route = **RED**. Chạy → đúng 4 RED. Ghi `red.md`. Nếu 5/5 hoặc 3/5 → dừng, đo lại.
- [ ] **Step 3: Commit test đỏ.**

---

### Task 2: Prop `actions` + 4 route compose

**Files:** Modify `ShellPageTemplate.js:90-101` (+ render), `ShellPageTemplate.d.ts:40-57`, 4 route trong scope.

**Interfaces:** `ShellPageChrome({ eyebrow, title, description, actions, badge, metrics, notice, error, children, className, id })`. Consumes: props cũ. Produces: `actions` render trong `titleRow` (`ShellPageTemplate.js` hiện có titleRow — giữ cấu trúc).

- [ ] **Step 1: Test prop đỏ** — render `ShellPageChrome` với `actions={<button>…</button>}` → assert button tồn tại. Chạy → FAIL (prop bị bỏ qua).
- [ ] **Step 2:** Thêm prop vào JS + `.d.ts` + render; không đổi các prop khác.
- [ ] **Step 3:** Compose 4 route; mỗi route 0 `detectH1`; actions/breadcrumb/AiHubNav đặt đúng prop `actions`.
- [ ] **Step 4:** Cập nhật detector vào `check-heading-contract.mjs` (dùng chung hàm Task 1) rồi chạy gate → **0 vi phạm mới**; nếu detector bắt thêm file ngoài 4 route scope → sửa file đó trong slice hoặc dừng báo blocker, không nâng baseline. Detector Task 1 → xanh 4/4 + 1 regression.
- [ ] **Step 5: Commit** — `fix(uiux-chrome-w1): actions prop + 4 routes on shared chrome`.

---

### Task 3: Glass thật cho admin + gộp feedback

**Files:** Modify `theme/tokens.css` (thêm `--glass-surface` có alpha + `--glass-blur`), `pages/admin/adminUi.tsx:41-101`, `ShellPageTemplate.js:167-195`, `components/feedback/{EmptyState,LoadingState,ErrorState}.tsx` (mới, wrap `ShellEmptyState`); update 19 import.

**Interfaces:** Consumes token glass mới. Produces: 1 export `components/feedback/EmptyState`.

- [ ] **Step 1: Test đỏ bằng computed style trên staging** — assert `getComputedStyle(panel).backgroundColor` có alpha < 1 **hoặc** `backdropFilter !== 'none'`. Chạy trước sửa → FAIL.
- [ ] **Step 2:** Đổi `AdminPanel` (`:48`), `AdminMetricCard` (`:71`), `AdminEmptyState` (`:97-101`) sang class/token glass; giữ contrast ≥4.5:1 cả 2 mode.
- [ ] **Step 3:** Gộp 2 `ShellEmptyState` về 1 export, re-export cho 19 file cũ.
- [ ] **Step 4:** Chạy test computed xanh; `check:contrast` + `check-theme-contrast` → 0 mới.
- [ ] **Step 5: Commit** — `refactor(uiux-chrome-w1): real glass admin cards + single feedback kit`.

---

### Task 4: B7/B8/B9

- [ ] Deploy staging + chụp 4 route × 2 theme; `test:visual --update-snapshots` có lý do.
- [ ] `pwsh -File scripts/agent-sync.ps1` → chạy lại dom-landmarks, heading-contract, contrast, `tsc`, build, `test:components`.
- [ ] Auditor `docs/evidence/uiux-ssot/w1-chrome/REAUDIT.md` → 0 blocker/0 major; claim done + PR.

## Rollback

Revert từng commit Task 2–3. Nếu glass làm contrast đỏ → revert Task 3, báo Owner (D2 cần review). Không `git checkout --` (L-A01).
