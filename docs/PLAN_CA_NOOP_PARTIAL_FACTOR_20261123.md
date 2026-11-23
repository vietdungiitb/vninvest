# Plan — Không để factor partial no-op chặn adjustment thật (2026-11-23)

> **TRẠNG THÁI: BLOCKED — audit độc lập `NEED_REVISION`, không viết code.**
> Verdict: `docs/evidence/widget-news-events/AUDIT_PLAN_CA_NOOP_20261123.md`.
> Lý do chặn: `factor_total == 1` trên factor `partial` chỉ có nghĩa **parser không trích được số**,
> không phải sự kiện vô hại. Bỏ qua ⇒ `adj_close` sai + `is_adjusted=True` cho rights issue / chuyển
> trái phiếu. Cần owner chốt policy trước khi sửa. Claim `ca-parser` đã chuyển `blocked`.
> Số liệu trong plan dưới đây là đo thật nhưng **chưa có lệnh tái tạo lưu trong evidence** — Audit objection 4.

## 1. Mục tiêu + bằng chứng đã tự mở đọc
Badge "Chưa điều chỉnh" trên chart VIC. Điều tra refute giả thuyết "parser là nút thắt" (xem `docs/evidence/widget-news-events/UI_ELEMENTS_EXPLAINED_20261123.md`).

Bằng chứng đo thật trên staging (lệnh tái hiện trong evidence):
- Hệ thống **đang tự điều chỉnh**: 2.254.058 / 4.584.956 `DailyPrice` có `adj_close`; 14.630 factor `computed`, 2.694 `partial`.
- VIC: 0/4.782 giá có `adj_close` dù có **11 factor `computed`**.
- VIC có 64 factor `partial`, trong đó **63 có `factor_total = 1.0000000000`** (không mang số liệu — no-op), chỉ 1 factor (ex_date 2010-05-07, `factor_total=0.6246096190`) mang hệ số thật.
- `adjustment.py:89`: `reset = (not affecting) or any(f.status != COMPUTED for f in affecting)` ⇒ 63 factor no-op vẫn làm `reset=True`, xoá sạch hiệu ứng của 11 factor computed.

## 2. Root cause
Fail-closed được áp dụng cho **mọi** factor `partial`, kể cả factor không đổi giá (`factor_total == ONE`). Đây là lỗi quá mức: không cần suy diễn số liệu, chỉ cần bỏ qua factor no-op khi xét điều kiện reset.

## 3. Thay đổi (SCOPE)
- `packages/core/backend/src/market_data/corporate_actions/adjustment.py:89` — điều kiện reset chỉ xét factor `partial` có `factor_total != ONE`.
- `packages/core/backend/src/market_data/tests/test_corporate_action_adjustment.py` — thêm test RED/GREEN.
- Evidence + ledger.

**LIMIT:** 1 slice, tối đa 3 vòng sửa. **Không** đổi parser, **không** đổi semantics rights issue/ESOP, **không** migration, **không** đụng FE.

## 4. Tiêu chí nghiệm thu (Given/When/Then)
- Given 1 factor `computed` (giảm giá) + 1 factor `partial` có `factor_total = 1`, When `apply_adjustments('X')`, Then giá trước cả 2 ex_date có `adj_close = close * computed_factor` và `is_adjusted=True`.
- Given factor `partial` có `factor_total != 1`, When chạy, Then vẫn fail-closed (giữ hành vi cũ) — test dương tính chặn "luôn không reset".
- Given correction xoá factor, When recompute, Then `adj_close` cũ bị reset (F1 không regression).
- Regression: toàn bộ test corporate actions hiện có vẫn xanh.

## 5. Baseline gate
- BE test: chạy trên VPS staging theo runbook (không local Docker). Trước sửa: test mới phải **đỏ**.
- `node scripts/check-experiment-env.mjs`, `check-multi-agent.mjs`, `npx tsc --noEmit` — chạy sau rebase.

## 6. Lessons áp dụng
`[L-002, L-M02, L-007, L-V02, L-V04, L-V03]` — claim trước code, tên branch đúng, không có env thì ghi CHƯA CHẠY, phản chứng root cause kế thừa (đã refute giả thuyết parser bằng số liệu), assert giá trị thật + test dương tính, `git status` sau lệnh có side effect.

MANDATORY CHECKLIST:
- [x] Claim commit riêng trước dòng code — làm ngay sau plan này.
- [x] Branch `feat/ca-parser` khớp agent `ca-parser` (L-M02).
- [ ] Fail-before chạy thật trên staging, test đỏ đúng lý do.
- [ ] Test dương tính cho fail-closed (factor partial có hệ số ≠ 1 vẫn reset).
- [ ] `git status --short` sau mỗi lệnh chạy test.
- [ ] Gate sau rebase; báo CHƯA CHẠY cho cổng không chạy được.

## 7. Non-goals / Rollback
Không sửa parser, không thêm nguồn dữ liệu, không đổi FE. Rollback = revert 1 điều kiện trong `adjustment.py` + xoá test mới.
