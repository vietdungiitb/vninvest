# Gate B2 Check

- Generated at: 2026-04-12T07:45:41.1048442+07:00
- Baseline summary: C:\Mujoco Projects\vninvest\docs\ops-evidence\prefetch-policy-baseline\20260412-074032\baseline-summary.json
- Gate B2 ready: False

## Checks

- [ ] Auth enabled during baseline capture
  - expected: true
  - actual: false
- [ ] Baseline 429 rate captured
  - expected: non-null
  - actual: 
- [ ] Baseline cooldown events captured
  - expected: non-null
  - actual: 
- [x] Baseline freshness captured
  - expected: non-null
  - actual: 0
- [ ] Baseline p95 latency endpoints captured
  - expected: prefetch + market-observability + admin-ops-stats non-null
  - actual: {"prefetch_health":2035.92,"market_observability":2025.51,"admin_ops_stats":null}
