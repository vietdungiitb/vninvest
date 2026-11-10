# Handoff — Widget cleanup: bỏ Dark Flow + dock rail + legend chips (2026-11-10)

**Slice:** `feat/widget-cleanup` (PR #329 + #330 MERGED). Ledger Entry 441.

## Đã làm
- Bỏ `darkFlowStrength/SignalType` → badge `Dark Flow100 Mạnh` mất hẳn.
- `showDock: false` → rail dock + tooltip `Nâng cấp Pro` mất hẳn.
- `VNStockChartPanel.css` mới: ẩn legend chips (stable selectors + `.Gc` indicatorRow hash build 0.4.1), scope `.vnstock-chart-panel`. Lines EMA/BB giữ nguyên, hover vẫn có giá trị.
- Test S6+S7 (fail-before đỏ → xanh), tổng 7/7. tsc 0, build OK, check-multi-agent PASS.
- Deploy staging PASS; visual verify (admin/admin123): chips `display:none` (visibleChips 0), screenshot gọn như demo.
- B3 PASS + B8 PASS (subagent độc lập, 2 vòng).

## Rủi ro đã biết (ghi nhận, không chặn)
- `.Gc` là hash của build 0.4.1 — bump widget phải verify lại CSS (package.json pin exact nên hiện ổn).
- S7 chỉ assert file tĩnh, không assert render — visual check bù bằng screenshot.

## Còn nợ
- Pre-existing: WS handshake fail, 404 `/core/v1/advisory/latest`, 2 lint errors (ShellMailConfigPage, VipLocalControlPage).
- P3.4 `registerProExtension` (cần backend tier source-of-truth). E2E full.

## Next
Owner quyết tier source-of-truth → P3.4. Không nợ UI nào khác.
