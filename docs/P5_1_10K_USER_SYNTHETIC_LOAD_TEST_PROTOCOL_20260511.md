# P5.1 - Giao thức chạy load test 10k user synthetic

Mục tiêu của slice này là xác nhận harness load test cho SBMP-P5.1: `p5_1` là đường full 10k trên surface core-native ổn định, còn các endpoint observability/load rộng hơn được tách sang `p5_1_wide` để chạy riêng nếu muốn phủ đầy đủ. Nhánh `core_saas` là đường validation ngắn cho service đã cutover sang core-native ASGI.

## Phạm vi

- Script chính: [infra/load-tests/api-load.js](infra/load-tests/api-load.js)
- `LOAD_PROFILE=smoke`: chỉ dùng các route public của core-api để validate cú pháp và runtime cục bộ.
- `LOAD_PROFILE=baseline`: giữ nguyên profile 500-VU cũ để không phá slice trước.
- `LOAD_PROFILE=core_saas`: validation ngắn cho core-api ASGI với HTTP auth, admin-ops, websocket ping/pong, và runtime probes nhẹ.
- `LOAD_PROFILE=p5_1`: bật 4 lane đồng thời trên surface core-native ổn định:
  - `api_mix`: HTTP mix 10k VU, dùng `/api/realtime/whale-feed/aggregate/` và `/core/v1/market-data/daily-prices/<symbol>/`.
  - `queue_pressure`: chỉ warm `prefetch` để giữ đường 10k ổn định.
  - `websocket_fanout`: connect vào `/ws/market/<symbol>/?token=...` và xác nhận ping/pong trên ASGI websocket consumer.
  - `runtime_probe`: đọc `runtime-kpi` và `realtime health` để giữ tín hiệu observability nhẹ.
- `LOAD_PROFILE=p5_1_wide`: lane diagnostic riêng cho observability/load rộng hơn:
  - `queue_pressure`: warm `prefetch` + `offpeak-ingest`.
  - `observability_probe`: đọc `runtime-kpi`, `realtime ops metrics`, `prefetch health`, và `market observability`.

## Biến môi trường

- `BASE_URL`: base URL của surface cần test.
- `CORE_PAT`: PAT cho các route read/auth đã bảo vệ.
- `OPS_PAT` hoặc `ADMIN_PAT`: PAT staff/admin cho các route `admin-ops` và metrics.
- `WS_PAT`: PAT dùng cho WebSocket query token; nếu không set thì fallback sang `CORE_PAT`.
- `TARGET_HTTP_VUS`: mặc định 10,000 cho `p5_1`.
- `WS_CLIENTS`: mặc định 200 cho `p5_1`.
- `QUEUE_PRESSURE_VUS`: mặc định 5 cho `p5_1`.
- `PROBE_VUS`: mặc định 2 cho `p5_1`.
- `LOAD_DURATION`: thời lượng giữ tải, mặc định 15m cho `p5_1`.
- `WS_HOLD_SECONDS`: thời gian giữ socket mở trước khi đóng.

## Validation nhanh cho cutover

```powershell
docker run --rm -v "${PWD}:/work" -w /work `
  -e LOAD_PROFILE=core_saas `
  -e BASE_URL=http://host.docker.internal:8001 `
  -e CORE_PAT=<pat> `
  -e OPS_PAT=<admin-pat> `
  -e WS_PAT=<ws-pat> `
  grafana/k6 run infra/load-tests/api-load.js
```

Nhánh này dùng để chứng minh core-api ASGI đã answer được HTTP auth, admin-ops, và websocket ping/pong mà không phụ thuộc route legacy.

## Cách chạy

### Smoke cục bộ

```powershell
docker run --rm -v "${PWD}:/work" -w /work -e LOAD_PROFILE=smoke -e BASE_URL=http://host.docker.internal:8001 grafana/k6 run infra/load-tests/api-load.js
```

### P5.1 live run

```powershell
docker run --rm -v "${PWD}:/work" -w /work `
  -e LOAD_PROFILE=p5_1 `
  -e BASE_URL=<core-saas-surface-url> `
  -e CORE_PAT=<pat> `
  -e OPS_PAT=<admin-pat> `
  -e WS_PAT=<ws-pat> `
  -e TARGET_HTTP_VUS=10000 `
  -e WS_CLIENTS=200 `
  -e QUEUE_PRESSURE_VUS=5 `
  -e PROBE_VUS=2 `
  grafana/k6 run infra/load-tests/api-load.js
```

`<core-saas-surface-url>` phải là surface đang phục vụ core-api ASGI. `p5_1` hiện là đường full-load ổn định, còn `p5_1_wide` là lane riêng nếu muốn phủ thêm observability/load rộng hơn mà không trộn vào gate 10k.

### P5.1 wide observability pass

```powershell
docker run --rm -v "${PWD}:/work" -w /work `
  -e LOAD_PROFILE=p5_1_wide `
  -e BASE_URL=<core-saas-surface-url> `
  -e CORE_PAT=<pat> `
  -e OPS_PAT=<admin-pat> `
  grafana/k6 run infra/load-tests/api-load.js
```

`p5_1_wide` là lane diagnostic tách riêng để đọc các endpoint observability/load rộng hơn. Không dùng lane này làm gate cutover cho đường full 10k.

## Gate đề xuất

- `http_req_duration p95 <= 250ms` cho `p5_1`.
- `request_errors rate < 1%`.
- `websocket_connect_latency_ms p95 <= 1s`.
- `websocket_ping_latency_ms p95 <= 1s`.
- `prefetch_freshness_seconds p95 <= 2s`.
- `realtime_pending_depth_max` được theo dõi trong lane wide, không phải gate 10k.

## Evidence cần lưu

- `infra/load-tests/results/summary.json`
- `infra/load-tests/results/summary.txt`
- Command output từ Docker k6.

## Residual risk

- P5.1 full 10k live run cần một lần chạy độc lập trên surface core-native đã ổn định.
- Lane `p5_1_wide` vẫn cần một pass riêng nếu muốn phủ đầy đủ observability/load rộng hơn.