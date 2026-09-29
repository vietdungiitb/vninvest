# Kế hoạch khắc phục & nâng cấp Cảnh báo Dashboard Realtime

**Mã:** `IMPL-ALERT-REALTIME-20260908`  
**Nguồn audit:** `docs/AUDIT_DASHBOARD_ALERT_REALTIME_20260908.md` (REV1 2026-09-08 — bổ sung phân biệt dev/prod, 11 findings P0-P3, 5 CONTRADICTIONS, evidence dev DB 29 ngày stale, CHƯA XÁC MINH prod)  
**Phạm vi:** `packages/core/backend/src/signal_intelligence` (models, views, tasks, materializers, broadcasting, consumers) ↔ `packages/core/backend/src/market_data` + `market_serving` (IntradayTick, SymbolSnapshot, beat) ↔ `packages/web` (DashboardPage, UnifiedAlertCenter, hooks realtime)  
**Ràng buộc cứng (AGENTS.md:6):** SOC glassmorphism `soc.module.css`, i18n qua `LangContext`, API qua `defaultCoreApiAdapter` cast `as unknown as {…}`, nhãn tiếng Việt có dấu, `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi slice  
**Báo cáo gốc:** Dashboard phải “sát giờ thực” nhưng `UnifiedAlert` mới nhất `2026-08-10` (29 ngày), `IntradayTick` `2026-05-22` (3.5 tháng) — không thể realtime nếu gốc chết

---

## 0. Mục tiêu & DoD tổng

**Mục tiêu:** Dashboard `/dashboard` hiển thị cảnh báo **mới nhất trong vòng 5 phút** (khi thị trường mở), **không quá 15 phút** khi stale, với thứ tự đúng recency, không trùng, có banner “dữ liệu chậm” khi ingestion chết, và **ổn định 24/7** (không spam log, không poll rác).

**DoD tổng:**
- [ ] `IntradayTick` latest age <1h (giờ hành chính) hoặc <24h (ngoài giờ) — `python shell` check
- [ ] `UnifiedAlert` latest age <5m (khi có tick mới) — `python shell` check
- [ ] `GET /core/v1/signals/alert-center/feed?page_size=20` trả 20 mới nhất theo `-triggered_at` (không phải `type_priority`) — `curl` + `vitest` pagination 3 trang
- [ ] `DashboardPage` merge sort đúng recency, dedup `alert_id` duy nhất — `vitest` breadth/dedup 4 tests PASS
- [ ] WS `WSCONNECT` nhận `whale_alert` trong 5m khi tick mới — `docker logs` + `vitest` WS mock
- [ ] Poll REST chỉ khi `!live` hoặc `?since=` — Network DevTools 4 req/phút → <1 req/phút khi live
- [ ] Banner `is_stale` hiện khi `latest_triggered_at < now-1h` — manual + `vitest`
- [ ] `npx tsc --noEmit` 0 error, `npm run build` PASS, `npx vitest run` 8+ tests PASS, `docker logs` không spam `lpop` error
- [ ] E2E `dashboard-alert-realtime.spec.ts` PASS 3 viewport: mock tick → 5m → “Vừa xong” trong 15s

---

## 1. Phân rã Slice (14 slices, 4 Phase)

> Mỗi slice ≤4 file, 1 PR, có thể review độc lập. Thứ tự phản ánh dependency: **Gốc BE → Feed → FE → Ổn định**.

### Phase A0 — Xác minh prod/beta trước khi duyệt P0 (0 ngày, chặn duyệt)

#### Slice A0 — Kiểm tra DB prod/beta có stale như dev không (B.1-B.3)
- **Mục đích:** Xác định F01-F02 là **P0 toàn hệ thống** hay **P2 DX dev-only** (phản biện độc lập 2026-09-08).
- **Files:** Không đổi code — chỉ chạy lệnh kiểm tra (đề xuất thêm vào `scripts/check_alert_freshness.sh` nếu cần).
- **Yêu cầu:**
  - Chạy `python manage.py shell` trên **beta `beta.edusuccess.vn`** và **prod** (nếu có) để `IntradayTick`/`SymbolSnapshot`/`UnifiedAlert` age như §6.5. Ghi kết quả vào `docs/evidence/alert-freshness-prod-vs-dev-20260908.md`.
  - Nếu **prod tươi (<1h)** → hạ F01-F02 **P0→P2 DX**, Phase A chỉ mock cho dev (0.5 ngày), không cần credential vendor; ước lượng toàn kế hoạch 6 ngày → 4.5 ngày và không chặn release.
  - Nếu **prod cũng stale (>24h)** → giữ P0, tiếp A1-A3 như cũ (phụ thuộc vendor, ghi rõ “phụ thuộc bên thứ 3, không cam kết cứng 2 ngày” như phản biện C).
- **Tiêu chí:** Có file evidence `alert-freshness-prod-vs-dev-20260908.md` với 3 dòng `tick_latest`, `alert_latest`, `now` cho cả dev và prod/beta, được PO ký xác nhận trước khi merge A1.
- **Kiểm chứng:** `cat docs/evidence/alert-freshness-prod-vs-dev-20260908.md` + `docker logs` dev đã có 2623h.
- **Rủi ro:** Không có — chỉ đọc DB.

### Phase A — Gốc dữ liệu (2 ngày nếu prod stale, 0.5 ngày nếu chỉ dev, P0→P2) — chặn “không có gì để hiển thị”

#### Slice A1 — Khôi phục IntradayTick ingestion (F01)
- **ID:** F01 `IntradayTick` 2026-05-22 + `tasks.py:92` + log `no_system_credentials`
- **Files:** `packages/core/backend/src/market_data/models.py` (đối chiếu), `packages/core/backend/src/data_ingest/tasks.py` (warm_intraday), `packages/core/backend/src/vninvest_core/settings.py` (beat), `compose.dev.env` (credentials), `docker-compose.dev.yml` (env)
- **DoR:** Quyết định **mock tick cho dev** hay **cấp credential thật** (hỏi PO). Mặc định: mock cho dev, credential cho prod.
- **Yêu cầu:**
  - Thêm `MOCK_TICK_ENABLED=true` (dev) → `data_ingest/tasks.py` sinh `IntradayTick` fake mỗi 5m cho 10 mã VN30 khi `tick_age_hours>24h` (dùng `IntradayTick.objects.bulk_create` với `timestamp=now()`, `value` random 500M-5B)
  - Hoặc cấp `VNBROKER_GITHUB_TOKEN`/`DNSE_API_KEY` cho `core-worker-realtime-prefetch` (prod) — kiểm tra `backfill_intraday_tick_system` không còn `aborted no_system_credentials`
  - Thêm health check `tick_age_hours` metric → `market_serving/materializers.py` log warn khi >24h
- **Tiêu chí:**
  - `docker exec core-api python shell` IntradayTick latest age <1h (sau 5m)
  - `docker logs core-worker | grep detect_and_store_global_whale_alerts` log `session=today whale_ticks>0` (không còn 0)
  - `npx tsc --noEmit` PASS (không đổi FE)
- **Kiểm chứng:** `python -c "IntradayTick latest age"` + `docker logs` + `curl /core/v1/market-data/intraday-ticks/?symbol=VCI` có mới
- **Rủi ro:** Thấp (mock chỉ dev). Rollback: `MOCK_TICK_ENABLED=false`.

#### Slice A2 — Khôi phục SymbolSnapshot (F02)
- **ID:** F02 `SymbolSnapshot` 2026-08-05 + `market_serving/materializers.py:503`
- **Files:** `packages/core/backend/src/market_serving/materializers.py:503`, `packages/core/backend/src/market_serving/models.py`, `vninvest_core/settings.py` (beat `materialize-symbol-snapshot-60s`)
- **Yêu cầu:**
  - Fix `fetch_symbol_group_members VN50 via KBS` (log 22:35:39) — kiểm tra `market_data/providers/kbs.py` fallback khi KBS fail → dùng `market_data` local
  - Đảm bảo `materialize-symbol-snapshot-60s` chạy mỗi 60s tạo `SymbolSnapshot` mới (không stale)
  - Thêm `stale` flag reset khi `fetched_at` mới
- **Tiêu chí:**
  - `SymbolSnapshot` latest age <5m
  - `GET /core/v1/realtime/tickers/?symbols=VCI` có `price_change_pct` mới
- **Kiểm chứng:** DB check + `docker logs core-beat | grep materialize-symbol-snapshot`

#### Slice A3 — Fix `flush_pat_audit_log` spam (F10)
- **ID:** F10 `identity_access/tasks.py:476` `RedisCacheClient lpop` error mỗi 10s
- **Files:** `packages/core/backend/src/identity_access/tasks.py:476`, `packages/core/backend/src/vninvest_core/cache.py`
- **Yêu cầu:** Sửa `cache_client.lpop` → dùng `redis_client.lpop` đúng interface hoặc tắt task khi dev không có Redis lpop (wrap try/except, log debug thay vì error)
- **Tiêu chí:** `docker logs core-worker | grep flush_pat_audit_log` không còn `AttributeError`, chỉ `succeeded`
- **Kiểm chứng:** `docker logs --tail 20` không spam

---

### Phase B — Feed & hiển thị đúng recency (1.5 ngày, P0-P1)

#### Slice B1 — Sửa ordering feed về recency (F03)
- **ID:** F03 `views.py:29` `ordering=('type_priority','-triggered_at')`
- **Files:** `packages/core/backend/src/signal_intelligence/views.py:29`, `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py` (thêm test)
- **Yêu cầu:**
  - Đổi `AlertCenterFeedCursorPagination.ordering = ('-triggered_at','-pk')` (bỏ `type_priority` ở pagination, giữ `type_priority` chỉ cho client sort nếu cần)
  - Hoặc thêm query param `?sort=recency` (mặc định recency), giữ `?sort=priority` cho backward compat
  - Cập nhật `test_alert_center_api.py` thêm case `dark_flow` mới hơn `whale` cũ vẫn xếp trước
- **Tiêu chí:**
  - `curl /core/v1/signals/alert-center/feed?page_size=20` trả 20 mới nhất theo `triggered_at` (dark_flow 2026-09-08 trước whale 2026-08-10)
  - `npx tsc --noEmit` PASS
- **Kiểm chứng:** `vitest` pagination 3 trang + `curl` check order

#### Slice B2 — Frontend merge sort + dedup chuẩn (F04, F05)
- **ID:** F04 `DashboardPage.tsx:256` không sort, F05 key `event_id||id||symbol-ts`
- **Files:** `packages/web/src/pages/DashboardPage.tsx:256`, `packages/web/src/components/dashboard/UnifiedAlertCenter.js:94`, `packages/web/src/hooks/useAlertCenterRealtime.js:27`
- **Yêu cầu:**
  - Thêm `.sort((a,b)=> new Date(b.triggered_at||b.ts||b.executed_at).getTime() - new Date(a.triggered_at||a.ts||a.executed_at).getTime())` sau dedup trong `mergedAlerts`
  - Chuẩn hóa dedup key dùng `alert_id` duy nhất: `key = a.alert_id || a.event_id || a.id || symbol-ts` (đồng bộ với `UnifiedAlertSerializer:15` `alert_id` UUID)
  - `UnifiedAlertCenter.js:94` `timeAgo` luôn dùng `triggered_at` (không `executed_at`), thêm fallback `ts`
  - Thêm `is_stale` banner: nếu `latest_triggered_at < now-1h` hiện “Dữ liệu cảnh báo chậm X ngày — kiểm tra ingestion”
- **Tiêu chí:**
  - `vitest` breadth/dedup 4 tests PASS (đã có) + thêm test sort recency
  - Manual: dashboard hiện “Vừa xong” cho alert <5m, list sort mới nhất lên đầu
- **Kiểm chứng:** `npx vitest run DashboardPage.breadth-dedup` + manual DevTools Network `triggered_at` sort

#### Slice B3 — Stale banner & `since` filter (F09, F07)
- **ID:** F09 `views.py:182` timeframe, F07 poll lãng phí
- **Files:** `packages/core/backend/src/signal_intelligence/views.py:352` (thêm `since` param), `packages/web/src/hooks/useAlertCenterSnapshot.ts:44`, `packages/web/src/components/dashboard/UnifiedAlertCenter.js:287`
- **Yêu cầu:**
  - BE thêm `?since=2026-09-08T01:25:43Z` filter `triggered_at__gt=since` cho feed (để FE chỉ poll mới hơn last seen)
  - FE `useAlertCenterSnapshot` lưu `last_triggered_at` từ `alerts[0]` và poll `?since=last_triggered_at` khi `silent` (giảm 17176 bytes mỗi poll xuống ~0 khi không có mới)
  - FE banner `is_stale` khi `latest_triggered_at < now-1h` (tính từ `alerts[0].triggered_at`)
- **Tiêu chí:**
  - Network: poll 15s khi không có mới chỉ trả `{"results":[]}` (<1kB) thay vì 17kB
  - Banner hiện khi stale 29 ngày
- **Kiểm chứng:** `curl .../feed?since=2026-08-10` trả rỗng khi không có mới, DevTools + vitest

---

### Phase C — Realtime & đồng bộ (1 ngày, P1)

#### Slice C1 — WS broadcast heartbeat (F06)
- **ID:** F06 `tasks.py:368` chỉ broadcast khi có mới
- **Files:** `packages/core/backend/src/signal_intelligence/broadcasting.py`, `packages/core/backend/src/signal_intelligence/tasks.py:368`, `packages/core/backend/src/signal_intelligence/consumers.py`
- **Yêu cầu:**
  - Khi `whale_df.empty` và không có `OrderFlowEvent` mới, vẫn `broadcast` heartbeat `{"event_type":"heartbeat","latest_triggered_at": last_alert.triggered_at.isoformat(), "status":"no_new_alerts"}` mỗi 30s qua channel layer
  - `consumers.py` relay heartbeat tới FE, FE `useRealtimeFeedCore.js:1103` hiển thị `lastEventAt` không đổi nhưng biết là đã kiểm tra
- **Tiêu chí:**
  - `docker logs core-api | grep heartbeat` có heartbeat mỗi 30s khi không có alert mới
  - `useRealtimeFeedCore` không `WSDISCONNECT` do im lặng
- **Kiểm chứng:** `docker logs` + `vitest` WS mock heartbeat

#### Slice C2 — Chỉ poll khi !live (F07)
- **ID:** F07 `useAlertCenterSnapshot.ts:76` poll song song WS
- **Files:** `packages/web/src/hooks/useAlertCenterSnapshot.ts:76`, `packages/web/src/pages/DashboardPage.tsx:165`
- **Yêu cầu:**
  - `useAlertCenterSnapshot` nhận `enabled` mới: `enabled && realtimeStatus !== 'live'` (truyền từ `DashboardPage` `realtimeFeed.realtimeStatus`)
  - Khi `realtimeStatus==='live'`, pause poll `setInterval` (clear), chỉ poll khi `polling`/`idle`
  - Giữ `POLL_PSEUDO_SYMBOLS` fix đã có (không poll `market_discovery`)
- **Tiêu chí:**
  - Network: khi WS live, không có `GET .../feed?page_size=20` mỗi 15s (chỉ WS)
  - Khi WS `polling`, poll 15s trở lại
- **Kiểm chứng:** DevTools Network + `vitest` enabled flag

#### Slice C3 — Thống nhất dedup key + `alert_id` (F05)
- **ID:** F05 key mismatch `event_id` vs `alert_id`
- **Files:** `packages/core/backend/src/signal_intelligence/broadcasting.py` (đảm bảo WS payload có `alert_id`), `packages/web/src/hooks/useAlertCenterRealtime.js:27`, `packages/web/src/pages/DashboardPage.tsx:263`
- **Yêu cầu:**
  - `broadcast_unified_alert` thêm `alert_id` UUID vào WS payload `whale_alert`/`dark_flow_alert` (hiện chỉ có `event_id`)
  - FE dedup luôn ưu tiên `alert_id` (UUID) trước `event_id`, thống nhất 1 key cho cả WS và REST
- **Tiêu chí:**
  - Không còn trùng hiển thị 1 alert 2 lần
  - `vitest` dedup test với `alert_id` + `event_id` trùng
- **Kiểm chứng:** `vitest` + manual WS + REST cùng alert

---

### Phase D — Ổn định & kiểm chứng (1.5 ngày, P2-P3)

#### Slice D1 — E2E realtime (DoD)
- **Files:** `packages/web/tests/visual/dashboard-alert-realtime.spec.ts` (NEW), `packages/web/src/adapters/core/market.js` (mock tick)
- **Yêu cầu:**
  - Test: mock `IntradayTick` cho VCI với `value=1B` → trigger `detect_and_store_global_whale_alerts` → đợi `materialize_unified_alerts` 2m → verify `GET .../feed` có alert mới trong 5m → FE `dashboard` hiện “Vừa xong” trong 15s
  - 3 viewport (desktop/tablet/mobile)
- **Tiêu chí:** `npx playwright test dashboard-alert-realtime` PASS
- **Kiểm chứng:** `playwright` + `python shell` DB

#### Slice D2 — Health check & Grafana (F01, F09)
- **Files:** `packages/core/backend/src/signal_intelligence/materializers.py` (thêm metric), `packages/core/backend/src/vninvest_core/settings.py` (beat health check), `infra/grafana/dashboards/*.json`
- **Yêu cầu:**
  - Thêm Celery beat task `check-alert-freshness-5m` mỗi 5m: nếu `UnifiedAlert` latest age >1h → log `CRITICAL` + đẩy metric `alert_stale_seconds` → Grafana alert
  - `market_serving` thêm `tick_age_hours` metric
  - Grafana dashboard `alert-freshness` panel
- **Tiêu chí:** Grafana hiện `alert_stale_seconds` và alert khi >3600s
- **Kiểm chứng:** `docker logs` + Grafana UI

#### Slice D3 — Lint & tsc hardening (đã có)
- **Files:** `packages/web/src/components/dashboard/*`, `packages/web/src/pages/DashboardPage.tsx`
- **Yêu cầu:** Giữ `npx tsc --noEmit` 0 error, `npm run lint` 0 error (hiện 3535 warnings dashboard scope 457), `npm run build` PASS
- **Tiêu chí:** Như DoD
- **Kiểm chứng:** `tsh` + `lint` + `build`

---

## 2. Ma trận phụ thuộc (REV1 — thêm A0)

```
A0 (verify prod/beta) ─┐
                       ├─> A1 (tick) ─┐
                       ├─> A2 (snapshot) ─┤
                       └─> A3 (lpop) ─────┤
                                         ├─> B1 (feed order) ─> B2 (FE sort) ─> B3 (stale/since) ─> C1 (WS heartbeat) ─> C2 (poll !live) ─> C3 (dedup) ─> D1 (E2E) ─> D2 (Grafana)
                                         │
                                         └─> D3 (lint) song song
- Nếu A0 cho thấy prod tươi → A1-A2 hạ P0→P2, chỉ mock cho dev, B-C-D vẫn giữ ưu tiên, không chặn release.
```

- A1-A3 song song, cùng chặn B1 (không có data mới thì B1-C3 chỉ “đẹp hơn” chứ không “sát giờ”).
- B1 chặn B2 (FE sort vô nghĩa nếu BE vẫn `type_priority`).
- C1-C3 tuần tự (heartbeat → poll → dedup).
- D1 E2E cần A1-B3-C3 xong.

---

## 3. Tiêu chí đánh giá chung (mọi slice)

| Gate | Lệnh | PASS |
|---|---|---|
| Type | `npx tsc --noEmit` (web) | 0 error |
| Lint | `npm run lint` (web) | 0 error (warning <500 dashboard scope) |
| Build | `npm run build` (web) | PASS, `dashboard 675k` + `echarts 637k` |
| Test | `npx vitest run` | 8+ tests PASS (pagination 2 + breadth/dedup 4 + universe 2 + mới D1) |
| E2E | `npx playwright test dashboard-alert-realtime` | PASS 3 viewport (sau D1) |
| Data | `docker exec core-api python shell` | IntradayTick <1h, UnifiedAlert <5m |
| Manual | `/dashboard` | “Vừa xong” cho alert <5m, list sort recency, banner stale khi >1h, WS live không disconnect, poll giảm khi live |
| Ledger | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Mỗi slice 1 entry |

---

## 4. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Mock tick cho dev làm sai prod | `MOCK_TICK_ENABLED` chỉ khi `DJANGO_SETTINGS_MODULE != prod`, prod bắt buộc credential thật |
| Đổi ordering `type_priority` làm vỡ client cũ | Giữ `?sort=priority` fallback, mặc định `recency`, thông báo trong `CHANGELOG` |
| WS heartbeat spam | Chỉ heartbeat khi không có alert mới trong 30s, không khi có mới (đã có `whale_alert`) |
| `?since` filter bỏ sót alert cùng giây | Dùng `triggered_at__gte` + `pk` cursor, không chỉ `gt` |

---

## 5. Ước lượng & nhân sự

| Phase | Effort | Người | Ghi chú phụ thuộc vendor |
|---|---|---|---|
| A0 Verify prod/beta | 0 ngày | 1 BE | Chạy shell trên beta/prod, ghi evidence |
| A Gốc (A1-A3) | 2 ngày nếu prod stale / 0.5 ngày nếu chỉ dev (mock) | 1 BE | Nếu cần credential VNBROKER_GITHUB_TOKEN/DNSE thật → “phụ thuộc vendor, không cam kết cứng 2 ngày” |
| B Feed (B1-B3) | 1.5 ngày | 1 BE + 1 FE | |
| C Realtime (C1-C3) | 1 ngày | 1 BE + 1 FE | |
| D Ổn định (D1-D3) | 1.5 ngày | 1 QA + 1 FE | |
| **Tổng** | **6 ngày nếu prod stale / 4.5 ngày nếu chỉ dev** | | |

---

## 6. Checklist phê duyệt & phát hành

- [ ] Duyệt **mock tick cho dev** hay **cấp credential thật** (chặn A1)
- [ ] Duyệt **đổi ordering feed** `type_priority` → `recency` (B1) — có giữ `?sort=priority` không?
- [ ] Duyệt **banner stale** text: “Dữ liệu cảnh báo chậm X ngày — kiểm tra ingestion” (B3)
- [ ] Merge A1-A3 → verify DB <1h → merge B1-B3 → verify FE sort → merge C1-C3 → verify WS + poll → merge D1-D2 → E2E xanh trên `beta.edusuccess.vn`
- [ ] Tag `alert-realtime-fix-20260908`, `docs/AUDIT_DASHBOARD_ALERT_REALTIME_20260908.md` REV1 nếu có patch

---

## 7. Phụ lục — Lệnh tái kiểm nhanh

```bash
# Data freshness
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml exec -T core-api python -c "from market_data.models import IntradayTick; from market_serving.models import SymbolSnapshot; from signal_intelligence.models import UnifiedAlert; from django.utils import timezone; now=timezone.now(); print('tick', IntradayTick.objects.order_by('-timestamp').first().timestamp, 'age_h', (now - IntradayTick.objects.order_by('-timestamp').first().timestamp).total_seconds()/3600); print('alert', UnifiedAlert.objects.order_by('-triggered_at').first().triggered_at)"

# Feed order
curl -H "Authorization: Bearer <token>" "http://localhost:8001/core/v1/signals/alert-center/feed?page_size=20" | python -m json.tool | head -40

# Gates
npx tsc --noEmit
npm run lint 2>&1 | Select-String "problems"
npm run build 2>&1 | Select-String "built in"
npx vitest run src/hooks/useAlertCenterSnapshot.pagination.component.test.ts src/pages/DashboardPage.breadth-dedup.component.test.ts
npx playwright test tests/visual/dashboard-alert-realtime.spec.ts --project=chromium
```

**Tham chiếu:** `signal_intelligence/models.py:59`, `views.py:29,352`, `tasks.py:48,92`, `materializers.py:187`, `serializers.py:47`, `DashboardPage.tsx:256`, `useAlertCenterSnapshot.ts:30`, `CODE_CHANGE_AUDIT_LEDGER.md:34`, `AUDIT_DASHBOARD_ALERT_REALTIME_20260908.md:5`.
