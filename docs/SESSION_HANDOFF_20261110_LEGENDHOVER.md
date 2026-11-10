# Handoff — Legend hover-reveal (2026-11-10)

**Slice:** `feat/widget-legend-hover` (PR #332 MERGED). Ledger Entry 442.

## Đã làm (theo user chọn "chỉ hiện khi hover")
- CSS: `.Gc` ẩn mặc định; `.fr:hover ~ div ...` hoặc `.Cc:hover` thì `inline-flex`.
- Test S7 mở rộng 7/7. tsc 0, build OK, check-multi-agent PASS.
- Deploy staging PASS; visual verify: default 0/3, hover 3/3, screenshot như demo.
- B3 PASS + B8 PASS. Claim single row done (code trước claim 1 bước đã ghi nhận).

## Rủi ro đã biết
- `.fr`/`.Cc`/`.Gc` là class của build widget 0.4.1 — bump phải verify lại (comment CSS + Entry 442).
- Mobile không hover → legend không hiện (crosshair drag vẫn có giá trị).

## Còn nợ
- Pre-existing: WS handshake fail, 404 advisory, 2 lint errors.
- P3.4 `registerProExtension` (cần backend tier source-of-truth). E2E full.
