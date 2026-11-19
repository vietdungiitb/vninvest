# AUDIT ROUND 3 — UI/UX SSOT program (rev3)

> **Verdict: NEED_REVISION.** 0 blocker, **1 major (O-25)**. Không cấp worktree S1 cho đến khi xử lý.
> **Tiến bộ**: rev3 xử lý đúng O-24 (text-on-accent dark → 7.35, tự tính WCAG khớp). Nhưng O-24 fix lại kéo theo O-25 (text-muted light inverse).

- **Ngày**: 2026-11-19
- **Auditor**: phiên độc lập, read-only; không claim, không sửa plan.
- **Phạm vi**: rev3 (5 file plan + handoff + Entry 539) + simulation gate trên bản sao token.
- **Base**: `dev@2b10b3016`.

---

## A. Disposition O-24 + 5 minor notes

| Item | Trạng thái | Evidence rev3 |
|---|---|---|
| O-24 (accent-cyan light trade-off) | **FIXED** | `PLAN_W0:7,20,31,52,80-81,100,102` giữ `#06b6d4` base + `--text-on-accent: #0f172a` light (7.35). Tự tính WCAG khớp audit: 8.31 / 2.43 / 7.35 / 3.77 / 3.75 / 6.96. ✓ |
| C1 (direct value `--text-muted`) | **FIXED** | `PLAN_W0:21,51,101` "giá trị trực tiếp, không qua var reference" ✓ |
| C2 (net delta muted = 0) | **FIXED** | `PLAN_W0:21` "giữ `#94a3b8`, net delta = 0" ✓ |
| C3 (dev flag precedence) | **FIXED** | `PLAN_W0:124` thứ tự 3 nhánh early-return ✓ |
| C4 (detector gate update) | **FIXED** | `PLAN_W1_CHROME:29,68` "detector cập nhật trong Task 2, baseline-locked" ✓ |
| C5 (re-run simulation) | **FIXED** | `PLAN_W0:102` "ghi contrast-green.md kèm 10 tỉ lệ tự tính" ✓ |

---

## B. NEW FINDING — O-25 (MAJOR)

**[O-25 | ERROR | MAJOR] `--text-muted: #475569` trong light block làm 3 baseline violation TỆ HƠN (inverse problem thứ 2)**

- **Bằng chứng** (mô phỏng rev3 trên bản sao 4 file token, gate `--no-runtime`):
  - text-muted base = `#94a3b8` (direct, O-24/C1 fix).
  - light block có `--text-muted: #475569` + `--text-on-accent: #0f172a` (theo rev3).
  - Gate báo: **"3 cap trong baseline bi XAU DI"**: `text-muted-on-bg-panel@shell/light` 3.75→2.36, `text-muted-on-bg-primary@shell/light` 4.24→2.66, `text-muted-on-bg-secondary@shell/light` 3.75→2.36. Exit 1.
  - Nguyên nhân: gate đo canvas tối (`--color-bg-primary = #020617`, không áp `light-theme.css`). `#475569` (darker, accessible trên canvas sáng 7.58) trên canvas tối = 2.36 (tệ hơn #64748b's 3.75).
- **Đây là cùng inverse problem như O-24**, nhưng cho text-muted: gate đo canvas tối, app dùng canvas sáng. Không có giá trị text-muted đơn lẻ nào pass cả hai:
  - `#475569`: app light ✅ (7.58) / gate ❌ (2.36)
  - `#64748b`: app light ✅ (4.76) / gate ✅ (3.75, baseline)
  - `#94a3b8`: app light ❌ (2.45) / gate ✅ (6.96)
- **Tác động**: rev3 `PLAN_W0:96` và `HANDOFF:74` vẫn yêu cầu "exit 0, 0 vi phạm mới". Với `--text-muted: #475569` trong light block, gate **không** đạt 0. Plan tự mâu thuẫn.
- **Fix đề xuất** (chọn 1):
  - **(a) Khuyến nghị**: **KHÔNG** thêm `--text-muted` vào light block. Giữ base `#94a3b8` (direct). Gate clean (0 mới, text-muted @shell/light = 6.96, passing). App light theme text-muted = `#94a3b8` (2.45 trên white, failing WCAG — nhưng light theme dev-only). Document đây là known limitation; sửa thật khi fix gate (include light-theme.css) hoặc fix R1/R2 defect.
  - **(b)** Thêm `--text-muted: #475569` vào light block **và** cập nhật baseline cho 3 pair (Owner sign-off, vi phạm R2 nhưng có lý do). Gate exit 0 sau update. App light theme accessible.
  - **(c)** Sửa gate để include `light-theme.css` trong cascade variant → gate đo canvas sáng → `#475569` pass. Thay đổi semantics gate (đang bắt R1/R2 defect) — cần Owner approve.
- **Ưu tiên**: (a) cho W0 (gate clean, 1 dòng xóa khỏi plan), (c) defer sang program light-theme, (b) fallback nếu Owner muốn app accessible ngay.

---

## C. Minor notes (không chặn, đã xử lý phần lớn)

1. **`--text-muted` direct value** — rev3 đã ghi rõ "giá trị trực tiếp" ✓. Minor: agent cần biết `index.css:67` define `--color-text-muted` nhưng direct value bypass nó. OK.
2. **Net delta muted = 0** — rev3 đã ghi "giữ `#94a3b8`, net delta = 0" ✓. Minor: D1 bảng (`PLAN_W0:21`) vẫn ghi "#94a3b8→#64748b" rồi "nâng lại" — nên ghi "giữ `#94a3b8` (không hội tụ)" cho rõ.
3. **Dev flag precedence** — rev3 đã ghi thứ tự 3 nhánh ✓.
4. **W1-chrome detector gate** — rev3 đã ghi "detector cập nhật trong Task 2, baseline-locked" ✓.
5. **Re-run simulation** — rev3 ghi "ghi contrast-green.md". Nhưng với O-25, simulation sẽ không exit 0 nếu giữ `#475569`. Sau fix (a), re-run sẽ exit 0.

---

## D. Verdict từng slice (round 3)

| Slice | Verdict | Blocker/Major |
|---|---|---|
| W0 `feat/uiux-ssot-w0` | **NEED_REVISION** | 1 major (O-25) + minor C2 |
| W1 chrome `feat/uiux-chrome-w1` | **AGREE** | 0/0 |
| W1 a11y `feat/uiux-a11y-w1` | **AGREE** | 0/0 |
| W2 `feat/uiux-exp-w2` | **AGREE** | 0/0 |
| W3 `feat/uiux-cmd-w3` | **AGREE** | 0/0 |

---

## E. Quality gates

Tất cả số liệu round 1/2 vẫn còn hiệu lực. **CHƯA CHẠY** thêm: staging, browser, E2E, vitest/build, ảnh. Simulation rev3 (với `#475569` light) → exit 1, 3 baseline got worse (O-25). Simulation với fix (a) (#94a3b8, no light override) → cần re-run để xác nhận 0 mới (dự đoán: exit 0).

---

## F. Câu hỏi cần Owner/coordinator chốt (chỉ còn 1)

1. **O-25**: chọn fix (a) (không thêm text-muted light override, giữ #94a3b8, gate clean, app light suboptimal) hay (b) (thêm #475569 + update baseline với sign-off) hay (c) (sửa gate include light-theme.css)? Nếu (a), W0 Task 2 xóa 1 dòng instruction + cập nhật D1 table; nếu (b), Owner phải ký baseline update; nếu (c), defer sang program light-theme.

---

## G. Đánh giá tổng thể

- **rev3 xử lý đúng O-24** — tự tính WCAG khớp audit (8.31 / 2.43 / 7.35 / 3.77 / 3.75 / 6.96). Text-on-accent dark là fix chính xác.
- **Nhưng rev3 chưa xử lý được O-25** — thêm `--text-muted: #475569` vào light block làm 3 baseline violation tệ hơn (inverse problem thứ 2). Plan vẫn ghi "exit 0" nhưng không đạt được.
- **Nguyên nhân gốc**: gate đo canvas tối (R1/R2 defect). Mọi light-theme text color accessible trên canvas sáng sẽ fail trên canvas tối, và ngược lại. Đây là **vấn đề kiến trúc** của gate, không phải bug của W0.
- **Ưu tiên**: (1) Owner chốt O-25 → planner sửa W0 (fix (a): bỏ `--text-muted: #475569` khỏi light block instruction, giữ #94a3b8) + cập nhật D1 table ("giữ #94a3b8, không hội tụ"); (2) audit vòng 4 (chỉ kiểm O-25) → PASS/AGREE; (3) S0 merge docs → cấp worktree S1.
- **Không cấp worktree, không merge docs** cho đến khi audit vòng 4 trả PASS/AGREE.

---

**Kết luận**: **NEED_REVISION** — 0 blocker, 1 major (O-25). Sửa O-25 fix (a), audit vòng 4.
