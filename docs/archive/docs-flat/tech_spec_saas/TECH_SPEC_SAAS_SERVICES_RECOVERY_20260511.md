# TECH SPEC — SaaS Services Recovery

**Ngày**: 2026-05-11  
**Trạng thái**: APPROVED FOR IMPLEMENTATION

---

## 1. Runtime Topology Target

## 1.1 Services bắt buộc
1. `core-db`
2. `core-redis`
3. `core-api`
4. `core-worker`
5. `core-beat`
6. `frontend`

## 1.2 Services bổ trợ (tuỳ môi trường)
1. `prometheus`
2. `grafana`
3. `mailpit` (dev)

## 1.3 Nguyên tắc đường chạy
1. API entry point chính đi qua core API.
2. Không để legacy background services xử lý song song cùng workload chính.
3. Worker và beat bắt buộc cùng broker contract.

---

## 2. Health Contract

## 2.1 Health endpoint
1. `GET /core/v1/health` -> 200 + payload status healthy/ok.
2. `GET /api/health/` -> 200 trong path runtime chính.

## 2.2 Container health rule
1. `core-api` phải có healthcheck pass.
2. `core-worker` và `core-beat` tối thiểu có runtime log heartbeat rõ ràng.
3. Data plane (`db`, `redis`) phải healthy trước khi core runtime khởi động.

---

## 3. Queue/Scheduler Contract

1. Broker URL của `core-api`, `core-worker`, `core-beat` phải đồng nhất namespace.
2. Beat schedule phải dispatch được và worker phải consume thành công.
3. Không có lỗi:
   - `Received unregistered task`
   - `Error 111 connecting to localhost`
   - `broker unavailable`

---

## 4. Config Contract

Biến môi trường tối thiểu bắt buộc:
1. DB URL/password
2. Redis URL
3. Django secret key
4. Allowed hosts / CORS origins
5. Core PAT pepper (nếu bật PAT path)

Quy tắc:
1. Prod dùng `${VAR:?error}` cho biến nhạy cảm.
2. Không hardcode secret trong source.
3. Không wildcard hosts/cors cho production path.

---

## 5. Recovery Sequence Contract

1. Start order bắt buộc:
   1. data plane (`db`, `redis`)
   2. `core-api`
   3. `core-worker`, `core-beat`
   4. `frontend`
2. Stop order khuyến nghị:
   1. `frontend`
   2. `core-worker`, `core-beat`
   3. `core-api`
   4. data plane

---

## 6. Observability Contract

Metrics bắt buộc:
1. API availability
2. API latency p95
3. Queue depth
4. Task failure/retry rates
5. Worker uptime/restart count

Alerts bắt buộc:
1. service_stalled
2. queue_backlog_abnormal
3. api_health_degraded
4. config_drift_detected

---

## 7. Test Contract

## 7.1 Smoke tests
1. Core health endpoints.
2. Realtime ticker endpoint.
3. Unified alerts/whale feed endpoint.
4. Portfolio/watchlist endpoint theo core path.

## 7.2 Integration tests
1. Compose-level startup validation.
2. Queue dispatch-consume-complete flow.
3. Scheduler cycle pass 3 lần liên tiếp.

## 7.3 Soak tests
1. 24-72h monitoring window.
2. Không có P1 incident.
3. SLO pass theo ngưỡng.

---

## 8. Failure Mode & Guardrails

1. DB down:
   - block rollout tiếp
   - ưu tiên recover data plane
2. Redis down:
   - block worker/beat startup
   - verify broker connectivity trước khi mở traffic
3. Core API stuck in starting:
   - kiểm tra migration/log dependency
   - không start frontend cutover cho đến khi healthy
4. Queue backlog tăng liên tục:
   - kiểm tra beat cadence
   - kiểm tra worker concurrency/resources

---

## 9. Acceptance Criteria

1. Full core services healthy >= 24h.
2. Background jobs hoàn thành theo schedule không lỗi critical.
3. Runtime path chính theo kiến trúc SaaS mới.
4. Evidence, audit ledger, progress dashboard cập nhật đầy đủ.
