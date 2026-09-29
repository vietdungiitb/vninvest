# HANDOFF MASTER — Scraping System SaaS-Native Cutover

**Ngày**: 2026-05-14  
**Trạng thái**: READY FOR EXECUTION  
**Scope**: Scraping system, broker access SSOT, operator contract canonicalization, legacy bridge removal cho market data ingestion

---

## 1. Mục tiêu bàn giao

Tài liệu này là master coordination cho workstream chuyển `scraping system` sang kiến trúc SaaS native sạch với các kết quả bắt buộc:

1. `packages/core/backend/src/market_data/vnbroker_adapter.py` trở thành cổng broker duy nhất cho mọi truy cập provider từ core runtime.
2. `service_ops` trở thành control plane thống nhất cho manual operator scraping; không tạo coordinator thứ hai song song với Matrix hiện có.
3. Scheduled ingest, backfill, warmup, whale/CVD materialization được đưa về execution model thống nhất, không còn bypass adapter hoặc bypass orchestration.
4. Các route scraping/operator có canonical namespace dưới `/core/v1/operator/scraping/*` với OpenAPI contract đúng chuẩn.
5. Legacy read bridge, legacy DB dependency, compat runtime và write-through bridge liên quan scraping phải có lộ trình sunset rõ ràng và bị loại bỏ trước khi khai báo complete.

---

## 2. Tài liệu trong bundle này

1. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_HANDOFF_MASTER_20260514.md`
2. `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
3. `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
4. `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`

Tài liệu historical liên quan:

1. `docs/SCRAPING_SYSTEM_AUDIT_AND_PLAN_COORDINATED_PARALLEL_20260515.md` — chỉ còn là audit đầu vào và historical context, không còn là execution SSOT.
2. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` — hard constraints SaaS migration vẫn có hiệu lực.
3. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` — hard constraints API contract vẫn có hiệu lực.

---

## 3. Quyết định đã khóa

1. Không dựng `scrape_coordinator_task` mới nếu nó trùng vai trò với `run_scrape_cycle` + `scrape_cell_task` hiện có.
2. `Matrix` là operator/manual execution surface chuẩn cho scraping theo provider và symbol-group; chỉ được mở rộng hoặc refactor, không được song song hóa bằng control plane thứ hai.
3. `vnbroker_adapter` là SSOT duy nhất cho broker access. Mọi import trực tiếp `vnbroker`, `vnbroker.explorer.*`, `Quote`, `DNSEClient` ngoài adapter là blocker.
4. Product read path phải ưu tiên facts/materialized data. Scraping system là control plane cho ingestion, không phải universal synchronous read path cho mọi feature runtime.
5. Provider roster chuẩn của workstream này là `VCI`, `KBS`, `DNSE`. Các provider khác không thuộc scope triển khai.
6. Không được giữ `legacy_readonly` hoặc `LEGACY_BACKEND_URL` trên primary execution path sau khi cutover scraping complete.
7. Canonical route cho operator scraping phải nằm dưới `/core/v1/operator/scraping/`; các alias `/api/soc/*` hoặc `/api/admin-ops/*` chỉ được giữ có sunset plan.

---

## 4. Trạng thái hiện tại tóm tắt

### Điểm đã có

1. `Matrix` cycle/cell native đã tồn tại trong `service_ops`.
2. `provider_catalog` đã chuẩn hóa provider matrix về `vci/kbs/dnse`.
3. `SOCBaseView` đã có standardized error envelope và pagination helper.
4. Core API đã mount schema và swagger.

### Điểm còn drift

1. `data_ingest.tasks.backfill_daily_prices` vẫn import thẳng `vnbroker.explorer.{provider}.quote`.
2. `signal_intelligence.materializers.materialize_whale_feed_aggregate` vẫn còn legacy-first path và native synthetic fallback.
3. `market_data.vnbroker_adapter` vẫn chứa fallback roster rộng hơn `vci/kbs/dnse`.
4. `admin_ops` vẫn còn bridge/write-block semantics dựa trên `LEGACY_BACKEND_URL`.
5. Canonical operator scraping namespace chưa tồn tại đầy đủ cho consumer cutover.

---

## 5. Thứ tự ưu tiên khi có xung đột

1. `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
2. `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
3. `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
4. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
5. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
6. `AGENTS.md`
7. `quality/QUALITY.md`

---

## 6. Evidence obligation

Mỗi slice trong workstream này phải có đủ:

1. Danh sách file đổi.
2. Focused validation command và kết quả.
3. Payload snapshot nếu chạm route/contract.
4. Runtime refresh evidence nếu chạm code runtime.
5. Residual risk note.
6. Đồng bộ `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, và `module_tree_full.md` nếu có thay đổi source.

---

## 7. Điều kiện đủ để khai báo workstream complete

1. Không còn direct provider import ngoài adapter trong `packages/core/backend/src`.
2. Không còn legacy-first scraping path trên price/history/intraday/whale execution flow.
3. OpenAPI schema xuất đầy đủ canonical scraping/operator routes với semantics chuẩn.
4. Alias `/api/soc/*` hoặc `/api/admin-ops/*` của scraping có sunset plan hoặc đã gỡ khỏi runtime active path.
5. Shadow run đạt parity chấp nhận được trên các flow bắt buộc trước khi decommission legacy dependencies.
6. Ledger, progress, module tree và residual risks đã được cập nhật đầy đủ.
