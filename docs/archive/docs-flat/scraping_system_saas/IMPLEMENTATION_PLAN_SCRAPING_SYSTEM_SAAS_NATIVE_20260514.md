# IMPLEMENTATION PLAN — Scraping System SaaS-Native

**Ngày**: 2026-05-14  
**Scope**: Scraping system, broker access SSOT, operator route canonicalization, legacy bridge removal  
**Status**: APPROVED FOR EXECUTION

---

## 1. Scope

### Trong scope

1. Chuẩn hóa mọi broker access trong core về `market_data.vnbroker_adapter`.
2. Reuse `Matrix` làm execution primitive cho operator/manual scraping.
3. Đưa scheduled price/history/intraday ingestion về cùng semantics orchestration.
4. Native hóa whale/dark-flow/CVD materialization, loại bỏ legacy-first và synthetic fallback.
5. Canonical hóa operator scraping routes dưới `/core/v1/operator/scraping/*`.
6. Đưa contract scraping/operator về chuẩn OpenAPI.
7. Loại bỏ legacy DB/bridge dependency trên primary scraping path.

### Ngoài scope

1. Thêm provider mới ngoài `VCI/KBS/DNSE`.
2. Thay chart/product semantics không liên quan trực tiếp scraping.
3. Xóa toàn bộ `backend/` ngay trong workstream này.
4. Rebuild toàn bộ operator platform ngoài phần scraping.

---

## 2. Architecture notes

1. `vnbroker_adapter` là data plane SSOT.
2. `service_ops` là control plane SSOT cho operator scraping.
3. `data_ingest` là scheduled/batch ingress layer, không được bypass SSOT.
4. Product reads phải bám facts/materialized outputs, không trigger coordinator trực tiếp theo request-time.
5. Canonical route đi trước consumer cutover; alias sunset chỉ làm sau khi canonical path đã có test và payload proof.

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| T01 | Freeze route map và ownership | `vninvest_core/contracts/operator/urls.py`, `service_ops/operator_urls.py`, docs bundle | Canonical scraping namespace tồn tại; matrix routes resolve dưới `/core/v1/operator/scraping/*`; ownership/alias plan được chốt trong docs |
| T02 | Enforce broker SSOT | `market_data/vnbroker_adapter.py`, `data_ingest/tasks.py` | Không còn direct provider import ngoài adapter trong core; provider roster sync về `vci/kbs/dnse` |
| T03 | Unify execution semantics | `service_ops/tasks.py`, `service_ops/views/matrix.py`, `data_ingest/tasks.py` | Scheduled/manual/backfill cùng dùng execution semantics thống nhất; không có coordinator song song |
| T04 | Price + history cutover | `data_ingest/tasks.py`, `market_serving/vnbroker_materializer.py` | Primary path không còn legacy_readonly hoặc direct explorer import |
| T05 | Native signal materialization | `signal_intelligence/materializers.py` | Không còn legacy-first whale path; không còn synthetic/random production path |
| T06 | Remove bridge dependencies | `vninvest_core/contracts/admin_ops/views.py`, `vninvest_core/settings.py` | Scraping write/read path không còn `LEGACY_BACKEND_URL` hoặc bridge-required semantics |
| T07 | OpenAPI conformance | serializers/views/schema metadata | Canonical scraping endpoints có schema, examples, status semantics, pagination, error envelope |
| T08 | Consumer cutover | operator callers/docs | Consumer dùng canonical routes; alias cũ bị chặn mở rộng |
| T09 | Shadow run và decommission prep | tests, runtime evidence, docs | Parity/shadow gates pass; residual risk và decommission notes complete |

---

## 4. Detailed task specs

### T01 — Freeze route map và ownership

**Mục tiêu**

Thiết lập canonical route đích cho scraping/operator mà không làm gãy `/api/soc/*` hiện có, đồng thời khóa documentation ownership để các slice sau không drift.

**Files bị ảnh hưởng**

- `packages/core/backend/src/service_ops/operator_urls.py` (CREATE)
- `packages/core/backend/src/vninvest_core/contracts/operator/urls.py` (MODIFY)
- `packages/core/backend/src/service_ops/tests/test_soc_matrix.py` (MODIFY)
- `docs/SCRAPING_SYSTEM_SAAS_NATIVE_HANDOFF_MASTER_20260514.md` (CREATE)
- `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md` (CREATE)
- `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md` (CREATE)
- `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md` (CREATE)

**DoD**

- `/core/v1/operator/scraping/matrix/providers/` resolve và trả payload tương đương alias `/api/soc/matrix/providers/`
- `/core/v1/operator/scraping/matrix/cycles/start/` resolve và dispatch cùng workflow hiện có
- Docs chốt rõ canonical route và alias sunset plan
- Focused suite `service_ops.tests.test_soc_matrix` pass

**Không thuộc scope task này**

- Chuyển toàn bộ SOC domains sang canonical operator path
- Gỡ alias `/api/soc/*`
- Đổi semantics execution hay ownership writes

### T02 — Enforce broker SSOT

**Mục tiêu**

Loại bỏ mọi đường gọi provider trực tiếp trong core runtime ngoài adapter.

**Files dự kiến**

- `packages/core/backend/src/market_data/vnbroker_adapter.py`
- `packages/core/backend/src/data_ingest/tasks.py`
- `packages/core/backend/src/user_workspace/vnbroker_dnse_compat.py` nếu còn nằm trên active path
- focused tests tương ứng

**DoD**

- Grep không còn `from vnbroker`, `vnbroker.explorer`, `DNSEClient`, `Quote` ngoài adapter trên active runtime path
- `backfill_daily_prices` gọi adapter function thay vì import trực tiếp explorer module
- Provider roster sync với `provider_catalog`

### T03 — Unify execution semantics

**Mục tiêu**

Đưa operator/manual/scheduled scraping về cùng control-plane semantics.

**DoD**

- Không xuất hiện `scrape_coordinator_task` mới mang semantics trùng `run_scrape_cycle`
- Scheduled wrappers hoặc job dispatch phải dùng execution model thống nhất
- Run log/progress semantics không bị chia đôi

### T04 — Price + history cutover

**Mục tiêu**

Làm sạch primary price/history path để không còn legacy dependency hay provider bypass.

**DoD**

- `fetch_and_upsert_price_board`, `ingest_daily_prices`, `backfill_daily_prices` không dùng direct explorer imports
- `market_serving` price materialization dùng native data plane chuẩn
- Runtime test xác nhận refreshed core-api vẫn phục vụ data path

### T05 — Native signal materialization

**Mục tiêu**

Đưa whale/dark-flow/CVD về native facts thay vì legacy-first fallback.

**DoD**

- `materialize_whale_feed_aggregate` không còn ưu tiên legacy DB
- Không còn random/synthetic data generation trong production path
- Residual parity risk được ghi rõ nếu detector native chưa full parity

### T06 — Remove bridge dependencies

**Mục tiêu**

Loại bỏ bridge/runtime dependency còn sót cho scraping ownership.

**DoD**

- Không scraping endpoint nào còn phụ thuộc `LEGACY_BACKEND_URL`
- `legacy_readonly` không còn nằm trên steady-state scraping runtime path
- Write semantics được native hóa hoặc block rõ với expiry plan ngoài scope

### T07 — OpenAPI conformance

**Mục tiêu**

Chuẩn hóa contract endpoints của scraping/operator.

**DoD**

- Request schema, response schema, examples, status codes, field_errors đầy đủ
- List endpoints paginated
- 401/403/404/409/429 semantics đúng chuẩn
- Schema xuất hiện dưới `/core/v1/schema/`

### T08 — Consumer cutover

**Mục tiêu**

Chuyển caller sang canonical routes và chặn drift mới.

**DoD**

- Consumer chính dùng `/core/v1/operator/scraping/*`
- Docs và examples không còn dùng alias cũ cho flow mới
- Alias cũ có warning hoặc deprecation note rõ ràng

### T09 — Shadow run và decommission prep

**Mục tiêu**

Khóa evidence cho cutover sạch.

**DoD**

- Focused test suites pass
- Runtime rebuild/restart hoàn tất
- Shadow run/parity note đầy đủ
- Ledger, progress, module tree được sync

---

## 5. Validation gates toàn workstream

1. `service_ops.tests.test_soc_matrix`
2. `service_ops.tests.test_soc_tasks`
3. `service_ops.tests.test_soc_api_domain`
4. `packages/core/backend/tests/test_market_data_intraday_native.py`
5. Grep gate cho direct provider imports ngoài adapter
6. OpenAPI schema generation smoke
7. Runtime refresh của service bị ảnh hưởng
8. `module_tree_full.md` regenerated sau source change

---

## 6. Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Dựng coordinator thứ hai làm trùng Matrix | M | Khóa T03: reuse execution primitive hiện có |
| Native signal path chưa parity | H | T05 xây native path, T09 shadow run trước bridge removal |
| Consumer còn dùng alias cũ | M | T08 cutover có route inventory và deprecation note |
| Provider truth bị lệch do fallback seed universe | M | T02/T04 giới hạn degraded fallback, không dùng làm operator truth |
| Bridge removal quá sớm | M | Chỉ làm trong T06 sau khi ownership và native route đã ổn định |
