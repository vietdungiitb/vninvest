# Implementation Plan: Frontend Advertising Admin Module

**Target:** `packages/web/src/features/advertising/` — React admin UI for managing AdCampaigns  
**Backend API:** Already exists at `/core/v1/advertising/` (AdCampaignViewSet, AdCampaignSerializer)  
**Auth:** CASL abilities `manage_advertising`, `view_advertising` mapped from PAT scopes  
**Timeline:** ~5 days (1 sprint) — depends on backend API contract stability

---

## 1. Architecture Overview

```
packages/web/src/
├── adapters/core/commercial.js          ← add advertising endpoints
├── features/advertising/
│   ├── api/
│   │   ├── advertisingClient.js         ← React Query hooks (list/create/update/delete)
│   │   └── index.js
│   ├── components/
│   │   ├── CampaignTable.jsx            ← TanStack Table v8
│   │   ├── CampaignForm.jsx             ← React Hook Form + Zod
│   │   ├── CampaignDetailDrawer.jsx     ← side panel detail
│   │   ├── CampaignMetricsCard.jsx      ← impressions/clicks/CTR
│   │   └── index.js
│   ├── hooks/
│   │   ├── useCampaigns.js              ← list with filters/pagination
│   │   ├── useCampaignMutations.js      ← CRUD mutations
│   │   └── index.js
│   ├── pages/
│   │   ├── AdvertisingDashboard.jsx     ← main page with tabs
│   │   ├── CampaignListPage.jsx
│   │   └── index.js
│   ├── types/
│   │   └── advertising.js               ← Zod schemas + TS types
│   ├── constants/
│   │   └── advertising.js               ← enums, column configs
│   ├── index.js                         ← barrel export
│   └── README.md
├── routes/
│   └── advertisingRoutes.jsx            ← lazy-loaded route config
└── casl/
    └── advertisingAbilities.js          ← ability definitions
```

---

## 2. Backend API Contract (Existing)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/core/v1/advertising/campaigns/` | List campaigns (pagination, filters: status, type, tenant) |
| POST | `/core/v1/advertising/campaigns/` | Create campaign |
| GET | `/core/v1/advertising/campaigns/{id}/` | Retrieve single |
| PATCH | `/core/v1/advertising/campaigns/{id}/` | Partial update |
| DELETE | `/core/v1/advertising/campaigns/{id}/` | Delete |
| GET | `/core/v1/advertising/campaigns/{id}/metrics/` | Daily aggregates (impressions, clicks, CTR) |
| GET | `/core/v1/advertising/metrics/summary/` | Global summary stats |

**Serializer fields (AdCampaign):**
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

| Task | Owner | Output |
|------|-------|--------|
| Create feature directory structure | Dev | `packages/web/src/features/advertising/` tree |
| Add advertising endpoints to `commercial.js` | Dev | `getAdvertisingCampaigns`, `createAdvertisingCampaign`, etc. |
| Define Zod schemas in `types/advertising.js` | Dev | `CampaignSchema`, `CampaignFormSchema`, `MetricsSchema` |
| Add CASL abilities in `casl/advertisingAbilities.js` | Dev | `defineAdvertisingAbilities()` |
| Register route in `routes/advertisingRoutes.jsx` | Dev | Lazy-loaded `/saas/advertising/*` |
| Add nav entry in SaaS sidebar | Dev | "Advertising" under "Commercial" group |

**Key files to create first:**
```js
// adapters/core/commercial.js — append
export function createCommercialClient({ coreGet, corePost, corePut, coreDelete }) {
  // ...existing billing/payment methods...
  
  // --- Advertising ---
  getAdvertisingCampaigns: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && searchParams.append(k, v));
    return coreGet(`/advertising/campaigns/?${searchParams.toString()}`);
  },
  getAdvertisingCampaign: async (id) => coreGet(`/advertising/campaigns/${id}/`),
  createAdvertisingCampaign: async (payload) => corePost("/advertising/campaigns/", payload),
  updateAdvertisingCampaign: async (id, payload) => corePut(`/advertising/campaigns/${id}/`, payload),
  deleteAdvertisingCampaign: async (id) => coreDelete(`/advertising/campaigns/${id}/`),
  getCampaignMetrics: async (id, params = {}) => {
    const searchParams = new URLSearchParams(params);
    return coreGet(`/advertising/campaigns/${id}/metrics/?${searchParams.toString()}`);
  },
  getAdvertisingSummary: async () => coreGet("/advertising/metrics/summary/"),
};
```

---

### Phase 1: Campaign List Page (Day 1–1.5)

**Files:** `pages/CampaignListPage.jsx`, `components/CampaignTable.jsx`, `hooks/useCampaigns.js`

**Requirements:**
- TanStack Table v8 with server-side pagination, sorting, filtering
- Columns: Name, Type, Status (badge), Weight, Date Range, Tenant, Actions
- Filters: Status dropdown, Type dropdown, Tenant autocomplete, Date range picker
- Toolbar: Create button (opens drawer), Refresh, Export CSV
- Row actions: View (drawer), Edit (drawer), Delete (confirm modal)
- Loading skeleton, empty state, error toast

**React Query:**
```js
// hooks/useCampaigns.js
export function useCampaigns(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['advertising', 'campaigns', filters],
    queryFn: () => commercialClient.getAdvertisingCampaigns(filters),
    placeholderData: (prev) => prev,
    ...options,
  });
}
```

**Column config example:**
```js
// constants/advertising.js
export const CAMPAIGN_COLUMNS = [
  { accessorKey: 'name', header: 'Tên chiến dịch', cell: LinkCell },
  { accessorKey: 'campaign_type', header: 'Loại', cell: BadgeCell('campaign_type') },
  { accessorKey: 'status', header: 'Trạng thái', cell: StatusBadgeCell },
  { accessorKey: 'weight', header: 'Trọng số', cell: NumberCell },
  { accessorKey: 'start_date', header: 'Bắt đầu', cell: DateCell },
  { accessorKey: 'end_date', header: 'Kết thúc', cell: DateCell },
  { accessorKey: 'tenant_name', header: 'Tenant', cell: TenantCell },
  { id: 'actions', header: '', cell: ActionsCell, enableSorting: false },
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
| targeting_rules | json editor | optional | Monaco/CodeMirror for JSON |

**Drawer layout:**
- Left: Form (scrollable)
- Right: Live preview of banner (image tag with dimensions)
- Footer: Cancel / Save Draft / Publish

**Validation:**
```js
// types/advertising.js
export const CampaignFormSchema = z.object({
  name: z.string().min(1).max(120),
  campaign_type: z.enum(['internal_promo', 'partner_ad']),
  status: z.enum(['draft', 'active', 'paused', 'completed']),
  banner_url: z.string().url(),
  banner_url_retina: z.string().url().optional().or(z.literal('')),
  banner_url_svg: z.string().url().optional().or(z.literal('')),
  banner_width: z.number().int().positive(),
  banner_height: z.number().int().positive(),
  destination_url: z.string().url(),
  weight: z.number().int().min(1).max(1000),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  tenant: z.string().uuid().optional().nullable(),
  targeting_rules: z.record(z.unknown()).optional(),
}).refine(d => new Date(d.end_date) > new Date(d.start_date), {
  message: 'End date phải sau start date',
  path: ['end_date'],
});
```

---

### Phase 3: Campaign Detail & Metrics (Day 2–2.5)

**Files:** `components/CampaignMetricsCard.jsx`, `hooks/useCampaignMetrics.js`

**Dashboard cards (4-up grid):**
| Metric | Source | Format |
|--------|--------|--------|
| Total Impressions | `metrics.summary.total_impressions` | number |
| Total Clicks | `metrics.summary.total_clicks` | number |
| CTR | computed | `%` (2 decimals) |
| Avg CPC | computed | VND |

**Detail drawer tabs:**
1. **Overview** — metrics cards + daily trend sparkline (Recharts area chart)
2. **Daily Breakdown** — table: Date, Impressions, Clicks, CTR
3. **Targeting Rules** — JSON viewer (read-only)

**Hook:**
```js
export function useCampaignMetrics(campaignId, dateRange) {
  return useQuery({
    queryKey: ['advertising', 'campaign', campaignId, 'metrics', dateRange],
    queryFn: () => commercialClient.getCampaignMetrics(campaignId, dateRange),
    enabled: !!campaignId,
  });
}
```

---

### Phase 4: Advertising Dashboard (Day 2.5–3)

**Files:** `pages/AdvertisingDashboard.jsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Quản trị Quảng cáo"  [Create Campaign]            │
├──────────────┬──────────────┬──────────────┬──────────────┤
│  Impressions │    Clicks    │     CTR      │   Active     │
│   1,234,567  │    12,345    │    1.00%     │      8       │
└──────────────┴──────────────┴──────────────┴──────────────┘
│  Tabs: [Tổng quan] [Chiến dịch] [Báo cáo] [Cấu hình]       │
└─────────────────────────────────────────────────────────────┘
```

**Tổng quan tab:**
- Summary cards (above)
- Recent campaigns table (top 5 by impressions)
- Performance trend chart (last 30 days)

**Chiến dịch tab:** → `CampaignListPage` (embedded)

**Báo cáo tab:**
- Date range picker
- Export buttons: CSV, Excel
- Aggregate table by campaign/tenant/symbol

**Cấu hình tab:**
- Global settings: `CORE_WIDGET_TRADEMARK_ENABLED` toggle (read-only display)
- Ad signing secret status (masked)
- Rate limit config display

---

### Phase 5: CASL Integration & Route Guard (Day 3–3.5)

**Files:** `casl/advertisingAbilities.js`, route guard in `advertisingRoutes.jsx`

```js
// casl/advertisingAbilities.js
export function defineAdvertisingAbilities(can, user, tenant) {
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
  const isStaff = user?.role === 'staff';
  
  if (isAdmin) {
    can('manage', 'Advertising');
    return;
  }
  if (isStaff) {
    can('read', 'Advertising');
    can('create', 'AdCampaign');
    can('update', 'AdCampaign', { tenant_id: tenant?.id });
    can('delete', 'AdCampaign', { tenant_id: tenant?.id });
    return;
  }
  // Default: no access
}
```

**Route protection:**
```jsx
// routes/advertisingRoutes.jsx
import { Can } from '@casl/react';

export const advertisingRoutes = [
  {
    path: '/saas/advertising/*',
    element: (
      <Can I="read" a="Advertising" fallback={<AccessDenied />}>
        <Suspense fallback={<PageSkeleton />}>
          <AdvertisingLayout />
        </Suspense>
      </Can>
    ),
  },
];
```

---

### Phase 6: Testing & Polish (Day 4–5)

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit | `useCampaigns`, `useCampaignMutations`, form validation | Vitest + React Testing Library |
| Integration | Campaign CRUD flow (mock API) | Vitest + MSW |
| E2E | Create→Edit→Delete campaign, verify list update | Playwright |
| Accessibility | Keyboard nav, ARIA labels, color contrast | axe-core |

**Polish checklist:**
- [ ] i18n keys for all VI/EN strings (`advertising.vi.js`, `advertising.en.js`)
- [ ] Responsive: table → card layout on mobile
- [ ] Dark mode CSS variables
- [ ] Error boundaries per section
- [ ] Optimistic updates for mutations
- [ ] Debounced search (300ms)
- [ ] Confirm modal for delete (SweetAlert2 or custom)

---

## 4. Dependencies & Imports

```json
// packages/web/package.json — ensure these exist
{
  "dependencies": {
    "@tanstack/react-table": "^8.x",
    "@tanstack/react-query": "^5.x",
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "^3.x",
    "zod": "^3.x",
    "@casl/ability": "^6.x",
    "@casl/react": "^7.x",
    "recharts": "^2.x",
    "date-fns": "^3.x",
    "lucide-react": "^0.x"
  }
}
```

---

## 5. API Integration Checklist

- [ ] `commercialClient.getAdvertisingCampaigns` — pagination, filters
- [ ] `commercialClient.createAdvertisingCampaign` — multipart? (no, JSON only)
- [ ] `commercialClient.updateAdvertisingCampaign` — PATCH
- [ ] `commercialClient.deleteAdvertisingCampaign` — DELETE
- [ ] `commercialClient.getCampaignMetrics` — date range params
- [ ] `commercialClient.getAdvertisingSummary` — dashboard cards
- [ ] Error handling: 400 (validation), 403 (permission), 404, 500
- [ ] Request/Response interceptors: add `X-Tenant-ID` header if needed

---

## 6. Definition of Done

- [ ] Feature module builds (`npm run build` passes)
- [ ] TypeScript strict mode: 0 errors
- [ ] ESLint: 0 warnings/errors
- [ ] Unit tests ≥ 80% coverage for hooks/components
- [ ] E2E tests: create/edit/delete flow passes
- [ ] Accessibility: axe-core 0 violations
- [ ] i18n: VI/EN strings complete
- [ ] Responsive: works at 320px, 768px, 1440px
- [ ] Dark mode: no hardcoded colors
- [ ] Storybook stories for CampaignForm, CampaignTable, CampaignMetricsCard
- [ ] Documentation: `features/advertising/README.md` with API usage examples

---

## 7. Rollback Plan

| Phase | Rollback Action |
|-------|-----------------|
| 0 | Delete `features/advertising/`, revert `commercial.js` additions |
| 1 | Disable route in `advertisingRoutes.jsx` |
| 2 | Remove form components, keep list |
| 3 | Disable metrics tab, keep detail view |
| 4 | Hide dashboard tab, keep list functional |
| 5 | Remove CASL rules, open route to all (dev only) |

---

## 8. File Index (for PR review)

```
NEW FILES:
packages/web/src/adapters/core/commercial.js          (modified)
packages/web/src/features/advertising/
  ├── api/advertisingClient.js
  ├── api/index.js
  ├── components/CampaignTable.jsx
  ├── components/CampaignForm.jsx
  ├── components/CampaignDetailDrawer.jsx
  ├── components/CampaignMetricsCard.jsx
  ├── components/index.js
  ├── hooks/useCampaigns.js
  ├── hooks/useCampaignMutations.js
  ├── hooks/useCampaignMetrics.js
  ├── hooks/index.js
  ├── pages/AdvertisingDashboard.jsx
  ├── pages/CampaignListPage.jsx
  ├── pages/index.js
  ├── types/advertising.js
  ├── constants/advertising.js
  ├── casl/advertisingAbilities.js
  ├── routes/advertisingRoutes.jsx
  ├── index.js
  └── README.md
packages/web/src/routes/index.js                      (modified: add advertisingRoutes)
packages/web/src/i18n/vi.js                           (modified: advertising keys)
packages/web/src/i18n/en.js                           (modified: advertising keys)
```

---

## 9. Next Steps

1. **Approve plan** → Dev starts Phase 0
2. **Daily sync** → 15-min standup per phase
3. **Code review** → Per phase PR (not one mega-PR)
4. **Staging deploy** → Phase 4 complete → QA smoke test
5. **Production** → Feature flag `advertising_admin_ui` → gradual rollout