# EXECUTION REBASELINE: ENTERPRISE B2B MCP TRANSFORMATION

**Date:** 2026-05-01  
**Status:** Current-code aligned execution override  
**Applies to:** Toàn bộ bộ tài liệu enterprise transformation ngày 2026-05-01

---

## 1. Mục đích và thứ tự ưu tiên

Tài liệu này tồn tại để **neo lại bộ kế hoạch enterprise vào code hiện có** của VNInvest.

- Các tài liệu enterprise ngày 2026-05-01 vẫn đúng với vai trò **target-state architecture**.
- Khi có xung đột giữa target-state và thực tế code hiện tại, **thứ tự triển khai trong tài liệu này được ưu tiên**.
- Mục tiêu không thay đổi: tách bạch dần `core`, `web`, `opencore`, `vip-app`, `mobile`, đồng thời đưa `core` lên mức phục vụ hàng chục nghìn truy vấn dữ liệu.
- Điều thay đổi là **đường đi**: đi từ monolith hiện tại sang architecture mới bằng các bước nhỏ, có rollback, tái sử dụng tối đa nền móng đang chạy.

---

## 2. Baseline thực tế của code hiện tại

### 2.1 Deploy units và tổ chức repo hiện có

Hiện tại repo vẫn vận hành theo các đơn vị triển khai sau:

- `backend/` — Django + DRF + Channels + Celery, đang là lõi nghiệp vụ thật sự.
- `frontend/` — React web app hiện hành.
- `mobile-app/` — mobile surface riêng.
- `opennews-main/` — nguồn phụ trợ cho tin tức/sentiment.
- `infra/` — hạ tầng và deployment helpers.

**Thực tế quan trọng:** repo **chưa có** `packages/`, **chưa có** `shared/api-contracts/` ở cấp root, **chưa có** `buildTarget.js`, và chưa có bất kỳ boundary enforcement tự động nào cho mô hình `core/web/vip-app/mobile`.

### 2.2 Nền móng scale đã có sẵn trong core hiện tại

Code hiện có đã sở hữu nhiều thành phần có thể dùng làm bước đệm cho high concurrency:

- `backend/config/asgi.py` — đã chạy ASGI + Channels.
- `backend/config/settings.py` — đã có Redis channel layer, Redis Streams config, Celery beat schedules, throttling/limit knobs.
- `backend/portfolio/realtime/tick_producer.py` — đã push intraday ticks vào Redis Streams.
- `backend/portfolio/realtime/stream_consumers.py` — đã có consumer groups `db-writer`, `ws-broadcaster`, `alert-engine`.
- `backend/portfolio/tasks_realtime.py` và `backend/portfolio/tasks_maintenance.py` — đã có luồng collect, publish, consume, trim stream.
- `backend/config/health.py` — đã có health endpoints cho realtime và streams.

**Kết luận:** core chưa phải enterprise-ready, nhưng **không bắt đầu từ số 0**. VNInvest đã có sẵn một lõi realtime Redis-first đủ tốt để làm Phase 0-2 mà chưa cần nhảy ngay sang Kong hay ClickHouse.

### 2.3 Nền móng entitlement / OpenCore đã có sẵn

Repo hiện đã có khối entitlement và quota user-level:

- `backend/portfolio/opencore_api.py`
- `backend/portfolio/opencore_analytics.py`
- `backend/config/settings.py` với `OPEN_CORE_QUOTA_*`
- `frontend/src/context/PortfolioContext.jsx` với `userPlan`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/Can.jsx`

**Kết luận:** lớp `opencore` không nên được thiết kế như một greenfield subsystem riêng ngay từ đầu. Nên xem đây là **hạt giống entitlement layer** để tiến hóa sang tenant quota, commercial packaging, build gating và partner access.

### 2.4 Nền móng AI runtime đã có sẵn

Repo hiện đã có một trục AI configuration thật sự đang chạy:

- `backend/portfolio/models.py` với `AICommandCenterConfig` và `SystemAISettings`
- `backend/portfolio/serializers.py`
- `backend/portfolio/ai_runtime_config.py`
- `backend/portfolio/views_ai_runtime_stats.py`
- `frontend/src/pages/AICommandCenter.jsx`

**Kết luận:** lộ trình BYOK/BYOM phải **đi qua việc mở rộng trục hiện tại**, không nên bỏ qua nó để tạo một schema hoàn toàn mới ngay từ bước đầu.

---

## 3. Các quyết định rebaseline bắt buộc

### 3.1 Không di chuyển thư mục vật lý ở Phase đầu

Trong code hiện tại, move `backend/` sang `packages/core/` và `frontend/` sang `packages/web/` ngay lập tức sẽ tạo rủi ro lớn cho:

- Docker compose paths
- import/runtime settings
- IDE/workspace scripts
- test commands
- operator workflow đang chạy

**Rebaseline:**

- Phase đầu chỉ làm **boundary-first**, không làm **folder-move-first**.
- `packages/` là **đích đến vật lý**, không phải bước khởi đầu.
- PR đầu tiên của transformation phải tạo **contracts, flags, ownership rules, API seams**, không phải rename hàng trăm đường dẫn.

### 3.2 Giữ Redis-first async stack trước khi nghĩ tới RabbitMQ

Tài liệu target-state có đề cập mở rộng queueing. Tuy nhiên code hiện tại đã dùng:

- Redis cho Celery broker/result
- Redis cho cache
- Redis cho Channels
- Redis Streams cho realtime tick pipeline

**Rebaseline:**

- Chưa đưa RabbitMQ vào phase đầu.
- Chỉ cân nhắc RabbitMQ khi có bằng chứng rõ ràng rằng Redis-based Celery không còn đáp ứng QoS, retry isolation hoặc queue separation mong muốn.
- Phase đầu nên tối ưu cái đang có: stream batching, fanout, materialized facts, cache locality, queue split bằng naming/runtime knobs.

### 3.3 Giữ PostgreSQL + materialized facts trước khi đưa ClickHouse vào

ClickHouse là hướng đi hợp lý cho OLAP lớn, nhưng hiện tại codebase chưa có:

- database router cho ClickHouse
- query abstraction dual-store
- migration strategy cho cold/hot path
- operational playbook cho backup/retention/replay hai hệ DB

**Rebaseline:**

- Trước tiên tối ưu `core` bằng PostgreSQL + Redis cache + Redis Streams + facts/materialization tables.
- Chỉ đưa ClickHouse vào khi các truy vấn raw ticks vẫn vượt ngưỡng sau khi đã áp dụng:
  - partition / retention rõ ràng,
  - facts-first path,
  - session summaries,
  - cached bucket/materialization,
  - selective forensic windows.

### 3.4 Internal realtime tiếp tục đi bằng WebSocket; SSE dành cho external AI stream sau

Hiện tại VNInvest đã có WebSocket runtime thật sự cho feed thị trường. Do đó:

- Internal web realtime nên tiếp tục tái sử dụng Channels/WebSocket.
- SSE nên được coi là **transport mục tiêu cho external orchestration stream / VIP client contract**, không phải lý do để rewrite ngay toàn bộ internal live path.

### 3.5 Kong không phải bước đầu tiên của partner access

Kong là công cụ đúng khi external partner traffic đủ lớn. Nhưng ở trạng thái code hiện tại, thứ còn thiếu trước Kong là:

- tenant model / partner account model
- PAT/API key issuance
- throttling semantics per tenant
- MCP route contract ổn định
- audit log cho external data consumption

**Rebaseline:**

- Bắt đầu bằng Django + DRF throttling + Redis-backed quota + NGINX edge.
- Chỉ đưa Kong vào sau khi partner API thực sự hình thành và route contract đã đóng.

### 3.6 OpenCore là lớp entitlement trước, package riêng sau

`opencore` hiện nên được hiểu là:

- plan/quota/billing primitives,
- feature boundary enforcement,
- packaging rules,
- community/self-host lane policy.

Nó **chưa phải** một deployable riêng ở phase đầu.

### 3.7 VIP app nên bắt đầu bằng “thin local control plane”

VIP app giai đoạn đầu không cần ôm toàn bộ backlog quản trị ngay.

**Mốc khả thi đầu tiên:**

- local credential store,
- local audit/chat log,
- local prompt overrides,
- PAT connection tới core,
- thin orchestrator gọi MCP/core API.

Sub-user management, branding suite, cost analytics chi tiết là phase sau khi PAT + MCP + AI orchestration path đã ổn định.

---

## 4. Kiến trúc chuyển đổi khả thi theo phase

### Phase 0 — Boundary-first trên cấu trúc hiện tại

**Mục tiêu:** Chuẩn hóa ranh giới logic mà không di chuyển thư mục.

**Làm ngay:**

- Giữ `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` là canonical paths.
- Tạo `shared/api-contracts/` và `shared/constants/` ở cấp root nếu cần dùng chung contracts, nhưng không move runtime code.
- Xác định 4 boundary logic trên code hiện có:
  - `core-runtime` = Django backend + realtime + data ops
  - `web-runtime` = React app hiện tại
  - `opencore-entitlements` = plan/quota/billing/feature access
  - `vip-surface` = future local control plane, chưa triển khai rộng
- Thiết lập policy trong docs/CI/code review: không import chéo kiểu “UI gọi trực tiếp logic nội bộ ngoài API/service seam”.

**Exit criteria:**

- Có contract inventory cho market data, whale analytics, AI config, entitlements.
- Có build-flag strategy thống nhất cho frontend hiện tại.
- Không cần rename thư mục để bắt đầu các slice enterprise tiếp theo.

### Phase 1 — Core enterprise access trên monolith hiện tại

**Mục tiêu:** Biến Django backend hiện tại thành “core-ready monolith”.

**Làm ngay:**

- Thêm tenant / partner access model trong backend hiện tại.
- Reuse `DPIQuotaTracker`, license/billing primitives để tiến hóa sang tenant quota và PAT accounting.
- Tạo MCP/core API wrapper mỏng quanh service layer hiện có, thay vì nhân bản logic.
- Đưa rate limiting và audit logging vào external data routes ngay trong Django trước.

**Không làm ngay:**

- Không dựng `vip-app` đầy đủ.
- Không đưa Kong trước khi PAT/quota/routes đã chứng minh đúng.

### Phase 2 — AI runtime transition dựa trên AICommandCenter hiện có

**Mục tiêu:** Từ AI advisory tĩnh hiện tại tiến hóa sang multi-provider và orchestrator.

**Làm ngay:**

- Mở rộng `AICommandCenterConfig` hoặc thêm credential child-model tương thích ngược.
- Giữ `resolve_ai_runtime_config()` làm transition seam.
- Tách tool wrappers gọi SSOT hiện có trong `core`.
- Thêm external streaming endpoint cho orchestrator sau khi tool contracts ổn định.

**Không làm ngay:**

- Không thay toàn bộ config runtime hiện có bằng schema greenfield trong bước đầu.

### Phase 3 — Build variants và OpenCore packaging

**Mục tiêu:** Tách lane Community / SaaS / VIP trong cùng frontend source trước khi move sang `packages/web/`.

**Làm ngay:**

- Thêm `frontend/src/config/buildTarget.js` ngay trong cấu trúc hiện có.
- Tận dụng `PortfolioContext`, `ProtectedRoute`, `Can` để gate route và component.
- Gắn feature boundary docs với entitlement/runtime plan hiện có.

**Exit criteria:**

- Frontend có thể build ra các lane khác nhau từ source hiện tại.
- VIP/admin pages có thể được gate mà không cần clone frontend.

### Phase 4 — VIP pilot với thin local orchestrator

**Mục tiêu:** Có bản self-host đầu tiên mà vẫn bảo vệ IP của core.

**Làm ngay:**

- Tạo local control plane nhỏ cho VIP: PAT, local AI keys, local prompt overrides, local logs.
- Core chỉ trả data qua API/MCP contract.
- AI orchestration chạy local hoặc edge-side, không kéo business logic nội bộ của core ra ngoài.

### Phase 5 — Physical repo/package restructure

**Chỉ bắt đầu khi đồng thời đúng các điều kiện sau:**

- API contracts giữa core, web, vip-app đã ổn định.
- Build variants đã hoạt động trong frontend hiện tại.
- Có ít nhất 1 consumer thực tế của external core API hoặc VIP self-host.
- CI/deployment path đã tách được logic theo boundaries.

Khi đó mới move dần sang `packages/core`, `packages/web`, `packages/mobile`, `packages/vip-app`.

### Phase 6 — Heavy-scale infra uplift theo trigger đo được

**Kong trigger:** external tenants thực sự chạy production, cần route governance, API key rotation, per-tenant analytics.

**ClickHouse trigger:** raw tick analytics vẫn là bottleneck sau khi đã tối ưu facts/materialization/cache trên PostgreSQL.

**Queue topology trigger:** Redis-based Celery không còn đáp ứng latency/throughput isolation mong muốn.

---

## 5. Tập trung vào `core`: runtime services, enrichment, và API readiness

> [!IMPORTANT]
> Phần này là executive summary cho `core`. Blueprint chi tiết về boundary, tổ chức CSDL, services architecture và global APIs nằm tại [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md).
>
> Bộ companion docs để hoàn thiện `core` theo hướng contract-first/schema-last gồm:
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)
> - [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)
> - [ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)
> - [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)
> - [ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md)

### 5.1 Core runtime deploy units phải được giữ làm SSOT trong phase đầu

| Deploy unit hiện có | Vai trò trong `core` | Nhiệm vụ chính | Hướng xử lý đúng |
|---|---|---|---|
| `db` | PostgreSQL source-of-record | Lưu dữ liệu giao dịch, profile, entitlement, signal events, billing/quota state | Phải giữ làm SSOT; tối ưu bằng partition, retention và read models trước khi nghĩ đến dual-store |
| `redis` | Runtime bus dùng chung | Cache, Celery broker/result backend, Channels layer, Redis Streams | Phải giữ; ưu tiên chuẩn hóa keyspace, TTL, queue naming và isolation trước khi thêm substrate mới |
| `backend` | ASGI API + auth + quota + WebSocket | Phục vụ REST APIs, operator APIs, health endpoints, realtime websocket | Tiếp tục là `core-ready monolith` ở phase đầu; chưa thay bằng API gateway mesh |
| `celery_worker` | Compute engine nền | Chạy prefetch, realtime collect, signal detection, off-peak ingest, enrichment, quota/billing jobs | Phải giữ; về sau có thể tách queue pools theo domain thay vì tách service vật lý quá sớm |
| `celery_beat` | Scheduler trung tâm | Kích hoạt prefetch, cleanup, lifecycle, detection, ingest, enrichment | Phải giữ; lịch chạy hiện tại đã là nhịp điều phối thật của `core` |

### 5.2 Danh sách background services hiện đang chạy và nhiệm vụ

| Nhóm service | Task / pipeline hiện có | Nhiệm vụ hiện tại | Định hướng enterprise |
|---|---|---|---|
| Realtime universe + prefetch | `build_realtime_symbol_universe_snapshot`, `schedule_realtime_prefetch_shards`, `prefetch_realtime_ticker_shard` | Chọn universe `hot/warm/cold`, áp budget upstream, làm ấm `ticker:*` cache theo shard | Phải giữ và tối ưu; đây là nền của mọi read path cache-first |
| Realtime collector/publisher | `collect_and_publish_realtime` | Thu dữ liệu intraday theo lock, bỏ qua path thừa khi prefetch còn tươi, đẩy ticker/whale/advisory events | Phải giữ; về sau có thể tách ingest và fanout thành queue pools riêng |
| Redis stream consumers | `run_stream_consumer_batch` cho `db-writer`, `ws-broadcaster`, `alert-engine`; `trim_streams` | Persist stream vào DB, broadcast websocket, chạy alert engine, giữ stream bounded | Phải giữ; đây là xương sống realtime của `core` hiện tại |
| Lifecycle maintenance | `run_intraday_side_backfill_apply`, `cleanup_old_intraday_ticks`, `cleanup_old_signal_service_runs` | Recompute, retention cleanup, cache invalidation, giữ dữ liệu thô không phình vô hạn | Phải giữ; cần tiếp tục facts-first và retention-first |
| Off-peak ingest | `offpeak_vnstock_ingest` | Hút dữ liệu lịch sử/reference ngoài giờ giao dịch để giảm áp lực giờ mở cửa | Nên mở rộng; đây là đường rẻ nhất để làm giàu dữ liệu an toàn |
| Order-flow / dark-flow detection | `detect_and_store_order_flow` | Phát hiện dark-flow, bucketize tín hiệu dòng tiền, phục vụ operator/runtime surfaces | Phải giữ; cần dịch dần sang facts/materialization thay vì đọc raw nhiều lần |
| Global whale detection + distribution | `detect_and_store_global_whale_alerts`, `distribute_whale_alert_event` | Quét universe, tạo whale events, tạo forensic windows, phát tán alert | Phải giữ; candidate tách fanout ngoài sau khi partner traffic đủ lớn |
| Global screener materialization | `run_global_screener_scheduled_task`, `auto_generate_advisories_for_all_tracked` | Precompute market snapshot, match active rules, broadcast kết quả, queue advisory | Phải tối ưu; nên chuyển hẳn sang read-model/materialized snapshot rõ ràng hơn |
| OpenCore quota / billing lifecycle | `sync_all_dpi_licenses`, `reset_monthly_quotas`, `generate_monthly_invoices`, `create_analytics_snapshots`, `check_overquota_users`, `process_plan_lifecycle_transitions` | Duy trì entitlement, quota, billing và analytics cho packaging thương mại | Phải giữ trong `core`; đây là nền B2B/commercialization thật sự |
| Reference/news enrichment | `sync_stock_profiles_from_snapshot`, `generate_all_portfolio_news_digests_task`, `sync_news_sentiment`, `compute_watchlist_indicators`, `verify_signals_daily` | Đồng bộ profile, digest tin tức, sentiment, chỉ báo và kiểm chứng tín hiệu | Nên mở rộng; đây là lớp làm giàu dữ liệu có giá trị user-facing nhanh |

### 5.3 Phân loại thực tế để đưa `core` đi đúng hướng

- Phải giữ trong monolith `core` ở phase đầu: ASGI API, Redis cache/streams, prefetch scheduler, stream consumers, quota-billing lifecycle, whale/order-flow detection, health/ops endpoints.
- Phải tối ưu trước khi mở rộng B2B: `price-board` fetch-on-demand, `stock workspace overview` composite assembly, whale analytics cold path, các fallback còn chạm upstream theo request.
- Chỉ nên tách thành service riêng ở phase sau: external notification fanout, partner projection APIs, AI orchestrator runtime, off-peak ingest pools, heavy analytics stores.

### 5.4 Hướng phát triển bổ sung services để làm giàu dữ liệu hữu ích nhanh nhất có thể

1. `core_symbol_snapshot_materializer`
  Precompute read model cho `stocks/:symbol/overview`: giá hiện tại, reference/open/high/low, 52W high/low, company profile, exchange, liquidity summary. Đây là service nên làm đầu tiên vì hiện tại `get_stock_workspace_overview()` còn fan-out nhiều upstream call trên cache miss và chỉ cache ngắn.
2. `session_facts_materializer`
  Tạo session/day facts cho từng mã: tổng giá trị mua/bán, CVD, imbalance, whale count, order-flow markers, bucket summary, selected-session metadata. Service này dùng lại được cho Whale Alerts, Stock Detail, partner APIs và AI prompt context.
3. `sector_regime_snapshot_service`
  Làm giàu dữ liệu theo ngành/thị trường: breadth, leaders/laggards, peer rank, regime score, sector money-flow. Đây là lớp có giá trị cao cho cả web lẫn B2B nhưng chi phí vận hành thấp hơn việc mở thêm nhiều raw APIs.
4. `fundamental_event_enrichment_service`
  Chuẩn hóa và cache hóa ratios, insider deals, dividend, ownership/fundamental delta, earnings calendar theo lịch off-hours. Nên chạy ngoài giờ và phát hành facts ổn định thay vì kéo trực tiếp từ upstream ở request time.
5. `news_impact_linker_service`
  Gắn news/sentiment với symbol, sector, session và event-score; xuất ra digest facts dùng chung cho AI, watchlists và partner feeds. Điều này tận dụng tốt pipeline news/sentiment hiện có thay vì xây nhánh mới.
6. `partner_projection_service`
  Không phải enrichment thô, nhưng là bước bắt buộc để B2B khả thi: xuất stable JSON contracts từ các bảng facts/materialized snapshots thay vì expose trực tiếp các API composite nội bộ đang còn nhiều fallback.

### 5.5 Đánh giá thẳng về tốc độ của các global system APIs hiện tại

Kết luận ngắn: **chưa thể nói toàn bộ global APIs hiện tại đủ để phục vụ nhiều nghìn concurrent users**. Nhóm API cache-first cho ticker đã ở trạng thái khá tốt; nhóm API composite hoặc còn phụ thuộc upstream tại request time thì chưa đủ an toàn để mở rộng mass traffic.

| API / read path | Path hiện tại | Mức sẵn sàng | Nhận định thực tế | Việc phải làm trước khi mở lớn |
|---|---|---|---|---|
| `/api/realtime/tickers/` | `get_realtime_tickers()` | Mạnh | Dùng `cache.get_many`, có `session_close` fallback, phù hợp fan-out lớn nếu prefetch khỏe | Giữ cache-first và giám sát freshness/prefetch health |
| `/api/realtime/ticker/<symbol>/` | `get_realtime_ticker()` | Mạnh | Cache-first, degrade có kiểm soát, hợp với traffic cao hơn hầu hết read paths khác | Giữ nguyên pattern; không để miss path trở thành mặc định |
| `/api/realtime/intraday/<symbol>/` | `get_intraday_matched()` | Trung bình | Mạnh khi Redis stream hoặc last-good cache còn ấm; yếu hơn khi phải rơi xuống DB/vnstock fallback | Tạo session facts store và kéo dài read-model lifetime thay vì chỉ cache ngắn |
| `/api/realtime/price-board/<symbol>/` | `get_price_board()` | Yếu | Cache miss còn gọi upstream trực tiếp; đây không phải design phù hợp cho mass concurrency | Phải có `price_board_snapshot` service/materializer trước khi mở rộng lớn |
| `/api/stock-management/stocks/<symbol>/overview/` | `get_stock_workspace_overview()` | Yếu | Trên miss còn fan-out nhiều fetch (`price_board`, `history`, `listing`) và chỉ cache `12s`; chưa phù hợp cho nhiều nghìn users | Ưu tiên làm `core_symbol_snapshot_materializer` và tách user overlay khỏi shared snapshot |
| `/api/portfolio/whale/analytics/<symbol>/` | `build_whale_analytics_snapshot()` | Trung bình | Đã tốt hơn nhờ shared bucket-facts cache và cache revision, nhưng cold path vẫn build facts từ `IntradayTick` | Chuyển sang facts-first materialization lâu dài cho selected session |

DRF throttling trong `market_views.py` là lớp bảo vệ cần thiết, nhưng throttling **không thay thế** cho việc tối ưu read path. Nếu một endpoint vẫn fan-out sang upstream hoặc scan dữ liệu thô ở cache miss, endpoint đó chưa thể coi là B2B-ready chỉ vì đã có rate limit.

**Hàm ý thực thi:** partner/global APIs nên chỉ được dựng trên các lớp read model sau khi đã materialize xong: ticker snapshot, symbol snapshot, session facts, sector snapshot. Không nên lấy `stock workspace overview` hay `price-board` hiện tại làm API đối ngoại hàng loạt theo nguyên trạng.

### 5.6 Pattern quốc tế cần áp dụng cho `vip-app` access layer

Để phần `core` khả thi theo chuẩn B2B SaaS/API platform thực tế, `vip-app` nên đi theo 4 pattern đã được chứng minh rộng rãi:

1. **Fine-grained machine tokens, không dùng personal token dài hạn**
  `vip-app` phải gọi `core` bằng service account PAT của tenant, không dùng token cá nhân của user vận hành làm credential nền.
2. **Entitlements tách khỏi metering**
  Gói/plan quyết định tenant có được dùng `signals`, `ai`, `bulk export`, `operator APIs` hay không; usage meter quyết định tenant đã dùng bao nhiêu và có bị overage hay không.
3. **Quota nhiều lớp**
  Tách riêng feature gate, request throttling, monthly quota và budget guard; không gom tất cả vào một khái niệm “quota”.
4. **Billing từ usage aggregates, không từ raw request logs**
  Hóa đơn của `vip-app` phải được dựng từ meter aggregates ổn định theo giờ/ngày, thay vì scan logs request thô.

Hàm ý cho execution plan hiện tại:

- `core` phải bổ sung `CoreServiceAccount`, `CoreAccessPolicy`, `CoreTokenSecretVersion`, `CoreUsageMeter`, `CoreUsageAggregateHourly`, `CoreBillingAccount`.
- `vip-app` cần các control-plane APIs riêng cho token rotation, quota visibility, usage visibility và invoice visibility.
- Đường đi đúng là `tenant -> service account -> PAT -> versioned partner APIs`, không phải `local user -> generic API key -> mọi route`.

### 5.7 Contract-first và schema-last mới là đường triển khai thực tế

Nếu bám theo các hệ API platform production đang hoạt động, VNInvest chưa nên nhảy vào implementation public APIs hay tách schema CSDL khi chưa chốt contract pack.

`Contract pack` tối thiểu phải có:

- resource catalog,
- endpoint matrix,
- field dictionary,
- auth and scope matrix,
- error model,
- pagination semantics,
- quota and meter semantics,
- additive vs breaking change policy.

Thứ tự đúng nên là:

1. chốt contract,
2. chốt serving model và read-model ownership,
3. rồi mới quyết định thêm bảng hay tách schema vật lý.

Điều này đặc biệt quan trọng với `vip-app`, vì nếu schema tách trước contract thì token, billing, quota và tenant semantics sẽ rất dễ drift giữa `core` và consumer.

---

## 6. Mapping mục tiêu `core / web / opencore / vip-app / mobile` vào repo hiện tại

| Boundary mục tiêu | Neo vào repo hiện tại | Ý nghĩa thực tế trong phase đầu |
|---|---|---|
| `core` | `backend/` + `opennews-main/` + phần infra/data ops liên quan | Giữ nguyên monolith deploy unit, nhưng tách bằng API seam và ownership |
| `web` | `frontend/` | Thêm build flags và route gating trước, chưa move sang `packages/web/` |
| `opencore` | `backend/portfolio/opencore_*` + frontend plan gating | Dùng như entitlement layer nội bộ trước khi packaging riêng |
| `vip-app` | Chưa có runtime thật | Phase đầu chỉ là thin local control plane + orchestrator |
| `mobile` | `mobile-app/` | Giữ độc lập, tiếp tục đi qua REST/API contracts |

---

## 7. Override matrix cho bộ tài liệu ngày 2026-05-01

| Tài liệu | Cách hiểu mới sau rebaseline |
|---|---|
| `HIGH_CONCURRENCY_TECH_STACK_PROPOSAL_20260501.md` | Là target-state tech stack. Thứ tự áp dụng phải đi qua Redis/PostgreSQL/Channels foundations hiện có trước. |
| `REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md` | `packages/` là đích đến có điều kiện, không phải PR đầu tiên. |
| `CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md` | Là map thư mục mục tiêu, không phải chỉ thị move ngay. |
| `IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md` | Phải mở rộng AI config/runtime hiện có trước khi giới thiệu schema/route greenfield. |
| `VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md` | Là phase-later backlog. Thin local control plane đi trước full admin suite. |
| `OPEN_CORE_*` docs | Gắn với entitlement layer hiện có, không giả định package/deploy unit riêng ngay lập tức. |

---

## 8. Kết luận thực thi

Nếu bám vào code hiện tại, đường nâng cấp khả thi của VNInvest là:

1. **Boundary-first, không move folder trước.**
2. **Core-first trên Django monolith hiện tại.**
3. **Redis/PostgreSQL/Channels-first trước khi đưa infra nặng hơn.**
4. **Mở rộng AICommandCenter và OpenCore hiện có thay vì bỏ qua chúng.**
5. **Build variants trước, `packages/` sau.**
6. **VIP self-host bắt đầu bằng thin local orchestrator, không phải mini-platform hoàn chỉnh ngay từ ngày đầu.**

Theo cách này, mục tiêu enterprise vẫn giữ nguyên nhưng lộ trình bớt rủi ro, bám sát repo hiện tại và tạo ra các điểm dừng kiểm chứng rõ ràng cho đội code.