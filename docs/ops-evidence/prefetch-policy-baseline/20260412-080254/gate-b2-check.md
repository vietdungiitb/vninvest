# Gate B2 Check

- Generated at: 2026-04-12T08:08:12.4980054+07:00
- Baseline summary: C:\Mujoco Projects\vninvest\docs\ops-evidence\prefetch-policy-baseline\20260412-080254\baseline-summary.json
- Gate B2 ready: True

## Checks

- [x] Auth enabled during baseline capture
  - expected: true
  - actual: true
- [x] Baseline 429 rate captured
  - expected: non-null
  - actual: 0
- [x] Baseline cooldown events captured
  - expected: counter present or no-429 observed
  - actual: {"multiplier_total_first":null,"multiplier_total_last":null,"multiplier_total_delta":null,"ticker_probe_429_ratio_pct":0,"no_429_observed":true}
- [x] Baseline freshness captured
  - expected: non-null
  - actual: 0
- [x] Baseline p95 latency endpoints captured
  - expected: prefetch + market-observability + admin-ops-stats non-null
  - actual: {"prefetch_health":20011.05,"market_observability":20012.78,"admin_ops_stats":19924.57}
