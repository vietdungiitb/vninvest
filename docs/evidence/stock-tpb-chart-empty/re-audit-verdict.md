# B8 — Re-audit slice chart-empty (round 3 + round 4 FINAL)

- **Date**: 2026-11-22 · **Branch**: `feat/stock-tpb-chart-empty` · **Auditor**: độc lập, chỉ đọc.

## Round 3 verdict: NEED_REVISION (OB-1 blocker + OB-2 nhẹ)

1. **Deadlock đúng**: `chartBody` cũ render widget chỉ khi đã có bars, bars chỉ từ `onBarsChange` → không bao giờ mount/fetch (0 HTTP/72h). Mount-always đúng hướng. Không phá W-C/TDZ/loop; R1 OK; test assert đúng.
2. Gate auditor tự chạy: vitest S2 4/4, `tsc` 0, eslint 0 error (1 unused-disable mới, nhẹ).
3. **OB-1 (blocker)**: `handleEmptyRetry` không reset `fetchStalled`/`fetchCallsRef`, stall deps thiếu `retryKey` → kẹt banner stall vĩnh viễn, retry no-op.
4. **OB-2 (nhẹ)**: import-fail lưu string → mất `.message`.

## Fix (commit `d2fe025c2`)

- Retry reset `fetchStalled` + `fetchCallsRef.current=0`, stall deps thêm `retryKey`.
- Import-fail lưu `Error` object.
- Test AC4: retry hết kẹt + timer re-arm (fake timers).

## Round 4 verdict: PASS (không còn OB)

- OB-1 hết kẹt (reset + deps + nhánh remount đúng); OB-2 thống nhất `Error`.
- AC4 chứng minh thật (mock retry → đúng handler; banner mất ngay + hiện lại sau 10s).
- Gate: vitest S2 **5/5 passed**.
