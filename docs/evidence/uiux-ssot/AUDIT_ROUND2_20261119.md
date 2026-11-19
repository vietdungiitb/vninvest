# AUDIT ROUND 2 — UI/UX SSOT program (rev2)

> **Verdict: NEED_REVISION.** 0 blocker, **1 major (O-24)**. Không cấp worktree S1 cho đến khi O-24 được xử lý.
> **Tiến bộ so với v1**: cả 23 objection round 1 đều được rev2 xử lý bằng thay đổi cụ thể; chỉ còn 1 major mới do tương tác giữa D1 và `check-theme-contrast`.

- **Ngày**: 2026-11-19
- **Auditor**: phiên độc lập, read-only; không claim, không sửa plan.
- **Phạm vi**: rev2 của `HANDOFF` + 5 `PLAN_UIUX_*_20261119.md` (W0, W1-chrome, W1-a11y, W2, W3) + Entry 537.
- **Base**: `dev@2b10b3016`.
- **Nguyên tắc**: mọi kết luận kèm `file:line` hoặc lệnh tái tạo; kết quả không chạy được ghi **CHƯA CHẠY**.

---

## A. Disposition round 1 (23/23 đã xử lý)

| Objection | Trạng thái round 2 | Evidence trong rev2 |
|---|---|---|
| O-01 regex xanh giả | **FIXED** | `PLAN_W0:48,68` regex `(?<![-\w])` + `stripComments` + control âm/dương `:71-73` |
| O-02 contrast đỏ | **PARTIAL** | `PLAN_W0:19,49,95` nâng `--text-muted` dark `#94a3b8` + sửa alias `--bg-panel-soft`; **nhưng accent-cyan light còn trade-off → O-24** |
| O-03 D1 delta thiếu | **FIXED** | `HANDOFF:37` bảng 8 nhóm; `PLAN_W0:17-26` bảng before/after |
| O-04 light tắt cứng | **FIXED** | `PLAN_W0:113-121` dev-only flag + `main.tsx:261-270` + `UserSettingsPage:18-24` |
| O-05 20 vs 13 | **FIXED** | `PLAN_W0:7,50,65-77` tách `BASE_TOKENS` (13) / `LIGHT_KEYS` (7), dời sang owner |
| O-06 4/5 RED + detector | **FIXED** | `PLAN_W1_CHROME:15-16,43-52` 4 RED + 1 regression; detector strip comment + `renderElement` |
| O-07 prop `actions` | **FIXED** | `PLAN_W1_CHROME:59-67` thêm prop + `.d.ts:40-57` + test render |
| O-08 glass đục | **FIXED** | `PLAN_W1_CHROME:18,73-83` token glass `--glass-surface`/`--glass-blur` + computed style test |
| O-09 modal path sai | **FIXED** | `PLAN_W1_A11Y:15-21` full path + symbol; không dùng line number |
| O-10 hook không trap | **FIXED** | `PLAN_W1_A11Y:7,71` dùng `ui/dialog.tsx`/`drawer.tsx`, không hook `contentProps` |
| O-11 modal xanh sẵn 2/5 | **FIXED** | `PLAN_W1_A11Y:22,48-49` behavior test Tab/Escape/focus-return; positive/negative control |
| O-12 focus 6 file sót | **FIXED** | `PLAN_W1_A11Y:23,67-73` bao phủ cả 8 file baseline |
| O-13 a11y-runtime 113 | **FIXED** | `PLAN_W1_A11Y:24,39,73` ghi baseline 113; modal dùng component test; không báo PASS nếu `CHUA_CHAY` |
| O-14 baseline sai | **FIXED** | `HANDOFF:67-82` bảng baseline với số thật + nghĩa "exit 0 = không mới" |
| O-15 `.vnbConsole` owner 3 | **FIXED** | `PLAN_W0:29,51` allowlist test có chủ đích; `HANDOFF:93` R8 |
| O-16 Cmd+K mount trùng | **FIXED** | `PLAN_W3:7,42-50` CommandRegistry + mount 1 lần; xoá mount tenant-admin |
| O-17 density không context | **FIXED** | `PLAN_W3:7,54-61` `SettingsProvider` theo pattern `LangContext` |
| O-18 S3/S4 đụng file | **FIXED** | `HANDOFF:56` S4 phụ thuộc S1+S2+**S3**; `PLAN_W2:15` không đụng file S3 |
| O-19 ledger mất Entry 533 | **FIXED** | Entry 533 khôi phục; 531/532 → 534/535; audit v1 = 536; rev2 = 537; base `2b10b3016` |
| O-20 `superpowers:*` | **FIXED** | Cả 5 plan dòng 3 thay bằng `workflow-dev-loop` + `writing-plans` |
| O-21 `impeccable document` | **ĐÍNH CHÍNH** | `reference/document.md` tồn tại (skill procedure). `PLAN_W2:7,18,60` ghi đúng nhãn |
| O-22 scanner timeout | **FIXED** | `PLAN_W1_A11Y:25,47` "không có timeout nội tại; ~6.2 phút" |
| O-23 claim stale/NUL | **FIXED** | `HANDOFF:61-65` bỏ release, không đụng NUL |

**Kết luận disposition**: 22/23 FIXED, 1 ĐÍNH CHÍNH (O-21). Không có objection nào bị bỏ sót hoặc bị bác bỏ không có lý do.

---

## B. NEW FINDING — O-24 (MAJOR)

**[O-24 | ERROR | MAJOR] accent-cyan light theme: trade-off gate vs app, "0 vi phạm mới" không đạt được như rev2 đang viết**

- **Bằng chứng** (đo lại trong phiên audit round 2):
  - Gate `check-theme-contrast` đo **canvas tối** (`--color-bg-primary = #020617` trong base, **không** áp `light-theme.css` — `VARIANTS` chỉ gồm `theme/tokens.css` + `index.css` + `soc.tokens.css`).
  - Trong light theme **thật** (có `light-theme.css`), canvas = `#f8fafc`.
  - `--accent-cyan` #06b6d4 (converged, D1) trên canvas tối = **8.31:1** (pass); trên canvas sáng = **2.32:1** (FAIL).
  - `--accent-cyan` #0e7490 (SOC cũ) trên canvas tối = **3.77:1** (FAIL); trên canvas sáng = **5.12:1** (pass).
  - `--text-on-accent` = `#ffffff` được dùng trên `--accent-cyan` tại `ScreenerPage.tsx:103,541` (button).
  - Mô phỏng W0 (rev2 plan, có `--accent-cyan: #0e7490` trong light block) → gate báo **1 vi phạm mới** `accent-cyan-on-bg-primary@shell/light` (3.77). Nếu bỏ override → gate sạch, nhưng app light theme dùng #06b6d4 → **2.32 FAIL** (gate không bắt được vì đo canvas tối).
- **Tác động**: rev2 `PLAN_W0:96` và `HANDOFF:74` yêu cầu "exit 0, 0 vi phạm mới". Với accent-cyan, **không có giá trị đơn lẻ nào pass cả gate (canvas tối) và app (canvas sáng)**. Nếu agent giữ `#0e7490` trong light block → gate đỏ; nếu bỏ → app light theme button trắng trên cyan quá sáng (2.32 < 4.5). Gate đo sai theme thật nên không bắt được regression thật.
- **Fix đề xuất (chọn 1)**:
  - **(a) Khuyến nghị**: thêm `--text-on-accent: #0f172a;` vào light block trong `theme/tokens.css` (1 dòng). Khi đó text trên accent-cyan trong light theme là **đen** → #06b6d4 với text đen = 7.35 (pass cả gate và app); giữ `--accent-cyan: #0e7490` trong light block (app accessibility) **hoặc** bỏ override (gate sạch) — cả hai đều pass vì text đã tối. Đây là thay đổi nhỏ, an toàn, không đổi màu tăng/giảm L-F08 (chỉ đổi màu chữ trên nút).
  - **(b)** Sửa gate `check-theme-contrast.mjs` để include `light-theme.css` vào cascade variant → gate đo đúng theme thật. Nhưng điều này thay đổi semantics của gate (đang cố tình bắt R1/R2 defect) — cần Owner approve và test lại baseline.
  - **(c)** Chấp nhận 1 vi phạm baseline mới với Owner sign-off rõ ràng, ghi "measurement artifact, không phải regression thật". Vi phạm R2 (`HANDOFF:71`) nhưng có lý do rõ ràng.
- **Ưu tiên**: (a) trong W0 (1 dòng + test), (b) defer sang program light-theme riêng, (c) fallback nếu Owner không đồng ý (a).

---

## C. Minor implementation notes (không chặn, nhưng nên sửa trong plan để tránh lặp)

1. **`--text-muted` direct value** (`PLAN_W0:49,95`): gate resolve `--text-muted: var(--color-text-muted, #64748b)` qua `--color-text-muted` ở `index.css:67` (= #64748b). Chỉ sửa fallback không đủ; phải đổi thành giá trị trực tiếp `#94a3b8` (hoặc sửa `index.css:67`, nhưng ảnh hưởng 10+ chỗ `StockDetailPage.css`). Plan nên ghi rõ "giá trị trực tiếp, không qua var reference".
2. **Net delta muted = 0**: D1 nói `#94a3b8→#64748b`, O-02 fix nói `#64748b→#94a3b8`. Net = 0. Plan nên ghi "giữ `#94a3b8` (không hội tụ về `#64748b` vì contrast)" thay vì 2 mũi tên ngược nhau.
3. **Dev light flag precedence** (`PLAN_W0:113-121`): `applyUserTheme()` (`UserSettingsPage.tsx:18-24`) vẫn force dark. Nếu dev flag set `data-theme=light` trước first paint, `applyUserTheme` có thể ghi đè. Plan nên ghi thứ tự gọi rõ ràng.
4. **W1-chrome gate detector** (`PLAN_W1_CHROME:39,68`): plan nói detector dùng chung "sau Owner approve" cho `check-heading-contract.mjs`. Nếu không cập nhật gate, `PLAN_W1_CHROME:29` "0 vi phạm mới" không bắt được `renderElement`. Nên либо cập nhật gate trong Task 2, либо ghi rõ baseline-locked.
5. **W0 Task 2 Step 4 "exit 0"**: với O-24 chưa xử lý, simulation sẽ trả 1 vi phạm mới. Sau khi áp fix (a), phải re-run simulation và ghi `contrast-red.md` + `contrast-green.md`.

---

## D. Verdict từng slice (round 2)

| Slice | Verdict | Blocker/Major |
|---|---|---|
| W0 `feat/uiux-ssot-w0` | **NEED_REVISION** | 1 major (O-24) + 5 minor notes C1-C5 |
| W1 chrome `feat/uiux-chrome-w1` | **AGREE** | 0 blocker, 0 major (reservation: detector gate update) |
| W1 a11y `feat/uiux-a11y-w1` | **AGREE** | 0 blocker, 0 major |
| W2 `feat/uiux-exp-w2` | **AGREE** | 0 blocker, 0 major |
| W3 `feat/uiux-cmd-w3` | **AGREE** | 0 blocker, 0 major |

---

## E. Quality gates (không chạy thêm trong round 2)

Tất cả số liệu round 1 vẫn còn hiệu lực; rev2 không thay đổi code. **CHƯA CHẠY** thêm: staging, browser, E2E, vitest/build, ảnh.

---

## F. Câu hỏi cần Owner/coordinator chốt (chỉ còn 1)

1. **O-24**: chấp nhận fix (a) `--text-on-accent: #0f172a` trong light block (1 dòng, text đen trên cyan button ở light theme), hay chọn (b)/(c)? Nếu (a), W0 Task 2 thêm 1 dòng + test; gate simulation phải re-run và ghi 0 mới.

---

## G. Đánh giá tổng thể

- **rev2 xử lý xuất sắc** cả 23 objection round 1 — disposition đầy đủ, không có objection nào bị bỏ sót hoặc bác bỏ không lý do. Đây là kế hoạch **implementable** sau khi xử lý O-24.
- **O-24 là major, không phải blocker**: ảnh hưởng 2 button ScreenerPage, light theme đang tắt (dev flag only), fix 1 dòng. Nhưng plan hiện tại ghi "exit 0" mà không đạt được → phải sửa plan trước khi cấp worktree.
- **Ưu tiên**: (1) Owner chốt O-24 → planner thêm fix (a) vào W0 Task 2 + cập nhật D1 table (muted: giữ `#94a3b8`, không hội tụ); (2) audit vòng 3 (chỉ kiểm O-24 + minor notes) → PASS/AGREE; (3) S0 merge docs → cấp worktree S1.
- **Không cấp worktree, không merge docs** cho đến khi audit vòng 3 trả PASS/AGREE.

---

**Kết luận**: **NEED_REVISION** — 0 blocker, 1 major (O-24). Sửa O-24 + 5 minor notes, audit vòng 3.
