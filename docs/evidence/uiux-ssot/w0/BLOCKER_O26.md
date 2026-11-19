# BLOCKER O-26 — W0 dừng tại Task 2 Step 4 (check-theme-contrast)

- **Ngày**: 2026-11-19 · **Slice**: `uiux-ssot-w0` @ `feat/uiux-ssot-w0`.
- **Trạng thái**: **BLOCKER** — không tiếp Task 3 (hạ baseline), không `--update-baseline`.

## 1. Đã làm

- Test đỏ → xanh: `packages/web/src/components/soc/__tests__/token-ssot.component.test.ts` (red 3 fail/2 pass → green 5/5). Evidence `red.md`, `green.md`.
- Simulation contrast đỏ: `contrast-red.md` (exit 1, 4 vi phạm mới @soc/dark).
- Gỡ 13 khai báo base khỏi `soc.tokens.css`; dời 5 light value sang `theme/tokens.css` light block; bỏ `--accent-cyan`/`--text-muted` khỏi light block (O-24/O-25).
- `theme/tokens.css:3` = `--text-muted: #94a3b8` direct; `:14` = `--bg-panel-soft: #0f172a` direct; light block thêm `--text-on-accent: #0f172a`.

## 2. Gate đo được

| Gate | Kết quả |
|---|---|
| `check-token-conflict --print-count` | **0** ✅ |
| `check:tokens` | PASS ✅ |
| `check:contrast` | PASS ✅ |
| `check-portfolio-contrast` (cwd `packages/web`) | PASS ✅ |
| `check:light-theme` | PASS ✅ |
| **check-theme-contrast --no-runtime** | **exit 1 — 2 VI PHẠM MỚI** ❌ |

2 vi phạm mới:
```
text-muted-on-bg-panel-token@shell/light  --text-muted trên --bg-panel = 2.56:1 · shell/light
text-muted-on-bg-panel-token@soc/light    --text-muted trên --bg-panel = 2.56:1 · soc/light
```
Baseline tương ứng: `text-muted-on-bg-panel@shell/light = 3.75:1` ⇒ **shell/light xấu đi 3.75 → 2.56** (hồi quy thật, không phải đổi tên).

## 3. Root cause — mâu thuẫn giữa 3 yêu cầu đã duyệt

1. **O-05**: xoá 13 khai báo base, trong đó có `--bg-panel` ⇒ sau W0, `--bg-panel` resolve từ owner; ở light block owner đặt `#ffffff`.
2. **O-25 fix (a)**: KHÔNG khai `--text-muted` trong light block; giữ base `#94a3b8` ⇒ light dùng `#94a3b8` trên `#ffffff` = 2.45–2.56.
3. Gate `check-theme-contrast` baseline-locked: đổi ID sang `...-bg-panel-token` ⇒ FAIL, và giá trị shell/light xấu đi.

Simulation O-25 trong audit v1/v2 **giữ lại 7 light override của SOC** (chỉ xoá 13 base), nên cho "gate clean". Khi áp đủ O-05 (xoá cả `--bg-panel` base) + O-25 (không thêm `--text-muted` light), tổ hợp mới sinh ra 2 vi phạm mà các vòng audit trước chưa mô phỏng.

Giới hạn toán học đã verify: tỉ lệ giữa `#0f172a`/`#ffffff` ≈19 ⇒ max contrast của 1 màu xám ≈4.38 < 4.5 ⇒ **không có giá trị `--text-muted` đơn lẻ pass cả dark lẫn light**.

## 4. C options cần Owner chốt (không tự chọn)

- **(a) Sửa gate** để light variant dùng `light-theme.css` đúng (O-25 option c ban đầu) — thay semantics gate, cần Owner approve + plan rev5 + audit vòng 5.
- **(b) Giữ `--text-muted: #475569` trong SOC light block** — vi phạm O-25 fix (a), tạo lại 2.66 regression.
- **(c) Owner sign-off nâng baseline** 2 ID mới — vi phạm R2 (cấm nâng baseline để xanh), trừ khi Owner ghi rõ lý do.
- **(d) Giữ `--bg-panel` trong SOC base** — vi phạm O-05 / test 13 base không xanh.

## 5. Không làm

Không chạy `--update-baseline`, không báo PASS cho gate đỏ, không tiếp Task 3–5 cho tới khi Owner chốt. Các code đã sửa ở Task 2 được commit như **partial state** để lần sửa sau có điểm xuất phát rõ.
