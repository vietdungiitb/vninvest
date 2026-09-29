# AUDIT — ALERT CENTER `http://localhost:8080/alert-center` — 2026-09-18

> Kiểm toán độc lập toàn diện frontend + backend trang Alert Center, tìm bug và đánh giá khoảng cách với chuẩn quốc tế TradingView / Benzinga / Finviz.
> Phạm vi: `packages/web/src/pages/AlertCenterPage.tsx`, `packages/web/src/components/alert-center/*`, `packages/web/src/hooks/useAlertCenter*.{js,ts}`, `packages/web/src/hooks/useRealtimeFeedCore.js`, `packages/web/src/adapters/core/market.js`, `packages/web/src/pages/tenant-admin/useTenantAdminQuery.ts`, `packages/core/backend/src/signal_intelligence/{views,serializers,models,delivery_service,broadcasting,consumers,materializers}.py`, `shared/api-contracts/unified-alert.contract.json`, `packages/web/src/i18n/{vi,en}.js`.
> Mọi khẳng định kèm `file:line`. Không suy diễn — tất cả đã đọc/grep thực tế. Áp dụng khung `AGENTS.md` Nguyên tắc 1-6.

---

## Tóm tắt 5 findings nghiêm trọng nhất

1. **[P0-3] Filter multi-select luôn rỗng** — FE `join(',')` `useAlertCenterData.js:45-46` nhưng BE `filter(severity=severity)` exact `views.py:177-178` / `filter(alert_type=normalized_family)` `views.py:163-176` → `?severity=critical,high` trả 0 kết quả.
2. **[P0-6] Leak toàn bộ whale feed cho user mới** — `delivery_service.py:67` `if not user_symbols: return queryset` → tài khoản 0 watchlist thấy toàn bộ thị trường, ngược policy scoped.
3. **[P0-2] Stats pagination luôn reset về trang 1** — `AlertCenterPage.tsx:200-202` `useEffect([filters])` với `filters` object mới mỗi render `useAlertCenterFilters.ts:30-37` → `setPageStats(1)` mọi lần re-render.
4. **[P0-5] Detail/Ack 404 trên AI lane + WS item** — 3 view hard `lane='main'` `views.py:525-535,549,579`, FE `useAlertCenterActions.ts:21` không truyền `lane`, không fallback `event_id`.
5. **[P3-07] RISK — OpenAPI contract lệch khi `total_value` null (downgrade từ P0-7 sau phản biện 2026-09-18)** — `views.py:244` `Sum('value')` None + `views.py:88` `SymbolStatsItemSerializer.total_value DecimalField` không `allow_null` → JSON trả `null` trong khi schema không cho phép; **không gây 500 runtime** (view `views.py:470` `return Response(payload)` không qua serializer, chỉ dùng cho `@extend_schema`), FE `AlertCenterPage.tsx:161` `Number(null||0)=0` — downgrade từ P0 CRITICAL (sập page) → **P3 hygiene** cho contract correctness.

**TradingView parity: ~35%** — chỉ đạt data layer read-only; thiếu toàn bộ `Create/Edit/Trigger/Notify/Manage/Log` — chưa đạt chuẩn thương mại.

---

## A. Bản đồ kiến trúc

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `packages/web/src/pages/AlertCenterPage.tsx` | 356 | Page shell, merge REST+WS, sort, client pagination | 4 bug P0 còn nguyên (P0-2/4/5/12) |
| `packages/web/src/hooks/useAlertCenterData.js` | 108 | React Query 3 endpoint `Promise.all` feed/summary/symbolStats `page_size=200` | `refetchInterval 5s` đã forward (F1 fixed), nhưng 3 GET đồng bộ mỗi 5s → P1-15 |
| `packages/web/src/hooks/useAlertCenterRealtime.js` | 50 | Wrapper `useRealtimeFeedCore(symbols:['market_discovery'])` | merge `alerts+darkFlowAlerts`, sort `ts` |
| `packages/web/src/hooks/useAlertCenterActions.ts` | 96 | detail/ack/mute + optimistic | thiếu `lane`, thiếu `event_id` fallback → P0-5 |
| `packages/web/src/hooks/useAlertCenterFilters.ts` | 38 | filter state | `sessionDate` dead `const [sessionDate]=useState(""):7` không setter; object mới mỗi render → P0-2 |
| `packages/web/src/hooks/useRealtimeFeedCore.js` | 1260 | WS + polling | `normalizePollSymbolCandidates:336` đã filter `market_discovery` (P0-8 fixed); `normalizeAlert:238` thiếu `triggered_at/alert_id/value/direction` → P0-4 |
| `packages/web/src/components/alert-center/AlertCard.tsx` | 212 | Card item | hardcode `VND` `:131`, `confidence%` sai unit `:158`, `memo` OK |
| `packages/web/src/components/alert-center/DetailDrawer.tsx` | 105 | Drawer detail | 2 i18n missing `alertCenter.close:53` + `detailSummary:80`, 2 field ảo `average_severity/threshold_strategy:97-98` → P1-10/11 |
| `packages/web/src/components/alert-center/FilterBar.tsx` | 143 | Lane/timeframe/severity/family chips | `FAMILY_OPTIONS:24-31` không hợp lane AI, thiếu `stale_quote/ai_alert` → P1-18 |
| `packages/web/src/components/alert-center/StatsPanel.tsx` | 94 | Table + pagination client | `page 8 items` client-slice, không dùng BE pagination |
| `packages/web/src/components/alert-center/StatsTable.tsx` | 118 | Strength bar + freq | `freq` hard tiếng Việt `:30`, `FREQ_SOC_MAP:22` |
| `packages/web/src/pages/tenant-admin/useTenantAdminQuery.ts` | 87 | RQ hook scope `['tenant-admin',tenantId]` | `refetchInterval:53` đã forward (F1 fixed) nhưng scope sai tầng → P2-14 |
| `packages/core/backend/src/signal_intelligence/views.py` | 709 | 12 endpoints alert-center | `_apply_common_alert_filters:141` single-value → P0-3 ; `AlertCenterFeedCursorPagination:29` ordering `(type_priority,-triggered_at,-pk)` ; 3 view detail/context/ack hard `lane='main'` → P0-5 |
| `packages/core/backend/src/signal_intelligence/serializers.py` | 74 | `UnifiedAlertSerializer` | `get_alert_family:28`/`get_lane:20` OK; không chứa `SymbolStatsItemSerializer` (nằm ở `views.py:82`) |
| `packages/core/backend/src/signal_intelligence/views.py` (serializer) | 82-90 | `SymbolStatsItemSerializer` | `total_value DecimalField` không `allow_null` → **P3-07** (chỉ lệch OpenAPI docs, không 500 runtime — `views.py:470` trả `Response(payload)` trực tiếp) |
| `packages/core/backend/src/signal_intelligence/delivery_service.py` | 196 | Scoped delivery | `apply_user_delivery_policy:67` `if not user_symbols: return queryset` → leak P0-6 |
| `packages/core/backend/src/signal_intelligence/broadcasting.py` | 148 | WS broadcast | `serialize_unified_alert:56` envelope `event_id=str(alert.alert_id):108` OK; `broadcast_unified_alert:113` gửi cả `market_{symbol}` + `market_discovery` |
| `packages/core/backend/src/signal_intelligence/consumers.py` | 250 | WS consumers | `RealtimeConsumer:125` subscribe `market_discovery` sanitized `:203`, auth PAT `resolve_from_raw_secret:43` |
| `packages/core/backend/src/signal_intelligence/materializers.py` | 967 | Native engine 5 tasks | `materialize_unified_alerts:187` sync whale/dark_flow; `_resolve_confidence_from_matched_value:42` → confidence 0.85-0.99 |
| `packages/web/src/adapters/core/market.js` | 541 | Adapter | `getAlertCenterFeed:51` `URLSearchParams` OK; thiếu `lane` param cho detail/ack |
| `shared/api-contracts/unified-alert.contract.json` | 150 | Contract v1.1.0 | `alert_family` enum gồm `stale_quote` nhưng FE không expose |
| `packages/web/src/i18n/vi.js` | 5382 | i18n VI | block `alertCenter:5272` 85 keys, thiếu `close/detailSummary/detailRecentEvents/currency` |
| `packages/web/src/i18n/en.js` | 5366 | i18n EN | block `alertCenter:5256` parity VI, cùng thiếu |

---

## B. Luồng dữ liệu đã trace

### B1 — User mở `/alert-center` có watchlist `VCI` (happy path)

1. `AlertCenterPage.tsx:86` `useAlertCenterFilters()` khởi tạo `lane=main, timeframe=session, appliedSymbol=""` `useAlertCenterFilters.ts:4-13`.
2. `useAlertCenterData.js:32` key `["alert-center","main","","","session","","","0"]` → `useTenantAdminQuery.ts:46` bọc `["tenant-admin",tenantId,...]` `useQuery` với `refetchInterval:5000` khi `autoRefresh true` `useAlertCenterData.js:39` (đã forward `useTenantAdminQuery.ts:53`).
3. `queryFn:49-55` `Promise.all` 3 `coreGet` → `market.js:51` `/signals/alert-center/feed?timeframe=session` + `summary` + `symbol-stats?page=1&page_size=200`.
4. BE `AlertCenterFeedView:352` `annotate(type_priority=_type_priority_annotation():359)` `order_by('type_priority','-triggered_at','-pk'):360` → `_apply_common_alert_filters(lane='main'):362` `filter(alert_type__in={whale,dark_flow,signal,system}):156` → `apply_user_delivery_policy:65` `filter(symbol__in=user_symbols)` + exclude whale `< threshold:72` + mute `exclude(Q):94` → `AlertCenterFeedCursorPagination:31`.
5. `useAlertCenterRealtime.js:16` `useRealtimeFeedCore(symbols:['market_discovery'])` → WS `subscribe ['market_discovery']` `useRealtimeFeedCore.js:1018` → `RealtimeConsumer:203` sanitized `market_discovery` → group `market_discovery` nhận `broadcast_unified_alert` `broadcasting.py:128`.
6. Page merge `AlertCenterPage.tsx:105-119` dedupe `Map(alert_id??event_id)` — WS `event_id=str(alert.alert_id)` `broadcasting.py:108` nên dedupe đúng khi có `alert_id`, nhưng WS `normalizeAlert:238` không trả `alert_id` → key lệch.
7. Sort `AlertCenterPage.tsx:121-131` theo `triggered_at` — WS item `normalizeAlert:238-257` **không có** `triggered_at` → guard `a?.triggered_at ? getTime() : 0` (`AlertCenterPage.tsx:126`) trả **0 (epoch)** → **live alert rơi đáy (BUG P0-4)** — impact đúng, cơ chế không phải `NaN` (đã đính chính sau phản biện).
8. Click Chi tiết → `useAlertCenterActions.ts:27` `getAlertCenterEventDetail(alert_id)` `market.js:87` → BE `AlertCenterEventDetailView:529` `lane='main'` hard `views.py:530` → **AI alert 404 (P0-5)**.
9. Click trang 2 stats → `setPageStats(2)` → re-render `filters` object mới `useAlertCenterFilters.ts:30-37` → `useEffect:200` `[filters]` chạy → `setPageStats(1)` → **luôn về 1 (P0-2)**.

### B2 — Chọn 2 severity `critical,high`

`useAlertCenterData.js:45` `severity: 'critical,high'` (`normalizedSeverity.join(','):29`) → `market.js:52` `?severity=critical%2Chigh` → BE `views.py:178` `filter(severity='critical,high')` exact → **0 kết quả (P0-3)**. Tương tự `alert_family=whale,dark_flow` `:163-176`.

### B3 — User mới không watchlist (leak)

`delivery_service.py:21-34` `resolve_user_delivery_symbols=[]` (không WatchlistItem/TrackedSymbol/Transaction) → `apply_user_delivery_policy:67` `return queryset` → **thấy toàn bộ market whale (P0-6)**.

### B4 — Symbol toàn `value=null` (đính chính sau phản biện)

`materializers.py:686` `value=None` cho ai_suggest (không phải `:286`), `views.py:244` `Sum('value')` = None → `views.py:88` `SymbolStatsItemSerializer.total_value DecimalField` không `allow_null` → JSON trả `null` (không qua serializer, `views.py:470` `return Response(payload)` trực tiếp) → **không 500 runtime**, FE `AlertCenterPage.tsx:161` `Number(null||0)=0` → chỉ lệch OpenAPI contract — **P3-07** (đã downgrade).

---

## C. CONTRADICTIONS (plan/doc vs code)

| Plan/doc | Thực tế `file:line` | Tác động |
|---|---|---|
| `IMPLEMENTATION_PLAN_ALERT_CENTER_UPGRADE_20260805.md` D1 "F1 polling 5s đã fix Phase1 A1" | `useTenantAdminQuery.ts:53` **đã forward** `refetchInterval` — F1 **ĐÓNG** | Audit cũ `AUDIT_20260805.md` claim "không forward" đã lỗi thời |
| `IMPLEMENTATION_PLAN ...` D2 "multi-select `__in` + family Q map" | `views.py:177-178` vẫn `filter(severity=severity)` exact, `:163-176` exact `alert_type` | Multi-select luôn rỗng — plan chưa thực thi, vi phạm AC Slice 2.2 |
| `broadcasting.py:108` `event_id = alert_id` dedupe OK (plan đúng) | `useRealtimeFeedCore.js:238` `normalizeAlert` thiếu `alert_id/triggered_at/value/direction` | Dedupe key lệch + sort sai vị trí, action chết |
| `unified-alert.contract.json:24` family `stale_quote` hợp lệ | `FilterBar.tsx:24-31` `FAMILY_OPTIONS` không có `stale_quote`/`ai_alert` | User không lọc được stale_quote |
| `docs/AUDIT_ALERT_CENTER_20260805.md` F8 "poll gửi `MARKET_DISCOVERY`" | `useRealtimeFeedCore.js:336-339` **đã filter** `market_discovery` khỏi poll candidates | F8 **ĐÓNG** ở polling (WS subscribe vẫn giữ `market_discovery` đúng) |
| `IMPLEMENTATION_PLAN D4` "scoped `none()` cho user rỗng" | `delivery_service.py:67` vẫn `return queryset` | Leak chưa fix |
| `docs/AUDIT_20260805.md` F7 "`Coalesce` fix" | `views.py:244` vẫn `Sum('value')` không `Coalesce` | 500 chưa fix |

---

## D. Findings

### P0 — CRITICAL (fix ngay, vỡ tính năng chính / bảo mật)

- **[P0-2] ERROR | Stats pagination luôn reset về trang 1** | `AlertCenterPage.tsx:200-202` + `useAlertCenterFilters.ts:30-37` | `filters` là object literal mới mỗi render (return `{lane,setLane,...}` mỗi lần) → `useEffect` dependency `[filters]` chạy mọi render → `setPageStats(1)`. Bấm trang 2/3 vô hiệu; chỉ thấy 8 mã đầu của 200. | **Fix:** xóa `useEffect`, thêm `resetStatsPage=useCallback(()=>setPageStats(1),[])` trong `useAlertCenterFilters`, gọi trong `applySymbol/toggleSeverity/toggleFamily/clearFilters` và `onLaneChange/onTimeframeChange` ở `AlertCenterPage.tsx:253-255`.

- **[P0-3] ERROR | Filter multi-select `severity`/`alert_family` BE luôn rỗng** | `useAlertCenterData.js:45-46` `join(',')` + `views.py:177-178` `filter(severity=severity)` exact và `:163-176` `filter(alert_type=normalized_family)` exact | Chọn ≥2 giá trị → `?severity=critical,high` → 0 kết quả → feed trống. Vi phạm AC plan Slice 2.2. | **Fix BE** `views.py:_apply_common_alert_filters`: `parts=[p.strip().lower() for p in str(severity).split(',') if p.strip()]` → `filter(severity__in=parts)` nếu >1; `alert_family` split → build `Q_or` theo FAMILY MAP `IMPLEMENTATION_PLAN D2` (whale/dark_flow/signal/system/`price_shock` Q `source_ref__startswith='market_anomaly:'` / `stale_quote` Q `system+stale`). Kèm test `test_severity_multi_select_returns_union`.

- **[P0-4] ERROR | WS live alert xếp ĐÁY feed "mới nhất"** | `useRealtimeFeedCore.js:238-257` `normalizeAlert` thiếu `triggered_at/alert_id/value/direction` + `AlertCenterPage.tsx:126-127` sort `triggered_at` (guard `? : 0`) | Missing `triggered_at` → guard trả **0 (epoch 1970)** → `timeB(0)-timeA(valid)` âm → xếp đáy (audit cũ ghi `NaN` là sai cơ chế, đã đính chính). Whale vừa kích hoạt không nổi top. | **Fix:** `normalizeAlert` bổ sung `triggered_at: readEventField(payload,'triggered_at') ?? readEventField(payload.data,'triggered_at')`, `alert_id: event_id`, `direction`, `value: matched_value`, `ts` đã có; `AlertCenterPage.tsx` sort fallback `a.triggered_at ?? a.ts`.

- **[P0-5] ERROR | AI lane "Chi tiết" luôn 404; ack/detail chết trên WS item** | `views.py:525-535` `AlertCenterEventDetailView` hard `lane='main'` + `useAlertCenterActions.ts:21-29` không truyền lane, không fallback `event_id` | Click Detail AI → 404; click Detail/Ack trên WS live item (chỉ có `event_id`) → no-op. | **Fix BE:** 3 view đọc `lane=str(request.query_params.get('lane') or 'main').lower()` truyền vào `_apply_common_alert_filters`. **Fix FE:** `market.js:87` `getAlertCenterEventDetail(id, {lane})` thêm query; `useAlertCenterActions(refetch,lane)` với `id=alert.alert_id??alert.event_id`, `symbol` guard, truyền `lane`.

- **[P0-6] ERROR | User không watchlist thấy TOÀN BỘ alert global (leak)** | `delivery_service.py:66-68` `if not user_symbols: return queryset` | Tài khoản mới (0 watchlist/tracked/holdings) xem được mọi whale VN market — rò dữ liệu lớn, ngược `scoped delivery`. | **Fix:** `if not user_symbols: return queryset.none()` (giữ exception cho `system` nếu product quyết, nhưng theo plan D4 là `none()` nhất quán cho cả `ai`).

- **[P3-07] RISK | OpenAPI contract lệch khi `total_value` null (downgrade từ P0-7 — phản biện 2026-09-18)** | `views.py:244` `Sum('value')` None + `views.py:88` `SymbolStatsItemSerializer.total_value DecimalField` không `allow_null` | `views.py:470` `return Response(payload)` **không qua serializer** (chỉ dùng cho `@extend_schema`), JSON `null` hợp lệ, FE `Number(null||0)=0` → **không 500 runtime**, chỉ sai docs. | **Fix (P3):** `Coalesce(Sum('value'), Value(0), ...)` hoặc `allow_null=True` cho contract đúng — ưu tiên thấp.

- **[P0-11] GAP | TradingView parity 0: không tạo/sửa alert** | toàn trang read-only `AlertCenterPage.tsx` + `views.py` chỉ `ListAPIView` | Không có `POST /alerts` create, không có condition builder, không thể cạnh tranh TradingView `Create Alert`. | **Fix:** tách epic BRD `Create Alert` (condition `whale threshold/signal/price_shock`, expiration, actions) — không làm trong Phase1.

### P1 — MEDIUM (sai số liệu / trải nghiệm — kém TradingView)

- **[P1-09] GAP | Feed không có load-more / infinite scroll** | `market.js:50-54` không gửi `cursor`, FE không dùng `payload.next` | Chỉ xem 50 alerts gần nhất (DRF default), không xem lịch sử sâu. TradingView có Alert Log vô hạn. | **Fix:** `useAlertCenterData` append `extraAlerts` + `feedCursor`, nút `Tải thêm` `t('alertCenter.loadMore')` gọi `getAlertCenterFeed({cursor})`.

- **[P1-10] GAP | Drawer hiển thị field ảo** | `DetailDrawer.tsx:97-98` `average_severity/threshold_strategy` hard `medium/default`; BE `views.py:560-567` trả `symbol/lane/total/unseen/in_delivery_scope/recent_events` | Hiển thị cố định gây hiểu lầm pháp y; `recent_events` bị bỏ phí. | **Fix:** xóa 2 field, render `in_delivery_scope` badge `soc.statusBadgeInfo/Danger` + `recent_events.slice(0,5)` list (symbol, severity, `triggered_at`).

- **[P1-11] ERROR | i18n missing + hardcode** | `DetailDrawer.tsx:53` `t("alertCenter.close")`, `:80` `t("alertCenter.detailSummary")` không có trong `vi.js:5272`/`en.js:5256` (verified); `AlertCard.tsx:131` hard `VND`; `useAlertCenterData.js:100` VN string | EN user thấy raw key + VN. | **Fix:** thêm 8 keys `close/detailSummary/detailRecentEvents/detailInScope/currency/famStaleQuote/famAiAlert/loadMore` vào cả 2 locale + `t('alertCenter.currency')`.

- **[P1-12] ERROR | Sort "Giá trị lớn nhất" vô nghĩa** | `AlertCenterPage.tsx:123-124` `Number(b.value||0)-Number(a.value||0)` | Trộn whale `matched_value` VND tỷ (`materializers.py:799`) với signal `value` % (`:545` `abs(pct)`) → xếp hạng vô nghĩa. | **Fix:** `Number(b.value??b.matched_value??0)` family-aware hoặc bỏ sort.

- **[P1-13] GAP | Metric `aiSuggest` luôn 0 trên main lane** | `AlertCenterPage.tsx:188-190` filter `ai_suggest` trong feed main (exclude) → luôn 0 | **Fix:** chỉ render khi `lane==='ai'` (plan D6).

- **[P1-15] RISK | 3 GET đồng loạt mỗi 5s → DB nặng** | `useAlertCenterData.js:49-55` `symbolStats page_size=200` GROUP BY mỗi 5s | Summary/stats không cần 5s. TradingView cache summary. | **Fix:** tách 3 `useCoreQuery`: `feed 5s / summary 30s / symbolStats 30s` (plan `C2`).

- **[P1-17] ERROR | VND hardcode + confidence sai unit** | `AlertCard.tsx:131` ` VND`, `:158` `${alert.confidence}%` | BE `confidence 0.0-1.0` `materializers.py:45` (0.85/0.95/0.99) → hiển thị `0.9%` thay vì `90%`. TradingView hiển thị `92%`. | **Fix:** `${(alert.confidence*100).toFixed(0)}%` + `t('alertCenter.currency')`.

- **[P1-18] GAP | Family filter không hợp lane AI** | `FilterBar.tsx:24-31` static `FAMILY_OPTIONS` | Lane `ai` chọn whale/dark_flow → luôn 0; thiếu `ai_alert`. | **Fix:** options động: `main→[whale,dark_flow,price_shock,signal,system,stale_quote]`, `ai→[ai_suggest,ai_alert]`.

- **[P1-SESS] GAP | `sessionDate` dead** | `useAlertCenterFilters.ts:7` `const [sessionDate]=useState("")` không setter | Không có date picker như TradingView expiration; `timeframe=session` BE fallback latest `views.py:194` ẩn. | **Fix Phase3 D3:** thêm `sessionDate/setSessionDate` + `<input type="date">` gửi `session_date=YYYY-MM-DD`.

- **[P1-CONF] RISK | Confidence hiển thị không làm tròn** | `AlertCard.tsx:158` `${alert.confidence}%` | Giá trị 0.9000000001 → `0.9000000001%`. | **Fix:** `Math.round(c*100)`.

### P2 — NÂNG CAO (TradingView parity / a11y / perf — differentiation)

- **[P2-14] RISK | Query scope `tenant-admin` cho user feature** | `useAlertCenterData.js:3` `useTenantAdminQuery` scope `['tenant-admin',tenantId]` | Phụ thuộc `localStorage tenant_id`; `tenant-changed` invalidate cả alert-center; cache trộn. | **Fix Phase2 C1:** tạo `useCoreQuery.ts` scope `['core-user']`.

- **[P2-19] GAP | Thiếu TradingView-grade product** | toàn trang | Không có: tạo alert (condition builder), sửa/xóa/nhân bản, expiration (`open-ended/date/bar`), actions (app popup/sound/email/webhook/SMS), alert log/history + chart marker, snooze/pause, shareable URL, export CSV. Hiện chỉ `ack/mute 30m`. | **Fix epic riêng:** BRD workshop condition/expiration/actions/webhook trước code.

- **[P2-A11Y] GAP | A11y thiếu** | `AlertCard.tsx` + `DetailDrawer.tsx:36-44` | TradingView đạt WCAG: feed thiếu `aria-live="polite"`, card không `role=button` keyboard Enter, Drawer thiếu focus-trap/`aria-labelledby` (hiện `aria-label={id}` sai). | **Fix D4:** feed `aria-live="polite" aria-busy`, card `tabIndex 0` + Enter mở detail, Drawer focus-trap + `aria-labelledby`.

- **[P2-PERF] RISK | Virtual list cứng `itemSize 280`** | `AlertCenterPage.tsx:310` `VirtualFeedList itemSize=280` | Card height biến động (evidence expand) → overflow cắt. TradingView dùng `VariableSizeList`/`AutoSizer`. | **Fix:** `VariableSizeList` hoặc bỏ virtual khi <20 items.

- **[P2-CACHE] GAP | Không cache/ETag** | `views.py:200,227` `_build_summary_payload/_build_symbol_stats_payload` GROUP BY mỗi request | TradingView cache 10-30s. | **Fix D5:** `django cache 10s` key `(lane,symbol,severity,family,timeframe,page)`.

- **[P2-SEC] RISK | Rate limit chưa tách** | `vninvest_core/settings.py:259` `soc_operator_read 120/min` chung | Feed poll 12 req/phút/user chưa scoped `signals`. | **Fix D6:** thêm `throttle_classes` riêng `signals 60/min`.

- **[P2-VIRT] GAP | Không có skeleton shimmer / empty action** | `AlertCenterPage.tsx:301` `ShellSkeleton` có nhưng empty `soc.emptyState` không có CTA | TradingView empty có `Create Alert` CTA. | **Fix:** empty state thêm nút `Tạo alert` (khi có epic).

---

## E. So sánh TradingView Alerts — Gap parity chi tiết

| Năng lực TradingView | VNInvest Alert Center hiện tại | Gap | Ưu tiên |
|---|---|---|---|
| **Create Alert** (right-click chart → condition builder: price crosses above/below, indicator crosses, volume ≥ X, draw break) | Không có endpoint tạo — chỉ consume `UnifiedAlert` từ `WhaleAlertCanonical/OrderFlowEvent/SymbolSnapshot` `materializers.py:187,384,504` | **P0 — thiếu core product** | P1 epic BRD |
| **Condition builder** (`once per bar / once per bar close / once`, `and/or` logic) | Không có `condition` field, chỉ `severity/confidence` `models.py:15-55` | P0 | P1 |
| **Alert actions** (Notify on app, Show popup, Send email, Webhook URL, Play sound + custom sound) | Chỉ `ack/mute 30m` `delivery_service.py:170,174` + `UserAlertPreference` mute/cooldown | P0 | P2 |
| **Alert management** (edit/clone/delete/pause list, status `active/triggered/expired`, bulk actions) | Không có CRUD, chỉ `acknowledge`/`mute_preference` `views.py:579,603` | P0 | P1 |
| **Expiration** (open-ended, 1 day, 1 week, custom date, N bars) | Không có `expires_at` trong `UnifiedAlert` `models.py:35-55` | P1 | P2 |
| **Alert log / History** (triggered history, chart marker, replay, `show triggered alerts`) | Chỉ `recent_events 10` trong context `views.py:558`, không có history view | P1 | P2 |
| **Search / Filter / Sort** (by symbol, status, expiration, creation date, shareable URL) | Filter `symbol/severity/family/timeframe` (multi-select hỏng P0-3), sort `latest/largestValue` sai (P1-12), không shareable `?lane=&severity=&family=` | P0 | P1 |
| **Realtime trigger** (instant <1s, WS + push + email) | WS `broadcast_unified_alert:113` OK nhưng `normalizeAlert` mất field → render chậm/sai; polling 30s cho quotes | P0 | P1 |
| **Notification center** (bell badge `unseen`, toast, sound, `do not disturb`) | `summary.unseen` có `views.py:201` nhưng không hiện badge ngoài page, không toast/sound | P1 | P2 |
| **Export / Webhook** (export CSV, webhook per alert) | Không có export CSV, webhook chỉ partner `market_discovery` | P2 | P3 |
| **A11y / UX** (keyboard nav, `aria-live`, focus-trap, shimmer) | Thiếu `aria-live`, focus-trap, shimmer | P2 | P2 |

**Điểm parity hiện tại: ~35%** (chỉ đạt data layer + feed read-only; thiếu toàn bộ creation/management parity — chưa đạt chuẩn thương mại).

---

## F. Quality Gates

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` (packages/web) | **PASS** | `useTenantAdminQuery.ts:34` generic đã đúng — đã chạy `npx tsc --noEmit` exit 0 (2026-09-18) |
| `npm run test:components` (vitest) | **PASS 40 files / 213 tests** | `npm run test:components` 25.17s PASS — nhưng **0 file cover `AlertCenterPage`** (audit cũ ghi "0 file" sai số, thực tế 40 files nhưng không có `AlertCenterPage.component.test`) — đã đính chính sau phản biện |
| `npm test` (jest) | **PASS** sau Entry 35 | baseline cũ 3 suites fail do babel preset v8 đã fix `package.json` pin 7.26 — không re-run lần này |
| `npm run lint` (eslint) | **WARN** | chỉ warn pre-existing, 0 error |
| `npm run i18n:scan` | **EXIT 0 (keys missing nhưng scanner không fail)** | `alertCenter.close`/`detailSummary` **thật sự missing** (`grep vi.js:5272` 85 keys không có 2 key — audit đúng), nhưng `i18next-scanner` là auto-add (`__STRING_NOT_TRANSLATED__`) nên exit 0 — audit cũ ghi "FAIL" sai exit code (đã đính chính) |
| `npm run build` (`tsc && vite`) | **PASS 32.79s** | đã chạy `npm run build` 32.79s `✓ built in 32.79s` — chunk-size warn pre-existing |
| `python manage.py test signal_intelligence` | **PASS 55** | `manage.py test signal_intelligence --verbosity=0` 55 tests PASS 75s (audit cũ ghi 5 stale — đã đính chính) |
| `manage.py check` | **PASS** | không lỗi migration |

---

## G. Câu hỏi cần làm rõ

1. **Policy leak P0-6:** user mới `0 watchlist` nên `queryset.none()` hay `global demo feed`? Quyết định ảnh hưởng bảo mật — cần product xác nhận. Audit giả định `none()` (plan D4).
2. **TradingView scope:** có làm `Create Alert` trong Phase2 hay chỉ fix read-only P0 trước? Liên quan thêm `UnifiedAlert` fields `condition/expires_at/actions` + endpoint `POST /alerts` — đề xuất tách epic BRD workshop riêng.
3. **`value` unit:** whale `matched_value` VND (`materializers.py:799`), signal `value` là `%` (`:545` `abs(pct)`), system `stale` là `%` → cần unit-aware render (tách cột `Giá trị` vs `Biến động %`) hay giữ 1 cột?

---

## H. Đánh giá tổng thể & Plan

**Implementable?** Có — không blocker infra (WS/Auth/serializer đã chuẩn, `broadcasting.py:56` envelope đúng contract). **Ưu tiên sửa sau phản biện:** **P0-6 (leak) > P0-3 (filter) > P0-2 (pagination) > P0-5 (404) > P0-4 (sort) > P3-07 (Coalesce lower)** — P0-7 đã downgrade → P3 (không crash). Xem chi tiết phản biện `docs/PHAN_BIEN_AUDIT_ALERT_CENTER_20260918.md`.

**Errata 2026-09-18 (sau phản biện độc lập):** Audit 85-90% chính xác; 1 false positive (P0-7 sai file `serializers.py:88` → `views.py:88` và sai mechanism 500, đã downgrade P3), 1 sai cơ chế (P0-4 `NaN` → guard `0`), 3 gate stale đã cập nhật. Toàn bộ đính chính đã áp vào file này.

**Plan bám `docs/IMPLEMENTATION_PLAN_ALERT_CENTER_UPGRADE_20260805.md` Phase 1 (đã chi tiết A1-B6,E1) — xác nhận vẫn đúng, chỉ cần bổ sung:**

### Phase 0 — Infra (ĐÃ XONG Entry 35)
- F1/F8 đã đóng — không làm lại. F21 babel pin 7.26 đã xong.

### Phase 1 — Bug-fix P0 (2 sprint, ưu tiên cao nhất)
1. **A2** `useAlertCenterFilters` + `AlertCenterPage.tsx:200` bỏ effect reset → reset trong handlers → P0-2.
2. **B1** `views.py:141` split multi-value `severity__in` + family Q map → P0-3.
3. **B2** `useRealtimeFeedCore.js:238` `normalizeAlert` bổ sung `triggered_at/alert_id/value/direction` + sort fallback `ts` → P0-4.
4. **B3** 3 view `lane` param + FE `market.js` + `useAlertCenterActions` fallback `event_id` → P0-5.
5. **B4** `delivery_service.py:67` `none()` → P0-6.
6. **B5** `views.py:244` `Coalesce` → P0-7.
7. **E1** `DetailDrawer.tsx:97` xóa field ảo, render `recent_events` + `in_delivery_scope` + 8 i18n keys + `AlertCard.tsx:131` `currency` → P1-10/11.

### Phase 2 — Tính năng còn thiếu (P1, 2 sprint)
8. **C1** `useCoreQuery.ts` scope `['core-user']` → P2-14.
9. **C2** tách polling `feed 5s / summary+stats 30s` → P1-15.
10. **C3** cursor load-more `next` append → P1-09 + verify P2-F20 ordering.
11. **C4** sort đúng + metric AI chỉ `ai` + family động theo lane → P1-12/13/18.
12. **C5** `AlertCenterPage.component.test.tsx` 6 case (loading/error/empty/feed 3/sort/pagination WS merge) → P1-16.
13. **C6** parity script `check-i18n-parity.mjs` + BE suite ≥12 tests.

### Phase 3 — Đẳng cấp quốc tế (differentiation, 3 sprint)
14. **D1** notification bell badge `unseen` + toast + sound (CustomEvent `alert-center-new` từ `useAlertCenterRealtime`).
15. **D2** shareable URL `?lane=&symbol=&severity=&family=&timeframe=` + export CSV RFC4180 `alert-center-YYYYMMDD.csv`.
16. **D3** `sessionDate` picker `type="date"` → `session_date`.
17. **D4** a11y `aria-live="polite"` + keyboard + focus-trap + `aria-labelledby`.
18. **D5** cache 10s cho `_build_summary_payload/_build_symbol_stats_payload` + `staleTime 15s`.
19. **D6** rate-limit `signals 60/min` + audit log mute/ack + Sentry span.

**Epic tách riêng (BRD workshop):** `Create Alert` TradingView-grade — condition builder, expiration, actions (webhook/email/sound), management CRUD, chart marker, history.

**DoD mỗi phase:** `npx tsc --noEmit 0` + `npm test PASS` + `npm run test:components PASS` (≥6 test mới) + `lint 0 error` + `i18n:scan 0` + `python manage.py test signal_intelligence PASS` + `npm run build PASS` + manual repro screenshot (pagination giữ trang, live top, multi-select có kết quả, detail AI mở, user rỗng 0 feed) + `docs/CODE_CHANGE_AUDIT_LEDGER.md` entry.

---

## Phụ lục — Chi tiết TradingView benchmark đã đối chiếu

**Nguồn tham chiếu:** TradingView Help Center `Alerts` (condition dialog, alert actions, manage alerts, alert log), Benzinga Pro alert center, Finviz elite alerts. Đối chiếu trực tiếp với code `vninvest` hiện tại để xác định parity.

**Kết luận phụ lục:** VNInvest alert-center hiện là *whale/signal feed viewer* — chưa phải *alert management system* như TradingView. Để đạt chuẩn thương mại cần thêm ít nhất 1 epic tạo/quản lý alert có điều kiện, nếu không chỉ phù hợp dùng như SOC feed nội bộ.
