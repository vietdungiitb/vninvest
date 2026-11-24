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

### S2 PASS @ `7960fb3b8` (implementation)

Lệnh identical với S1: `manage.py test market_serving.tests.test_native_views.WhaleFeedContractTests --noinput --keepdb`

```
Ran 4 tests in 0.098s
OK
```

### S3+S4+S5 — implementation @ `1c405ca2c`

Phạm vi: CVD `delta/unit/source/trade_count/revision`, scope `market:read`, strict window 400, cache key kép revision, empty payload đủ field; engine lọc `tick_session:` + bỏ `else:sell`; WS `resolve_ws_identity()` additive + subscribe `events[]` → `not_provisioned`; test CORS `override_settings(DYNAMIC=False)`; manifest 540 route.

**LỘC SỬ LỖI (3 vòng, đúng LIMIT):**
1. `@extend_schema` bị đặt cách khỏi class → SyntaxError (`native_views.py:346`) — đã chuyển decorator vào sát class.
2. `system-design` CATALOG drift do 2 route mới → regenerate `gen-endpoint-catalog.py --write` (1438 route) + inventory.
3. `UNSUPPORTED_WINDOW`: DRF `ValidationError` bọc thành `validation_error`, rồi `status` chưa import → trả `Response` 400 tường minh + import `status`.

**PASS cuối (3 lỗi trên đã đóng):**
```
Found 13 test(s).
Ran 13 tests in 0.204s
OK
TEST_EXIT=0
```
DB riêng `whale_cvd_r2` + `whale_cvd_r1`, cleanup DROP FORCE + remove worktree sau mỗi lần.

### Local gates @ `1c405ca2c`

| Gate | Kết quả |
|---|---|
| `python -m py_compile` 5 file BE | exit 0 |
| `node scripts/check-lessons.mjs` | 60/60, sạch |
| `node packages/web/scripts/check-multi-agent.mjs` | 0 lỗi, PASS |
| `node scripts/pre-push-gate.mjs` | **36 PASS / 0 SKIP / 0 FAIL** — cho phép push |
| `npx tsc --noEmit` (web) | exit 0 |
| `npm test -- --runTestsByPath src/adapters/core/__tests__/route-contract.test.js` | **1 suite / 4 test PASS** (manifest 540 route khớp) |

### CHƯA CHẠY / thuộc coordinator

- Cập nhật `CORS_ALLOWED_ORIGINS` trong `/opt/vninvest/compose.staging.env` (VPS) — **owner coordinator** theo `AGENT_PROTOCOL.md:33`; AC11 đã chứng minh bằng `override_settings(CORS_API_DYNAMIC_ALLOW=False)` trong test, nhưng env production/staging chưa đổi và chưa restart container.
- Full BE suite + E2E/tape browser; không thuộc scope slice.
