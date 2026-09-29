# AUDIT — ALERT CENTER (http://localhost/alert-center) 2026-08-05

> Kiểm toán độc lập toàn diện frontend + backend trang Alert Center, tìm bug và xây plan nâng cấp đạt đẳng cấp quốc tế (TradingView/Benzinga/Finviz class).
> Phạm vi: `packages/web/src/pages/AlertCenterPage.tsx`, `packages/web/src/components/alert-center/*`, `packages/web/src/hooks/useAlertCenter*.{js,ts}`, `packages/web/src/hooks/useRealtimeFeedCore.js`, `packages/web/src/adapters/core/market.js`, `packages/core/backend/src/signal_intelligence/{views,serializers,models,delivery_service,broadcasting,consumers,materializers}.py`, `packages/web/src/pages/tenant-admin/useTenantAdminQuery.ts`, `packages/web/src/providers/QueryProvider.tsx`, `src/i18n/{vi,en}.js`.
> Mọi khẳng định kèm `file:line`. Không suy diễn — tất cả đã đọc/grep thực tế.

---

## A. Bản đồ kiến trúc

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `packages/web/src/pages/AlertCenterPage.tsx` | 356 | Page shell, merge REST+WS, sort, pagination stats | có 4 bug P0 (xem mục D) |
| `packages/web/src/hooks/useAlertCenterData.js` | 108 | React Query 3 endpoints (feed/summary/symbolStats) | `refetchInterval` bị drop |
| `packages/web/src/hooks/useAlertCenterRealtime.js` | 50 | WS wrapper global feed (`market_discovery`) | merge whale+dark_flow |
| `packages/web/src/hooks/useAlertCenterActions.ts` | 96 | detail/ack/mute + optimistic | ack/detail chết trên WS item |
| `packages/web/src/hooks/useAlertCenterFilters.ts` | 38 | filter state | `sessionDate` dead, `filters` object mới mỗi render |
| `packages/web/src/hooks/useRealtimeFeedCore.js` | 1256 | WS + polling quotes | poll mã giả `market_discovery` |
| `packages/web/src/components/alert-center/AlertCard.tsx` | 212 | Card item | hardcode "VND" |
| `packages/web/src/components/alert-center/DetailDrawer.tsx` | 105 | Drawer detail | 2 i18n missing key + 2 field không tồn tại backend |
| `packages/web/src/components/alert-center/FilterBar.tsx` | 143 | Lane/timeframe/severity/family chips | family options không hợp lane ai |
| `packages/web/src/components/alert-center/StatsPanel.tsx` | 94 | Bảng thống kê + pagination | pagination bị reset |
| `packages/web/src/components/alert-center/StatsTable.tsx` | 118 | Bảng strength bar | — |
| `packages/web/src/pages/tenant-admin/useTenantAdminQuery.ts` | 83 | Generic RQ hook (tenant scope) | KHÔNG forward `refetchInterval` → bug P0 |
| `packages/core/backend/src/signal_intelligence/views.py` | 709 | 12 endpoints alert-center | 2 bug P0 (multi-select filter, lane-404) |
| `packages/core/backend/src/signal_intelligence/serializers.py` | 74 | UnifiedAlert serializer | `total_value` DecimalField null → 500 |
| `packages/core/backend/src/signal_intelligence/delivery_service.py` | 196 | Delivery policy scope | user không có symbol → thấy GLOBAL feed (leak) |
| `packages/core/backend/src/signal_intelligence/broadcasting.py` | 148 | WS broadcast | event_id = alert_id (dedupe OK) |

---

## B. Luồng dữ liệu đã trace (use-case: user mở /alert-center, có watchlist)

1. `AlertCenterPage` mount → `useAlertCenterFilters()` khởi tạo lane=main, timeframe=session, appliedSymbol="" (useAlertCenterFilters.ts:4-13).
2. `useAlertCenterData` tạo queryKey `["alert-center","main","","","session","","","0"]` (useAlertCenterData.js:32) → `useTenantAdminQuery` bọc thêm scope `["tenant-admin", tenantId, ...]` (useTenantAdminQuery.ts:44).
3. queryFn `Promise.all` 3 endpoint: feed, summary, symbol-stats page_size=200 (useAlertCenterData.js:49-55) → adapter `coreGet('/signals/alert-center/feed?...')` (market.js:50-54).
4. Backend: `AlertCenterFeedView.get_queryset` → `_apply_common_alert_filters(lane='main')` (views.py:355-363) → `apply_user_delivery_policy` filter theo watchlist+tracked+holdings (delivery_service.py:65-96) → `AlertCenterFeedCursorPagination` ordering `(type_priority, -triggered_at, -pk)` (views.py:29-31).
5. `useAlertCenterRealtime` mở WS subscribe `['market_discovery','market_discovery']` (useRealtimeFeedCore.js:1013-1014) → backend group `market_discovery` nhận mọi `broadcast_unified_alert` (broadcasting.py:113-129).
6. Page merge REST results + WS alerts dedupe theo `alert_id ?? event_id` — cả 2 đều là UUID của UnifiedAlert → dedupe hoạt động (AlertCenterPage.tsx:109-118).
7. Sort theo `triggered_at` (AlertCenterPage.tsx:121-131) — WS item KHÔNG có `triggered_at` (normalizeAlert useRealtimeFeedCore.js:238-257) → NaN → **live alert rơi xuống đáy feed (BUG P0-4)**.
8. Click "Chi tiết" → `getAlertCenterEventDetail(alert_id)` (market.js:86-88) → `AlertCenterEventDetailView` scoped lane='main' (views.py:528-531) → AI alert = 404 (BUG P0-5).
9. Click phân trang stats → `setPageStats(2)` → re-render → effect `[filters]` chạy → `setPageStats(1)` (AlertCenterPage.tsx:200-202) → **luôn về trang 1 (BUG P0-2)**.

---

## C. CONTRADICTIONS (plan/doc vs code)

| Plan/doc | Thực tế | Tác động |
|---|---|---|
| `IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md:46,50` — "Giữ polling 5s làm fallback khi WS down" | `useTenantAdminQuery.ts:34-52` không forward `refetchInterval` → polling 5s KHÔNG bao giờ chạy | Feed REST chỉ cập nhật khi user bấm Refresh; live badge hiển thị sai |
| `IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md:89-90,106` — AC "chọn whale+dark_flow → `?alert_family=whale,dark_flow`" | `views.py:163-176` filter exact match nguyên chuỗi `'whale,dark_flow'` → không khớp bản ghi nào | Multi-select filter luôn trả 0 kết quả |
| `IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md:36` — "Không duplicate event_id" | Dedupe theo `alert_id ?? event_id` (AlertCenterPage.tsx:111,115) — WS `event_id` = REST `alert_id` (broadcasting.py:108) → dedupe OK | Không phải bug (đã verify) |
| `IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md:101` — family values gồm `stale_quote` | `FilterBar.tsx:24-31` FAMILY_OPTIONS KHÔNG có `stale_quote` | User không lọc được stale_quote qua UI |
| `AUDIT_ALERT_CENTER_20260718.md` (P0 F1) — "WS đến nhưng không render" | Đã render (merge), nhưng live item thiếu `triggered_at`/`alert_id` → sai vị trí + action chết | Hiệu quả realtime không đạt AC |

---

## D. Findings

### P0 — CRITICAL (fix ngay, làm vỡ tính năng chính)

- **[F1] ERROR | Auto-refresh 5s hoàn toàn không hoạt động** | `useAlertCenterData.js:39` → `useTenantAdminQuery.ts:34-52` | Option `refetchInterval` không được forward vào `useQuery`. Feed/summary/stats chỉ load 1 lần; alert mới từ backend không bao giờ xuất hiện nếu WS không gửi (WS có gửi whale/dark_flow nhưng không gửi system/ai alerts). Live badge "LIVE (5s)" là giả. | **Fix**: thêm `refetchInterval` vào options của `useTenantAdminQuery` hoặc tách hook `useAlertCenterQuery` riêng (không dùng tenant-admin scope cho user feature).
- **[F2] ERROR | Phân trang bảng stats luôn reset về trang 1** | `AlertCenterPage.tsx:200-202` + `useAlertCenterFilters.ts:30-37` | `filters` là object literal mới mỗi render → effect `[filters]` chạy mọi render → `setPageStats(1)`. Bấm trang 2/3 vô hiệu; user chỉ thấy 8 mã đầu tiên của 200. | **Fix**: bỏ effect; reset page trong `applySymbol`/`toggleSeverity`/`toggleFamily`/`setLane` handlers thay vì effect trên object identity.
- **[F3] ERROR | Filter multi-select severity/alert_family backend luôn trả rỗng** | `useAlertCenterData.js:45-46` join `','` + `views.py:177-178` (`filter(severity=severity)` exact) và `views.py:176` (`filter(alert_type=normalized_family)` exact) | Chọn ≥2 severity hoặc ≥2 family → query `severity=critical,high` → 0 kết quả → feed trống, user tưởng không có alert. Vi phạm AC plan Slice 2.2. | **Fix backend**: split `','` → `filter(severity__in=parts)`; `alert_family` map danh sách (kể cả `stale_quote`) → `filter(alert_type__in=...)`. Kèm test.
- **[F4] ERROR | Live WS alert bị xếp xuống ĐÁY feed "mới nhất"** | `useRealtimeFeedCore.js:238-257` (`normalizeAlert` không lấy `triggered_at`) + `AlertCenterPage.tsx:126-128` (sort theo `triggered_at`) | Comparator nhận NaN → thứ tự giữ nguyên → WS items (append sau REST) nằm cuối danh sách. Alert whale vừa kích hoạt không bao giờ nổi top — ngược hoàn toàn mục đích realtime. | **Fix**: `normalizeAlert` bổ sung `triggered_at` từ `data.triggered_at`; sort fallback `ts`.
- **[F5] ERROR | AI lane: "Chi tiết" luôn 404; ack/detail chết trên WS items** | `useAlertCenterActions.ts:21-29` (không truyền lane) + `views.py:525-535` (`AlertCenterEventDetailView` scoped main) + `normalizeAlert` thiếu `alert_id` | Click Detail alert AI → 404; click Detail/Ack trên live WS item → no-op im lặng (thiếu `alert_id`). | **Fix**: thêm query param `lane` vào detail/context endpoints; backend nhận `lane`; `handleLoadDetail`/`handleAcknowledge` fallback `event_id`; WS serializer bổ sung `alert_id`.
- **[F6] ERROR | User không có watchlist/tracked/holdings thấy TOÀN BỘ alert global** | `delivery_service.py:66-68` `if not user_symbols: return queryset` | Tài khoản mới đăng ký (0 watchlist) xem được mọi whale alert VN market — rò rỉ dữ liệu giao dịch lớn, ngược chính sách "scoped delivery". | **Fix**: khi `user_symbols` rỗng trả `qs.none()` cho lane main; chỉ exception cho ai lane/system theo thiết kế.
- **[F7] ERROR | 500 khi `total_value` null** | `views.py:244` `Sum('value')` có thể None + `serializers.py:88` `DecimalField` không `allow_null` | Symbol có toàn bộ alert value null → symbol-stats 500 → toàn page lỗi (vì Promise.all). | **Fix**: `Coalesce(Sum('value'), Value(0))` hoặc `allow_null=True`.
- **[F8] ERROR | WS polling gửi request rác cho mã giả `market_discovery`** | `useRealtimeFeedCore.js:737-855` coi `market_discovery` là symbol cần quote; `normalizePollSymbolCandidates` luôn đưa vào staleOrMissing | Mỗi 30s (WS healthy) gọi `GET /realtime/tickers/?symbols=MARKET_DISCOVERY` vô nghĩa; có thể kích recovery mode. | **Fix**: loại pseudo-symbol khỏi poll candidates (chỉ giữ cho WS subscribe).

### P1 — MEDIUM

- **[F9] GAP | Feed không có load-more** | `market.js:50-54` không gửi `cursor`; page_size default 50 | User chỉ xem 50 alerts gần nhất, không xem được lịch sử sâu hơn. Cursor pagination backend có sẵn. | **Fix**: thêm "Load more" → gửi `cursor=next` append vào danh sách.
- **[F10] GAP | DetailDrawer hiển thị field không có thật** | `DetailDrawer.tsx:97-98` `average_severity`/`threshold_strategy`; backend context trả `symbol/lane/total/unseen/in_delivery_scope/recent_events` (views.py:560-567) | Hiển thị "medium"/"default" cố định — gây hiểu lầm dữ liệu pháp y. `recent_events` backend trả nhưng UI bỏ phí. | **Fix**: bỏ 2 field, render `recent_events` list + `in_delivery_scope`.
- **[F11] ERROR | i18n missing keys** | `DetailDrawer.tsx:53` `t("alertCenter.close")`, `DetailDrawer.tsx:80` `t("alertCenter.detailSummary")` — không tồn tại trong `vi.js`/`en.js` (verified regex) | Hiện raw key string trên UI + aria-label. | **Fix**: thêm 2 key vào cả 2 dict + i18n scan.
- **[F12] ERROR | Sort "Giá trị lớn nhất" sai đơn vị/ý nghĩa** | `AlertCenterPage.tsx:123-125` `Number(b.value) - Number(a.value)` | Trộn whale matched_value với signal value → thứ hạng vô nghĩa. | **Fix**: sort theo `matched_value`/`value` có family-aware hoặc bỏ.
- **[F13] GAP | aiSuggest metric luôn 0 trên main lane** | `AlertCenterPage.tsx:188-190` filter `ai_suggest` trong feed main (exclude ai types) | Metric luôn 0 sai lệch. | **Fix**: đếm từ payload ai lane riêng hoặc summary API.
- **[F14] RISK | Query scope sai tầng** | `useAlertCenterData.js:3` dùng `useTenantAdminQuery` (scope `['tenant-admin', tenant_id]`) cho user feature | Phụ thuộc localStorage `tenant_id`; `tenant-changed` event invalidate luôn cả alert-center; data user bị trộn cache tenant. | **Fix**: tách `useCoreQuery` generic (scope `['user']`) như tenant-admin.
- **[F15] RISK | 3 endpoint GET đồng loạt mỗi 5s** (sau khi fix F1) | `useAlertCenterData.js:49-55` | symbol-stats page_size=200 GROUP BY cả bảng mỗi 5s → tải DB; summary+stats không cần refresh nhanh. | **Fix**: feed 5s; summary/stats 30-60s; debounce filter.
- **[F16] GAP | Không có component test cho AlertCenterPage; jest suite chưa được chạy trong audit này** | `vitest.config.ts` include chỉ `*.component.test.*`; `jest.config.js:18-20` chạy `**/*.test.*` (trừ component tests) → hook tests (`useAlertCenterData.test.js`, `useAlertCenterRealtime.test.js`) **CÓ** chạy dưới `npm test` (jest) | Nguy cơ: fix F1/F2/F3 không có test component chặn regression. Audit này chỉ chạy vitest (6/16), chưa chạy jest. | **Fix**: thêm `AlertCenterPage.component.test.tsx` (vitest); chạy `npm test` (jest) như một gate bắt buộc trong plan.
- **[F17] ERROR | Hardcode tiếng Việt + đơn vị** | `useAlertCenterData.js:100` "Không thể tải alert center từ core API.", `AlertCard.tsx:131` "VND" | Vi phạm i18n; EN user thấy VN string. | **Fix**: `t()` cho error; `formatCurrency`/tỷ giá.
- **[F18] GAP | Family filter không hợp lane ai** | `FilterBar.tsx:24-31` | Trong AI lane, chọn whale/dark_flow/signal/system → backend exclude main types + filter type → luôn 0 kết quả. Thiếu `ai_alert` option. | **Fix**: options theo lane hiện tại (ai: ai_suggest/ai_alert).
- **[F19] GAP | Không có bulk actions, notification, sessionDate picker, export** | toàn trang | Plan P1/P2 (F8 bulk ack, F9, F11 sessionDate, F13 a11y) chưa làm. | **Fix**: theo roadmap mục G.
- **[F20] RISK | Cursor pagination với ordering annotation** | `views.py:29-31` + `_type_priority_annotation()` | DRF CursorPagination + annotated ordering field cần `nulls` xử lý đúng; chưa verify runtime → cần repro trước khi dùng cursor (Nguyên tắc 6). | **Fix**: kiểm tra `next` link trả đúng dữ liệu khi bật load-more.
- **[F21] ERROR (P0-infra, phát hiện khi chạy baseline jest 2026-08-05) | `npm test` RED — babel preset v8 trên core v7 không strip TypeScript types** | `package.json` devDeps: `@babel/preset-env@^8.0.2`, `@babel/preset-react@^8.0.1`, `@babel/preset-typescript@^8.0.1` nhưng `@babel/core@7.29.0` (npm ls đánh dấu `invalid: "^8.0.0"`); `babel-jest@^30.4.1` | Mọi jest test import `.ts` (vd `useAlertCenterData.test.js` → `useTenantAdminQuery.ts`) ném `ReferenceError: T is not defined` tại `useTenantAdminQuery.ts:45` (`useQuery<T>` không được strip) → worker crash → cascade fail `useAlertCenterRealtime.test.js`, `coreApiAdapter.test.js` (worker 4 exceptions). Baseline: 3 suites fail, 170 tests pass. Vite build KHÔNG bị ảnh hưởng (dùng esbuild) → bug tồn tại âm thầm từ commit `396d5a94` (bump presets lên 8.x). | **Fix (ĐÃ HOÀN THÀNH — Entry 35)**: pin 3 presets về `^7.26.x` (7.29.7) khớp core 7.29 + babel-jest 30 (không nâng core lên 8 vì babel-jest 30 peer-dep core 7). Kèm: fix `transport.js:398` (unhandled rejection từ `.finally()` bị vứt — crash worker khi GET fail) + migrate 2 hook test sang vitest (`jest.mock` không chạy được trong jest 29 ESM mode). Kết quả: jest 17/17 suites 221 tests PASS, vitest 8/25 PASS, tsc 0, build ✓.

---

## E. Quality Gates

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` (packages/web) | PASS | exit 0 |
| `npm run test:components` (vitest) | PASS | Audit gốc: 6 files / 16 tests — KHÔNG file nào cover AlertCenterPage. Sau Phase 0 (Entry 35): 8 files / 25 tests (2 hook test alert-center migrate từ jest sang vitest). |
| `npm test` (jest, `**/*.test.*`) | PASS — sau fix Phase 0 (Entry 35) | Baseline trước fix: 3 suites fail (`useAlertCenterData`, `useAlertCenterRealtime`, `coreApiAdapter`) do F21 (babel preset v8 vs core v7) + `transport.js:398` unhandled rejection + jest 29 ESM `jest.mock` limit. Sau fix: 17/17 suites / 221/221 tests PASS. |
| i18n scan | FAIL (2 key) | `alertCenter.close`, `alertCenter.detailSummary` missing |

---

## F. Câu hỏi cần làm rõ

1. Policy khi user chưa có watchlist: nên thấy global feed (giống bản demo) hay empty state? F6 giả định scoped — cần xác nhận product intent.
2. `value` trên card hiển thị "VND" — đúng cho whale matched_value; signal/system value là gì (điểm số? %?)? Cần unit-aware rendering.
3. Có cần notification center (F8 cũ) trong scope nâng cấp này hay chỉ trong trang?

---

## G. PLAN NÂNG CẤP — Alert Center đẳng cấp quốc tế (3 phase)

### Phase 1 — Bug-fix P0 (1-2 sprints, ưu tiên cao nhất)
1. `useTenantAdminQuery` forward `refetchInterval` (hoặc tách `useCoreQuery` generic) → F1.
2. Bỏ effect `[filters]` reset page; reset page trong handlers → F2.
3. Backend split multi-value severity/alert_family (`__in` + family map incl. `stale_quote`) + test → F3.
4. `normalizeAlert` bổ sung `triggered_at`, `alert_id`, `value`/`matched_value`; sort fallback `ts` → F4, F6-actions.
5. Detail/context/ack endpoints nhận `lane` param; frontend truyền lane hiện tại → F5.
6. `delivery_service` trả `none()` cho user không có symbols (theo câu trả lời F6) → F6.
7. `Coalesce(Sum('value'), 0)` → F7.
8. Loại pseudo-symbol khỏi polling quotes → F8.
9. i18n keys + bỏ field ảo trong drawer → F10, F11.

### Phase 2 — Tính năng còn thiếu (P1)
10. Load-more cursor cho feed (verify F20 trước) → F9, F20.
11. Tách polling feed (5s) vs summary/stats (30s) + debounce → F15.
12. Hook tests vào CI + component test AlertCenterPage → F16.
13. i18n-ize toàn bộ hardcode + unit-aware value rendering → F12, F17.
14. Family options theo lane + thêm ai_alert → F18.
15. Drawer render `recent_events` + `in_delivery_scope` → F10.
16. Bulk actions (ack all filtered, mute symbol) → F19.

### Phase 3 — Đẳng cấp quốc tế (differentiation)
17. **UX**: infinite scroll feed + skeleton shimmer; empty/error states có action; keyboard navigation (a11y F13).
18. **Product**: notification center (toast + badge trên sidebar, unread count realtime), sessionDate picker (F11), export CSV, shareable filter URL (`?lane=&symbol=&severity=`).
19. **Perf**: summary/stats từ read-model/cache Redis thay GROUP BY mỗi request; gzip+ETag; skeleton trước data.
20. **Observe**: Sentry/otel tracing cho feed latency, WS metrics dashboard (connectionState đã có sẵn — đưa vào StatusBar), OpenAPI contract test auto.
21. **Security**: rate limit per-user cho feed poll; delivery policy test (user rỗng vs đầy đủ watchlist); audit log mute/ack.

**DoD mỗi phase**: tsc + lint + vitest + jest pass, i18n scan sạch, contract test, manual repro theo từng AC.
