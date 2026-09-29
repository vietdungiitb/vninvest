# PHẢN BIỆN ĐỘC LẬP: IMPLEMENTATION_PLAN_ADVERT_TRADEMARK_P1_P2_20260710.md

**Ngày review:** 2026-07-10  
**Reviewer:** Independent verification against 3 repo source code  
**Status:** ✅ APPROVED WITH CONDITIONS (3 blockers to resolve before T1.1)

---

## TÓM TẮT

| Metric | Score | Note |
|--------|-------|------|
| File/line accuracy | 95%+ | Claims match actual source across backend/widget/engine |
| Contract locking | ✅ Complete | §2 locks all 3 endpoint shapes |
| Phase decomposition | ✅ Excellent | 11 tasks P1, 4 tasks P2, self-contained |
| Audit gates | ✅ Self-service | Each phase has verify + audit checklist + doc self-update |
| Rollback safety | ✅ Additive changes | Engine changes optional/default null |

**Overall:** Kế hoạch chất lượng cao, sẵn sàng implement sau khi resolve 3 blockers.

---

## ✅ CLAIMS VERIFIED (Khớp code thực tế)

| # | Claim in Plan | Source Location | Verified |
|---|---------------|-----------------|----------|
| 1 | Backend `ContentDisplayView` trả đúng `AdCampaign` shape | `vninvest/packages/core/backend/src/advertising/views.py:151-166` | ✅ |
| 2 | Engine export `AdCampaign` type | `vninvestcharts-engine/packages/vn-kline-engine-react/src/index.ts:7` | ✅ |
| 3 | `EngineAdSlotProps.campaign?: AdCampaign \| null` tồn tại | `EngineAdSlot.tsx:55` | ✅ |
| 4 | `AdEnforcerHandle` THIẾU `updateCampaign` | `mountAdEnforcer.ts:8-13` | ✅ |
| 5 | `mountAdEnforcer` options THIẾU `campaign` | Line 105-110 | ✅ |
| 6 | `renderAd()` KHÔNG pass campaign vào `EngineAdSlot` | Line 74 | ✅ |
| 7 | `enforcementEnabled` + `updateEnforcement` ĐÃ CÓ (Phase A6) | Line 109, 142-146 | ✅ |
| 8 | `trademarkConfig.ts` fetch `/core/v1/widget/config` (no slash) | Line 20 | ✅ |
| 9 | Widget `fetchAd`/`refetchAd` là no-op | `SaaSFeatureContext.tsx:208-214` | ✅ |
| 10 | `adCampaign` context tồn tại, destructured tại `VNInvestCharts` | `types/saas.ts:51`, `VNInvestCharts.tsx:584` | ✅ |
| 11 | Dual trademark render: widget footer + engine portal | `VNInvestCharts.tsx` + `MultiChartsFooter.tsx` | ✅ |
| 12 | `EngineHostProps` THIẾU `campaign` prop | `types.ts:30-62` | ✅ |
| 13 | Widget `VNInvestClient.buildEndpoints()` có `AUTH_ME` | `VNInvestClient.ts:248` | ✅ |

---

## 🔴 3 BLOCKERS (Must resolve before T1.1)

### Blocker 1: Backend URL Routing Strategy
**Plan assumption:** Advertising included at `core/v1/` via `advertising/urls.py`  
**Reality:** `advertising/urls.py` chỉ có operator routes (`operator/ads/campaigns`, `operator/ads/analytics`). Public endpoints ở `advertising/api_urls.py` dưới `/api/v1/`.  
**Fix:** Tạo `advertising/widget_urls.py` mới với `WidgetConfigView`, `WidgetAdView` → include tại `vninvest_core/urls.py` namespace `core/v1/`.

### Blocker 2: Trailing Slash Mismatch
**Plan warns:** Engine gọi `${base}/core/v1/widget/config` (no slash), Django route có slash  
**Reality:** `trademarkConfig.ts:20` → `${base}/core/v1/widget/config` (no slash). Django `path('widget/config/', ...)` yêu cầu slash.  
**Fix:** Thêm cả 2 route (có/không slash) HOẶC bật `APPEND_SLASH=True` + test cả 2.

### Blocker 3: Response Shape Mismatch
**Plan assumes:** `ContentDisplayView` trả bare `{campaigns: AdCampaign[]}`  
**Reality:** `ContentDisplayView` wrap trong `{show_ads, hide_trademark, ad: {...}}` — KHÔNG khớp contract `{campaigns: [...]}`.  
**Fix:** `WidgetAdView` mới phải unwrap trả `{campaigns: AdCampaign[]}`.

---

## ⚠️ HIGH-RISK ITEMS (Technical Corrections)

| # | Plan Assumption | Reality | Required Fix |
|---|----------------|---------|--------------|
| 1 | Backend URL namespace `core/v1/widget/*` | `advertising.urls` chỉ operator; public endpoints ở `/api/v1/` | Tạo `widget_urls.py` + include tại `core/v1/` |
| 2 | `ContentDisplayView` trả `campaigns[]` | Trả `{show_ads, hide_trademark, ad: {...}}` | `WidgetAdView` mới trả `{campaigns: [...]}` |
| 3 | `renderAd(pat, validatePat?, tier?)` | Thiếu param `campaign` | Update signature + call sites |
| 4 | Trailing slash handling | Engine no-slash, Django slash | Thêm route không slash hoặc verify `APPEND_SLASH` |

---

## 🟡 MEDIUM-RISK (Verified OK with Notes)

| Item | Status | Note |
|------|--------|------|
| Tenant-scoped cache key | ✅ Plan correct | `trademarkConfig.ts:1` hardcoded global; widget dùng per-PAT key |
| `effectivePat` propagation | ✅ OK | Widget → EngineHost → `resolvePatTier` |
| `EngineTrademark` badge-only render | ✅ Plan correct | Phase 2: `renderAd()` khi `!enforcementEnabled` render badge thay vì empty Fragment |
| Rollback safety | ✅ Additive | `campaign` optional, default null; backward compat |
| Widget `AdCampaign` type | ✅ Matches engine | `types/saas.ts:26-35` khớp `EngineAdSlot.tsx:38-47` |

---

## 📋 AUDIT GATE CHECKLIST (Per Plan)

### Phase 1 Gate (Must PASS before P2)
```bash
# Backend
curl -s /core/v1/widget/config | jq '.trademark.enabled, .trademark.version'
curl -s /core/v1/widget/ad | jq '.campaigns[0] | has("campaign_id") and has("click_url")'
curl -s -H "Authorization: Bearer <pro_pat>" /core/v1/widget/ad | jq '.campaigns == []'

# Engine
npx tsc --noEmit  # 0 errors
npm test -- mountAdEnforcer  # 4/4 pass + updateCampaign test

# Widget
npm run type-check  # 0 errors
npm test

# Runtime proof
# Free tier + campaign → ad banner đúng image_source + click_url
# Pro tier → campaigns = []
```

### Phase 2 Gate (Sau P1 stable)
```bash
# Engine
npx tsc --noEmit
npm test -- mountAdEnforcer  # enforcement=false → badge-only render

# Widget
npm run type-check
grep -rn "<EngineTrademark" src/  # 0 direct renders

# Runtime
# Free tier + enforcement OFF → 1 badge duy nhất từ engine portal
# Free tier + enforcement ON → badge + ad + watchdog
```

---

## 🎯 KHUYẾN NGHỊ THỰC THI

### Trước khi bắt đầu T1.1 (Hôm nay):
1. [ ] Backend team: Confirm URL routing strategy (tạo `widget_urls.py` vs extend `api_urls.py`)
2. [ ] Backend team: Verify trailing slash handling (test cả 2 route)
3. [ ] Engine team: Sign-off `mountAdEnforcer` changes (3 touchpoints, low risk)

### Phase 1 Sprint (3-5 ngày):
- **Backend** (1-2d): `WidgetConfigView`, `WidgetAdView`, `widget_urls.py`, settings check
- **Engine** (0.5-1d): `mountAdEnforcer` wiring + `updateCampaign` handle
- **Widget** (1-2d): `VNInvestClient.WIDGET_AD`, `SaaSFeatureContext.fetchAd`, pass `campaign` → `EngineHost`
- **Cross-cutting**: Tenant-scoped cache key (engine + widget)
- **E2E test** (1d): Runtime proof free/pro tier

### Phase 2 Sprint (1-2 ngày, sau P1 stable):
- **Engine**: `renderAd()` badge-only khi `!enforcementEnabled`
- **Widget**: Xoá dual `EngineTrademark` render (VNInvestCharts + MultiChartsFooter)

---

## 📝 COMMIT FORMAT (Per Plan §3.5, §4.4)

```
# Backend (vninvest)
feat(widget-ad): add GET /core/v1/widget/ad + widget/config version [P1]

# Widget (vninvestcharts-widget)
feat(ad-pipeline): wire fetchAd → EngineHost campaign prop [P1]

# Engine (vninvestcharts-engine)
feat(ad-enforcer): add campaign option + updateCampaign handle [P1]

# Phase 2
refactor(trademark): remove dual EngineTrademark render, engine is SSOT [P2]
feat(trademark): render badge-only when enforcement disabled [P2]
```

---

## KẾT LUẬN

**Kế hoạch: 9/10** — Chi tiết, self-contained, audit gates rõ ràng, rollback an toàn.

**Điều kiện GO:** Resolve 3 blockers trên (Backend routing, trailing slash, response shape). Sau đó **conditional GO cho Phase 1**. Phase 3/4 defer như plan.

**File tham chiếu verified:**
- Backend: `vninvest/packages/core/backend/src/advertising/{views,urls,api_urls}.py`
- Widget: `vninvestcharts-widget/src/widget/{adapters/VNInvestClient.ts, contexts/SaaSFeatureContext.tsx, VNInvestCharts.tsx, types/saas.ts}`
- Engine: `vninvestcharts-engine/packages/vn-kline-engine-react/src/{types.ts, index.ts, useEngineHost.ts, ad/{mountAdEnforcer,EngineAdSlot,trademarkConfig}.ts(x)}`