# Implementation Plan: Frontend Advertising & Trademark Admin Module

**Target:** `packages/web/src/features/advertising/` — React admin UI for managing AdCampaigns + Trademark config  
**Backend API:** `/core/v1/operator/ads/` (AdCampaignViewSet, AdDailySummaryViewSet)  
**Auth:** CASL abilities + `IsAdminUser` permission  
**Timeline:** ~5.5 days (1 sprint)  
**Date:** 2026-07-12

---

## 1. Architecture Overview

```
packages/web/src/
├── adapters/core/
│   ├── commercial.js                    (MODIFY: add advertising endpoints)
│   └── advertising.js                   (NEW: dedicated advertising client)
├── features/advertising/
│   ├── api/
│   │   └── advertisingClient.js         (React Query hooks)
│   ├── components/
│   │   ├── CampaignTable.jsx            (TanStack Table v8)
│   │   ├── CampaignForm.jsx             (React Hook Form + Zod)
│   │   ├── CampaignDetailDrawer.jsx     (side panel detail)
│   │   ├── CampaignMetricsCard.jsx      (impressions/clicks/CTR)
│   │   └── TrademarkConfigPanel.jsx     (trademark toggle)
│   ├── hooks/
│   │   ├── useCampaigns.js              (list with filters/pagination)
│   │   ├── useCampaignMutations.js      (CRUD mutations)
│   │   ├── useCampaignMetrics.js        (per-campaign metrics)
│   │   └── useTrademarkConfig.js        (trademark config)
│   ├── pages/
│   │   └── AdvertisingAdminPage.jsx     (main page with tabs)
│   ├── types/
│   │   └── advertising.js               (Zod schemas)
│   ├── constants/
│   │   └── advertising.js               (enums, column configs)
│   └── index.js                         (barrel export)
├── app/
│   ├── routeCatalog.js                  (MODIFY: add advertising route)
│   └── navigationCatalog.js             (MODIFY: add to admin group)
├── layouts/full/vertical/sidebar/
│   └── sidebaritems.ts                  (MODIFY: add sidebar item)
└── i18n/
    ├── vi.js                            (MODIFY: add advertising keys)
    └── en.js                            (MODIFY: add advertising keys)
```

---

## 2. Backend API Contract (Existing)

### 2.1 Advertising Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/core/v1/operator/ads/campaigns/` | List campaigns (pagination, filters: status, type, tenant) |
| POST | `/core/v1/operator/ads/campaigns/` | Create campaign |
| GET | `/core/v1/operator/ads/campaigns/{id}/` | Retrieve single |
| PATCH | `/core/v1/operator/ads/campaigns/{id}/` | Partial update |
| DELETE | `/core/v1/operator/ads/campaigns/{id}/` | Delete |
| GET | `/core/v1/operator/ads/analytics/` | Daily summaries (read-only) |

### 2.2 Trademark Config (Widget-facing, read-only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/core/v1/widget/config/` | Trademark enforcement config |

**Response:**
```json
{
  "trademark": {
    "enabled": true,
    "activationTs": 1750000000000,
    "version": "cfg_v3"
  }
}
```

### 2.3 Serializer Fields (AdCampaign)

```json
{
  "id": "uuid",
  "name": "string",
  "campaign_type": "internal_promo|partner_ad",
  "status": "draft|active|paused|completed",
  "banner_url": "url",
  "banner_url_retina": "url|null",
  "banner_url_svg": "url|null",
  "banner_width": "int",
  "banner_height": "int",
  "destination_url": "url",
  "weight": "int",
  "start_date": "datetime",
  "end_date": "datetime",
  "tenant": "uuid|null",
  "targeting_rules": "object",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

## 3. Phase Breakdown

### Phase 0: Setup & Scaffolding (Day 0.5)

**Tasks:**
1. Install dependencies: `@tanstack/react-table`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`
2. Create feature directory structure
3. Add advertising adapter in `adapters/core/advertising.js`
4. Register route in `routeCatalog.js`
5. Add navigation entry in `navigationCatalog.js` + `sidebaritems.ts`
6. Add i18n keys in `vi.js` + `en.js`

**Files to create:**
```js
// adapters/core/advertising.js
export function createAdvertisingClient({ coreGet, corePost, corePatch, coreDelete }) {
  return {
    getAdvertisingCampaigns: async (params = {}) => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      );
      return coreGet(`/operator/ads/campaigns/${searchParams.toString() ? `?${searchParams}` : ""}`);
    },
    getAdvertisingCampaign: async (id) => coreGet(`/operator/ads/campaigns/${id}/`),
    createAdvertisingCampaign: async (payload) => corePost("/operator/ads/campaigns/", payload),
    updateAdvertisingCampaign: async (id, payload) => corePatch(`/operator/ads/campaigns/${id}/`, payload),
    deleteAdvertisingCampaign: async (id) => coreDelete(`/operator/ads/campaigns/${id}/`),
    getCampaignAnalytics: async (params = {}) => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      );
      return coreGet(`/operator/ads/analytics/${searchParams.toString() ? `?${searchParams}` : ""}`);
    },
    getTrademarkConfig: async () => coreGet("/widget/config"),
  };
}
```

---

### Phase 1: Campaign List Page (Day 1–1.5)

**Files:** `pages/AdvertisingAdminPage.jsx`, `components/CampaignTable.jsx`, `hooks/useCampaigns.js`

**Requirements:**
- TanStack Table v8 with server-side pagination, sorting, filtering
- Columns: Name, Type (badge), Status (badge), Weight, Date Range, Tenant, Actions
- Filters: Status dropdown, Type dropdown, Search input
- Toolbar: Create button (opens drawer), Refresh
- Row actions: View (drawer), Edit (drawer), Delete (confirm modal)
- Loading skeleton, empty state, error toast

**Column config:**
```js
// constants/advertising.js
export const CAMPAIGN_COLUMNS = [
  { accessorKey: 'name', header: 'Tên chiến dịch' },
  { accessorKey: 'campaign_type', header: 'Loại' },
  { accessorKey: 'status', header: 'Trạng thái' },
  { accessorKey: 'weight', header: 'Trọng số' },
  { accessorKey: 'start_date', header: 'Bắt đầu' },
  { accessorKey: 'end_date', header: 'Kết thúc' },
  { accessorKey: 'tenant', header: 'Tenant' },
  { id: 'actions', header: '', enableSorting: false },
];
```

---

### Phase 2: Create/Edit Campaign Form (Day 1.5–2)

**Files:** `components/CampaignForm.jsx`, `components/CampaignDetailDrawer.jsx`

**Form fields (React Hook Form + Zod):**
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| name | text | required, max 120 | |
| campaign_type | select | required | `internal_promo`, `partner_ad` |
| status | select | required | `draft`, `active`, `paused`, `completed` |
| banner_url | url | required | 1x WebP/PNG |
| banner_url_retina | url | optional | 2x |
| banner_url_svg | url | optional | Vector |
| banner_width | number | required, min 1 | default 300 |
| banner_height | number | required, min 1 | default 50 |
| destination_url | url | required | Landing page |
| weight | number | required, min 1, max 1000 | default 100 |
| start_date | datetime-local | required | |
| end_date | datetime-local | required | > start_date |
| tenant | autocomplete | optional | Search CoreTenant API |
| targeting_rules | json editor | optional | JSON textarea |

**Drawer layout:**
- Left: Form (scrollable)
- Right: Live preview of banner (image tag with dimensions)
- Footer: Cancel / Save Draft / Publish

---

### Phase 3: Campaign Detail & Metrics (Day 2–2.5)

**Files:** `components/CampaignMetricsCard.jsx`, `hooks/useCampaignMetrics.js`

**Dashboard cards (4-up grid):**
| Metric | Source | Format |
|--------|--------|--------|
| Total Impressions | `analytics.total_impressions` | number |
| Total Clicks | `analytics.total_clicks` | number |
| CTR | computed | `%` (2 decimals) |
| Active Campaigns | filter status=active | count |

**Detail drawer tabs:**
1. **Overview** — metrics cards + daily trend sparkline (Recharts area chart)
2. **Daily Breakdown** — table: Date, Impressions, Clicks, CTR
3. **Targeting Rules** — JSON viewer (read-only)

---

### Phase 4: Trademark Config Panel (Day 2.5–3)

**Files:** `components/TrademarkConfigPanel.jsx`, `hooks/useTrademarkConfig.js`

**Current state:** Trademark config is read-only from `settings.py`:
```python
CORE_WIDGET_TRADEMARK_ENABLED = False
CORE_WIDGET_TRADEMARK_ACTIVATION_TS = None
CORE_WIDGET_CONFIG_VERSION = 'cfg_v1'
```

**Required backend endpoint:**
```
PATCH /core/v1/operator/ads/trademark-config/
{
  "enabled": true,
  "activation_ts": 1750000000000,
  "version": "cfg_v3"
}
```

**Frontend panel:**
- Toggle switch: Bật/tắt trademark badge
- Activation timestamp picker
- Version display (auto-increment on save)
- Read-only info: "Badge `⚡ vninvest` sẽ hiển thị ở tất cả widget"

---

### Phase 5: CASL Integration & Route Guard (Day 3–3.5)

**Abilities:**
```js
export function defineAdvertisingAbilities(can, user, tenant) {
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
  const isStaff = user?.role === 'staff';
  
  if (isAdmin) {
    can('manage', 'Advertising');
    can('update', 'TrademarkConfig');
    return;
  }
  if (isStaff) {
    can('read', 'Advertising');
    can('create', 'AdCampaign');
    can('update', 'AdCampaign', { tenant_id: tenant?.id });
    can('delete', 'AdCampaign', { tenant_id: tenant?.id });
    return;
  }
}
```

**Route:**
```js
{
  id: "advertising-admin",
  path: "/admin/advertising/*",
  titleKey: "routes.advertisingAdmin",
  group: "admin",
  buildTargets: ["saas", "vip"],
  requiredCapabilities: ["admin.operator.read"],
  adapter: "core",
  status: "baseline",
}
```

---

### Phase 6: Testing & Polish (Day 3.5–5)

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit | `useCampaigns`, `useCampaignMutations`, form validation | Vitest + React Testing Library |
| Integration | Campaign CRUD flow (mock API) | Vitest + MSW |
| E2E | Create→Edit→Delete campaign, verify list update | Playwright |

**Polish checklist:**
- [ ] i18n keys for all VI/EN strings
- [ ] Responsive: table → card layout on mobile
- [ ] Dark mode CSS variables
- [ ] Error boundaries per section
- [ ] Optimistic updates for mutations
- [ ] Debounced search (300ms)
- [ ] Confirm modal for delete

---

## 4. Dependencies

```json
// packages/web/package.json — new additions
{
  "dependencies": {
    "@tanstack/react-table": "^8.20.0",
    "@tanstack/react-query": "^5.60.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.24.0"
  }
}
```

**Already installed:**
- `@casl/ability` ^6.8.0
- `@casl/react` ^5.0.1
- `recharts` ^2.12.7
- `lucide-react`
- `date-fns`

---

## 5. API Integration Checklist

- [ ] `advertisingClient.getAdvertisingCampaigns` — pagination, filters
- [ ] `advertisingClient.createAdvertisingCampaign` — JSON body
- [ ] `advertisingClient.updateAdvertisingCampaign` — PATCH
- [ ] `advertisingClient.deleteAdvertisingCampaign` — DELETE
- [ ] `advertisingClient.getCampaignAnalytics` — date range params
- [ ] `advertisingClient.getTrademarkConfig` — read-only
- [ ] Error handling: 400 (validation), 403 (permission), 404, 500
- [ ] Request/Response interceptors: add `X-Tenant-ID` header if needed

---

## 6. Definition of Done

- [ ] Feature module builds (`npm run build` passes)
- [ ] TypeScript strict mode: 0 errors
- [ ] ESLint: 0 warnings/errors
- [ ] Unit tests ≥ 80% coverage for hooks/components
- [ ] i18n: VI/EN strings complete
- [ ] Responsive: works at 320px, 768px, 1440px
- [ ] Dark mode: no hardcoded colors
- [ ] Documentation: `features/advertising/README.md`

---

## 7. File Index (for PR review)

```
NEW FILES:
packages/web/src/adapters/core/advertising.js
packages/web/src/features/advertising/
  ├── api/advertisingClient.js
  ├── components/CampaignTable.jsx
  ├── components/CampaignForm.jsx
  ├── components/CampaignDetailDrawer.jsx
  ├── components/CampaignMetricsCard.jsx
  ├── components/TrademarkConfigPanel.jsx
  ├── hooks/useCampaigns.js
  ├── hooks/useCampaignMutations.js
  ├── hooks/useCampaignMetrics.js
  ├── hooks/useTrademarkConfig.js
  ├── pages/AdvertisingAdminPage.jsx
  ├── types/advertising.js
  ├── constants/advertising.js
  └── index.js

MODIFIED FILES:
packages/web/src/adapters/coreApiAdapter.js          (register advertising client)
packages/web/src/app/routeCatalog.js                 (add advertising route)
packages/web/src/app/navigationCatalog.js            (add to admin group)
packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts  (add sidebar item)
packages/web/src/i18n/vi.js                          (add advertising keys)
packages/web/src/i18n/en.js                          (add advertising keys)
```

---

## 8. Rollback Plan

| Phase | Rollback Action |
|-------|-----------------|
| 0 | Delete `features/advertising/`, revert adapter/route changes |
| 1 | Disable route in `routeCatalog.js` |
| 2 | Remove form components, keep list |
| 3 | Disable metrics tab, keep detail view |
| 4 | Hide trademark panel |
| 5 | Remove CASL rules, open route to all (dev only) |

---

## 9. Next Steps

1. **Approve plan** → Dev starts Phase 0
2. **Daily sync** → 15-min standup per phase
3. **Code review** → Per phase PR (not one mega-PR)
4. **Staging deploy** → Phase 4 complete → QA smoke test
5. **Production** → Feature flag `advertising_admin_ui` → gradual rollout
