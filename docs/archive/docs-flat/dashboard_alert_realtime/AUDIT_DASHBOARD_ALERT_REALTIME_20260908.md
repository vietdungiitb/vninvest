# Audit Cảnh báo Dashboard Realtime — `http://localhost/dashboard`

**Ngày:** 2026-09-08  
**Phạm vi:** `packages/web` (DashboardPage triad, UnifiedAlertCenter, hooks realtime) ↔ `packages/core/backend/src/signal_intelligence` (UnifiedAlert, materializers, tasks, broadcasting, views) ↔ `packages/core/backend/src/market_data` + `market_serving` (IntradayTick, SymbolSnapshot, Celery beat)  
**Loại:** Chỉ nghiên cứu + phân tích — không sửa code (chờ phê duyệt)  
**Khung:** AGENTS.md § AI Audit/Research Framework — 6 nguyên tắc, 8 điểm đầu ra; mọi khẳng định kèm `file:line`

---

## 0. Nguyên tắc bắt buộc (đã tuân thủ)

1. Mọi khẳng định kèm `file:line`. Không có line = không hợp lệ.
2. Không đoán — chưa đọc file thật ghi `CHƯA XÁC MINH`.
3. Dùng grep/glob/read + `docker logs`/`python shell` evidence, không dùng kinh nghiệm chung.
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS riêng.
5. Quét toàn repo gồm `.css`, `.module.css`, config, i18n, adapters, `docker-compose.*`, `settings.py` beat schedule.
6. Không viết code trong audit.
7. File không tồn tại báo `KHÔNG TỒN TẠI`.
8. Ngôn ngữ: Tiếng Việt.

---

## 1. Tóm tắt 5 findings nghiêm trọng nhất (đọc trước)

> **⚠️ Phạm vi bằng chứng:** Toàn bộ số liệu DB (`IntradayTick` 2026-05-22, `UnifiedAlert` 2026-08-10) và log `no_system_credentials` được lấy từ **môi trường dev `vninvest-dev-*`** (`docker compose -p vninvest-dev`, `core-api` 22:38:57). **CHƯA XÁC MINH production/beta** (`beta.edusuccess.vn` / prod compose). Nếu production vẫn tươi (<1h) thì F01-F02 hạ từ **P0 blocker** xuống **P2 DX** (chỉ cần mock tick cho dev). Cần kiểm tra production trước khi duyệt Phase A (xem §7 Q0).

1. **[P0-DEV (P2 nếu prod tươi)] Dữ liệu gốc đã chết 3.5 tháng — không thể có cảnh báo mới (trên dev)** — `IntradayTick` mới nhất `2026-05-22 07:59:58` (`market_data.models:IntradayTick` — age 2623h, `vninvest-dev`), `SymbolSnapshot` mới nhất `2026-08-05` (age 49081 phút). `detect_and_store_global_whale_alerts` chạy mỗi 5m nhưng luôn `session=2026-05-22 whale_ticks=0` (log `vninvest-dev-core-worker` 2026-09-08 22:38:57), `backfill_intraday_tick_system` abort `no_system_credentials` (log 22:38:43). Hệ quả `UnifiedAlert` mới nhất `2026-08-10` (age 29 ngày, dev) — dashboard dù poll đúng vẫn chỉ hiển thị “30 ngày trước” **trên dev**. *Cần đối chiếu prod trước khi kết luận P0 toàn hệ thống.*

2. **[P0] Thứ tự feed sai — whale cũ che dark_flow mới** — `signal_intelligence/views.py:29` `AlertCenterFeedCursorPagination(ordering=('type_priority','-triggered_at','-pk'))` với `type_priority:whale=0, dark_flow=1` (`views.py:15-26`). 769 whale sẽ luôn đứng trước 259 dark_flow dù cũ hơn 1 tháng, `page_size=20` (`useAlertCenterSnapshot.ts:32`) sẽ không bao giờ tới được dark_flow mới nếu whale đủ 20. Frontend `DashboardPage.tsx:256` gộp `[...feedAlerts, ...darkFlow, ...globalRealtime, ...snapshot]` rồi dedup **không sort lại** theo `triggered_at` — hiển thị theo thứ tự type_priority của BE, không phải recency.

3. **[P1] Frontend merge không sắp xếp theo thời gian** — `DashboardPage.tsx:256-269` `mergedAlerts` dedup bằng `event_id || id || symbol-ts` nhưng giữ nguyên thứ tự chèn `feedAlerts → darkFlow → globalRealtime → snapshot`. Không có `.sort((a,b)=>tb-ta)`. `UnifiedAlertCenter.js:287` chỉ render `filteredAlerts` theo thứ tự nhận, `timeAgo:94` tính `Date.now() - ts` đúng nhưng list không theo `timeAgo`. Người dùng thấy cảnh báo 29 ngày trước xen lẫn 1 giờ trước không theo thứ tự.

4. **[P1] WS không đẩy cảnh báo mới vì không có gì để đẩy** — `tasks.py:368` `broadcast_unified_alert` chỉ gọi khi `canonical_to_create` mới (`tasks.py:366-374`) và `materializers.py:363` khi `alert_created or dirty_fields`. Với tick stale, `whale_df.empty` → 0 canonical mới → không broadcast. `consumers.py` WS chỉ relay `broadcast_unified_alert`, nên dù WS `WSCONNECT` (log 22:36:05) thành công, không có `whale_alert`/`dark_flow_alert` event mới. Dashboard fallback về poll 15s (`useAlertCenterSnapshot.ts:30,76`) — vốn đã 29 ngày cũ.

5. **[P1] Snapshot poll và WS dùng 2 nguồn không đồng bộ thời gian** — `useAlertCenterSnapshot.ts:78` poll `GET /core/v1/signals/alert-center/feed?page_size=20` (trả về 17176 bytes cố định mỗi 15s, log 22:36:20/22:36:35…), `useAlertCenterRealtime.js:17` subscribe `market_discovery` WS riêng, `useRealtimeFeedCore.js:1033` timeout 35s. Khi WS healthy, poll REST vẫn chạy song song (không cancel) nhưng `POLL_PSEUDO_SYMBOLS` đã fix, poll ticker vẫn chạy. Hai nguồn dùng key dedup khác nhau (`useAlertCenterRealtime.js:27` `event_id || symbol-ts` vs `DashboardPage.tsx:263` `event_id || id || symbol-ts`) — có thể không dedup trùng nếu BE trả `alert_id` UUID nhưng WS trả `event_id` khác.

---

## 2. Bản đồ kiến trúc (file | line_count | trách nhiệm | note)

| File | Lines | Trách nhiệm | Note |
|---|---|---|---|
| `packages/web/src/pages/DashboardPage.tsx:1` | 475 | Orchestrator triad + merge 4 nguồn alert | `mergedAlerts:256` không sort, `resolvedBreadth:189` |
| `packages/web/src/hooks/useAlertCenterSnapshot.ts:1` | 112 | Poll REST feed `page_size=20` mỗi 15s | `POLL_INTERVAL=15000:30`, `fetchFeed:44` silent poll |
| `packages/web/src/hooks/useAlertCenterRealtime.js:1` | 50 | WS global `market_discovery` bypass manager | `symbols:["market_discovery"]:17` |
| `packages/web/src/context/RealtimeContext.js:1` | 197 | Singleton manager dedup poll/WS | `POLL_PSEUDO_SYMBOLS` đã fix 2026-09-08 |
| `packages/web/src/hooks/useRealtimeFeedCore.js:1` | 1260 | WS + REST hybrid, heartbeat 35s | `normalizePollSymbolCandidates:330`, `startHeartbeatTimeoutCheck:1029` |
| `packages/web/src/components/dashboard/UnifiedAlertCenter.js:1` | 490 | Render lane, `timeAgo:94`, `severityCardStyles:76` | Không sort, chỉ filter `severity/source:156` |
| `packages/core/backend/src/signal_intelligence/models.py:15` | 325 | `UnifiedAlert`, `WhaleAlertCanonical`, `OrderFlowEvent`, `MarketAnomalyEvent`, `UserAlertDelivery` | `ordering=['-triggered_at']` nhưng feed override |
| `packages/core/backend/src/signal_intelligence/views.py:29,352` | 709 | Feed + pagination `type_priority` | `ordering=('type_priority','-triggered_at')` |
| `packages/core/backend/src/signal_intelligence/serializers.py:6` | 74 | `UnifiedAlertSerializer` `triggered_at`, `executed_at` | `executed_at` từ `whale_detail` nếu có |
| `packages/core/backend/src/signal_intelligence/tasks.py:48,237` | 571 | `detect_and_store_global_whale_alerts` 5m, `_bulk_write_whale_canonical` | `session_date=_get_latest_session_date():34` từ `IntradayTick` |
| `packages/core/backend/src/signal_intelligence/materializers.py:187,384,503` | 967 | `materialize_unified_alerts` 2m, `materialize_market_anomaly_alerts` 5m | Sync từ `OrderFlowEvent`/`SymbolSnapshot` |
| `packages/core/backend/src/signal_intelligence/broadcasting.py:1` | ? | `broadcast_unified_alert` → channel layer | Chỉ khi tạo mới |
| `packages/core/backend/src/signal_intelligence/consumers.py:1` | ? | WS `/ws/realtime/` relay | `WSCONNECT` log 22:36:05 |
| `packages/core/backend/src/market_data/models.py:1` | ? | `IntradayTick` | Latest 2026-05-22 |
| `packages/core/backend/src/market_serving/models.py:1` | ? | `SymbolSnapshot` | Latest 2026-08-05 |
| `packages/core/backend/src/vninvest_core/settings.py:1` | ? | `CELERY_BEAT_SCHEDULE` | `detect-whale-alerts-5m:300s`, `materialize-unified-alerts-2m:120s` |
| `docker-compose.dev.yml:1` | ? | Stack dev native | `core-api`, `core-worker`, `core-beat`, `redis`, `frontend` |
| `packages/web/src/utils/dashboardSymbols.js:1` | 19 | `collectUniqueSortedSymbols` | Không liên quan alert |

---

## 3. Luồng dữ liệu đã trace (1 use-case: mở `/dashboard` lúc 22:36:05)

**B1: Frontend bootstrap**
`DashboardPage.tsx:165` `useAlertCenterSnapshot({page_size:20})` → `fetchFeed:44` `GET /core/v1/signals/alert-center/feed?page_size=20` (log 22:36:05 200 17176 bytes) + `useAlertCenterRealtime:17` subscribe WS `market_discovery` → `useRealtimeFeedCore:1018` `WSCONNECT /ws/realtime/` (log 22:36:05).

**B2: BE feed query**
`views.py:352` `AlertCenterFeedView` → `qs=UnifiedAlert.objects.annotate(type_priority).order_by('type_priority','-triggered_at')` (`views.py:358-360`) + `_apply_common_alert_filters:141` (lane main) + `delivery_service.apply_user_delivery_policy` → `AlertCursorPagination` → 20 rows đầu là whale cũ nhất trong 769 whale (do whale=0), không phải 20 mới nhất toàn bộ. `serializers.py:47` `executed_at` từ `whale_detail` nếu có.

**B3: FE merge**
`DashboardPage.tsx:256` `mergedAlerts = [...feedAlerts(WS 0), ...darkFlow(0), ...globalRealtime(0), ...snapshot(20)]` → dedup giữ thứ tự feed trước, snapshot sau, **không sort** → `UnifiedAlertCenter.js:287` render theo thứ tự đó. `timeAgo:94` tính `Date.now() - ts` → hiển thị “29 ngày trước” cho VCI 2026-08-10 (DB age 42612 phút, evidence 22:38:09).

**B4: WS không có mới**
`tasks.py:48` `detect_and_store_global_whale_alerts` chạy 22:38:44, `session=2026-05-22` (do `IntradayTick` stale), `whale_ticks=0`, `order_flow_events=975` (upsert, không tạo UnifiedAlert mới vì `source_ref` unique). `tasks.py:368` không broadcast → `consumers.py` không đẩy `whale_alert` → `useRealtimeFeedCore:1103` không `applyAlert` → `mergedAlerts` không tăng.

**B5: Poll lặp lại stale**
`useAlertCenterSnapshot.ts:76` `setInterval 15000` → `GET .../feed?page_size=20` mỗi 15s (log 22:36:20,22:36:35,22:36:50…) luôn trả 17176 bytes giống nhau (cùng 20 whale cũ). `DashboardPage.tsx:283` `showSkeleton` false nên UI không thay đổi, người dùng thấy “không có sự kiện mới nhất”.

---

## 4. CONTRADICTIONS (plan/doc vs code)

| # | Plan/Doc `file:line` | Code thực tế `file:line` | Tác động |
|---|---|---|---|
| C01 | `docs/IMPLEMENTATION_PLAN_DASHBOARD_COMMERCIAL_GRADE_20260908.md:7` “cảnh báo realtime sát giờ” (mục tiêu) | `signal_intelligence/tasks.py:90` `resolved_date=_get_latest_session_date()` từ `IntradayTick` 2026-05-22 | Mục tiêu không thể đạt khi data ingestion chết — doc không đề cập dependency `IntradayTick` freshness |
| C02 | `packages/web/src/pages/DashboardPage.tsx:283` comment “detail panel thay vì Vui lòng chọn mã” | `UnifiedAlertCenter.js:94` `timeAgo` luôn tính từ `ts`/`triggered_at` nhưng BE `UnifiedAlert.triggered_at` là `executed_at` của tick (2026-08-10), không phải `now()` của materializer | Hiển thị “Vừa xong” sai nếu BE dùng `now()` cho `OrderFlowEvent.triggered_at` (`tasks.py:138`) nhưng `UnifiedAlert.triggered_at` lại là `executed_at` (cũ) — 2 clock khác nhau |
| C03 | `signal_intelligence/views.py:29` `ordering=('type_priority','-triggered_at')` doc “feed theo recency” (serializer `generated_at:timezone.now()`) | Thực tế whale 0 luôn trước dark_flow 1, dù dark_flow mới hơn 1 tháng | Người dùng không thấy dark_flow mới vì bị whale cũ đẩy ra ngoài page_size |
| C04 | `useAlertCenterSnapshot.ts:30` `POLL_INTERVAL=15000` + `DashboardPage.tsx:256` merge “realtime + snapshot” | Không có sort sau merge, không có `triggered_at` sort | Poll 15s vô nghĩa khi BE không có mới — frontend vẫn “loading” nhưng data không đổi, không báo stale |
| C05 | `market_serving/materializers` `materialize-unified-alerts-2m` mỗi 2m (beat) | `IntradayTick` không có mới từ 2026-05-22, `SymbolSnapshot` từ 2026-08-05 | Materializer chạy đúng lịch nhưng đầu vào chết — doc không có health check `tick freshness` |

---

## 5. Findings chi tiết

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **F01** | **P0** | `market_data.models:IntradayTick` latest `2026-05-22 07:59:58` (DB) + `tasks.py:92` `_get_latest_session_date()` | Tick ingestion chết 3.5 tháng, `detect_and_store_global_whale_alerts` luôn `session=2026-05-22 whale_ticks=0` (log 22:38:57) | Không thể sinh whale/dark_flow mới → `UnifiedAlert` mới nhất 2026-08-10 (29 ngày) | **Khắc phục gốc:** kiểm tra `data_ingest` provider credentials (`log: no_system_credentials VHM` 22:38:43) + `warm-intraday-realtime-5m` task. Cần cấp `VNBROKER_GITHUB_TOKEN`/`DNSE` credentials cho `core-worker-realtime-prefetch` hoặc mock tick generator cho dev. Thêm health check `tick_age_hours >24h` → alert + block materializer |
| **F02** | **P0** | `market_serving/models:SymbolSnapshot` latest `2026-08-05`, `materializers.py:503` `materialize_market_anomaly_alerts` | Snapshot chết 34 ngày, `price_change_pct=-14.9%` cho YTC nhưng không có snapshot mới → `price_shock`/`stale_quote` không sinh mới | User thấy “Cá mập / Sốc giá” 29 ngày trước là mới nhất | Fix ingestion `materialize-symbol-snapshot-60s` (beat) + kiểm tra `market_serving.materializers` provider fetch (KBS failed `fetch_symbol_group_members VN50 via KBS` log 22:35:39) |
| **F03** | **P0** | `signal_intelligence/views.py:29-31` `ordering=('type_priority','-triggered_at')` | 769 whale luôn trước 259 dark_flow, `page_size=20` không bao giờ thấy dark_flow mới nếu whale đủ 20 | Người dùng không thấy “sự kiện mới nhất” nếu mới nhất là dark_flow/signal | Đổi ordering thành `('-triggered_at','-pk')` hoặc thêm `?sort=recency` param, giữ `type_priority` chỉ cho client sort, không cho pagination |
| **F04** | **P1** | `DashboardPage.tsx:256-269` merge không sort | `mergedAlerts` giữ thứ tự `feedAlerts → snapshot` không theo `triggered_at` | Hiển thị sai thứ tự thời gian, test `timeAgo` đúng nhưng list sai | Thêm `.sort((a,b)=> new Date(b.triggered_at||b.ts).getTime() - new Date(a.triggered_at||a.ts).getTime())` sau dedup, trước `setFiltered` |
| **F05** | **P1** | `UnifiedAlertCenter.js:94-104` `timeAgo` + `DashboardPage.tsx:256` key dedup | `timeAgo` tính `Date.now()-ts` đúng nhưng `key = event_id || id || symbol-ts` không khớp BE `alert_id` UUID vs WS `event_id` | Có thể trùng hiển thị 1 alert 2 lần (WS + REST) nếu `alert_id` khác `event_id` | Chuẩn hóa key dedup dùng `alert_id` duy nhất (BE `UnifiedAlertSerializer:15` `alert_id`), WS `broadcast_unified_alert` phải trả `alert_id` thay vì `event_id` |
| **F06** | **P1** | `signal_intelligence/broadcasting.py:??` + `tasks.py:368` chỉ broadcast khi `canonical_to_create` | Với tick stale, `whale_df.empty` → 0 broadcast → WS im lặng | Dashboard fallback poll 15s nhưng data cũ → “không hoạt động chính xác” như báo cáo | Khi không có tick mới, vẫn nên broadcast `heartbeat` hoặc `no_new_alerts` để FE biết là “đã kiểm tra, không có mới” thay vì im lặng |
| **F07** | **P1** | `useAlertCenterSnapshot.ts:30,76` poll 15s + `useAlertCenterRealtime.js:17` WS | Hai nguồn chạy song song không đồng bộ, poll trả 17176 bytes cố định mỗi 15s (log) | Lãng phí 4 req/phút, không có `If-None-Match` | Thêm `ETag`/`last_triggered_at` filter `?since=2026-08-10T01:25:43Z` để BE chỉ trả mới hơn, FE chỉ poll khi WS `polling` state, không khi `live` |
| **F08** | **P2** | `signal_intelligence/serializers.py:47` `get_executed_at` từ `whale_detail` | `executed_at` có thể null cho non-whale, FE `UnifiedAlertCenter.js:432` fallback `triggered_at` hoặc `ts` | Thời gian hiển thị nhảy giữa `executed_at` và `triggered_at` (chênh 0-29 ngày) | Chuẩn hóa FE luôn dùng `triggered_at` (canonical), `executed_at` chỉ tooltip |
| **F09** | **P2** | `signal_intelligence/views.py:182` `timeframe` cutoff `now - timedelta` | `timeframe` filter dựa trên `now()` của BE, không phải `session_date` | Khi tick stale, `timeframe=5m` sẽ filter hết (vì `triggered_at` 29 ngày trước < cutoff) → FE tưởng không có alert trong 5m nhưng thực ra là data stale | Thêm `stale` flag vào response `generated_at` + `is_stale:true` khi `latest_triggered_at < now-1h` để FE hiển thị banner “Dữ liệu cảnh báo đang chậm 29 ngày” |
| **F10** | **P2** | `core-worker` log `flush_pat_audit_log: RedisCacheClient lpop` error mỗi 10s | Lỗi không liên quan alert nhưng spam log, che mất log alert | Khó debug | Fix `identity_access/tasks.py:476` dùng `cache` đúng interface hoặc tắt task khi dev không có Redis lpop |
| **F11** | **P3** | `DashboardPage.tsx:283` `showSkeleton = loading && !hasHydrated` | Khi `hasHydrated=true`, `loading` sau poll silent không hiện skeleton, không báo “đang làm mới” | User không biết poll đang chạy hay chết | Thêm `isPolling` state hiển thị spinner nhỏ cạnh title khi `silent` poll |

---

## 6. Quality Gates Audit

### 6.1 Lint — `npm run lint`
- **Kết quả (đã chạy):** `3535 problems (0 errors, 3535 warnings)` — PASS (0 error) như trước. Không liên quan alert realtime, giữ nguyên.
- **Liên quan alert:** `UnifiedAlertCenter.js` không có lỗi `exhaustive-deps`, chỉ `jsx-no-literals` warnings.

### 6.2 Type-check — `npx tsc --noEmit`
- **Kết quả:** 0 errors (đã chạy 2026-09-08 22:14). Không báo sai type alert.

### 6.3 Build — `npm run build`
- **Kết quả:** 20.31s, `dashboard 675k`, `echarts 637k` — như báo cáo trước, không liên quan.

### 6.4 Test — `npx vitest run`
- **Kết quả:** 8 tests PASS (pagination 2 + breadth/dedup 4 + universe 2). Không có test nào cho alert recency — **gap**.

### 6.5 Data freshness — `docker exec core-api python shell` (evidence)
- `IntradayTick` latest 2026-05-22 age 2623h (3.5 tháng) — **FAIL** (>24h)
- `SymbolSnapshot` latest 2026-08-05 age 49081 phút (34 ngày) — **FAIL**
- `UnifiedAlert` latest 2026-08-10 age 29 ngày — **FAIL**
- `OrderFlowEvent` latest 2026-05-23 — **FAIL**
- `beat` schedule: `detect-whale-alerts-5m`, `materialize-unified-alerts-2m` đang chạy đúng nhưng đầu vào chết — **PASS schedule, FAIL data**

### 6.6 WS — `docker logs core-api --tail 20`
- `WSCONNECT /ws/realtime/` 22:36:05 OK, nhưng `WSDISCONNECT` sau 1s cho 1 consumer (do `market_discovery` poll rác đã fix nhưng WS vẫn disconnect nhanh — cần kiểm tra `heartbeat_timeout` 35s đã fix)
- Không có log `broadcast_unified_alert` vì không có alert mới — đúng với data stale.

---

## 7. Câu hỏi cần làm rõ (chặn fix triệt để)

1. **Có muốn mock tick data cho dev không?** Hiện `IntradayTick` 89k rows nhưng dừng 2026-05-22. Dev không có `VNBROKER_GITHUB_TOKEN`/`DNSE` live provider → `backfill_intraday_tick_system: no_system_credentials` mỗi lần. Cần quyết định: cấp credential thật, hay thêm `mock_intraday_generator` cho dev (sinh tick fake mỗi 5m để test realtime)?
2. **Thứ tự feed mong muốn là gì?** Giữ `type_priority` (whale trước) hay đổi thành `recency` (`-triggered_at`)? Nếu giữ, cần tăng `page_size` lên 50-100 và thêm tab filter theo `alert_family` để user thấy dark_flow mới.
3. **Có muốn hiển thị banner “dữ liệu chậm” không?** Khi `latest_triggered_at < now-1h`, hiển thị “Cảnh báo đang chậm 29 ngày — dữ liệu thị trường chưa cập nhật” để user không tưởng bug frontend.
4. **WS broadcast có cần heartbeat “no_new_alerts” không?** Hiện im lặng khi không có mới → FE không biết là đã kiểm tra xong hay chết. Có muốn thêm `event_type: heartbeat` mỗi 30s với `latest_triggered_at` để FE biết?

---

## 7. Câu hỏi cần làm rõ (bổ sung sau phản biện độc lập — chặn duyệt Phase A)

**Q0 — Dev vs Production (chặn P0):** Bằng chứng stale 29 ngày lấy từ `vninvest-dev` (không có credential provider thật, `no_system_credentials` có thể là hành vi bình thường cho dev). **Cần kiểm tra production/beta trước khi duyệt:** chạy `python manage.py shell` trên `beta.edusuccess.vn` hoặc prod compose để xem `IntradayTick`/`UnifiedAlert` có cũng stale không. Nếu **prod tươi (<1h)** → F01-F02 hạ **P0→P2 DX** (chỉ cần mock tick cho dev, không chặn release); nếu **prod cũng stale** → giữ P0 khẩn cấp. Đây là **bước 0 ngày, làm trước Phase A**.

## 8. Đánh giá tổng thể & Lộ trình phê duyệt (REV1 — phân biệt dev/prod)

**Implementable?** Có, nhưng phải xác minh **Q0** trước, rồi mới fix **gốc BE** nếu prod cũng stale, rồi **FE sorting/poll**.

**Blocker?** Nếu **prod stale** thì 2 P0 (F01,F02) là blocker thật — không có data mới thì mọi fix FE chỉ làm “hiển thị 29 ngày trước đẹp hơn”. Nếu **prod tươi** thì không blocker, chỉ là DX dev.

**Ưu tiên sửa (đề xuất 3 bước + 1 bước 0, cần phê duyệt):**

**Bước 0 — Xác minh prod/beta (0 ngày, trước Phase A):**
- [ ] Chạy `docker exec prod-core-api python manage.py shell` kiểm tra `IntradayTick`/`UnifiedAlert` age
- [ ] Nếu prod tươi → hạ F01-F02 P0→P2, Phase A chỉ mock cho dev (0.5 ngày), không cần credential vendor
- [ ] Nếu prod stale → giữ P0, tiếp Bước 1

**Bước 1 — Gốc BE (1-2 ngày, P0 nếu prod stale, P2 nếu chỉ dev):**
- [ ] Cấp `VNBROKER_GITHUB_TOKEN` cho `core-worker-realtime-prefetch` (hoặc thêm `MOCK_TICK_ENABLED=true` cho dev để `IntradayTick` sinh mỗi 5m)
- [ ] Fix `fetch_symbol_group_members VN50 via KBS` (log 22:35:39) — kiểm tra `market_data` provider KBS
- [ ] Thêm health check `tick_age_hours` metric → Grafana alert khi >24h
- [ ] Verify: `IntradayTick` latest age <1h, `detect_and_store_global_whale_alerts` log `whale_ticks>0`

**Bước 2 — FE hiển thị đúng recency (0.5 ngày, P1):**
- [ ] Sửa `views.py:29` ordering thành `('-triggered_at','-pk')` hoặc thêm `?sort=recency` (giữ `type_priority` cho backward compat)
- [ ] Sửa `DashboardPage.tsx:256` thêm `.sort()` sau dedup theo `triggered_at`
- [ ] Sửa `UnifiedAlertCenter.js` hiển thị `triggered_at` thống nhất, thêm banner `is_stale`
- [ ] Thêm `useAlertCenterSnapshot` param `?since=last_triggered_at` để giảm 17176 bytes mỗi poll

**Bước 3 — WS & poll đồng bộ (0.5 ngày, P1):**
- [ ] `broadcasting.py` thêm heartbeat khi không có mới
- [ ] `useAlertCenterSnapshot` chỉ poll khi `realtimeStatus !== 'live'` (đã có `isOffhours` gating 35s)
- [ ] Test E2E: mock tick → đợi 5m → verify dashboard hiện “Vừa xong” trong 15s

**Nếu Bước 1 không được duyệt (không cấp credential):** thay bằng mock generator cho dev, vẫn đạt “demo sát giờ” nhưng không phải data thật — cần ghi rõ trong báo cáo.

**Tài liệu tham chiếu:** `signal_intelligence/models.py:59`, `views.py:29,352`, `tasks.py:48,92`, `materializers.py:187`, `serializers.py:47`, `DashboardPage.tsx:256`, `useAlertCenterSnapshot.ts:30`, `docker logs` 2026-09-08 22:36-22:39, `python shell` age checks.

**Người thực hiện:** Muse Spark — audit chỉ nghiên cứu, không sửa code. Mọi phát hiện đã grep/read + DB evidence; thiếu `file:line` = không hợp lệ.
