# EXECUTION REBASELINE: ENTERPRISE B2B MCP TRANSFORMATION

**Date:** 2026-05-01  
**Updated:** 2026-05-02 - Owner approved packages-first parallel migration  
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

**Kết luận:** `opencore` khong nen duoc thiet ke nhu mot greenfield backend truth rieng. Huong dung la xem day la **hat giong entitlement/commercial lane** de tien hoa thanh `packages/opencore` - mot package distribution va upgrade funnel dung lai primitives cua `core`.

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

### 3.1 Không move legacy folders trực tiếp; `packages/` là track song song

Trong code hiện tại, move `backend/` sang `packages/core/` và `frontend/` sang `packages/web/` ngay lập tức sẽ tạo rủi ro lớn cho:

- Docker compose paths
- import/runtime settings
- IDE/workspace scripts
- test commands
- operator workflow đang chạy

**Rebaseline:**

- Không rename hoặc bulk-move các thư mục legacy làm bước khởi đầu.
- Tạo `packages/` và `shared/` sớm để làm **implementation track mới** theo mô hình song song.
- `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` tiếp tục giữ runtime đang chạy, reference semantics và rollback lane cho tới cutover.
- Chỉ cutover khi `packages` đã đạt parity, validation gates và readiness rõ ràng; sau đó mới decommission legacy runtime.

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

### 3.6 OpenCore là package distribution/commercial, nhưng truth vẫn nằm ở `core`

`opencore` hiện nên được hiểu là:

- plan/quota/billing primitives,
- feature boundary enforcement,
- packaging rules,
- community/self-host lane policy,
- distribution/activation/upgrade funnel package.

`opencore` co the va nen tro thanh mot package rieng trong package track, nhung:

- khong duoc tu giu entitlement/quota/billing truth rieng,
- khong duoc fork frontend source khoi `web`,
- khong duoc tro thanh backend platform thu hai.

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

### Phase 0 — Governance freeze và package boundaries

**Mục tiêu:** Chốt mô hình `packages-first parallel migration` mà không phá runtime đang chạy.

**Làm ngay:**

- Đóng băng mở rộng kiến trúc trong `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/`; các path này chỉ nhận hotfix hoặc parity fixes khi thật sự cần.
- Chốt ownership, contract inventory, build-target model, parity evidence và decommission rules.
- Xem legacy runtime là reference system cho semantics và rollback.

**Exit criteria:**

- Owner đã chốt execution model song song.
- Có cutover gates và evidence model cho từng package track.

### Phase 1 — Tạo `packages/` và `shared/` như implementation track mới

**Mục tiêu:** Dựng workspace mới cho kiến trúc đích mà không bulk-move legacy folders.

**Làm ngay:**

- Tạo `packages/core`, `packages/web`, `packages/mobile`, `packages/vip-app`, `shared/api-contracts`, `shared/constants`.
- Bootstrap manifest, workspace config, compose/dev helpers cho track mới.
- Giữ nguyên runtime hiện hành để tiếp tục vận hành và làm lane đối chiếu.

**Exit criteria:**

- Có package tree tối thiểu để bắt đầu implementation theo boundaries mới.
- CI/workspace có thể nhìn thấy cả legacy track và package track.

### Phase 2 — Build `packages/core` trên các seam đã được chứng minh

**Mục tiêu:** Dựng `packages/core` như core-ready monolith mới, bám theo semantics đã chứng minh từ runtime hiện tại.

**Làm ngay:**

- Thực thi tenant / partner access, PAT, quota, billing, capability snapshot trong `packages/core`.
- Dựng core serving models: symbol snapshot, session facts, partner APIs, AI runtime contracts.
- Tiếp tục ưu tiên Redis/PostgreSQL/Channels/Streams-first trước hạ tầng nặng hơn.

**Không làm ngay:**

- Không đưa Kong vào trước khi partner routes và quota semantics ổn định.
- Không đưa ClickHouse vào trước khi facts/materialization path đã chứng minh không đủ.

### Phase 3 — Build `packages/web` và `packages/vip-app`

**Mục tiêu:** Dựng shared shell và thin local control plane hoàn toàn trong `packages`.

**Làm ngay:**

- Xây `packages/web` với build targets, route catalog, capability bootstrap, adapters cho `core` và `vip-app`.
- Xây `packages/vip-app` với local auth, secret vault, prompt studio, local API gateway và usage analytics tối thiểu.
- Giữ rule bất biến: VIP không có frontend riêng, browser VIP không cầm PAT.

**Exit criteria:**

- SaaS/VIP builds chạy từ `packages/web`.
- VIP browser đi qua `packages/vip-app` local APIs thay vì gọi thẳng `core`.

### Phase 4 — Parity verification và pilot rollout

**Mục tiêu:** Chứng minh package track đủ ổn định để thay legacy runtime.

**Làm ngay:**

- So sánh payload, route behavior, auth flow, capability gating và UX flows giữa legacy và `packages`.
- Chạy focused suites theo workstream và thu evidence parity.
- Nếu cần, chạy pilot hoặc shadow traffic trước cutover.

**Exit criteria:**

- Contracts ổn định.
- Focused tests/builds pass.
- Runbook cutover/rollback đã sẵn sàng.

### Phase 5 — Cutover sang `packages` và decommission legacy runtime

**Mục tiêu:** Chuyển runtime chính sang kiến trúc mới và loại bỏ kiến trúc cũ.

**Làm ngay:**

- Chuyển compose, CI, workspace, scripts và deployment sang `packages/*`.
- Đánh dấu legacy folders là read-only fallback trong thời gian ổn định ngắn.
- Sau khi cutover ổn định, xóa legacy runtime paths và tài liệu/scripts bám đường cũ.

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

### 5.1 Legacy runtime deploy units phải được giữ làm reference SSOT trong giai đoạn song song

| Deploy unit hiện có | Vai trò trong `core` | Nhiệm vụ chính | Hướng xử lý đúng |
|---|---|---|---|
| `db` | PostgreSQL source-of-record | Lưu dữ liệu giao dịch, profile, entitlement, signal events, billing/quota state | Phải giữ làm SSOT; tối ưu bằng partition, retention và read models trước khi nghĩ đến dual-store |
| `redis` | Runtime bus dùng chung | Cache, Celery broker/result backend, Channels layer, Redis Streams | Phải giữ; ưu tiên chuẩn hóa keyspace, TTL, queue naming và isolation trước khi thêm substrate mới |
| `backend` | ASGI API + auth + quota + WebSocket | Phục vụ REST APIs, operator APIs, health endpoints, realtime websocket | Tiếp tục là runtime đang chạy và nguồn đối chiếu semantics cho tới khi `packages/core` cutover; chưa thay bằng API gateway mesh |
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

| Boundary mục tiêu | Legacy reference runtime | Package track da duoc phe duyet | Ý nghĩa thực tế trong giai đoạn song song |
|---|---|---|---|
| `core` | `backend/` + `opennews-main/` + phần infra/data ops liên quan | `packages/core/` | Legacy giữ vai trò runtime thật + source đối chiếu; implementation mới đi vào `packages/core/` |
| `web` | `frontend/` | `packages/web/` | Legacy frontend chỉ là reference/fallback; shared shell mới được xây trong `packages/web/` |
| `opencore` | `backend/portfolio/opencore_*` + frontend plan gating | `packages/opencore/` + `packages/web` community build + `packages/core` commercial contracts | Reuse semantics entitlement hiện có, nhưng đóng gói thành package funnel/distribution riêng trong package track mới |
| `vip-app` | Chưa có runtime thật | `packages/vip-app/` | Thin local control plane + orchestrator được dựng greenfield trong package track |
| `mobile` | `mobile-app/` | `packages/mobile/` | Có thể migration sau khi `core/web/vip-app` đã ổn định hơn |

---

## 7. Override matrix cho bộ tài liệu ngày 2026-05-01

| Tài liệu | Cách hiểu mới sau rebaseline |
|---|---|
| `HIGH_CONCURRENCY_TECH_STACK_PROPOSAL_20260501.md` | Là target-state tech stack. Thứ tự áp dụng phải đi qua Redis/PostgreSQL/Channels foundations hiện có trước. |
| `REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md` | `packages/` là implementation track song song đã được owner chấp nhận; không bulk-move legacy folders trước. |
| `CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md` | Là map thư mục mục tiêu và workspace plan cho package track, không phải blind move của runtime cũ. |
| `IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md` | Phải mở rộng AI config/runtime hiện có trước khi giới thiệu schema/route greenfield. |
| `VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md` | Là phase-later backlog. Thin local control plane đi trước full admin suite. |
| `OPEN_CORE_*` docs | Gắn với entitlement/commercial lane hiện có, nay được diễn giải thành `packages/opencore` nhưng vẫn không thay `core` làm truth backend. |

---

## 8. Kết luận thực thi

Nếu bám vào code hiện tại, đường nâng cấp khả thi của VNInvest là:

1. **Packages-first theo mô hình song song, không bulk-move legacy folders trước.**
2. **Core-first trên runtime semantics đã chứng minh, nhưng implementation mới đi vào `packages/core`.**
3. **Redis/PostgreSQL/Channels-first trước khi đưa infra nặng hơn.**
4. **Mở rộng AICommandCenter và OpenCore hiện có thay vì bỏ qua chúng.**
5. **`packages/opencore` là package funnel/distribution truoc VIP, nhung `core` van giu entitlement/quota/billing truth.**
6. **`packages/web` là nơi dựng build variants mới; legacy frontend chỉ làm fallback/reference cho tới cutover.**
7. **VIP self-host bắt đầu bằng thin local orchestrator, không phải mini-platform hoàn chỉnh ngay từ ngày đầu.**
8. **Sau khi package track đạt parity và cutover ổn định, legacy runtime phải bị decommission.**

Theo cách này, mục tiêu enterprise vẫn giữ nguyên nhưng lộ trình bớt rủi ro, bám sát repo hiện tại và tạo ra các điểm dừng kiểm chứng rõ ràng cho đội code.