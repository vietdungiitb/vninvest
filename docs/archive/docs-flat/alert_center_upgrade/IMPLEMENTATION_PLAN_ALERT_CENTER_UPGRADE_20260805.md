# IMPLEMENTATION PLAN — ALERT CENTER UPGRADE (từ AUDIT_ALERT_CENTER_20260805)

**Ngày:** 2026-08-05
**Cơ sở:** `docs/AUDIT_ALERT_CENTER_20260805.md` (20 findings: 8 P0, 12 P1 + F21 infra P0 phát hiện khi chạy baseline jest) + `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 33.
**Mục tiêu:** Fix toàn bộ bug P0/P1 và nâng Alert Center lên đẳng cấp quốc tế. Plan đóng mọi quyết định — đội code thực thi và tự audit KHÔNG cần hỏi lại.
**Nguyên tắc:** (1) Không đổi REST response shape trừ khi task ghi rõ; (2) mỗi task có AC + minh chứng (lệnh + output); (3) sau mỗi task chạy gate: `npx tsc --noEmit` + `npm test` (jest) + `npm run test:components` (vitest); (4) cuối mỗi phase chạy `npm run build`; (5) i18n mọi string user-facing.

---

## 0. QUYẾT ĐỊNH ĐÃ CHỐT (đội code không được hỏi lại, không deviation)

| # | Vấn đề | Quyết định |
|---|---|---|
| D1 | F1 + F14 (auto-refresh + scope) | Phase 1: thêm `refetchInterval` vào options `useTenantAdminQuery` (additive, backward-compatible). Phase 2: tạo `src/hooks/useCoreQuery.ts` mới (scope `['core-user']`), migrate `useAlertCenterData`; tenant-admin KHÔNG đổi. |
| D2 | F3 (multi-select filter) | Backend split `,` → `severity__in`; `alert_family` → map Q OR theo bảng ở Task B1. Giữ behavior single-value cũ. |
| D3 | F5 (lane cho detail/context/ack) | Thêm query param `lane` (mặc định `main`), 3 views nhận param; frontend truyền `filters.lane`. |
| D4 | F6 (user không symbol) | `apply_user_delivery_policy`: `user_symbols` rỗng → `queryset.none()` (security-first). Ai lane cũng áp dụng (nhất quán). |
| D5 | F12 (sort largest) | Sort theo `value ?? matched_value`. |
| D6 | F13 (AI Suggest metric) | Metric chỉ render khi `lane === 'ai'`. |
| D7 | F15 (polling tiers) | Tách hook thành 3 sub-query: feed 5000ms, summary 30000ms, symbolStats 30000ms. Return shape giữ nguyên. |
| D8 | F16 | Jest (`npm test`) chạy hook tests; vitest chạy component tests. Thêm component test mới cho AlertCenterPage. |
| D9 | F17 (VND) | i18n key `alertCenter.currency: 'VND'`; value render `{n} {t('alertCenter.currency')}`. Error page-level dùng `t('alertCenter.error')`. |
| D10 | F9/F20 (load-more) | Phase 2: append local state `extraAlerts` + cursor; backend có test ordering cursor trước. |
| D11 | F19 (sessionDate picker) | Phase 3: date input, format `YYYY-MM-DD`, gửi `session_date`, reset khi đổi lane. |

**FAMILY MAP backend (dùng cho D2, Task B1)** — đóng bảng, không suy diễn:

| Giá trị client gửi | Backend build |
|---|---|
| `whale` | `alert_type='whale'` |
| `dark_flow` | `alert_type='dark_flow'` |
| `signal` | `alert_type='signal'` |
| `system` | `alert_type='system'` |
| `price_shock` | `alert_type='signal' AND source_ref LIKE 'market_anomaly:%'` |
| `stale_quote` | `(alert_type='system' AND source_ref LIKE 'stale_quote:%') OR freshness_state='stale'` |
| `ai_alert` | `alert_type='ai_alert'` |
| `ai_suggest` | `alert_type='ai_suggest'` |
| giá trị lạ | `alert_type=<value>` (giữ hành vi cũ, không lỗi) |

---

## 1. MÔI TRƯỜNG & LỆNH GATE (chạy tại `packages/web` và `packages/core/backend`)

```bash
# Frontend gates
cd "packages/web"
npx tsc --noEmit                          # type-check → exit 0
npm test                                  # jest: **/*.test.* (không chạy *.component.test.*) → PASS
npm run test:components                   # vitest: *.component.test.* → PASS
npm run lint                              # eslint src → exit 0
npm run i18n:scan                         # không báo hardcode/missing mới
npm run build                             # tsc && vite build → exit 0

# Backend gates
cd "packages/core/backend"
python manage.py test signal_intelligence --settings=vninvest_core.settings.test   # hoặc lệnh pytest của repo → PASS
```

**Quy ước minh chứng:** mỗi task dán output thật vào comment PR (số test pass, curl response). Không ghi "OK" trần.

---

## PHASE 0 — FIX INFRA TEST (BẮT BUỘC ĐẦU TIÊN — chặn mọi gate jest)

### Task A0 — [F21] Pin babel presets về ^7.26 khớp @babel/core 7.29 (P0-infra)

> **TRẠNG THÁI: ĐÃ HOÀN THÀNH 2026-08-05** (Entry 35 ledger). Baseline sau fix: jest 17/17 suites / 221 tests PASS; vitest 8 files / 25 tests PASS; tsc 0; build ✓.
> **Deviation đã xử lý trong lúc thực thi** (đội code KHÔNG làm lại):
> 1. Ngoài pin babel, phát hiện + fix `transport.js:398` — unhandled rejection từ `promise.finally(...)` bị vứt khi GET fail (crash jest worker + noise production).
> 2. `npm test` (ESM mode — `"type": "module"` + `--experimental-vm-modules`) không hỗ trợ `jest.mock` hoisting (jest 29 giới hạn: `require is not defined` trong VM modules) → 2 hook test alert-center đã MIGRATE sang vitest: `useAlertCenterRealtime.component.test.js` + `useAlertCenterData.component.test.js` (thêm QueryClientProvider wrapper — trước đây fail `No QueryClient set`). Mọi test task sau trong plan viết theo convention này: jest (`*.test.*`) KHÔNG dùng `jest.mock`; viết `*.component.test.*` (vitest) khi cần mock module.
> 3. Xác nhận cuối: các suite còn lại pass đều đặn, không còn flake liên quan.

**Bối cảnh (đã repro):** `npm test` RED. `useAlertCenterData.test.js` ném `ReferenceError: T is not defined` tại `useTenantAdminQuery.ts:45` — `useQuery<T>` không được strip. Nguyên nhân: `@babel/preset-env@^8.0.2` + `@babel/preset-react@^8.0.1` + `@babel/preset-typescript@^8.0.1` (yêu cầu `@babel/core ^8.0.0`) chạy trên `@babel/core@7.29.0` (npm ls đánh dấu invalid). Vite không dùng babel (esbuild) nên build vẫn xanh — bug âm thầm từ commit `396d5a94`. babel-jest `^30.4.1` peer-dep core 7 → KHÔNG nâng core lên 8.

**Files:**
- `packages/web/package.json` (3 dòng devDeps babel presets)

**Spec (chạy tại `packages/web`):**
```bash
npm install -D @babel/preset-env@^7.26.9 @babel/preset-react@^7.26.3 @babel/preset-typescript@^7.26.10
```
1. `npm ls @babel/core @babel/preset-env @babel/preset-react @babel/preset-typescript` → tất cả 7.x, KHÔNG còn `invalid`.
2. Verify strip hoạt động: `node -e "const b=require('@babel/core');console.log(b.transformSync('function f(){return useQuery<T>({})}',{filename:'x.ts',presets:[['@babel/preset-typescript',{}]],configFile:false}).code)"` → output KHÔNG còn `<T>`.
3. `npx jest src/hooks/useAlertCenterData.test.js --no-coverage` → 3/3 PASS.

**Test:** không viết test mới (infra); minh chứng = output 2 lệnh trên + full suite.

**AC + minh chứng:**
- `npm test -- --no-coverage` → tất cả suites PASS, dán bảng kết quả (trước: 3 fail / sau: 19-19 PASS hoặc số thực tế).
- `npx tsc --noEmit` vẫn exit 0; `npm run build` exit 0 (vite không đổi).
- Nếu sau fix còn suite fail riêng lẻ (không phải F21) → ghi finding mới vào ledger, KHÔNG tự sửa ngoài scope task này.

---

## PHASE 1 — FIX 8 BUG P0 (ước lượng: 2 sprints)

### Task A1 — [F1] Forward `refetchInterval` trong `useTenantAdminQuery` (P0)

**Files:**
- `packages/web/src/pages/tenant-admin/useTenantAdminQuery.ts`
- `packages/web/src/pages/tenant-admin/useTenantAdminQuery.component.test.ts` (thêm test)
- `packages/web/src/hooks/useAlertCenterData.test.js` (thêm 1 test)

**Spec:**
1. Interface `options` thêm: `refetchInterval?: number | false | undefined`.
2. `useQuery<T>` nhận thêm `refetchInterval: options?.refetchInterval`.
3. KHÔNG đổi queryKey, KHÔNG đổi scope (F14 nằm Phase 2).
4. `useAlertCenterData.js` giữ nguyên `refetchInterval: autoRefresh ? 5000 : false` (giờ sẽ chạy thật).

**Test phải viết:**
- `useTenantAdminQuery.component.test.ts`: mock module `@tanstack/react-query` (vi.mock `useQuery`), gọi hook với `{ refetchInterval: 5000, queryFn: ... }` → assert `useQuery` được gọi với option `refetchInterval: 5000`; gọi không có option → `undefined` (không break tenant-admin).
- `useAlertCenterData.test.js`: assert hook trả `refetch` là function (đã có pattern sẵn ở file này — mock adapter).

**AC + minh chứng:**
- `npx tsc --noEmit` exit 0.
- `npm test` PASS (jest, ít nhất file `useTenantAdminQuery.component.test.ts` không chạy ở jest vì là component test — assert qua `npm run test:components`).
- `npm run test:components` PASS với test mới.
- Manual (dev): mở /alert-center, DevTools Network → tab API: sau 5s thấy request mới `/signals/alert-center/feed?...` tự gửi (không cần bấm Refresh). Dán 2 screenshot: trước/trong vòng 5-10s.

---

### Task A2 — [F2] Bỏ effect reset page; reset page trong handlers (P0)

**Files:**
- `packages/web/src/pages/AlertCenterPage.tsx`
- `packages/web/src/hooks/useAlertCenterFilters.ts`

**Spec:**
1. XÓA `useEffect(() => { filters.setPageStats(1); }, [filters])` (AlertCenterPage.tsx:200-202).
2. `useAlertCenterFilters` thêm helper `resetStatsPage = useCallback(() => setPageStats(1), [])` trả về trong object.
3. Gọi `resetStatsPage()` tại các nơi làm thay đổi dữ liệu stats: `applySymbol`, `toggleSeverity`, `toggleFamily`, `clearFilters`, và trong `AlertCenterPage` khi `lane` đổi (`onLaneChange` handler hiện có đã gọi `actions.closeDetail()` — thêm `filters.resetStatsPage()`).
4. `timeframe` đổi → `onTimeframeChange` cũng gọi `resetStatsPage()`.

**Test phải viết:**
- `AlertCenterPage.component.test.tsx` (mới — vitest): mock `useAlertCenterData` trả `symbolStats` 16 rows; bấm nút "›" ở StatsPanel → assert row 9 (trang 2) xuất hiện và vẫn ở đó sau re-render 500ms (waitFor) — regression trực tiếp của F2.

**AC + minh chứng:**
- tsc exit 0; `npm run test:components` PASS.
- Manual: feed ≥9 mã → bấm "›" → trang 2 hiện, KHÔNG tự nhảy về trang 1 sau 1s. Screenshot.

---

### Task B1 — [F3] Backend: multi-select severity / alert_family (P0)

**Files:**
- `packages/core/backend/src/signal_intelligence/views.py` (`_apply_common_alert_filters`)
- `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py` (thêm 2 test)

**Spec (`_apply_common_alert_filters`):**
1. `severity`: split `,` → bỏ rỗng → nếu 1 phần tử: `qs.filter(severity=parts[0])`; nếu >1: `qs.filter(severity__in=parts)`.
2. `alert_family`: split `,` → với mỗi value dùng FAMILY MAP (mục 0) build `Q`; ghép `Q_or = Q_or | family_q`; `qs = qs.filter(Q_or)`. Nếu value lạ → `Q(alert_type=value)`. Nếu không còn phần tử hợp lệ → bỏ qua.
3. Giữ nguyên xử lý `timeframe`, `session_date`, `symbol`, `alert_type`.
4. KHÔNG đổi response shape.

**Test phải viết (test_alert_center_api.py, theo style `setUp` đã có):**
- `test_severity_multi_select_returns_union`: tạo 2 alert (HIGH + LOW) cùng lane main, GET `/feed?severity=high,low` → 200, 2 results; `/feed?severity=high` → 1 result.
- `test_alert_family_multi_select_returns_union`: tạo whale + dark_flow + signal; GET `/feed?alert_family=whale,dark_flow` → 2 results, không có signal; `alert_family=price_shock` (SIGNAL source_ref `market_anomaly:x`) → 1 result đúng type.

**AC + minh chứng:**
- `python manage.py test signal_intelligence` PASS (tất cả test cũ + 2 mới).
- curl thật: `/core/v1/signals/alert-center/feed?severity=high,low` trả cả 2 severity (dán response).

---

### Task B2 — [F4] WS normalize: `triggered_at`, `alert_id`, `direction`, `value`; sort fallback `ts` (P0)

**Files:**
- `packages/web/src/hooks/useRealtimeFeedCore.js` (`normalizeAlert` lines 238-257)
- `packages/web/src/pages/AlertCenterPage.tsx` (sort lines 121-131; key line 315)
- `packages/web/src/components/alert-center/AlertCard.tsx` (value line 131)
- `packages/web/src/hooks/useRealtimeFeedCore.test.js` (mới hoặc mở rộng — jest)

**Spec:**
1. `normalizeAlert` bổ sung field:
   - `triggered_at: readEventField(payload, 'triggered_at') ?? null`
   - `alert_id: readEventField(payload, 'event_id') ?? null` (WS `event_id` == `alert_id` UUID — broadcasting.py:108)
   - `direction: readEventField(payload, 'direction') ?? null` (broadcast gửi `data.direction`)
   - `value: readEventField(payload, 'matched_value') ?? null`
2. `AlertCenterPage.sortedAlerts`: `const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : (a?.ts ? new Date(a.ts).getTime() : 0);` (tương tự timeB).
3. `largestValue` sort: `Number(b?.value ?? b?.matched_value ?? 0) - Number(a?.value ?? a?.matched_value ?? 0)`.
4. VirtualFeedList key: `displayAlerts[index].alert_id ?? displayAlerts[index].event_id`.
5. `AlertCard.tsx:131`: hiển thị `formatAlertValue(alert.value ?? alert.matched_value)` + suffix `t('alertCenter.currency')` (xem Task E1 — làm cùng commit).

**Test phải viết (jest, mock WebSocket global):**
- `useRealtimeFeedCore.test.js` (tạo file mới nếu chưa có — kiểm tra trước; nếu đã có file `useAlertCenterRealtime.test.js` thì thêm test tại đó):
  - renderHook `useRealtimeFeedCore({ symbols: ['market_discovery'], maxAlerts: 5 })`; fake `global.WebSocket = class { onmessage; onopen; onerror; onclose; readyState=1; send(){}; close(){}; static OPEN=1 }`; gọi `ws.onmessage({ data: JSON.stringify({ event_type:'whale_alert', event_id:'uuid-1', symbol:'VCI', ts:'2026-08-05T08:00:00Z', data:{ severity:'high', direction:'buy', title:'T', body:'B', triggered_at:'2026-08-05T08:00:01Z', matched_value: 1_000_000_000 } }) })`; assert `alerts[0].triggered_at === '2026-08-05T08:00:01Z'`, `.alert_id === 'uuid-1'`, `.direction === 'buy'`, `.value === 1_000_000_000`.
- `AlertCenterPage.component.test.tsx` (vitest): mock `useRealtimeFeedCore` module trả `alerts: [{event_id:'uuid-live', triggered_at: futureTs}]` → assert live item nằm ĐẦU danh sách (đầu DOM feed).

**AC + minh chứng:**
- `npm test` PASS (jest, test mới); `npm run test:components` PASS.
- Manual: bật backend emit whale alert → card mới xuất hiện TRÊN CÙNG feed trong <1s, có title/giá trị/severity đúng, bấm "Chi tiết" không lỗi. Video/gif 10s.

---

### Task B3 — [F5] Lane param cho detail/context/ack + actions dùng `event_id` fallback (P0)

**Files:**
- Backend: `packages/core/backend/src/signal_intelligence/views.py` (`AlertCenterEventDetailView` 525-535, `AlertCenterSymbolContextView` 549-568, `AlertCenterAcknowledgeView` 579-590)
- Backend test: `test_alert_center_api.py`
- Frontend: `packages/web/src/adapters/core/market.js` (`getAlertCenterEventDetail` 86-88, `acknowledgeAlertCenterEvent` 110-112, `getAlertCenterSymbolContext` 97-103)
- Frontend: `packages/web/src/hooks/useAlertCenterActions.ts`
- Frontend: `packages/web/src/pages/AlertCenterPage.tsx` (truyền lane vào hook)
- Frontend: `packages/web/src/adapters/coreApiAdapter.d.ts` (signature)

**Spec backend:**
1. 3 view đọc `lane = str(request.query_params.get('lane') or 'main').strip().lower()`; truyền vào `_apply_common_alert_filters(..., lane=lane)`.
2. `AlertCenterEventDetailView`: nếu lane không hợp lệ → mặc định `main` (không lỗi).
3. `AlertCenterAcknowledgeView`: ack theo lane param — alert không thuộc lane → 404 (cơ chế cũ).

**Spec frontend:**
1. `market.js`: `getAlertCenterEventDetail(alertId, params = {})` — thêm query string; `acknowledgeAlertCenterEvent(alertId, params = {})` — tương tự; `getAlertCenterSymbolContext(symbol, params = {})` đã hỗ trợ params (giữ).
2. `useAlertCenterActions(refetch, lane = 'main')`:
   - `handleLoadDetail`: `const id = alert.alert_id ?? alert.event_id; if (!id || !alert?.symbol) return;` gọi `getAlertCenterEventDetail(id, { lane })` + `getAlertCenterSymbolContext(alert.symbol, { lane })`.
   - `handleAcknowledge`: `const id = alert.alert_id ?? alert.event_id; if (!id) return;` gọi `acknowledgeAlertCenterEvent(id, { lane })`.
   - `handleMute` giữ nguyên (mute theo symbol, không cần lane).
3. `AlertCenterPage.tsx:103`: `const actions = useAlertCenterActions(refetch, filters.lane);`

**Test phải viết:**
- Backend: `test_event_detail_and_ack_respect_lane_param`: tạo AI_ALERT; GET detail `?lane=ai` → 200; GET detail không param → 404 (main lane exclude); POST ack `?lane=ai` → 200; ack không param → 404.
- Frontend (jest, `useAlertCenterActions.test.js` mới — mock `coreApiAdapter`): gọi `handleLoadDetail({alert_id:'x', event_id:'y', symbol:'VCI'})` với lane='ai' → assert `getAlertCenterEventDetail('x', { lane: 'ai' })`; gọi với item chỉ có `event_id` → assert dùng `event_id`. `handleAcknowledge({event_id:'y'})` → assert gọi với 'y'.

**AC + minh chứng:**
- Backend tests PASS; jest + vitest PASS; tsc PASS.
- Manual: AI lane → click "Chi tiết" → drawer mở (trước đây 404). Screenshot drawer AI alert.

---

### Task B4 — [F6] User không có symbols → feed rỗng (P0, security)

**Files:**
- `packages/core/backend/src/signal_intelligence/delivery_service.py` (`apply_user_delivery_policy` 65-68)
- `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py` (+ test riêng)

**Spec:**
1. `apply_user_delivery_policy`: sau `user_symbols = resolve_user_delivery_symbols(user)`, đổi `if not user_symbols: return queryset` → `if not user_symbols: return queryset.none()`.
2. KHÔNG đổi gì khác; `sync_user_delivery_rows`/`transition_delivery_state` giữ nguyên.

**Test phải viết:**
- `test_user_without_watchlist_sees_no_alerts`: tạo user 2 (không watchlist/không tracked/không transactions) + alert whale; GET feed/summary/symbol-stats dưới user 2 → 200, 0 results/0 total; user 1 (có watchlist VCI) vẫn thấy alert VCI.

**AC + minh chứng:**
- Backend tests PASS (chú ý: mọi test cũ phải vẫn PASS — user trong `setUp` có watchlist nên không ảnh hưởng).
- Kiểm tra tác động: grep tất cả caller `apply_user_delivery_policy` (feed/summary/stats/detail/context/ack trong views.py) — dán kết quả grep vào PR.

---

### Task B5 — [F7] symbol-stats không 500 khi `total_value` null (P0)

**Files:**
- `packages/core/backend/src/signal_intelligence/views.py` (`_build_symbol_stats_payload`, line 244)
- `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py`

**Spec:**
1. `total_value=Sum('value')` → `total_value=Coalesce(Sum('value'), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2))`.
2. `serializers.py:88` giữ nguyên (không cần allow_null vì đã Coalesce) — không đổi serializer.

**Test phải viết:**
- `test_symbol_stats_null_value_no_500`: tạo 2 alert SIGNAL `value=None`; GET `/symbol-stats` → 200; `symbols[0].total_value` là số (không phải null).

**AC + minh chứng:**
- Backend tests PASS; curl thật với dữ liệu null → 200 (dán response).

---

### Task B6 — [F8] Bỏ polling quote rác cho pseudo-symbol (P0)

**Files:**
- `packages/web/src/hooks/useRealtimeFeedCore.js` (`normalizePollSymbolCandidates` 330-371; hydrate 602-669; poll loop 737-855)

**Spec:**
1. Định nghĩa hằng `PSEUDO_SYMBOLS = new Set(['market_discovery'])` (module-level, export để test).
2. `normalizePollSymbolCandidates`: `(symbols || []).filter(s => !PSEUDO_SYMBOLS.has(normalizeSymbol(s)))` trước khi phân loại; nếu sau filter rỗng → return `{ symbols: [], hasOverThreshold: false }`.
3. `hydrateQuotes` và poll loop: lọc `syms.filter(s => !PSEUDO_SYMBOLS.has(s))` khi build batch (bootstrap `normalizedSymbols` lọc khi loop; `poll()` lọc tại `syms`).
4. WS subscribe giữ nguyên `['market_discovery']` (bắt buộc cho global feed).

**Test phải viết (jest):**
- `useRealtimeFeedCore.test.js`: assert `normalizePollSymbolCandidates(['market_discovery'], {}, true)` → `symbols: []`; với `['market_discovery','VCI']` → chỉ `['VCI']` trong danh sách; call `getRealtimeTickers` KHÔNG được gọi với `market_discovery` trong batch (mock adapter, fake timers).

**AC + minh chứng:**
- `npm test` PASS; DevTools Network: không còn request `realtime/tickers?symbols=MARKET_DISCOVERY` trong 2 phút xem trang. Screenshot filter network.

---

### Task E1 — [F10/F11/F17] i18n keys mới + DetailDrawer field thật + currency (P0-P1, làm cùng commit)

**Files:**
- `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js` (block `alertCenter`)
- `packages/web/src/components/alert-center/DetailDrawer.tsx`
- `packages/web/src/components/alert-center/AlertCard.tsx`

**Spec:**
1. Thêm keys (vi/en parity — tiếng Việt full dấu):
   - `close: 'Đóng' / 'Close'`
   - `detailSummary: 'Tóm tắt' / 'Summary'`
   - `detailRecentEvents: 'Sự kiện gần nhất' / 'Recent events'`
   - `detailInScope: 'Trong phạm vi giao nhận' / 'In delivery scope'`
   - `detailNotInScope: 'Ngoài phạm vi giao nhận' / 'Outside delivery scope'`
   - `currency: 'VND' / 'VND'`
   - `famStaleQuote: 'Stale Quote' / 'Stale Quote'`
   - `famAiAlert: 'AI Alert' / 'AI Alert'`
2. `DetailDrawer.tsx`:
   - Thay `t("alertCenter.detailTitle", { id: "" })` (line 72) → `t("alertCenter.detailContent")` (label hiện thiếu).
   - XÓA 2 dòng `average_severity`/`threshold_strategy` (97-98).
   - Thêm block: `in_delivery_scope` badge (dùng `soc.statusBadge` danger khi false / info khi true) + `recent_events` list (tối đa 5 item: symbol, severity, triggered_at — dùng `formatAlertTimestamp` prop nếu có, nếu không dùng format inline).
3. `AlertCard.tsx:131`: `{formatAlertValue(alert.value ?? alert.matched_value)} {t('alertCenter.currency')}`.
4. Chạy `npm run i18n:scan` → không báo missing/hardcode mới cho alertCenter.

**Test phải viết:**
- `DetailDrawer` render test (vitest component, `DetailDrawer.component.test.tsx`): mock t từ `useI18n`; render với `activeContext={{ in_delivery_scope: true, recent_events: [{...}] }}` → assert "Trong phạm vi giao nhận" text + recent_events items; không render `average_severity`/`threshold_strategy`.
- i18n parity check bằng script (như Entry 33 pattern): so sánh key set `alertCenter` vi vs en — chênh lệch = 0.

**AC + minh chứng:**
- tsc/jest/vitest PASS; i18n scan sạch; dán output script parity.

---

## PHASE 2 — FIX P1 (ước lượng: 2 sprints)

### Task C1 — [F14] Tách `useCoreQuery` (scope user) — bỏ phụ thuộc tenant-admin

**Files:**
- Mới: `packages/web/src/hooks/useCoreQuery.ts` (export `useCoreQuery`, `invalidateCoreQueries`)
- `packages/web/src/hooks/useAlertCenterData.js` (migrate)
- `packages/web/src/providers/QueryProvider.tsx` (listener tenant-changed giữ nguyên cho tenant-admin; core-user không cần listener — scope theo user cố định)

**Spec:**
1. `useCoreQuery<T>(queryKey: string[], options?: { enabled?, queryFn?, refetchInterval? })` — scope key `['core-user', ...queryKey]`, KHÔNG đọc localStorage tenant_id.
2. `useAlertCenterData` đổi import từ `useTenantAdminQuery` → `useCoreQuery`; queryKey giữ nguyên `['alert-center', ...]`.
3. Xóa bỏ tham số `_env` không dùng nếu phát hiện dead.

**AC:** tsc/jest/vitest PASS; queryKey trong React DevTools có prefix `core-user`; test tenant switch (đổi `tenant_id`) → alert-center cache không bị invalidate/không đổi key.

---

### Task C2 — [F15] Tách polling 3 tiers (feed 5s / summary+stats 30s)

**Files:**
- `packages/web/src/hooks/useAlertCenterData.js` (viết lại)

**Spec:**
1. Trong hook: 3 lần gọi `useCoreQuery` (hoặc `useTenantAdminQuery` nếu C1 chưa merge):
   - `['alert-center-feed', ...filters]`, `queryFn: getFeed`, `refetchInterval: autoRefresh ? 5000 : false`
   - `['alert-center-summary', ...filters]`, `queryFn: getSummary`, `refetchInterval: autoRefresh ? 30000 : false`
   - `['alert-center-symbol-stats', ...filters]`, `queryFn: getSymbolStats(page1, 200)`, `refetchInterval: autoRefresh ? 30000 : false`
2. Return shape GIỮ NGUYÊN: `{ loading, error, payload, summary, symbolStats, refetch }` — `loading = any.isLoading || any.isFetching`; `error` = error đầu tiên; `refetch` = refetch tất cả 3.
3. Debounce: KHÔNG thêm debounce ở hook (filters thay đổi → queryKey mới, react-query tự xử lý); nếu muốn debounce search thì để Phase 3.

**AC:** tsc/jest PASS; Network: feed mỗi 5s, summary/stats mỗi 30s (screenshot Network filter `signals/`).

---

### Task C3 — [F9/F20] Load-more feed bằng cursor (P1)

**Files:**
- Backend: `test_alert_center_api.py` (test cursor ordering)
- Frontend: `packages/web/src/pages/AlertCenterPage.tsx`, `packages/web/src/hooks/useAlertCenterActions.ts` hoặc state page

**Spec backend test (làm TRƯỚC khi viết FE):**
- `test_cursor_pagination_ordering_annotated`: tạo 5 alert (2 whale, 3 dark_flow) — feed ordering `(type_priority, -triggered_at, -pk)`; GET feed `?page_size=2` → next != null; GET `?cursor=<next>` → page 2; assert: không trùng alert_id page 1, tổng 2 trang ≤ 5, thứ tự type ưu tiên không vỡ (whale trước dark_flow). Nếu test FAIL → báo bug DRF cursor + annotated ordering (F20), ghi vào ledger rồi mới làm FE.

**Spec frontend:**
1. `useAlertCenterData` trả thêm `payload.next` (đã trả — giữ).
2. Page: state `extraAlerts: AlertItem[]` + `feedCursor: string|null`; nút "Tải thêm" (i18n key `loadMore: 'Tải thêm' / 'Load more'`) hiện khi `payload.next || feedCursor` còn.
3. Handler: `coreApiAdapter.getAlertCenterFeed({ ...currentFilters, cursor })` → append `extraAlerts`, set cursor mới. Khi filters đổi (lane/symbol/severity/family/timeframe) → reset `extraAlerts=[]`, `feedCursor=null`.
4. `alerts` useMemo: merge REST base + extraAlerts + realtime (thứ tự: base, extra, realtime dedupe bằng Map như hiện tại — chỉnh `byId` merge từng mảng tuần tự).

**AC:** jest test handler append/reset (mock adapter); vitest component: click "Tải thêm" → list dài hơn, cursor gửi đúng; backend cursor test PASS.

---

### Task C4 — [F12/F13/F18] Sort đúng, metric AI chỉ ở ai lane, family options theo lane

**Files:**
- `AlertCenterPage.tsx` (sort đã sửa ở B2 — verify; metric: render `aiSuggest` chỉ khi `lane==='ai'`)
- `FilterBar.tsx` (family options động theo lane: main → [whale, dark_flow, price_shock, signal, system, stale_quote]; ai → [ai_suggest, ai_alert]; xóa FAMILY_OPTIONS tĩnh)

**Spec:** như mục D5/D6 và bảng ở đầu plan. `useAlertCenterFilters.clearFilters` giữ nguyên (chỉ severity/family).

**AC:** vitest: FilterBar render đúng options theo lane prop (2 case); bấm family ai lane không gửi `alert_family=whale`.

---

### Task C5 — [F16] Component test AlertCenterPage (vitest)

**Files:**
- Mới: `packages/web/src/pages/AlertCenterPage.component.test.tsx`

**Spec (bắt buộc, độ phủ tối thiểu 6 case):**
1. `vi.mock('../../hooks/useAlertCenterData.js')`, `useAlertCenterRealtime.js`, `useAlertCenterActions.js`; mock `coreApiAdapter` cho actions.
2. Cases: (a) loading=true → `ShellSkeleton` xuất hiện; (b) error set → banner lỗi + nút "Thử lại" gọi refetch; (c) payload rỗng → empty state text; (d) feed 3 items → 3 card render, sort newest-first; (e) F2 regression: 16 symbols → bấm "›" → row trang 2; (f) WS merge: realtimeAlerts có item mới → xuất hiện trong feed.
3. Render qua wrapper có `LangProvider` (mock useI18n trả t() identity nếu đơn giản hơn).

**AC:** `npm run test:components` PASS ≥ 6 test mới; tsc PASS.

---

### Task C6 — [F18/F10 residual] Backend test suite mở rộng + i18n scan script tự động

**Files:**
- `test_alert_center_api.py` (gom toàn bộ test mới Phase 1/2 — đảm bảo ≥ 12 test alert-center)
- Thêm script (tuỳ chọn): `packages/web/scripts/check-i18n-parity.mjs` — so key set vi/en của block alertCenter, exit 1 nếu lệch (chạy trong gate).

**AC:** `python manage.py test signal_intelligence` PASS với số test mới dán vào PR; script parity chạy exit 0.

---

## PHASE 3 — ĐẲNG CẤP QUỐC TẾ (ước lượng: 3 sprints)

### Task D1 — Notification center (unread badge + toast)
- Sidebar icon Bell hiện count `unseen` từ summary (poll 30s khi ở page khác — dùng `useCoreQuery` global ở layout); click → /alert-center.
- Toast realtime: dùng `window` CustomEvent `alert-center-new` (dispatch từ `useAlertCenterRealtime` khi có alert mới chưa thấy) → layout hiện toast 5s (nút "Xem ngay" → navigate).
- AC: chuyển trang khác vẫn thấy badge tăng; click badge → trang mở đúng alert. Minh chứng: video 15s.

### Task D2 — Shareable filter URL + export CSV
- Sync filter state ↔ URLSearchParams: `?lane=&symbol=&severity=&family=&timeframe=` (init từ URL, pushState khi đổi, reset stats page).
- Export CSV: nút (i18n `exportCsv`) → xuất `alert-center-YYYYMMDD.csv` (columns: alert_id, alert_type, alert_family, lane, symbol, severity, direction, value, session_date, triggered_at, title, body) — tạo từ current displayAlerts (tối đa 500, chú ý dấu phẩy trong body — escape theo RFC4180).
- AC: mở URL share → filter đúng; CSV mở Excel không vỡ cột. Minh chứng: 2 screenshot.

### Task D3 — sessionDate picker (F11 cũ)
- FilterBar thêm date input (native `type="date"`, i18n `sessionDate`), gửi `session_date=YYYY-MM-DD`; xoá = reset; đổi lane → reset date. Backend đã hỗ trợ (views.py:179-180).
- AC: chọn ngày → feed/query có `session_date`; bỏ chọn → không có param. Screenshot.

### Task D4 — A11y + UX chuẩn quốc tế
- `DetailDrawer`: focus trap (Tab giữ trong drawer), `role=dialog` đã có, thêm `aria-labelledby`, focus đầu khi mở (đã có closeRef — mở rộng).
- Feed: `aria-live="polite"` trên container, keyboard navigation card (Enter mở detail), skip-link.
- Loading: skeleton đã có; thêm `aria-busy`.
- AC: kiểm tra bằng axe-core (npx @axe-core/cli) hoặc manual tab order — dán kết quả.

### Task D5 — Perf: summary/stats từ cache + batching
- Backend: thêm cache 10s cho `_build_summary_payload` và `_build_symbol_stats_payload` theo key `(lane, symbol, session, timeframe, severity, family)` (django cache, TTL 10) — tránh GROUP BY liên tục.
- Frontend: `staleTime` cho summary/stats 15s (React Query đã có staleTime 30s global — giữ).
- AC: benchmark `ab` hoặc log query count: symbol-stats từ cache giảm query DB ≥50% (2 request liên tiếp, log `DEBUG` count). Minh chứng: log count trước/sau.

### Task D6 — Observability + security hardening
- Backend: thêm middleware/log metric: `alert-center.feed.latency`, `symbol-stats.count` (dùng logging existing, không thêm lib).
- Rate limit: kiểm tra policy authenticated hiện có áp cho `/signals/*` (grep settings RATELIMIT) — nếu chưa có, thêm scope `signals` 60 req/min.
- Sentry/otel nếu đã cấu hình trong repo: thêm span cho queryFn 3 endpoint.
- AC: dán log latency sample; rate limit test: 61 requests trong 1 phút → request 61 bị 429 (curl loop script).

---

## 2. TRACEABILITY MATRIX

| Audit finding | Task | Test chính | Phase |
|---|---|---|---|
| F1 | A1 | useTenantAdminQuery.component.test.ts (refetchInterval passthrough) | 1 |
| F21 (infra) | A0 | npm test full suite xanh (baseline trước: 3 suites fail) | 0 |
| F2 | A2 | AlertCenterPage.component.test.tsx (pagination) | 1 |
| F3 | B1 | test_severity_multi_select / test_alert_family_multi_select | 1 |
| F4 | B2 | useRealtimeFeedCore.test.js (alert fields) + component live-top | 1 |
| F5 | B3 | test_event_detail_and_ack_respect_lane_param + useAlertCenterActions.test.js | 1 |
| F6 | B4 | test_user_without_watchlist_sees_no_alerts | 1 |
| F7 | B5 | test_symbol_stats_null_value_no_500 | 1 |
| F8 | B6 | normalizePollSymbolCandidates pseudo-symbol test | 1 |
| F10/F11/F17 | E1 | DetailDrawer.component.test.tsx + parity script | 1 |
| F14 | C1 | queryKey scope test (vitest) | 2 |
| F15 | C2 | Network tiers evidence | 2 |
| F9/F20 | C3 | test_cursor_pagination_ordering_annotated + load-more jest | 2 |
| F12/F13/F18 | C4 | FilterBar lane-options test | 2 |
| F16 | C5 | 6 component cases | 2 |
| F18/F10 residual | C6 | backend suite ≥12 test + parity script | 2 |
| F19 (bulk ack, a11y, notif, picker, export) | D1-D4 | manual + axe | 3 |
| Perf/Security/obs | D5-D6 | cache log + rate-limit curl | 3 |

---

## 3. ĐỊNH NGHĨA DONE TỔNG (DoD) — bắt buộc cho mọi PR

1. `npx tsc --noEmit` exit 0.
2. `npm test` (jest) PASS — dán tổng số tests.
3. `npm run test:components` (vitest) PASS — dán tổng số tests.
4. `npm run lint` exit 0 (chỉ warning pre-existing).
5. `npm run i18n:scan` không báo lỗi mới; parity vi/en alertCenter = 0 lệch.
6. Backend: `python manage.py test signal_intelligence` PASS — dán số tests.
7. `npm run build` exit 0 (chunk-size warning pre-existing OK).
8. Manual repro theo AC từng task — dán screenshot/video, KHÔNG ghi "OK" trần.
9. `docs/CODE_CHANGE_AUDIT_LEDGER.md` có entry mới per task/phase theo format hiện có (files touched, summary, validation, residual).

## 4. AUDIT CHECKLIST CUỐI (đội audit độc lập chạy lại, không hỏi code team)

- [ ] Chạy toàn bộ gate mục 1 — ghi output thật vào file `docs/AUDIT_ALERT_CENTER_VERIFICATION_<date>.md`.
- [ ] Re-trace 4 luồng của audit gốc (mục B report) — xác nhận từng bước giờ đúng: polling 5s chạy, live alert nổi top, pagination giữ trang, AI lane detail mở.
- [ ] Security: user mới (không watchlist) → feed 0; curl 60+ req/phút → 429 đúng policy.
- [ ] i18n: EN toggle → 0 chuỗi tiếng Việt trong alertCenter (grep `[àảãáạ]` trong rendered DOM của EN).
- [ ] Regression tenant-admin: `useTenantAdminQuery` vẫn hoạt động với mọi page cũ (13 page) — vitest 16 test cũ + test mới PASS.
- [ ] CONTRADICTIONS (mục C report cũ) đều đã đóng: plan P0 line 46/50 (polling), line 89-90/106 (multi-select), line 36 (dedupe) — cập nhật doc plan cũ đánh dấu hoàn thành.
- [ ] Ledger Entry 33 → bổ sung dòng "Resolved" theo từng phase khi đóng.

---

## 5. LƯU Ý KHÔNG THUỘC PHẠM VI (đội code không làm, ghi rõ để audit không hỏi)

- Đổi WS contract backend (`consumers.py`/`broadcasting.py`) — KHÔNG; chỉ đọc.
- Đổi `UnifiedAlert` model/migration — KHÔNG.
- Refactor `useRealtimeFeedCore` toàn bộ (1256 dòng) — KHÔNG; chỉ các điểm B2/B6.
- Legacy `UnifiedAlertCenter.js` dashboard — KHÔNG đụng (khác feature).
