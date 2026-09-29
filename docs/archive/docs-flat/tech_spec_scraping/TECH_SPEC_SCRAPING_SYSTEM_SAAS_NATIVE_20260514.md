# TECH SPEC — Scraping System SaaS-Native

**Ngày**: 2026-05-14  
**Status**: APPROVED BASELINE FOR EXECUTION

---

## 1. Mục tiêu kỹ thuật

Spec này định nghĩa kiến trúc đích cho `scraping system` theo hướng:

1. Native core only.
2. OpenAPI contract first.
3. Facts-first read path.
4. Một SSOT cho broker access.
5. Một control plane cho operator scraping.

---

## 2. Canonical architecture

### 2.1 Layering

1. `market_data.vnbroker_adapter`
   - Vai trò: broker access SSOT.
   - Chịu trách nhiệm: provider routing, provider capability guard, retry/failover, timeout, degraded signaling.
2. `data_ingest`
   - Vai trò: scheduled ingestion và batch persistence.
   - Chỉ gọi adapter, không gọi trực tiếp provider SDK.
3. `service_ops`
   - Vai trò: operator control plane cho cycle/cell orchestration, provider health, run logs, ownership, config lifecycle.
4. `market_serving` và `signal_intelligence`
   - Vai trò: facts/materialized outputs cho product read path.
5. `vninvest_core.contracts.operator`
   - Vai trò: canonical OpenAPI surface cho operator scraping.

### 2.2 Hard rule

Không caller nào trong `packages/core/backend/src` được import trực tiếp từ:

1. `vnbroker`
2. `vnbroker.explorer.*`
3. `vnbroker.connector.*`
4. Provider-specific `Quote` classes

Ngoại lệ duy nhất: `packages/core/backend/src/market_data/vnbroker_adapter.py`.

---

## 3. Provider model

### 3.1 Provider roster in-scope

- `VCI`
- `KBS`
- `DNSE`

### 3.2 Provider truth

1. `service_ops.provider_catalog` là provider SSOT cho operator surfaces.
2. `market_data.vnbroker_adapter` phải đồng bộ provider roster với `provider_catalog`.
3. Nếu provider chưa đủ runtime secret hoặc chưa ready, API phải trả 400/409 có reason rõ ràng; không được âm thầm downgrade sang provider khác nếu request yêu cầu provider explicit.
4. Fallback provider chỉ được dùng trong adapter theo chính sách rõ ràng cho use case phù hợp, không được làm sai provider truth của operator request.

---

## 4. Control plane rules

### 4.1 Matrix là execution primitive chuẩn

1. `run_scrape_cycle` là coordinator chuẩn cho manual/operator scraping hiện tại.
2. `scrape_cell_task` là cell worker chuẩn.
3. `MatrixCoordinator` là source of truth cho cell claim, row skip, progress, completion.
4. Không thêm coordinator Celery song song nếu chỉ lặp lại partition-dispatch-aggregate semantics của Matrix.

### 4.2 Scheduled jobs

1. Scheduled price refresh, daily history, intraday warmup phải tái sử dụng execution primitives chung hoặc wrapper trên cùng orchestration semantics.
2. Không được để `data_ingest` giữ execution semantics riêng làm lệch provider truth, retry logic, hay run-log model.

---

## 5. Canonical route map

### 5.1 Canonical namespace

Tất cả operator scraping routes mới phải nằm dưới:

- `/core/v1/operator/scraping/*`

### 5.2 Route families

- `/core/v1/operator/scraping/matrix/cycles/`
- `/core/v1/operator/scraping/matrix/cycles/start/`
- `/core/v1/operator/scraping/matrix/cycles/{cycle_id}/`
- `/core/v1/operator/scraping/matrix/cycles/{cycle_id}/cells/`
- `/core/v1/operator/scraping/matrix/cycles/{cycle_id}/abort/`
- `/core/v1/operator/scraping/matrix/providers/`
- `/core/v1/operator/scraping/matrix/monitor/`

Planned families sau T01:

- `/core/v1/operator/scraping/providers/*`
- `/core/v1/operator/scraping/jobs/*`
- `/core/v1/operator/scraping/history/*`
- `/core/v1/operator/scraping/runtime/*`

### 5.3 Transitional aliases

1. `/api/soc/*` có thể tiếp tục tồn tại trong giai đoạn cutover.
2. `/api/admin-ops/*` chỉ được giữ cho admin ownership chưa migrate hoàn tất.
3. Không consumer mới nào được bind vào alias khi canonical route đã tồn tại.

---

## 6. OpenAPI contract rules

### 6.1 Request/response

1. Mọi endpoint scraping phải có request schema rõ ràng.
2. Mọi response phải có payload shape ổn định và example.
3. Validation fail trả `400` với `field_errors`.
4. State conflict trả `409`.
5. Rate limit trả `429` với standard envelope.

### 6.2 Error envelope

Tất cả lỗi phải theo envelope chuẩn:

```json
{
  "detail": "Human-readable error",
  "code": "error_code_slug",
  "timestamp": "2026-05-14T12:00:00Z",
  "request_id": "req_xxx",
  "field_errors": {}
}
```

### 6.3 Pagination

1. List cycles, list cells, list run logs, list audit history phải paginated.
2. Không trả full dataset unbounded cho endpoint list.

---

## 7. Data lifecycle rules

1. `IntradayTick` là short-lived staging input, không phải long-term truth trên product path.
2. `DailyPrice`, `SymbolSnapshot`, `SessionFacts`, `UnifiedAlert`, `WhaleAlertCanonical`, `OrderFlowEvent` là persistence outputs được product đọc.
3. `signal_intelligence.materializers` không được sinh dữ liệu synthetic/random trên production path.
4. Nếu native facts chưa sẵn sàng, endpoint phải degrade có chủ đích hoặc empty-state rõ ràng, không được fabricate data.

---

## 8. Legacy removal rules

1. `legacy_readonly` chỉ được tồn tại như migration aid có expiry, không được là dependency của steady-state scraping runtime.
2. `LEGACY_BACKEND_URL` không được nằm trên write/read execution path của scraping sau khi ownership migrated.
3. Compat shims cho scraping phải có sunset task và test coverage trước khi gỡ.

---

## 9. Validation baseline

1. Grep gate cho direct provider imports ngoài adapter.
2. Focused tests cho Matrix canonical routes, SOC alias parity, provider catalog, task dispatch, and adapter propagation.
3. OpenAPI schema check cho canonical operator scraping namespace.
4. Runtime refresh cho `core-api` sau mọi thay đổi route/controller ảnh hưởng runtime.
