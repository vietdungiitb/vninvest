# IMPLEMENTATION PLAN — ALERT CENTER `http://localhost:8080/alert-center`

**Ngày:** 2026-09-18 (sau phản biện độc lập `PHAN_BIEN_AUDIT_ALERT_CENTER_20260918.md`)
**Cơ sở:** `docs/AUDIT_ALERT_CENTER_20260918.md` (đã đính chính sau phản biện, 6 P0 + 8 P1 + 7 P2, parity TradingView ~35%) + `docs/PHAN_BIEN_AUDIT_ALERT_CENTER_20260918.md` (P0-7 downgrade → P3, P0-4 mechanism fix, 55 BE tests, 40/213 vitest)
**Mục tiêu:** Fix toàn bộ P0/P1 và nâng Alert Center lên chuẩn thương mại TradingView-grade. Plan đóng 100% quyết định — đội code thực thi KHÔNG cần hỏi lại, auditor kiểm tra theo checklist slice.
**Nguyên tắc:** (1) Không đổi REST shape trừ khi task ghi rõ (2) Mỗi slice có Spec code + Test bắt buộc + AC minh chứng lệnh + Tiêu chí audit (3) Sau mỗi slice `npx tsc --noEmit` + `npm run test:components` + `npm test` đều PASS (4) Cuối mỗi phase `npm run build` + `manage.py test signal_intelligence` PASS (5) i18n mọi string qua `t("alertCenter.*")`.

> **Lưu ý phản biện đã áp:** P0-7 downgrade → P3 (low), P0-4 `NaN` → `guard 0`, line numbers `serializers.py:88` → `views.py:88`, `materializers.py:686`. Gates cập nhật: `tsc PASS`, `build 32.79s PASS`, `i18n:scan EXIT 0` (auto-add), `vitest 40/213`, `BE 55 tests`. Thứ tự ưu tiên mới: **P0-6 > P0-3 > P0-2 > P0-5 > P0-4 > P3-07**.

---

## 0. QUYẾT ĐỊNH ĐÃ CHỐT (đội code KHÔNG được deviation — hỏi lại = fail audit)

| # | Vấn đề | Quyết định đóng |
|---|---|---|
| **D1** | F1 + P2-14 scope `tenant-admin` | **Phase 1 giữ** `useTenantAdminQuery` (đã forward `refetchInterval:53`). **Phase 2** mới tách `src/hooks/useCoreQuery.ts` scope `['core-user']`, migrate `useAlertCenterData`; `tenant-admin` không đổi. |
| **D2** | P0-3 multi-select | BE `severity` split `','` → `severity__in`; `alert_family` split `','` → build `Q_OR` theo **FAMILY MAP** dưới. Giữ single-value cũ. |
| **D3** | P0-5 lane cho detail/context/ack | Thêm query param `lane` (default `main`), 3 views đọc `lane` từ `request.query_params`; FE truyền `filters.lane`. |
| **D4** | P0-6 user rỗng | `delivery_service.py:67` `if not user_symbols: return queryset.none()` — security-first, áp nhất quán cả `main` và `ai` (không exception). |
| **D5** | P1-12 sort largest | Sort theo `value ?? matched_value ?? 0` (whale `matched_value` VND, signal `value` %). |
| **D6** | P1-13 aiSuggest metric | Chỉ render khi `lane==='ai'` (main lane ẩn). |
| **D7** | P1-15 polling tiers | Tách 3 sub-query: `feed 5s / summary 30s / symbolStats 30s`, return shape giữ nguyên. |
| **D8** | P1-16 tests | `jest` (`npm test`) chạy logic tests không mock ESM; `vitest` (`test:components`) chạy component tests mock `useQuery`/`WebSocket`. Mỗi slice có test bắt buộc. |
| **D9** | P1-17 VND/confidence | Thêm `alertCenter.currency='VND'`, `confidence` hiển thị `Math.round(c*100)%`. |
| **D10** | P1-09 load-more | Phase 2 append `extraAlerts` + `next` cursor; BE test cursor ordering trước khi FE. |
| **D11** | P1-SESS `sessionDate` | Phase 3 mới thêm date input `YYYY-MM-DD` → `session_date`, đổi lane reset. Phase 1 giữ dead `sessionDate` (không sửa). |
| **D12** | P3-07 total_value null | Downgrade P0 → P3 (không 500). Fix `Coalesce` cho OpenAPI correctness, ưu tiên thấp (cuối Phase 1). |
| **D13** | P0-4 mechanism | Guard `a?.triggered_at ? getTime() : 0` trả 0 (epoch) chứ không NaN — sửa mô tả, giữ P0 impact. |

**FAMILY MAP — đóng bảng, không suy diễn (dùng cho D2/B1):**

| Client gửi | Backend `Q` |
|---|---|
| `whale` | `alert_type='whale'` |
| `dark_flow` | `alert_type='dark_flow'` |
| `signal` | `alert_type='signal'` |
| `system` | `alert_type='system'` |
| `price_shock` | `alert_type='signal' AND source_ref LIKE 'market_anomaly:%'` |
| `stale_quote` | `(alert_type='system' AND source_ref LIKE 'stale_quote:%') OR freshness_state='stale'` |
| `ai_alert` | `alert_type='ai_alert'` |
| `ai_suggest` | `alert_type='ai_suggest'` |
| giá trị lạ | `alert_type=<value>` (giữ hành vi cũ, không 500) |
| multi `whale,dark_flow` | `Q(alert_type='whale') | Q(alert_type='dark_flow')` |

---

## 1. MÔI TRƯỜNG & LỆNH GATE (bắt buộc trước mỗi slice)

```bash
# Frontend — chạy tại packages/web
npx tsc --noEmit                          # exit 0
npm run test:components                   # vitest 40/213 → PASS (sau slice tăng)
npm test -- --no-coverage                 # jest 17/17 → PASS
npm run lint                              # exit 0 (chỉ warn pre-existing)
npm run i18n:scan                         # exit 0 — grep mới là truth cho missing keys (scanner auto-add)
npm run build                             # 32.79s PASS (chunk warn OK)

# Backend — chạy tại packages/core/backend
$env:DJANGO_DEBUG="true"; $env:DJANGO_ALLOWED_HOSTS="*"
python manage.py test signal_intelligence --verbosity=0   # 55 tests → OK (sau slice tăng)
python manage.py check                    # 0 issues
```

**Quy ước minh chứng mỗi slice:** dán output thật `tsc / vitest / jest / BE tests / build` vào PR comment. Không ghi "OK" trần.

---

## PHASE 1 — BUG-FIX P0 (6 slices, 2 sprint) — Ưu tiên P0-6 > P0-3 > P0-2 > P0-5 > P0-4 > P3-07

### Slice A2 — [P0-2] Stats pagination luôn reset về 1

**Mục tiêu:** Bấm trang 2/3 ở `StatsPanel` giữ nguyên, không snap back về 1.

**Files:**
- `packages/web/src/hooks/useAlertCenterFilters.ts` — thêm `resetStatsPage`
- `packages/web/src/pages/AlertCenterPage.tsx:200-202` — xóa `useEffect([filters])`

**Spec chi tiết:**

```ts
// useAlertCenterFilters.ts — thêm helper, trả về trong return
const resetStatsPage = useCallback(() => setPageStats(1), []);
return { lane,setLane, ..., pageStats,setPageStats, resetStatsPage, toggleSeverity, ... };

// Mỗi handler gọi resetStatsPage():
const toggleSeverity = useCallback((val:string)=>{
  setSeverityFilter(prev=> prev.includes(val) ? prev.filter(v=>v!==val) : [...prev,val]);
  setPageStats(1); // hoặc resetStatsPage()
},[]);
const toggleFamily = useCallback((val:string)=>{
  setFamilyFilter(prev=> prev.includes(val) ? prev.filter(v=>v!==val) : [...prev,val]);
  setPageStats(1);
},[]);
const clearFilters = useCallback(()=>{
  setSeverityFilter([]); setFamilyFilter([]); setPageStats(1);
},[]);
const applySymbol = useCallback((e:React.FormEvent)=>{
  e.preventDefault(); setAppliedSymbol(symbolDraft.trim().toUpperCase()); setPageStats(1);
},[symbolDraft]);

// AlertCenterPage.tsx — XÓA:
useEffect(()=>{ filters.setPageStats(1); },[filters]); // DELETE lines 200-202

// Thay bằng handlers đã có reset:
<FilterBar onLaneChange={(val)=>{ filters.setLane(val); filters.resetStatsPage(); actions.closeDetail(); }} />
// timeframe similarly
onTimeframeChange={(val)=>{ filters.setTimeframe(val); filters.resetStatsPage(); }}
```

**Không đổi:** `FilterBar` props, `StatsPanel` pagination buttons (`pageBtn`), `ITEMS_PER_PAGE=8`.

**Test bắt buộc (vitest `AlertCenterPage.component.test.tsx` mới — 1 test):**
```tsx
// mock useAlertCenterData trả 16 symbols (count 1..16)
vi.mock('../../hooks/useAlertCenterData.js', ()=>({ useAlertCenterData: ()=>({ loading:false, error:"", payload:{results:[]}, summary:{total:0,by_severity:{}}, symbolStats:{symbols: Array.from({length:16},(_,i)=>({symbol:`S${i}`,count:1,buy_count:1,sell_count:0,neutral_count:0,total_value:100, by_severity:{critical:0,high:0,medium:0,low:0}, latest_triggered_at: new Date().toISOString()})), pagination:{total_symbols:16}}, refetch: vi.fn() }) }));
// mock realtime + actions
render(<AlertCenterPage />);
// assert trang 1 hiện S0..S7, không có S8
// bấm » (next)
await userEvent.click(screen.getByRole('button',{name:'›'}));
// assert S8 hiện, S0 không hiện, vẫn ở trang 2 sau 500ms (waitFor không snap back)
await waitFor(()=> expect(screen.getByText('S8')).toBeInTheDocument(), {timeout: 700});
```

**AC + minh chứng:**
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:components` PASS (test mới)
- [ ] Manual: feed ≥9 mã → bấm `›` → trang 2 hiện, đợi 1s không nhảy về 1 → screenshot before/after

**Tiêu chí audit slice A2:**
- [ ] `grep -n "useEffect.*filters" AlertCenterPage.tsx` → 0 match (đã xóa)
- [ ] `grep -n "resetStatsPage\|setPageStats(1)" useAlertCenterFilters.ts` → ≥4 match (handlers)
- [ ] Vitest test `pagination stays on page 2` PASS
- [ ] Manual repro video 10s

---

### Slice B1 — [P0-3] Backend multi-select `severity` / `alert_family`

**Mục tiêu:** `?severity=critical,high` và `?alert_family=whale,dark_flow` trả union đúng.

**Files:**
- `packages/core/backend/src/signal_intelligence/views.py:141-178` `_apply_common_alert_filters`
- `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py` +2 tests

**Spec chi tiết `views.py:_apply_common_alert_filters`:**

```python
if alert_family:
    parts = [p.strip().lower() for p in str(alert_family).split(',') if p.strip()]
    if parts:
        q_or = Q()
        for val in parts:
            if val == 'price_shock':
                q_or |= Q(alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL) & Q(source_ref__startswith='market_anomaly:')
            elif val == 'stale_quote':
                q_or |= (Q(alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM) & (Q(source_ref__startswith='stale_quote:') | Q(freshness_state='stale')))
            elif val in {c[0] for c in UnifiedAlert.AlertTypeChoices.choices}:
                q_or |= Q(alert_type=val)
            else:
                q_or |= Q(alert_type=val)  # giữ hành vi cũ cho giá trị lạ
        qs = qs.filter(q_or)

if severity:
    parts = [p.strip().lower() for p in str(severity).split(',') if p.strip()]
    if len(parts) == 1:
        qs = qs.filter(severity=parts[0])
    elif len(parts) > 1:
        qs = qs.filter(severity__in=parts)
```

Giữ nguyên `timeframe/session_date/symbol/alert_type` logic.

**Test bắt buộc (`test_alert_center_api.py` style `setUp` có watchlist `VCI`):**
```python
def test_severity_multi_select_returns_union(self):
    self._create_alert(severity='high', source_ref='multi-sev-high', symbol='VCI')
    self._create_alert(severity='low', source_ref='multi-sev-low', symbol='VCI')
    res = self.client.get('/core/v1/signals/alert-center/feed', {'severity': 'high,low'})
    self.assertEqual(res.status_code, 200)
    self.assertEqual(len(res.json()['results']), 2)
    res2 = self.client.get('/core/v1/signals/alert-center/feed', {'severity': 'high'})
    self.assertEqual(len(res2.json()['results']), 1)

def test_alert_family_multi_select_returns_union(self):
    self._create_alert(alert_type='whale', source_ref='fam-whale', symbol='VCI')
    self._create_alert(alert_type='dark_flow', source_ref='fam-dark', symbol='VCI')
    self._create_alert(alert_type='signal', source_ref='market_anomaly:x', symbol='VCI')  # price_shock
    res = self.client.get('/core/v1/signals/alert-center/feed', {'alert_family': 'whale,dark_flow'})
    self.assertEqual(len(res.json()['results']), 2)
    self.assertNotIn('signal', [r['alert_type'] for r in res.json()['results']])
    res2 = self.client.get('/core/v1/signals/alert-center/feed', {'alert_family': 'price_shock'})
    self.assertEqual(len(res2.json()['results']), 1)
    self.assertEqual(res2.json()['results'][0]['alert_type'], 'signal')
```

**AC + minh chứng:**
- [ ] `python manage.py test signal_intelligence --verbosity=0` 57 tests PASS (55 cũ +2 mới)
- [ ] curl `GET /core/v1/signals/alert-center/feed?severity=high,low` → 2 results (dán JSON)
- [ ] `GET ?alert_family=whale,dark_flow` → 2 results không có signal

**Tiêu chí audit B1:**
- [ ] `grep -n "severity__in" views.py` → ≥1
- [ ] `grep -n "Q(alert_type" views.py` → ≥3 (family map)
- [ ] BE tests `test_severity_multi*` + `test_alert_family_multi*` PASS
- [ ] Single-value vẫn PASS (`?severity=high` → 1)

---

### Slice B2 — [P0-4] WS normalize `triggered_at`/`alert_id`/`value`/`direction` + sort fallback

**Mục tiêu:** Live whale alert nổi TOP feed "Mới nhất", có thể ack/detail.

**Files:**
- `packages/web/src/hooks/useRealtimeFeedCore.js:238-257` `normalizeAlert`
- `packages/web/src/pages/AlertCenterPage.tsx:121-131` sort + `:315` key
- `packages/web/src/components/alert-center/AlertCard.tsx:131` value (làm cùng E1)
- `packages/web/src/hooks/useAlertCenterRealtime.js:27` dedupe (verify)

**Spec chi tiết:**

```js
// useRealtimeFeedCore.js — normalizeAlert bổ sung 4 field:
function normalizeAlert(payload){
  const data = payload.data || {};
  return {
    event_id: readEventField(payload,'event_id'),
    alert_id: readEventField(payload,'event_id'), // WS event_id == alert_id (broadcasting.py:108)
    triggered_at: readEventField(payload,'triggered_at') ?? data.triggered_at ?? null,
    direction: readEventField(payload,'direction') ?? data.direction ?? null,
    value: readEventField(payload,'matched_value') ?? data.matched_value ?? null,
    symbol: readEventField(payload,'symbol') ?? payload.symbol,
    severity: readEventField(payload,'severity') ?? data.severity,
    ts: normalizeEventTimestamp(payload.ts || data.triggered_at || payload.created_at),
    // keep existing: side, matched_value, threshold, size_class, event_score, etc.
  };
}
// similarly normalizeDarkFlowAlert if needed (already has ts)

// AlertCenterPage.tsx — sort fallback ts:
const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : (a?.ts ? new Date(a.ts).getTime() : 0);
const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : (b?.ts ? new Date(b.ts).getTime() : 0);
return timeB - timeA; // largestValue: Number(b?.value??b?.matched_value??0) - Number(a?.value??a?.matched_value??0)

// key:
<AlertCard key={displayAlerts[index].alert_id ?? displayAlerts[index].event_id} ... />
```

**Test bắt buộc (vitest + jest):**
- `useRealtimeFeedCore.component.test.ts` (vitest): fake `global.WebSocket`, `onmessage` với `whale_alert` payload `{event_id:'uuid-1', symbol:'VCI', ts:'2026-09-18T08:00:00Z', data:{triggered_at:'2026-09-18T08:00:01Z', direction:'buy', matched_value:1_000_000_000}}` → assert `alerts[0].triggered_at==='2026-09-18T08:00:01Z' && alert_id==='uuid-1' && value===1e9`.
- `AlertCenterPage.component.test.tsx`: mock `useAlertCenterRealtime` trả `realtimeAlerts:[{alert_id:'live-1', triggered_at: futureISO, symbol:'VCI'}]` + REST 2 alerts cũ → assert live item ở **đầu** DOM feed (first card).

**AC + minh chứng:**
- [ ] `tsc` 0, `test:components` PASS
- [ ] Manual: backend `broadcast_unified_alert` whale → card mới xuất hiện TOP trong <1s, có `triggered_at/value` đúng → video 10s

**Tiêu chí audit B2:**
- [ ] `grep -n "triggered_at" useRealtimeFeedCore.js` → ≥2 (normalize)
- [ ] `grep -n "alert_id.*event_id" useRealtimeFeedCore.js` → ≥1
- [ ] `grep -n "triggered_at.*ts" AlertCenterPage.tsx` → fallback
- [ ] Vitest live-top test PASS

---

### Slice B3 — [P0-5] Lane param cho detail/context/ack + FE fallback `event_id`

**Mục tiêu:** AI lane `Chi tiết` mở được, WS live item ack/detail được.

**Files:**
- BE `views.py:525-590` 3 views `AlertCenterEventDetailView/SymbolContext/AcknowledgeView`
- FE `market.js:87-113` 3 adapters
- FE `useAlertCenterActions.ts:21-85`
- FE `AlertCenterPage.tsx:103` truyền lane

**Spec BE:**

```python
# views.py — mỗi view đọc lane:
lane = str(request.query_params.get('lane') or 'main').strip().lower()
if lane not in ('main','ai'):
    lane = 'main'
qs = _apply_common_alert_filters(qs, request.query_params, lane=lane)
# áp dụng cho detail/context/ack
```

**Spec FE `market.js`:**

```js
getAlertCenterEventDetail(alertId, params={}){
  const q = new URLSearchParams(params).toString();
  return coreGet(`/signals/alert-center/events/${encodeURIComponent(alertId)}${q?`?${q}`:''}`);
}
acknowledgeAlertCenterEvent(alertId, params={}){
  const q = new URLSearchParams(params).toString();
  return corePost(`/signals/alert-center/events/${encodeURIComponent(alertId)}/ack${q?`?${q}`:''}`);
}
// getAlertCenterSymbolContext đã có params — giữ
```

**Spec FE `useAlertCenterActions.ts`:**

```ts
export function useAlertCenterActions(refetch:()=>void, lane:string='main'){
  const handleLoadDetail = useCallback(async (alert)=>{
    const id = (alert as any).alert_id ?? (alert as any).event_id;
    const sym = (alert as any).symbol;
    if(!id || !sym) return;
    const [detail, ctx] = await Promise.all([
      coreApiAdapter.getAlertCenterEventDetail(id, {lane}),
      coreApiAdapter.getAlertCenterSymbolContext(sym, {lane}),
    ]);
    setActiveDetail(detail); ...
  },[lane]);
  const handleAcknowledge = useCallback(async (alert)=>{
    const id = (alert as any).alert_id ?? (alert as any).event_id;
    if(!id) return;
    await coreApiAdapter.acknowledgeAlertCenterEvent(id, {lane});
    refetch();
  },[lane, refetch]);
}
// AlertCenterPage.tsx:
const actions = useAlertCenterActions(refetch, filters.lane);
```

**Test bắt buộc:**
- BE `test_alert_center_api.py`:
```python
def test_event_detail_respects_lane_param(self):
    ai = self._create_alert(alert_type='ai_suggest', source_ref='ai-lane-test', symbol='VCI')
    # main lane → 404
    r1 = self.client.get(f'/core/v1/signals/alert-center/events/{ai.alert_id}')
    self.assertEqual(r1.status_code, 404)
    # ai lane → 200
    r2 = self.client.get(f'/core/v1/signals/alert-center/events/{ai.alert_id}', {'lane': 'ai'})
    self.assertEqual(r2.status_code, 200)
    # ack ai lane
    r3 = self.client.post(f'/core/v1/signals/alert-center/events/{ai.alert_id}/ack', {}, QUERY_STRING='lane=ai')
    # using ?lane=ai via query_params in POST — DRF reads query_params even on POST
    self.assertEqual(r3.status_code, 200)
```
- FE `useAlertCenterActions.component.test.tsx` (vitest mock `coreApiAdapter`): `handleLoadDetail({event_id:'y', symbol:'VCI'})` với lane ai → assert `getAlertCenterEventDetail('y',{lane:'ai'})`.

**AC + minh chứng:**
- [ ] BE 57 tests (55+2) PASS
- [ ] FE vitest PASS
- [ ] Manual: switch lane AI → click Chi tiết → drawer mở (trước 404) → screenshot

**Tiêu chí audit B3:**
- [ ] `grep -n "lane.*query_params" views.py` → ≥3
- [ ] `grep -n "getAlertCenterEventDetail.*lane" market.js` → 1
- [ ] `grep -n "event_id.*alert_id" useAlertCenterActions.ts` → fallback

---

### Slice B4 — [P0-6] User rỗng → `none()` (security)

**Mục tiêu:** User mới 0 watchlist không thấy global feed.

**Files:**
- `packages/core/backend/src/signal_intelligence/delivery_service.py:65-68`

**Spec:**

```python
def apply_user_delivery_policy(*, user, queryset):
    user_symbols = resolve_user_delivery_symbols(user)
    if not user_symbols:
        return queryset.none()  # was: return queryset
    scoped = queryset.filter(symbol__in=user_symbols)
    # ... rest unchanged
```

Không đổi `resolve_user_whale_threshold` / `preferences` — chỉ áp sau khi đã `none()` (không chạy).

**Test bắt buộc:**
```python
def test_user_without_watchlist_sees_no_alerts(self):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user2 = User.objects.create_user(username='no-watchlist', password='pass')
    # user2 không watchlist — dùng force_authenticate
    from rest_framework.test import APIClient
    c2 = APIClient(); c2.force_authenticate(user=user2)
    # tạo alert VCI cho user1 (có watchlist) — user2 không thấy
    self._create_alert(symbol='VCI', source_ref='leak-test', alert_type='whale')
    r = c2.get('/core/v1/signals/alert-center/feed')
    self.assertEqual(r.status_code, 200)
    self.assertEqual(len(r.json()['results']), 0)
    r2 = c2.get('/core/v1/signals/alert-center/summary')
    self.assertEqual(r2.json()['total'], 0)
    # user1 vẫn thấy
    r3 = self.client.get('/core/v1/signals/alert-center/feed')
    self.assertEqual(len(r3.json()['results']), 1)
```

**AC + minh chứng:**
- [ ] BE 56 tests PASS (chú ý 5 cũ với user có watchlist không ảnh hưởng)
- [ ] `grep -rn "apply_user_delivery_policy" signal_intelligence/views.py` → 6 caller (feed/summary/stats/detail/context/ack) đều scoped

**Tiêu chí audit B4:**
- [ ] `read delivery_service.py:67` → `return queryset.none()`
- [ ] Test `test_user_without_watchlist_sees_no_alerts` PASS
- [ ] Không có `if lane == 'ai': return queryset` exception (theo D4 nhất quán)

---

### Slice E1 — [P1-10/11/17] Drawer field thật + i18n + currency/confidence

**Mục tiêu:** Drawer không hiển thị field ảo, i18n đủ, VND/confidence đúng.

**Files:**
- `packages/web/src/i18n/vi.js:5272` + `en.js:5256` block `alertCenter`
- `packages/web/src/components/alert-center/DetailDrawer.tsx:53,80,97-98`
- `packages/web/src/components/alert-center/AlertCard.tsx:131,158`

**Spec i18n (vi/en parity, tiếng Việt full dấu):**
```js
// vi.js alertCenter block — thêm 8 keys:
close: 'Đóng', // cho aria-label nút X
detailSummary: 'Tóm tắt', // fix D-11
detailRecentEvents: 'Sự kiện gần nhất',
detailInScope: 'Trong phạm vi giao nhận',
detailNotInScope: 'Ngoài phạm vi giao nhận',
currency: 'VND',
famStaleQuote: 'Stale Quote',
famAiAlert: 'AI Alert',
loadMore: 'Tải thêm',
// en.js tương ứng: Close, Summary, Recent events, In delivery scope, Outside..., VND, Stale Quote, AI Alert, Load more
```

**Spec `DetailDrawer.tsx`:**
```tsx
// fix missing keys:
aria-label={t("alertCenter.close")} // now exists
<span>{t("alertCenter.detailSummary")}</span> // now exists
// XÓA 2 dòng:
<div>{t("alertCenter.detailAvgSeverity")}: <strong>{average_severity}</strong></div> // DELETE 97
<div>{t("alertCenter.detailThreshold")}: <strong>{threshold_strategy}</strong></div> // DELETE 98
// THÊM:
{props.activeContext && (
  <>
    <div>{t(props.activeContext.in_delivery_scope ? "alertCenter.detailInScope" : "alertCenter.detailNotInScope")}</div>
    <ul>{(props.activeContext.recent_events as any[])?.slice(0,5).map(ev=> <li key={ev.alert_id}>{ev.symbol} {ev.severity} {new Date(ev.triggered_at).toLocaleString('vi-VN')}</li>)}</ul>
  </>
)}
```

**Spec `AlertCard.tsx`:**
```tsx
// line 131:
{formatAlertValue(alert.value ?? (alert as any).matched_value)} {t('alertCenter.currency')}
// line 158:
{t("alertCenter.labelConfidence")}: {alert.confidence!=null ? `${Math.round(alert.confidence*100)}%` : "—"}
```

**Test bắt buộc (vitest `DetailDrawer.component.test.tsx`):**
```tsx
render(<DetailDrawer activeAlertId="x" activeDetail={{title:'T', summary:'S'}} activeContext={{symbol:'VCI', total:2, unseen:1, in_delivery_scope:true, recent_events:[{alert_id:'1', symbol:'VCI', severity:'high', triggered_at: new Date().toISOString()}]}} appliedSymbol="VCI" onClose={vi.fn()}/>);
expect(screen.getByText('Trong phạm vi giao nhận')).toBeInTheDocument();
expect(screen.getByText('VCI')).toBeInTheDocument();
expect(screen.queryByText('medium')).not.toBeInTheDocument(); // no fake field
```

**AC + minh chứng:**
- [ ] `npx tsc --noEmit` 0, `npm run test:components` PASS, `npm run i18n:scan` exit 0 + grep parity 0
- [ ] `grep alertCenter.close vi.js` → 1, `en.js` →1, `grep VND AlertCard.tsx` → `t('alertCenter.currency')`

**Tiêu chí audit E1:**
- [ ] `grep -n "average_severity" DetailDrawer.tsx` → 0
- [ ] `grep -n "recent_events" DetailDrawer.tsx` → ≥1
- [ ] `grep -n "t('alertCenter.currency')" AlertCard.tsx` → 1
- [ ] `grep -n "Math.round.*confidence" AlertCard.tsx` → 1

---

### Slice P3-07 — [P3] Coalesce cho OpenAPI correctness (low priority, cuối Phase 1)

**Files:** `views.py:244` + `views.py:88` serializer doc

**Spec (đã downgrade):**

```python
# views.py:_build_symbol_stats_payload
from django.db.models.functions import Coalesce
from django.db.models import Value, DecimalField
total_value=Coalesce(Sum('value'), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2))
# hoặc allow_null=True trong serializer — ưu tiên Coalesce để docs đúng
```

Không gây 500, chỉ fix docs hiển thị `null` → `0`.

**Test:** `test_symbol_stats_null_value` tạo 2 `SIGNAL value=None` → `GET /symbol-stats` → `symbols[0].total_value == '0.00'` (không null).

**Tiêu chí audit:** `grep -n "Coalesce" views.py` → 1.

---

## PHASE 2 — TÍNH NĂNG CÒN THIẾU (P1, 2 sprint)

### Slice C1 — [P2-14] Tách `useCoreQuery` (scope user)

**Files:** mới `packages/web/src/hooks/useCoreQuery.ts`, sửa `useAlertCenterData.js`, `QueryProvider.tsx` giữ nguyên.

**Spec:**
```ts
// useCoreQuery.ts — copy useTenantAdminQuery nhưng scope ['core-user']
export function useCoreQuery<T>(queryKey:string[], options:{enabled?:boolean, queryFn?:()=>Promise<T>, refetchInterval?:number|false}){
  const scopedKey = ['core-user', ...queryKey];
  return useQuery<T>({ queryKey: scopedKey, queryFn: options.queryFn!, enabled: options.enabled, refetchInterval: options.refetchInterval });
}
// useAlertCenterData.js đổi import:
import { useCoreQuery } from './useCoreQuery.js';
// 3 lần gọi useCoreQuery thay vì useTenantAdminQuery
```

**Test:** vitest `queryKey scope test` — render hook với `tenant_id` khác, assert key không đổi; `tenant-changed` event không invalidate `core-user`.

**Tiêu chí audit C1:** `grep -rn "core-user" src/hooks` → ≥1, `grep -rn "useCoreQuery" src` → ≥1.

---

### Slice C2 — [P1-15] Tách polling 3 tiers

**Files:** `useAlertCenterData.js:49-55`

**Spec:**
```js
// Thay Promise.all 1 queryFn thành 3 useCoreQuery:
const feedQ = useCoreQuery(['alert-center-feed', lane, symbol, sessionDate, timeframe, severityKey, familyKey], { queryFn: ()=> coreApiAdapter.getAlertCenterFeed(q), refetchInterval: autoRefresh?5000:false });
const summaryQ = useCoreQuery(['alert-center-summary', ...], { queryFn: ()=> coreApiAdapter.getAlertCenterSummary(q), refetchInterval: autoRefresh?30000:false });
const statsQ = useCoreQuery(['alert-center-stats', ...], { queryFn: ()=> coreApiAdapter.getAlertCenterSymbolStats({...q, page:1, page_size:200}), refetchInterval: autoRefresh?30000:false });
// return { loading: feedQ.isLoading||summaryQ.isLoading..., error: feedQ.error||..., payload: feedQ.data, summary: summaryQ.data, symbolStats: statsQ.data, refetch: ()=>{feedQ.refetch();summaryQ.refetch();statsQ.refetch();} }
```

Giữ shape return.

**Tiêu chí audit C2:** Network tab `feed` 5s, `summary/stats` 30s (screenshot), `grep -n "refetchInterval.*30000" useAlertCenterData.js` → 2.

---

### Slice C3 — [P1-09] Load-more cursor

**Files:** BE test + FE `AlertCenterPage.tsx` + `useAlertCenterData.js`

**Spec BE test trước (verify P2-F20):**
```python
def test_cursor_pagination_ordering_annotated(self):
    # tạo 5 alerts (2 whale, 3 dark_flow) với triggered_at khác
    r1 = self.client.get('/core/v1/signals/alert-center/feed', {'page_size': 2})
    self.assertIsNotNone(r1.json()['next'])
    r2 = self.client.get(r1.json()['next'])  # follow cursor
    self.assertEqual(len(r1.json()['results']) + len(r2.json()['results']), 4) # 2 pages
    # no duplicate
```

**Spec FE:**
```tsx
const [extraAlerts, setExtra]=useState([]);
const [cursor, setCursor]=useState(null);
const alerts = useMemo(()=> [...base, ...extra, ...realtime] dedupe, [base,extra,realtime]);
const handleLoadMore = async()=>{
  const res = await coreApiAdapter.getAlertCenterFeed({...q, cursor});
  setExtra(prev=> [...prev, ...res.results]); setCursor(res.next);
};
// reset khi filters đổi
useEffect(()=>{ setExtra([]); setCursor(null); },[lane,symbol,severityKey,familyKey,timeframe]);
<Button disabled={!payload.next && !cursor} onClick={handleLoadMore}>{t('alertCenter.loadMore')}</Button>
```

**Tiêu chí audit C3:** BE cursor test PASS, FE click Tải thêm → list dài hơn.

---

### Slice C4 — [P1-12/13/18] Sort + metric + family động

**Files:** `AlertCenterPage.tsx:188,123`, `FilterBar.tsx:24`

**Spec:**
```tsx
// AlertCenterPage.tsx metric:
{lane==='ai' && <ShellMetric label={t('alertCenter.summary.aiSuggest')} value={aiCount}/>}
// sort: Number(b?.value??b?.matched_value??0)
// FilterBar.tsx:
const FAMILY_OPTIONS = lane==='ai'
  ? [{value:'ai_suggest',labelKey:'alertCenter.famAiSuggest'},{value:'ai_alert',labelKey:'alertCenter.famAiAlert'}]
  : [{value:'whale',...},{value:'dark_flow',...},{value:'price_shock',...},{value:'signal',...},{value:'system',...},{value:'stale_quote',labelKey:'alertCenter.famStaleQuote'}];
```

**Tiêu chí audit C4:** vitest `FilterBar lane ai` → 2 options, `lane main` → 6 options.

---

### Slice C5 — [P1-16] Component test AlertCenterPage

**Files:** mới `packages/web/src/pages/AlertCenterPage.component.test.tsx` (6 cases)

**Cases bắt buộc:**
1. loading → `ShellSkeleton`
2. error → banner + Retry gọi `refetch`
3. empty → `t('alertCenter.empty')`
4. feed 3 items → 3 cards, sort newest-first
5. pagination regression (A2)
6. WS merge realtime top

Wrap `LangProvider` mock `t` identity nếu cần.

**Tiêu chí audit C5:** `npm run test:components` ≥6 tests mới PASS.

---

## PHASE 3 — ĐẲNG CẤP QUỐC TẾ (3 sprint)

### D1 — Notification center (bell badge + toast + sound)
- Sidebar `Bell` icon hiện `summary.unseen` (poll 30s global ở layout `useCoreQuery`).
- `useAlertCenterRealtime` dispatch `CustomEvent('alert-center-new')` khi có alert mới chưa thấy → layout toast 5s + `new Audio('/sounds/alert.mp3').play()`.
- **Audit:** badge tăng khi ở page khác, click → `/alert-center`.

### D2 — Shareable URL + export CSV
- Sync `filters` ↔ `URLSearchParams` `?lane=&symbol=&severity=&family=&timeframe=` (init từ `location.search`, `history.pushState` khi đổi).
- Export `t('alertCenter.exportCsv')` → `alert-center-YYYYMMDD.csv` columns `alert_id,alert_type,alert_family,lane,symbol,severity,direction,value,session_date,triggered_at,title,body` RFC4180 escape.
- **Audit:** mở URL share → filter đúng; CSV mở Excel không vỡ cột.

### D3 — sessionDate picker
- `FilterBar` thêm `<input type="date">` `t('alertCenter.sessionDate')`, gửi `session_date`, reset khi đổi lane.
- **Audit:** chọn ngày → query có `session_date`, bỏ → không param.

### D4 — A11y
- `DetailDrawer` focus-trap, `aria-labelledby`, `role=dialog` đã có + `aria-label` fix.
- Feed `aria-live="polite" aria-busy`, card `tabIndex 0` Enter mở detail.
- **Audit:** `axe-core` 0 critical.

### D5 — Perf cache
- BE `django cache 10s` cho `_build_summary_payload/_build_symbol_stats_payload` key `(lane,symbol,severity,family,timeframe,page)`.
- **Audit:** 2 request liên tiếp `DEBUG` query count giảm ≥50%.

### D6 — Observability + security
- Log `alert-center.feed.latency`, `symbol-stats.count`; rate-limit `signals 60/min` (kiểm tra `settings.py` nếu chưa có).
- **Audit:** 61 req/phút → 429 thứ 61.

---

## 2. TRACEABILITY MATRIX

| Finding | Slice | Test chính | Phase |
|---|---|---|---|
| P0-2 pagination | A2 | `AlertCenterPage.component.test` pagination stays | 1 |
| P0-3 multi-select | B1 | `test_severity_multi_select` + `test_alert_family_multi` | 1 |
| P0-4 WS sort | B2 | `useRealtimeFeedCore` fields + live-top component | 1 |
| P0-5 lane 404 | B3 | `test_event_detail_respects_lane` + `useAlertCenterActions` fallback | 1 |
| P0-6 leak | B4 | `test_user_without_watchlist_sees_no_alerts` | 1 |
| P3-07 Coalesce | P3-07 | `test_symbol_stats_null_value` | 1 low |
| P1-10/11/17 drawer/i18n | E1 | `DetailDrawer.component` + parity script | 1 |
| P2-14 scope | C1 | `useCoreQuery` scope test | 2 |
| P1-15 tiers | C2 | Network tiers screenshot | 2 |
| P1-09 load-more | C3 | cursor ordering + load-more jest | 2 |
| P1-12/13/18 | C4 | `FilterBar` lane options | 2 |
| P1-16 component | C5 | 6 cases | 2 |
| TradingView parity | D1-D6 | manual + axe | 3 |

---

## 3. DoD TỔNG (bắt buộc mỗi PR)

1. `npx tsc --noEmit` 0
2. `npm test -- --no-coverage` PASS (17/17 + mới)
3. `npm run test:components` PASS (40/213 + mới)
4. `npm run lint` 0 error
5. `npm run i18n:scan` exit 0 + `grep` parity `alertCenter` vi/en 0 lệch
6. `python manage.py test signal_intelligence --verbosity=0` PASS (55 + mới)
7. `npm run build` 32.79s PASS
8. Manual repro screenshot/video theo AC slice
9. `docs/CODE_CHANGE_AUDIT_LEDGER.md` entry mới per slice (files, summary, validation)

---

## 4. CHECKLIST AUDIT CUỐI (auditor chạy lại, không hỏi code team)

- [ ] Gates mục 1 đều PASS — dán output thật vào `docs/AUDIT_ALERT_CENTER_VERIFICATION_<date>.md`
- [ ] Re-trace 4 luồng B1-B4 — polling 5s chạy, live top, pagination giữ, AI detail mở
- [ ] Security: user rỗng → 0 feed; 61 req/phút → 429
- [ ] i18n: EN toggle → 0 chuỗi VN trong alertCenter (`grep [àảãáạ]` trong DOM EN)
- [ ] Regression tenant-admin 13 pages vitest 40/213 PASS
- [ ] CONTRADICTIONS C đều đóng
- [ ] Ledger + AGENTS.md cập nhật

---

## 5. KHÔNG THUỘC PHẠM VI (không làm, audit không hỏi)

- Đổi WS contract `consumers.py/broadcasting.py` — KHÔNG (chỉ đọc)
- Đổi `UnifiedAlert` model/migration — KHÔNG (trừ `Coalesce` view)
- Refactor toàn bộ `useRealtimeFeedCore` 1260 dòng — KHÔNG (chỉ B2/B4)
- Epic `Create Alert` TradingView-grade — TÁCH BRD workshop riêng (không trong 3 phase này)
