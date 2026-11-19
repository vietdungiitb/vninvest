# UI/UX W3 — Command Registry + Density Implementation Plan (mới, rev2)

> Thực thi theo skill repo `workflow-dev-loop` + `writing-plans`; từng step checkbox `- [ ]`. Không dùng `superpowers:*`.

**Goal:** Cmd+K dùng chung toàn app **không mount trùng** trên `/tenant-admin/*`; density toggle có nguồn state thật. Tách khỏi W2 theo Owner D7 (O-16/O-17).

**Architecture:** `CommandRegistry` định nghĩa entry + capability (CASL), thay cho 15 entry hardcode trong `TenantAdminCommandPalette.tsx:9-25`. Mount **duy nhất** một `AppCommandPalette` trong `FullLayout.tsx` (vì route tenant-admin là con của `/` — `main.tsx:157,229` — và đã nằm trong FullLayout); **xoá** mount tại `TenantAdminLayout.tsx:90`. `SettingsProvider` theo pattern `LangContext` cung cấp `density` + persistence; không dùng `localStorage` rời rạc.

**Tech Stack:** React 19, `@casl/react` (`package.json:50`), Radix Dialog wrapper, Vitest component test.

**Spec:** `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-16/O-17) · handoff rev2 D7. **Base** `dev@2b10b3016`.

## Global Constraints

- S5 phụ thuộc S2 (dùng `components/feedback`); **không** chạy song song S4.
- Giữ nguyên hành vi tenant-admin (filter theo `ability`, Escape) — regression test bắt buộc.
- Không thêm dependency; không sửa `vi.js`/`en.js` (module `locales/{vi,en}/uiuxCmd.js`).
- Branch `feat/uiux-cmd-w3` (agent `uiux-cmd-w3`).

**Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-008, L-M02, L-T01, L-F06, L-G02, L-V04]
**Checklist đã tick:** [x] xác nhận mount trùng (`FullLayout` chứa route con) · [x] đọc `TenantAdminCommandPalette:9-42` · [x] xác nhận không có `*SettingsContext*` · [x] regression tenant-admin.

## Review Focus

1. **2 palette / 2 listener Cmd+K** — test đếm `role="dialog"` trên `/tenant-admin/*` phải = 1.
2. **CASL** — entry cũ dùng `subject`; registry phải giữ filter quyền, không lộ action trái phép.
3. **SettingsProvider** — detect theme guard của W0 (`main.tsx`) không bị ghi đè.
4. **Density overflow** — 375px/1440px, bảng 9 cột không bị bóp (L-F12).
5. **i18n 2 locale** — key mới đủ VI/EN.

---

### Task 1: Test đỏ mount trùng + registry

**Files:** Create `packages/web/src/components/__tests__/uiux-cmd-w3.component.test.tsx`

- [ ] **Step 1:** Test render route `/tenant-admin/home` trong `FullLayout`: assert số `role="dialog"` sau Cmd+K = **1**; assert registry có entry ngoài tenant-admin (vd `/portfolios`, `/settings/ai`). Chạy → FAIL (hiện 2 hoặc registry không tồn tại).
- [ ] **Step 2:** Positive control: tenant-admin palette hiện tại vẫn mở/Escape đóng → PASS ngay (regression baseline).
- [ ] **Step 3: Commit test đỏ.**

---

### Task 2: CommandRegistry + mount một lần

**Files:** Create `packages/web/src/context/CommandRegistry.tsx`; Modify `TenantAdminCommandPalette.tsx:9-42` (dùng registry, giữ ability filter); Create `packages/web/src/components/AppCommandPalette.tsx`; Modify `FullLayout.tsx` (mount 1), `TenantAdminLayout.tsx:90` (xoá mount).

- [ ] **Step 1:** Implement registry `{id, labelKey, path, subject?}` + provider; palette đọc registry + `ability.can`.
- [ ] **Step 2:** Mount `AppCommandPalette` chỉ ở `FullLayout`; xoá mount tenant-admin.
- [ ] **Step 3:** Test Task 1 → xanh; regression tenant-admin xanh.
- [ ] **Step 4: Commit.**

---

### Task 3: SettingsProvider + density toggle

**Files:** Create `packages/web/src/context/SettingsProvider.tsx`; Modify `UserSettingsPage.tsx` (dùng context thay vì state rời); Modify `FullLayout.tsx` (`data-density` trên root); Modify `locales/{vi,en}/uiuxCmd.js`.

- [ ] **Step 1:** Test đỏ: đổi density qua `UserSettingsPage` → `document.documentElement.dataset.density` đổi; reload vẫn giữ; production không đổi theme W0.
- [ ] **Step 2:** Implement provider (pattern `LangContext`) + persistence; CSS dùng `var(--sp-*)` có sẵn, không token mới.
- [ ] **Step 3:** Playwright 375/1440: Cmd+K + density đổi, không overflow.
- [ ] **Step 4: Commit.**

---

### Task 4: B7/B8/B9

`agent-sync.ps1` → gate sau rebase; auditor `REAUDIT.md` 0 blocker/0 major; claim done → Entry ledger → PR → cleanup.

## Rollback

Revert từng commit Task 2–3. Nếu mount tenant-admin regression hỏng → revert Task 2, giữ registry làm source cho slice sau.
