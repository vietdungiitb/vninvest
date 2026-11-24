# GATES — Whale/CVD contract BE

Repo `vninvest`, branch `feat/whale-cvd-contract-be`. Mọi lệnh BE test chạy trên VPS `14.225.255.47`, DB riêng `whale_cvd_r1`, worktree `/tmp/wt-whale-cvd`, cleanup sau mỗi lần (RUNBOOK §12.3).

## Baseline (trước code) @ `3437183bc`

| Gate | Lệnh | Kết quả |
|---|---|---|
| multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | 0 lỗi, PASS |
| lessons | `node scripts/check-lessons.mjs` | 14 file / 60/60, sạch |
| experiment-env | `node scripts/check-experiment-env.mjs` | PASS, exit 0 |
| EOL | `node scripts/normalize-eol.mjs` | OK, exit 0 |
| tsc | `npx tsc --noEmit` (packages/web) | exit 0 |

## S1 — FAIL-BEFORE @ `7960fb3b8` (test commit, CHƯA có implementation)

Lệnh: `manage.py test market_serving.tests.test_native_views.WhaleFeedContractTests --noinput --keepdb`

```
ERROR: test_aggregate_tick_session_rows_are_not_returned -> KeyError: 'whale_orders'
ERROR: test_summary_has_eight_fields_and_invariant -> KeyError: 'whale_orders'
FAIL: test_min_value_floor_and_empty_state -> AssertionError: 200 != 400
FAIL: test_orderflow_aggressor_routes_are_not_provisioned -> AssertionError: 404 != 501
Ran 4 tests in 0.261s
FAILED (failures=2, errors=2)
```

**Kết luận:** đỏ đúng 4/4 — failure ở đúng chỗ cần sửa (builder chưa tồn tại, thiếu floor validation, thiếu route 501). Cleanup DB + worktree xong.

## S2 — implementation (đang chạy)

- `market_serving/native_views.py`: helper `build_whale_feed_payload()` (per-tick only, 8-field summary, keyset cursor, `+07:00`, empty state), `RealtimeWhaleFeedView` mở rộng, `NotProvisionedView` 501.
- `market_serving/urls.py`: 2 route orderflow 501.
- `signal_intelligence/views.py`: alias `/core/v1/whale-feed` giữ nguyên envelope/side HOA/`signals:read`/`?session_date=`, chỉ thêm guard `whale_tick:` + enum `small`.
- `order_flow_engine.py` + `tasks.py`: loại UNKNOWN aggressor (G0: 0,75%).

*(phần PASS/CHƯA CHẠY sẽ cập nhật sau khi chạy lại test trên VPS)*
