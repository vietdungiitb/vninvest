# UI/UX W2 — Freshness disclosure + DESIGN.md Implementation Plan (rev2)

> Thực thi theo skill repo `workflow-dev-loop` + `writing-plans`; từng step checkbox `- [ ]`. Không dùng `superpowers:*` (O-20).

**Goal:** Sau SSOT/chrome/a11y, bổ sung 1 năng lực fintech (data-freshness disclosure) và sinh `DESIGN.md` từ code đã hội tụ. **Cmd+K và density đã chuyển sang S5/W3** (Owner D7) — không nằm trong slice này.

**Architecture:** Reuse-first: đọc `locales/{vi,en}/freshness.js` có sẵn trước khi tạo key; `FreshnessBadge` nằm trong `components/feedback` (do S2 tạo); 3 nơi tiêu biểu có badge "Ước tính" (`StockOrderBookWidget.jsx:153-161`) **không làm đôi**. `DESIGN.md` sinh qua skill `impeccable` procedure `document` (`reference/document.md`) — **không phải CLI binary** (O-21 đính chính).

**Tech Stack:** React 19, `locales/*` module, Playwright staging, skill `impeccable`.

**Spec:** `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-16/O-17/O-18/O-21) · handoff rev2 D4/D7. **Base** `dev@2b10b3016`.

## Global Constraints

- **Phụ thuộc S1 + S2 + S3** (O-18): S4 dùng `components/feedback` từ S2 và **không** sửa `CoreDashboardPositionDeck.tsx` / `PortfolioHoldingsPage.tsx` (đây là file của S3). Chỉ mounts badge ở component wrapper riêng hoặc qua prop do S3 expose.
- Không palette mới, không dependency mới, không đổi màu tăng/giảm (L-F08).
- Key mới trong `locales/{vi,en}/uiuxExp.js`; coordinator đăng ký barrel.
- Không gọi `impeccable document` như lệnh shell; dùng skill procedure.
- Branch `feat/uiux-exp-w2` (agent `uiux-exp-w2`).

**Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-007, L-008, L-M02, L-T01, L-F08, L-G02, L-V02, L-V03]
**Checklist đã tick:** [x] đọc `freshness.js` trước khi viết · [x] không đụng file ownership S3 · [x] DESIGN.md sau W0 · [x] skill procedure không CLI.

## Baseline

| Gate | Trước (sau S3) | Mục tiêu |
|---|---|---|
| `check-token-conflict` | 0 | 0 |
| `check-uiux-budget` | PASS | PASS |
| `test:visual` | baseline S2 | snapshot mới có chủ đích |

---

### Task 1: Reuse inventory + test đỏ

**Files:** Create `docs/evidence/uiux-ssot/w2/inventory.md`, `packages/web/src/components/__tests__/uiux-exp-w2.component.test.tsx`

- [ ] **Step 1:** Grep `freshness.js` (VI/EN) + `StockOrderBookWidget.jsx:153-161`; ghi key đã có. Nếu đã đủ `stale|delayed|fresh` → **bỏ key mới** (ponytail).
- [ ] **Step 2:** Test đỏ: `FreshnessBadge` render 3 trạng thái `fresh|delayed|stale|empty`; `stale` **không** dùng class của `EmptyState`. Chạy → FAIL.
- [ ] **Step 3: Commit test đỏ.**

---

### Task 2: FreshnessBadge

**Files:** Create `packages/web/src/components/feedback/FreshnessBadge.tsx`; Modify `locales/{vi,en}/uiuxExp.js`; Modify tối đa 3 nơi theo ownership (ưu tiên component wrapper riêng, **không** đụng 2 file của S3).

**Interfaces:** `FreshnessState = "fresh"|"delayed"|"stale"|"empty"`; Produces 1 component dùng chung.

- [ ] **Step 1:** Implement component tối thiểu, label từ `uiuxExp.*` (VI đủ dấu).
- [ ] **Step 2:** Test xanh; `npm run i18n:scan:strict` → 0 thiếu.
- [ ] **Step 3: Commit.**

---

### Task 3: DESIGN.md qua skill procedure (sau W0 merge)

**Files:** Create `packages/web/DESIGN.md`, `docs/evidence/uiux-ssot/w2/design-doc-note.md`.

- [ ] **Step 1:** Dùng skill `impeccable`, procedure `document` (đọc `reference/document.md`) — **không** gõ lệnh CLI.
- [ ] **Step 2:** Kiểm tra mọi hex trong `DESIGN.md` nằm trong allowlist `check-tokens.mjs:10-29`; hex mới → xoá, không nới allowlist.
- [ ] **Step 3:** Ghi chú: DESIGN.md mô tả code hiện tại; SSOT vẫn `theme/tokens.css` + `soc.tokens.css`.
- [ ] **Step 4: Commit.**

---

### Task 4: B7/B8/B9

Deploy staging; `test:visual` snapshot mới; `check-token-conflict`, `check-uiux-budget`, `check:tokens`, `check:contrast`, `check:light-theme`, `check-a11y-runtime` (với dev light flag từ W0); `tsc`, build. Auditor `REAUDIT.md` → 0 blocker/0 major. Claim done → Entry ledger → PR → cleanup.

## Rollback

Mỗi Task = 1 commit. `DESIGN.md` revert riêng. Không đụng maintenance của S3.
