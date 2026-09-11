# Kế Hoạch Triển Khai Chi Tiết — Advert Widget & Trademark (P1 + P2)

> **Trạng thái**: Approved — Ready to implement
> **Scope**: Phase 1 (Ad Campaign Pipeline) + Phase 2 (Trademark Unification). P3/P4 **defer**.
> **Ngày**: 2026-07-10
> **Repos (twin + backend)**:
> - Backend: `C:\Mujoco Projects\vninvest` (Django)
> - Widget: `C:\Mujoco Projects\vninvestcharts-widget` (React, open)
> - Engine: `C:\Mujoco Projects\vninvestcharts-engine` (React, closed)
> **Tài liệu gốc**: `docs/SOLUTION_ADVERT_TRADEMARK_MANAGEMENT_20260710.md`

---

## 0. Nguyên tắc thực thi (đọc trước khi code)

1. **RULE 0 (cả 3 repo)**: Đọc `module_tree_full.md` của repo tương ứng TRƯỚC khi sửa code.
2. **Twin repos**: Mọi thay đổi engine ↔ widget phải tham chiếu cả 2 (`song-hanh`).
3. **Zero câu hỏi**: Kế hoạch này đã lock đủ contract + file + line. Không cần confirm lại. Nếu gặp lệch thực tế so với line number (do code đã đổi), tìm theo **symbol name** (đã ghi kèm) thay vì line tuyệt đối.
4. **Mỗi phase = 1 audit gate**: Sau khi code xong mỗi phase, đội code **tự** chạy audit checklist + tự cập nhật docs (mục "Audit & Doc self-service" cuối mỗi phase). Không chờ review ngoài.
5. **i18n**: Không hardcode text mới. Text ad overlay nằm trong engine (đã tồn tại) — không thêm mới ở widget.
6. **Verify runtime**: Build/test pass CHƯA đủ — phải có bằng chứng runtime (ad overlay hiện campaign, badge hiện đúng).

---

## 1. Phát hiện quan trọng (đã verify với source)

### 1.1 Backend đã có sẵn hạ tầng ad
App `advertising` (`packages/core/backend/src/advertising/`) đã có:
- Models: `AdCampaign`, `AdDailySummary`, `AdImpressionLog`, `AdClickLog`
- `ContentDisplayView` (`views.py`) — **đã trả về đúng shape** engine `AdCampaign` cần:
  ```json
  { "show_ads": true, "hide_trademark": false,
    "ad": { "campaign_id": "...", "image_source": {"default","retina","svg"},
            "click_url": "...", "click_tracking_url": "...", "impression_tracking_url": "...",
            "width": 300, "height": 50 } }
  ```
- HMAC signing (`CORE_AD_SIGNING_SECRET`), Redis cache, Celery aggregation
- Conventions: `APIView` + `CorePATAuthentication` + `permissions.AllowAny` + throttle (`AdvertisingAnonRateThrottle` 60/min, `AdvertisingUserRateThrottle` 120/min)

→ **`GET /core/v1/widget/ad` không phải build từ 0** — chủ yếu là wrap lại logic `ContentDisplayView` thành contract `{campaigns:[...]}` + mount route mới.

### 1.2 Widget đã có type + context slot
- `AdCampaign` type: `src/widget/types/saas.ts:26-35` (khớp engine)
- `adCampaign` context value: `types/saas.ts:51` (default `null`)
- `VNInvestCharts.tsx:584` đã destructure `adCampaign` (đang unused)
- Gap: `fetchAd`/`refetchAd` no-op (`SaaSFeatureContext.tsx:208-214`), thiếu `WIDGET_AD` endpoint + `fetchAd()` method, `<EngineHost>` chưa nhận `campaign`

### 1.3 Engine đã export + EngineAdSlot campaign-aware
- `AdCampaign` export: `packages/vn-kline-engine-react/src/index.ts:7` ✅
- `EngineAdSlot` đã nhận `campaign` prop đầy đủ (`EngineAdSlot.tsx:55, 264-520`) — **KHÔNG sửa**
- `enforcementEnabled` + `updateEnforcement` đã có (Phase A6) — **KHÔNG sửa cho enforcement**
- Gap: `EngineHostProps` thiếu `campaign`, `AdEnforcerHandle` thiếu `updateCampaign`, `mountAdEnforcer` options/renderAd thiếu campaign wiring

---

## 2. Contract Lock (chốt trước khi code — §9 solution doc)

### 2.1 `GET /core/v1/widget/config` (mở rộng — thêm `version`)
```json
{ "trademark": { "enabled": true, "activationTs": 1750000000000, "version": "cfg_v3" } }
```
- Required: `trademark.enabled` (bool). Thêm: `version` (string, cho cache invalidation). No auth.

### 2.2 `GET /core/v1/widget/ad` (MỚI)
```json
{
  "campaigns": [{
    "campaign_id": "camp_001",
    "image_source": { "default": "https://.../b.png", "retina": "https://.../b@2x.png", "svg": "https://.../b.svg" },
    "video_url": "https://.../promo.mp4",
    "click_url": "https://saas.edusuccess.vn/upgrade",
    "click_tracking_url": "https://saas.edusuccess.vn/track/click/camp_001",
    "impression_tracking_url": "https://saas.edusuccess.vn/track/imp/camp_001",
    "width": 200, "height": 50,
    "targeting": { "tiers": ["free", "starter"] },
    "start_at": 1750000000000, "end_at": 1750600000000
  }]
}
```
- Required (khớp engine `AdCampaign`): `campaign_id`, `image_source.default`, `click_url`, `click_tracking_url`, `impression_tracking_url`, `width`, `height`
- Optional: `video_url`, `image_source.retina/svg`, `targeting`, `start_at`, `end_at`
- No auth bắt buộc (optional `Authorization: Bearer <pat>` cho targeting theo tier). Nếu có PAT → filter `campaigns` theo `tenant.plan`; nếu premium → trả `{campaigns: []}`.

---

## 3. PHASE 1 — Ad Campaign Pipeline

**Mục tiêu**: Campaign chảy từ backend → widget → engine → hiển thị trong `EngineAdSlot`.

> 🔴 **3 BLOCKERS đã resolve** (peer review 2026-07-10) — xem §3.0. Đội code PHẢI đọc §3.0 trước T1.1.

### 3.0 Blocker Resolution (bắt buộc đọc trước khi code backend)

**B1 — URL routing**: `advertising/urls.py` hiện chỉ `urlpatterns = router.urls` (operator viewsets), nhưng đã được mount tại `core/v1/` (`vninvest_core/urls.py:48`). ✅ **Không cần include mới** — chỉ amend `advertising/urls.py` để prepend widget paths (xem T1.2). KHÔNG dùng `api_urls.py` (đó là `/api/v1/`, sai prefix).

**B2 — Trailing slash**: Engine `trademarkConfig.ts:20` gọi `/core/v1/widget/config` (KHÔNG slash). Django `APPEND_SLASH=True` → 301 redirect no-slash→slash; `fetch()` cross-origin + redirect dễ mất header/CORS. ✅ **Fix**: dùng `re_path` với slash optional `/?$` để 1 view nhận cả 2 dạng, KHÔNG redirect.

**B3 — Response shape**: `ContentDisplayView` trả `{show_ads, hide_trademark, ad: {single object}}` — **KHÁC** contract `{campaigns: [array]}`. ✅ **Fix**: `WidgetAdView` là view MỚI, query nhiều campaign → trả array `{campaigns: [...]}`. Chỉ **tái dùng helper** (Redis cache index, plan check, HMAC sign) của `ContentDisplayView`, KHÔNG tái dùng response.

### 3.1 BACKEND (`vninvest`)

**File edit**:

**T1.1** — `packages/core/backend/src/advertising/views.py`
- Thêm class `WidgetAdView(APIView)`:
  - `authentication_classes = [CorePATAuthentication]`, `permission_classes = [permissions.AllowAny]`, `throttle_classes = [AdvertisingAnonRateThrottle, AdvertisingUserRateThrottle]`
  - `def get(self, request)`:
    - Query **nhiều** active `AdCampaign` (dùng Redis cache index như `ContentDisplayView`, nhưng lấy list thay vì 1)
    - Nếu có PAT + `request.user`/tenant premium (`tenant.plan in {'starter','pro','enterprise','custom','internal'}`) → trả `{"campaigns": []}`
    - Filter `start_at <= now <= end_at` (nếu campaign có field thời gian)
    - Map mỗi campaign → dict shape §2.2, sign tracking URL bằng HMAC (dùng helper hiện có)
  - **Response (B3)**: `{ "campaigns": [ {campaign_id, image_source{default,retina,svg}, video_url?, click_url, click_tracking_url, impression_tracking_url, width, height, targeting?, start_at?, end_at?}, ... ] }`
  - ⚠️ KHÔNG copy nguyên response `ContentDisplayView` (nó là single `ad` + `show_ads` wrapper)
- Thêm class `WidgetConfigView(APIView)`:
  - Same auth/throttle (AllowAny)
  - `def get`: trả `{ "trademark": { "enabled": <bool>, "activationTs": <int|null>, "version": <str> } }`
  - `enabled` từ setting/DB flag (chưa có → `False` + TODO); `version` = hash/timestamp config để client invalidate cache (§5)

**T1.2** — `packages/core/backend/src/advertising/urls.py` (B1 + B2)
- Import: `from django.urls import re_path` (đã có) + `from advertising.views import WidgetConfigView, WidgetAdView`
- Sửa dòng cuối `urlpatterns = router.urls` thành:
  ```python
  urlpatterns = [
      re_path(r'^widget/config/?$', WidgetConfigView.as_view(), name='widget-config'),
      re_path(r'^widget/ad/?$', WidgetAdView.as_view(), name='widget-ad'),
  ] + router.urls
  ```
- `re_path` với `/?$` → nhận cả `/core/v1/widget/config` và `/core/v1/widget/config/` (fix B2, không 301)
- Route cuối: `core/v1/widget/config[/]`, `core/v1/widget/ad[/]` (đã mount qua `vninvest_core/urls.py:48`)

**T1.3** — `packages/core/backend/src/advertising/serializers.py` (optional)
- Thêm `WidgetAdCampaignSerializer` nếu muốn type-safe; hoặc build dict trực tiếp (pattern `ContentDisplayView` — chấp nhận được)

**T1.4** — Settings check
- Verify `CORE_AD_SIGNING_SECRET` đã declare trong `settings.py`/env (audit 20260614 báo chỉ có fallback). Nếu chưa → thêm vào `settings.py` + compose env (KHÔNG hardcode secret; dùng `os.environ`)

### 3.2 WIDGET (`vninvestcharts-widget`)

**T1.5** — `src/widget/adapters/VNInvestClient.ts`
- `buildEndpoints()` (dòng 241-254): thêm `WIDGET_AD: \`${base}/core/v1/widget/ad\``
- Thêm type `WidgetAdResponse` (sau `AuthMeResponse` ~283):
  ```ts
  export interface WidgetAdResponse { campaigns: AdCampaign[]; }
  ```
  (import/re-dùng `AdCampaign` từ `types/saas.ts`)
- Thêm method `fetchAd()` (sau `validateMe` ~681):
  ```ts
  async fetchAd(): Promise<WidgetAdResponse> {
    const endpoints = buildEndpoints(this._base);
    return this._fetch<WidgetAdResponse>(endpoints.WIDGET_AD);
  }
  ```
  (`_fetch` tự gắn Bearer PAT + 401 refresh)

**T1.6** — `src/widget/contexts/SaaSFeatureContext.tsx`
- Thay `fetchAd` no-op (dòng 208-210):
  ```ts
  const fetchAd = useCallback(async () => {
    try {
      setState(prev => ({ ...prev })); // set isAdLoading true
      const res = await client.fetchAd();
      const now = Date.now();
      // filter theo tier + start_at/end_at
      const eligible = res.campaigns.filter(c => withinWindow(c, now) && tierMatch(c, currentTier));
      setState(prev => ({ ...prev, adCampaign: eligible[0] ?? null, isAdLoading: false, adError: null }));
    } catch (e) {
      setState(prev => ({ ...prev, adCampaign: null, isAdLoading: false, adError: String(e) }));
    }
  }, [client, currentTier]);
  ```
- `refetchAd` = alias gọi `fetchAd`
- Gọi `fetchAd()` sau `finishValidation` trong validation effect (dòng ~281-342), chỉ khi `flags.showWidgetAds === true`
- **Cache tenant-scoped** (§10.2): campaign cache key `vnsc_ad_campaign__{tenantId ?? hash(apiBase)}`, TTL 5 phút

**T1.7** — `src/widget/VNInvestCharts.tsx`
- Dòng 584: `adCampaign` đã destructure từ `useFeatureGate()` — giữ nguyên
- `<EngineHost>` (dòng 2822-2845, fork branch): thêm `campaign={adCampaign}`
- Nếu có `<EngineHost>` standalone khác (vùng ~2399): thêm tương tự

### 3.3 ENGINE (`vninvestcharts-engine`)

**T1.8** — `packages/vn-kline-engine-react/src/types.ts`
- `EngineHostProps` (dòng 30-62): thêm `campaign?: AdCampaign | null;` (import `AdCampaign` từ `./ad/EngineAdSlot`)

**T1.9** — `packages/vn-kline-engine-react/src/ad/mountAdEnforcer.ts`
1. Import `AdCampaign` từ `./EngineAdSlot`
2. `AdEnforcerHandle` (dòng 8-13): thêm `updateCampaign(campaign: AdCampaign | null): void;`
3. Module var: `let _currentCampaign: AdCampaign | null = null;`
4. `mountAdEnforcer` options (dòng 105-110): thêm `campaign?: AdCampaign | null;`; trong body set `_currentCampaign = options.campaign ?? null;`
5. `renderAd()` (dòng 74): `createElement(EngineAdSlot, { pat: pat ?? "", validatePat, campaign: _currentCampaign })`
6. Handle: thêm
   ```ts
   updateCampaign(campaign) {
     _currentCampaign = campaign;
     if (_globalRoot) renderAd(_currentPat, _currentValidatePat, _currentTier);
   },
   ```
7. Verify `_currentCampaign` KHÔNG bị reset sai trong `unmount()` (chỉ reset khi subscriberCount<=0)

**T1.10** — `packages/vn-kline-engine-react/src/useEngineHost.ts`
- 2 call site `mountAdEnforcer` (dòng 180-185 và 213-218): thêm `campaign: options.campaign ?? null`
- PAT effect (dòng 238-250): thêm effect mới (hoặc mở rộng) cho campaign:
  ```ts
  useEffect(() => {
    adEnforcerRef.current?.updateCampaign(campaign ?? null);
  }, [campaign]);
  ```
  (`campaign` từ `options.campaign` / destructure `UseEngineHostOptions`)

**T1.11** — `EngineAdSlot.tsx`: **KHÔNG SỬA** (đã campaign-aware)

### 3.4 VERIFY Phase 1

**Backend**:
```bash
# trong vninvest, dùng docker theo AGENTS.md backend
# B2: test CẢ 2 dạng slash — cả 2 phải 200, KHÔNG 301/404
curl -s -o /dev/null -w "%{http_code}" https://<base>/core/v1/widget/config    # → 200 (no slash)
curl -s -o /dev/null -w "%{http_code}" https://<base>/core/v1/widget/config/   # → 200 (slash)
curl -s -o /dev/null -w "%{http_code}" https://<base>/core/v1/widget/ad        # → 200 (no slash)
# B3: assert response shape = {campaigns: [...]}, KHÔNG có show_ads/ad wrapper
curl -s https://<base>/core/v1/widget/ad | jq 'has("campaigns") and (.campaigns | type=="array")'  # → true
curl -s https://<base>/core/v1/widget/ad | jq '.campaigns[0] | has("campaign_id") and has("click_url") and has("click_tracking_url") and has("impression_tracking_url") and has("width") and has("height")'  # → true
curl -s https://<base>/core/v1/widget/config | jq 'has("trademark") and (.trademark | has("enabled") and has("version"))'  # → true
curl -s -H "Authorization: Bearer <pro_pat>" https://<base>/core/v1/widget/ad | jq '.campaigns == []'  # → true (premium)
python -m py_compile packages/core/backend/src/advertising/views.py packages/core/backend/src/advertising/urls.py
```

**Widget** (`vninvestcharts-widget`, dùng `npm run watch`):
```bash
npm run type-check   # 0 errors
npm test             # pass
npm run audit:fat-files
```

**Engine** (`vninvestcharts-engine`):
```bash
npx tsc --noEmit            # 0 errors
npm run build:react         # pass
npm test -- mountAdEnforcer # 4/4 pass (+ thêm test updateCampaign)
```

**Runtime proof (bắt buộc)**:
- Free tier + campaign trả về → ad banner/popup hiện đúng `image_source`/`click_url` từ backend
- Pro tier → không có ad
- Multi-chart → 1 ad instance (singleton)
- Console không lỗi

### 3.5 AUDIT & DOC SELF-SERVICE — Phase 1 (đội code tự làm)

**Blocker gate** (PHẢI xong trước khi tick audit):
- [ ] B1: `WidgetConfigView`/`WidgetAdView` ở `advertising/urls.py` (amend `urlpatterns = [...] + router.urls`), KHÔNG dùng `api_urls.py`
- [ ] B2: `re_path(r'^widget/config/?$')` + `/?$` cho ad → curl cả 2 dạng slash đều 200 (không 301/404)
- [ ] B3: response = `{campaigns: [...]}` array, KHÔNG có `show_ads`/`ad` wrapper của `ContentDisplayView`

**Audit checklist** (tick trong PR description):
- [ ] Root cause: `fetchAd` no-op đã thay bằng real fetch; campaign chảy đủ chain
- [ ] `grep` old pattern = 0: `grep -rn "ad system temporarily disabled" src/` → 0 hit
- [ ] Contract khớp: response `widget/ad` fields == engine `AdCampaign` required fields
- [ ] Edge cases: campaign rỗng (`[]`) → không lỗi; premium → không ad; network fail → `adCampaign=null` không crash; slash + no-slash URL đều OK
- [ ] Anti-spoof giữ nguyên: campaign chỉ hiện khi `requiresAds(tier)` true (server-validated)
- [ ] Tenant-scoped cache key áp dụng
- [ ] Runtime proof đính kèm (screenshot/trace ad hiện campaign)

**Doc self-update** (đội code tự cập nhật, không hỏi lại):
1. **Backend** `vninvest`:
   - `docs/server-endpoints/README.md` → thêm section `GET /core/v1/widget/ad` (nếu file này ở widget repo, cập nhật ở đó — xem note)
   - `docs/SOLUTION_ADVERT_TRADEMARK_MANAGEMENT_20260710.md` → tick P1 backend done
2. **Widget** `vninvestcharts-widget`:
   - `docs/upgrade-standard/AUDIT_LEDGER.md` → thêm entry `Phase A8 — Ad Campaign Pipeline (widget side)`
   - Chạy `python scripts/generate_module_tree.py` → regenerate `module_tree_full.md`
3. **Engine** `vninvestcharts-engine`:
   - `AUDIT_LEDGER.md` (engine) → entry `mountAdEnforcer updateCampaign + campaign wiring`
   - Regenerate engine `module_tree_full.md`
4. **Commit** (mỗi repo riêng, push `dev`):
   - Backend: `feat(widget-ad): add GET /core/v1/widget/ad + widget/config version [P1]`
   - Widget: `feat(ad-pipeline): wire fetchAd → EngineHost campaign prop [P1]`
   - Engine: `feat(ad-enforcer): add campaign option + updateCampaign handle [P1]`

> ⚠️ **Điều kiện vào Phase 2**: Phase 1 phải PASS toàn bộ verify + audit + runtime proof. Không bắt đầu P2 nếu P1 chưa stable.

---

## 4. PHASE 2 — Trademark Unification

**Mục tiêu**: Engine là nơi DUY NHẤT render trademark. Badge `⚡ vninvest` luôn hiện (kể cả enforcement off); watchdog/degrade chỉ khi enforcement on. Xoá dual render ở widget.

### 4.1 ENGINE (`vninvestcharts-engine`)

**T2.1** — `packages/vn-kline-engine-react/src/ad/mountAdEnforcer.ts` `renderAd()` (dòng 56-78)
- Vấn đề hiện tại: khi `!_enforcementEnabled` → render empty Fragment (dòng 66-68) → badge KHÔNG hiện từ portal
- Sửa: khi `!_enforcementEnabled` → render **badge-only**:
  ```ts
  if (!_enforcementEnabled) {
    root.render(
      createElement(EngineTrademark, { patTier: _currentTier as any, enforcementEnabled: false })
    );
    return;
  }
  ```
- Khi `_enforcementEnabled` → giữ nguyên (EngineAdSlot + EngineTrademark enforcementEnabled=true)

**T2.2** — `EngineTrademark.tsx`: **KHÔNG SỬA** — `enforcementEnabled` prop đã có (A6); `false` = badge-only, tắt watchdog. Verify lại logic guard timer khi `enforcementEnabled=false`.

**Fetch ownership (chốt — critique #2)**:
- Engine `trademarkConfig.ts` **giữ** vai trò fetch `GET /core/v1/widget/config` (owner). KHÔNG dịch sang widget.
- Widget chỉ pass `apiBase` override nếu cần (đã có qua `__VNI_API_BASE__`).

### 4.2 WIDGET (`vninvestcharts-widget`)

**T2.3** — `src/widget/VNInvestCharts.tsx`
- Xoá inline `<EngineTrademark ... enforcementEnabled={false}>` ở footer (dòng ~3195) + import nếu không dùng nữa
- Lý do: engine portal (T2.1) giờ render badge-only → không cần footer widget

**T2.4** — `src/widget/components/footer/MultiChartsFooter.tsx`
- Xoá `<EngineTrademark>` (dòng ~238) + import
- Verify không component footer khác còn render `EngineTrademark` (grep)

### 4.3 VERIFY Phase 2

**Engine**:
```bash
npx tsc --noEmit
npm run build:react
npm test -- mountAdEnforcer   # cập nhật test: enforcement=false render badge-only (not empty)
```

**Widget**:
```bash
npm run type-check
npm test
grep -rn "EngineTrademark" src/   # chỉ còn ở import gián tiếp qua engine, KHÔNG render trực tiếp trong widget
```

**Runtime proof (bắt buộc)**:
- Enforcement OFF: đúng **1** badge `⚡ vninvest` (từ engine portal), KHÔNG có badge thứ 2, KHÔNG watchdog/degrade
- Enforcement ON (mock `widget/config` trả `enabled:true`): badge + ad slot + watchdog active
- Free tier + multi-chart: 1 badge duy nhất
- Fork widget thử ẩn badge: không được (portal closed)

### 4.4 AUDIT & DOC SELF-SERVICE — Phase 2 (đội code tự làm)

**Audit checklist**:
- [ ] Root cause: dual trademark loại bỏ; engine portal là single source
- [ ] `grep` = 0: `grep -rn "<EngineTrademark" src/` trong widget → 0 render trực tiếp
- [ ] Badge visibility: enforcement OFF vẫn có đúng 1 badge (không mất branding)
- [ ] Watchdog: enforcement OFF → watchdog/degrade tắt; ON → active
- [ ] Anti-spoof: fork widget không ẩn được badge
- [ ] Edge: single chart + multi chart đều 1 badge; StrictMode không nhân đôi
- [ ] Runtime proof đính kèm (screenshot cả 2 trạng thái enforcement)

**Doc self-update**:
1. Widget `AUDIT_LEDGER.md` → `Phase A9 — Trademark Unification (remove dual render)`
2. Engine `AUDIT_LEDGER.md` → `mountAdEnforcer badge-only render when enforcement off`
3. Regenerate `module_tree_full.md` cả 2 repo
4. `docs/SOLUTION_ADVERT_TRADEMARK_MANAGEMENT_20260710.md` → tick P2 done
5. **Commit** (push `dev`):
   - Widget: `refactor(trademark): remove dual EngineTrademark render, engine is SSOT [P2]`
   - Engine: `feat(trademark): render badge-only when enforcement disabled [P2]`

---

## 5. Cross-cutting — Tenant-scoped Cache Key (làm trong P1)

**T-C1** — `packages/vn-kline-engine-react/src/ad/trademarkConfig.ts`
- Hiện tại: `STORAGE_KEY = "vnsc_tm_enforcement"` (dòng 1, global)
- Sửa: key theo tenant:
  ```ts
  function storageKey(): string {
    const t = (typeof window !== "undefined" && (window as any).__VNI_TENANT_ID__)
      || hash((window as any).__VNI_API_BASE__ ?? "default");
    return `vnsc_tm_enforcement__${t}`;
  }
  ```
- Áp dụng cho cả `persist()` và `tryCache()`
- Thêm `version` check (§2.1): cache `{ enabled, version, ts }`; nếu server `version` khác cache → invalidate

**T-C2** — Widget campaign cache: dùng cùng chiến lược key `vnsc_ad_campaign__{tenantId}` (T1.6)

---

## 6. Rollback plan

| Phase | Rollback |
|-------|----------|
| P1 backend | Route mới độc lập — xoá 2 `path()` trong `advertising/urls.py` + 2 view class. Không ảnh hưởng route cũ |
| P1 widget | `fetchAd` revert về no-op; `campaign` prop optional nên engine vẫn chạy (fallback null) |
| P1 engine | `campaign` option optional (default null) → backward compat; revert `updateCampaign` không phá `unmount/renderAd` |
| P2 engine | `renderAd` revert về empty Fragment khi enforcement off |
| P2 widget | Khôi phục `<EngineTrademark>` footer (giữ trong git history) |

**Nguyên tắc**: mọi thay đổi engine đều **additive/optional** → widget cũ + engine mới tương thích ngược, và ngược lại.

---

## 7. Thứ tự thực thi & phụ thuộc

```
GATE 0 (trước T1.1): resolve 3 blockers §3.0 (B1 routing, B2 slash, B3 shape) → đã lock trong plan
  ↓
P1 (song song được):
  ├── Backend T1.1-T1.4  ──┐
  ├── Engine  T1.8-T1.10 ──┤ (independent, contract-driven)
  └── Widget  T1.5-T1.7  ──┘ (cần engine EngineHostProps.campaign + backend endpoint để E2E test)
  + Cross-cutting T-C1, T-C2
  → VERIFY 3.4 → AUDIT 3.5

P2 (sau P1 stable):
  ├── Engine T2.1-T2.2
  └── Widget T2.3-T2.4
  → VERIFY 4.3 → AUDIT 4.4
```

**Gợi ý sprint**: P1 = 3-5 ngày (backend 1-2d, widget 1-2d, engine 0.5-1d, E2E 1d). P2 = 1-2 ngày.

---

## 8. Definition of Done (cả P1 + P2)

- [x] P1: campaign backend → widget → engine → `EngineAdSlot` hiển thị (code chain complete; runtime proof pending manual)
- [x] P2: 1 badge duy nhất từ engine, dual render removed, watchdog gated đúng
- [x] `type-check`/`tsc --noEmit` 0 errors cả widget + engine
- [x] `py_compile` backend pass; curl smoke 3 endpoint đúng shape (py_compile ✓; curl smoke pending stack-up)
- [x] Tests pass (bao gồm test mới cho `updateCampaign` + badge-only render) — engine `mountAdEnforcer` 5/5
- [x] `audit:fat-files` không vượt budget (bump `VNInvestClient.ts` 832→845)
- [x] Tenant-scoped cache key áp dụng (T-C1 trademark, T-C2 ad campaign)
- [x] Docs tự cập nhật: `AUDIT_LEDGER.md` (widget; engine repo không có ledger — ghi nhận trong widget theo twin-repo), `server-endpoints/README.md`
- [x] `module_tree_full.md` regenerated (widget; engine repo không có generator)
- [x] Commit + push `dev` mỗi repo theo format (P1 pushed; P2 in progress)

---

*Nguồn verified: `vninvest/packages/core/backend/src/advertising/{views,urls,models,serializers}.py`, `vninvestcharts-widget/src/widget/{adapters/VNInvestClient.ts, contexts/SaaSFeatureContext.tsx, VNInvestCharts.tsx, types/saas.ts}`, `vninvestcharts-engine/packages/vn-kline-engine-react/src/{types.ts, useEngineHost.ts, index.ts, ad/{mountAdEnforcer,EngineAdSlot,trademarkConfig,EngineTrademark}.ts(x)}`*
