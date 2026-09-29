# Giải Pháp Quản Lý Advertisement Widget & Trademark (Frontend)

> **Trạng thái**: Chờ phê duyệt  
> **Tác giả**: AI Agent  
> **Ngày**: 2026-07-10  
> **Repo**: `vninvestcharts-widget` (widget) + `vninvestcharts-engine` (engine)

---

## 1. Hiện trạng

| Layer | Component | Trạng thái |
|-------|-----------|-----------|
| **Engine (closed)** | `mountAdEnforcer` — singleton portal root, anti-spoof `_validatedTier` | ✅ Hoạt động |
| **Engine (closed)** | `EngineAdSlot` — banner + popup campaign | ✅ Cơ chế render, nhưng thiếu data source |
| **Engine (closed)** | `EngineTrademark` — badge `⚡ vninvest` + watchdog degrade | ✅ Hoạt động |
| **Engine (closed)** | `trademarkConfig.ts` — fetch `GET /core/v1/widget/config` | ✅ Hoạt động (cache sessionStorage 20 phút) |
| **Widget (open)** | `SaaSFeatureContext` — feature flags, PAT storage | ✅ Hoạt động, nhưng `fetchAd`/`refetchAd` là no-op |
| **Widget (open)** | `VNInvestClient` — `buildEndpoints()` | ✅ Endpoint `AUTH_ME` tồn tại, thiếu endpoint campaign/ad |
| **Widget (open)** | `VNInvestCharts.tsx` — `EngineTrademark` footer (client tier) | ⚠️ Dual render với engine portal |
| **Backend (SaaS)** | `GET /core/v1/widget/config` | ✅ Có thể triển khai |
| **Backend (SaaS)** | `GET /core/v1/auth/me` | ✅ Có thể triển khai |

---

## 2. Các gap đã xác định

1. **Ad campaign infrastructure chết**: `fetchAd` là no-op → `EngineAdSlot` không có campaign data → ad overlay không bao giờ hiện (dù enforcement bật)
2. **Dual trademark rendering**: `EngineTrademark` được render ở cả engine portal (khi enforcement bật) và widget footer (luôn) → nguy cơ 2 badge
3. **Widget footer dùng client-side tier**: `patTier={resolvePatTier(effectivePat ?? "")}` — fork widget có thể pass `patTier="enterprise"` để ẩn badge footer
4. **Không hỗ trợ ad network ngoài**: `EngineAdSlot` hardcode cho VNInvest campaign, không có abstraction để plug Google Ad Manager, AdMob, v.v.
5. **Cache staleness 20 phút**: Nếu server bật/tắt enforcement, client mất đến 20 phút mới sync
6. **Không có loading/transition UX**: Khi config fetch chậm, enforcement nhảy từ `false → true` đột ngột
7. **Hardcoded VN text trong engine**: Engine closed → widget không thể i18n được text ad overlay

---

## 3. Giải pháp đề xuất (4 Phase)

### Phase 1: Ad Campaign Pipeline

**Mục tiêu**: Thay thế `fetchAd` no-op bằng real campaign API, `EngineAdSlot` có data để render.

**Thay đổi backend**:
- Thêm endpoint mới `GET /core/v1/widget/ad`. Response campaign phải khớp **chính xác** type `AdCampaign` đã tồn tại trong engine (`EngineAdSlot.tsx:38-47`) để không phải sửa engine mapping:

```json
{
  "campaigns": [{
    "campaign_id": "camp_001",
    "image_source": { "default": "https://.../banner.png", "retina": "https://.../banner@2x.png", "svg": "https://.../banner.svg" },
    "video_url": "https://.../promo.mp4",
    "click_url": "https://saas.edusuccess.vn/upgrade",
    "click_tracking_url": "https://saas.edusuccess.vn/track/click/camp_001",
    "impression_tracking_url": "https://saas.edusuccess.vn/track/imp/camp_001",
    "width": 200,
    "height": 50,
    "targeting": { "tiers": ["free", "starter"] },
    "start_at": 1750000000000,
    "end_at": 1750600000000
  }]
}
```

> ⚠️ **Contract lock**: `campaign_id`, `image_source.default`, `click_url`, `click_tracking_url`, `impression_tracking_url`, `width`, `height` là **required** trong engine `AdCampaign`. `video_url` optional. `targeting`/`start_at`/`end_at` là field mở rộng của backend — widget filter trước khi map sang `AdCampaign` (engine không dùng).

**Thay đổi widget**:
- `VNInvestClient.ts`: Thêm `WIDGET_AD` endpoint + `CampaignResponse` type (map sang `AdCampaign`)
- `SaaSFeatureContext.tsx`: `fetchAd` gọi real API, filter theo tier/thời gian, cache campaign data (5 phút TTL, tenant-scoped key)
- `VNInvestCharts.tsx`: Đọc campaign từ context, pass `campaign` prop xuống `EngineHost` → `mountAdEnforcer`

**Engine changes** (đã verify với source — scope nhỏ hơn dự kiến ban đầu):
- `EngineAdSlot.tsx`: **KHÔNG cần sửa** — `campaign?: AdCampaign` prop đã tồn tại (`EngineAdSlotProps` dòng 55) + type `AdCampaign` đầy đủ (dòng 38-47).
- `mountAdEnforcer.ts`: **CẦN sửa** 3 điểm:
  1. Thêm `campaign?: AdCampaign | null` vào `options` + module var `_currentCampaign`
  2. `renderAd()` dòng 74 truyền `campaign: _currentCampaign` vào `createElement(EngineAdSlot, {...})` (hiện chỉ truyền `{pat, validatePat}`)
  3. Thêm handle `updateCampaign(campaign)` vào `AdEnforcerHandle` (hiện chỉ có `updatePat/updateTier/updateEnforcement/unmount`)

**Flow**:
```
SaaSFeatureContext.fetchAd()
  → GET /core/v1/widget/ad
  → filter theo tier + start_at/end_at
  → map sang AdCampaign, cache (tenant-scoped, 5m TTL)
  → VNInvestCharts pass campaign prop → EngineHost
  → mountAdEnforcer.updateCampaign(campaign)  [handle mới]
  → renderAd() truyền campaign → EngineAdSlot renders banner/popup
```

---

### Phase 2: Unified Trademark Control

**Mục tiêu**: Loại bỏ dual trademark, engine là enforcement layer duy nhất.

> ✅ **Đã verify**: `mountAdEnforcer` **đã có** `enforcementEnabled` option (dòng 109-114) + `updateEnforcement()` handle (dòng 142-147). Phase A6 đã implement. **Không cần thêm interface enforcement mới cho engine** — chỉ cần wiring từ widget.

**Quyết định thiết kế — Badge visibility (giải quyết gap từ critique)**:
Hiện tại `renderAd()` khi `_enforcementEnabled=false` render **empty Fragment** (dòng 66-68) → badge KHÔNG hiện từ portal. Nếu Phase 2 xoá badge footer widget → badge biến mất hoàn toàn khi enforcement off. **Giải pháp**: tách 2 khái niệm:
- **Badge `⚡ vninvest`**: LUÔN render (kể cả enforcement off) — branding tối thiểu
- **Enforcement (watchdog + degrade overlay + ad slot)**: chỉ khi `enforcementEnabled=true`

→ Cần sửa `renderAd()`: khi `!_enforcementEnabled` vẫn render `<EngineTrademark enforcementEnabled={false}>` (badge-only, no watchdog) thay vì empty Fragment.

**Thay đổi widget**:
- `VNInvestCharts.tsx`: Xoá `<EngineTrademark>` footer (dòng ~3195) — engine portal thay thế
- `MultiChartsFooter.tsx`: Xoá `<EngineTrademark>` multi-chart footer (dòng ~238)

**Thay đổi engine**:
- `mountAdEnforcer.ts` `renderAd()`: khi `!_enforcementEnabled` → render `EngineTrademark` badge-only (thay vì empty Fragment)
- `EngineTrademark.tsx`: **KHÔNG đổi** — `enforcementEnabled` prop đã có (Phase A6)

**Fetch ownership (giải quyết critique #2)**:
- **Primary**: engine `trademarkConfig.ts` tiếp tục fetch `GET /core/v1/widget/config` (backward compat, fork widget không bỏ được)
- **KHÔNG dịch chuyển fetch sang widget** — giữ engine làm owner để anti-spoof. Widget chỉ pass `apiBase` override nếu cần.
- Sửa lại đề xuất ban đầu (widget fetch): **huỷ** — engine giữ quyền fetch.

**Anti-spoof**:
- Enforcement nằm trong engine portal (singleton root, closed source) — widget fork không ẩn được
- Server-validated tier (`_validatedTier`) đã có từ A7 → engine tự quyết định watermark

**Flow**:
```
Engine trademarkConfig.ts (owner)
  → GET /core/v1/widget/config
  → updateEnforcement(enabled)  [handle đã có]
  → renderAd():
       enforcementEnabled=false → EngineTrademark badge-only
       enforcementEnabled=true  → EngineAdSlot + EngineTrademark (watchdog on)
```

---

### Phase 3: Ad Slot Abstraction Layer

**Mục tiêu**: Abstraction để hỗ trợ nhiều loại ad (internal + external network) mà không sửa engine.

**Thiết kế**:

```
Widget: AdProvider
  ├── InternalCampaignSource (VNInvest API)
  ├── ExternalAdNetwork (Google Ad Manager / AdMob)
  └── AdRouter → chọn source dựa trên config
        → output: CampaignData
        → EngineAdSlot render
```

**Thay đổi widget**:
- `src/widget/ad/AdProvider.tsx` (NEW) — context provider, chọn ad source
- `src/widget/ad/sources/VNInvestAdSource.ts` (NEW) — campaign API
- `src/widget/ad/sources/GoogleAdManagerSource.ts` (NEW) — Google Ad Manager integration
- `src/widget/ad/types.ts` (NEW) — `CampaignData`, `AdSource` interface

**Engine changes**:
- `EngineAdSlot.tsx` cập nhật để nhận `AdSlotConfig` thay vì campaign cụ thể

**Flow**:
```
AdProvider
  ├─ reads config: { source: "vninvest" | "gam" | "none" }
  ├─ VNInvestSource → fetch /core/v1/widget/ad
  ├─ GAMSource → fetch Google Ad Manager ad unit
  └─ provides { campaign, refresh, onImpression, onClick } context
        → VNInvestCharts pass xuống EngineHost
        → mountAdEnforcer → EngineAdSlot render
```

---

### Phase 4: UX & Cache Optimization

**Mục tiêu**: Giải quyết cache staleness, loading states, transition.

**Thay đổi**:
1. **Short TTL**: Cache `trademarkConfig` giảm từ 20 phút → 5 phút
2. **Polling**: `useEffect` interval 5 phút refetch config (khi tab active)
3. **Loading state**: `SaaSFeatureContext` expose `configLoading` flag
4. **Transition**: Khi enforcement bật/tắt, fade transition 300ms trên ad overlay (CSS transition do engine kiểm soát)
5. **WebSocket future**: Backend push config change qua WebSocket (optional, phase sau)

**Fallback behavior**:
- Config fetch fail → cache cũ (nếu có) → `{ enabled: false }` (nếu không có cache)
- Campaign fetch fail → ad overlay không hiện, không ảnh hưởng chart

---

## 4. So sánh các approaches

### Approach A (Khuyến nghị) — Widget làm config source

Widget fetch config → pass xuống engine → engine enforcement.

| Pros | Cons |
|------|------|
| Widget kiểm soát được config URL, dễ debug | Cần sửa engine để nhận config từ widget prop thay vì tự fetch |
| Dễ thêm caching/polling/loading UX | |
| Phase 1-4 độc lập, deploy dần | |

### Approach B — Engine tự fetch, widget override

Engine tự fetch config (hiện tại) + widget có thể override qua prop.

| Pros | Cons |
|------|------|
| Ít thay đổi engine | Dual fetch khó debug |
| Engine vẫn hoạt động nếu widget không pass prop | Cache conflict giữa widget & engine |

### Approach C — Backend push config

Backend push config change qua SSE/WebSocket.

| Pros | Cons |
|------|------|
| Realtime, không cache staleness | Phức tạp hơn nhiều |
| | Backend cần thêm infrastructure |

**Chọn Approach A** vì phù hợp kiến trúc hiện tại (widget mở, engine đóng), deploy dần theo phase.

---

## 5. Rủi ro & Mitigation

| Rủi ro | Mitigation |
|--------|-----------|
| Engine closed-source → khó sửa | Chỉ sửa interface (props), không sửa logic engine; các thay đổi lớn đều qua `mountAdEnforcer` handle |
| Ad campaign API chưa có backend | Phase 1 define contract trước, backend có thể implement sau |
| Cache staleness dù đã giảm | Polling + version check; fallback về `{ enabled: false }` |
| Fork widget bypass campaign fetch | Engine vẫn tự fetch `trademarkConfig` nếu widget không pass `enforcementEnabled` prop (backward compatibility) |

---

## 6. Kế hoạch triển khai

| Phase | Scope | Engine changes | Widget changes | Backend changes |
|-------|-------|---------------|---------------|----------------|
| **P1** | Ad campaign pipeline | `mountAdEnforcer`: thêm `campaign` option + `updateCampaign` handle + truyền campaign vào `renderAd()`. **EngineAdSlot KHÔNG đổi** (đã có `campaign` prop) | `VNInvestClient` + `SaaSFeatureContext` fetch ad API; pass campaign xuống engine | `GET /core/v1/widget/ad` (shape = `AdCampaign`) |
| **P2** | Unified trademark | `mountAdEnforcer.renderAd()`: render badge-only khi enforcement off. **enforcementEnabled/updateEnforcement đã có (A6)** | Xoá dual footer trademark (widget + MultiChartsFooter) | Không đổi |
| **P3** | Ad slot abstraction | `EngineAdSlot` nhận `AdSlotConfig` generic (nếu cần external network) | `AdProvider` + `VNInvestAdSource` + `GoogleAdManagerSource` | Không đổi |
| **P4** | UX & cache | CSS transition class | Polling + version check, loading states, short TTL, tenant-scoped key | Config version field (optional WebSocket) |

---

## 7. Câu hỏi chờ phê duyệt

1. **Phase scope**: Full 4 phase hay P1+P2 trước (khuyến nghị: P1+P2, defer P3+P4)?
2. **Ad network**: Cần Google Ad Manager/AdMob ngay (P3) hay chỉ VNInvest campaign (P1)?
3. **Timeline**: Backend sẵn sàng implement `GET /core/v1/widget/ad` chưa?
4. **Engine access**: Có quyền commit engine repo (`mountAdEnforcer.ts` — 3 điểm sửa nhỏ)?
5. **API contract lock**: Chốt response shape `auth/me` + `widget/config` + `widget/ad` trước P1 (xem §9)?
6. **Cache key**: Chốt tenant-scoped sessionStorage key (xem §10)?
7. **Engine sign-off**: Engine team review `updateCampaign` handle + badge-only render change?

---

## 8. Phản biện độc lập — Xác minh & Phản hồi (2026-07-10)

Kết quả đối chiếu critique với **source code engine thật** (`vninvestcharts-engine`):

| # | Critique claim | Verdict | Sự thật đã verify |
|---|----------------|---------|-------------------|
| 1 | auth/me shape thiếu | ✅ Đúng | Đã lock full shape ở §9 |
| 2 | Fetch owner nhập nhằng | ✅ Đúng | Đã chốt: **engine `trademarkConfig.ts` là owner**, huỷ đề xuất widget-fetch (§Phase 2) |
| 3 | `mountAdEnforcer` thiếu `enforcementEnabled` | ❌ **SAI** | Đã có `enforcementEnabled` (dòng 109-114) + `updateEnforcement()` (dòng 142-147) từ Phase A6 |
| 4 | `EngineAdSlot` cần define schema generic | ⚠️ **Sai một phần** | `AdCampaign` + `campaign` prop **đã tồn tại** (dòng 38-55). Gap thật: `renderAd()` dòng 74 không truyền campaign. Generic `AdSlotConfig` chỉ cần cho P3 (external network) |
| 5 | Cache invalidation thiếu | ✅ Đúng | Chỉ TTL 20p, không version. Fix ở §10 |
| 6 | sessionStorage key collision | ✅ Đúng | `STORAGE_KEY = "vnsc_tm_enforcement"` hardcode global (`trademarkConfig.ts:1`). Fix ở §10 |
| HR | `updateCampaign` handle chưa có | ✅ Đúng | `AdEnforcerHandle` chỉ có `updatePat/updateTier/updateEnforcement/unmount`. P1 thêm mới |
| HR | Dual trademark removal risk | ✅ Đúng | Đã giải quyết bằng badge-only render (§Phase 2) |

**Tác động**: Scope engine changes **nhỏ hơn** critique dự đoán — chỉ sửa `mountAdEnforcer.ts` (3 điểm cho P1, 1 điểm cho P2). `EngineAdSlot.tsx` và `EngineTrademark.tsx` không đổi cho P1/P2.

---

## 9. API Contracts (LOCK trước Phase 1)

### 9.1 `GET /core/v1/auth/me` (đã tồn tại — document đầy đủ)

```json
{
  "plan": "pro",
  "access": "eyJ...",
  "token": "vni_pro_xxx",
  "token_prefix": "vni_pro",
  "active_pat_count": 1,
  "max_active_pats": 5
}
```
- **Required**: `plan` (enum: `internal|custom|enterprise|pro|starter|free`)
- Auth: `Authorization: Bearer <pat>`. 401/403 → widget coi là `free`.

### 9.2 `GET /core/v1/widget/config` (đã tồn tại)

```json
{ "trademark": { "enabled": true, "activationTs": 1750000000000, "version": "cfg_v3" } }
```
- **Required**: `trademark.enabled` (boolean)
- **Đề xuất thêm**: `version` (string) — cho cache invalidation (§10)
- No auth.

### 9.3 `GET /core/v1/widget/ad` (MỚI — cần backend implement)

Response `campaigns[].{campaign_id, image_source{default,retina?,svg?}, video_url?, click_url, click_tracking_url, impression_tracking_url, width, height, targeting?, start_at?, end_at?}` — xem chi tiết §Phase 1.
- **Required** (khớp engine `AdCampaign`): `campaign_id`, `image_source.default`, `click_url`, `click_tracking_url`, `impression_tracking_url`, `width`, `height`
- No auth (hoặc optional Bearer để targeting theo user).

---

## 10. Cache Invalidation & Multi-tenant Key Strategy

### 10.1 Version-based invalidation (giải quyết critique #5)
- Backend thêm `version` vào `widget/config` response
- Client cache `{ enabled, version, ts }`; khi poll, so sánh `version` → chỉ re-render nếu đổi
- Tránh waste re-render khi data không đổi

### 10.2 Tenant-scoped key (giải quyết critique #6)
- Hiện tại: `STORAGE_KEY = "vnsc_tm_enforcement"` (global)
- Đề xuất: `vnsc_tm_enforcement__{tenantId ?? apiBaseHash}` — scope theo tenant/apiBase
- `tenantId` lấy từ `window.__VNI_TENANT_ID__` hoặc hash của `__VNI_API_BASE__`
- Tránh cross-contamination khi nhiều tenant embed trên cùng domain

### 10.3 TTL
- Giảm 20p → 5p cho `widget/config`
- Campaign cache 5p (tenant-scoped)

---

## 11. Khuyến nghị cuối (sau phản biện)

**KHÔNG approve full 4 phase.** Trình tự đề xuất:
1. **Lock API contracts** (§9) — backend commit response shapes
2. **Engine sign-off** — `mountAdEnforcer.ts` changes (P1: 3 điểm, P2: 1 điểm)
3. **Triển khai P1** (Ad campaign) → stable → **P2** (Trademark unification)
4. **Defer P3** (external ad network — cần legal review TCF/COPPA cho GAM) + **P4** (UX/cache — trừ tenant-scoped key nên làm sớm ở P1)

**P1 MVP scope**:
- [ ] Lock `widget/ad` + `widget/config` (+version) contracts
- [ ] Backend: implement `GET /core/v1/widget/ad`
- [ ] Widget: `VNInvestClient.WIDGET_AD` + `SaaSFeatureContext.fetchAd` (5m, tenant-scoped)
- [ ] Widget: pass `campaign` → `EngineHost` → `mountAdEnforcer.updateCampaign`
- [ ] Engine: `mountAdEnforcer` campaign wiring + `updateCampaign` handle
- [ ] Engine: tenant-scoped cache key trong `trademarkConfig.ts`
- [ ] Doc: update `docs/server-endpoints/README.md` với `widget/ad`

---

*Tài liệu tham khảo: `docs/server-endpoints/README.md`, `docs/upgrade-standard/AUDIT_LEDGER.md`, source đã verify: `vninvestcharts-engine/packages/vn-kline-engine-react/src/ad/{mountAdEnforcer,EngineAdSlot,trademarkConfig}.ts(x)`*
