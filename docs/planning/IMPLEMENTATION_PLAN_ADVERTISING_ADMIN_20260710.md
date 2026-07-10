# Implementation Plan: Frontend Advertising Admin Module (v2)

## Overview

Frontend module for marketing/ops teams to manage advertising campaigns within VNInvest.  
**Rewrite of v1** — addresses 14 audit findings (6 critical, 5 major, 3 minor).

---

## Prerequisites (BLOCKING)

Before Phase 0 starts, confirm:

1. **Backend API endpoints exist** — or create a parallel backend PR with:
   - Django model (`AdvertisingCampaign`)
   - Serializer + ViewSet
   - URL routing under `/core/v1/advertising/`
   - Database migration + rollback plan
2. **CASL rules shipped from backend** — `_build_abilities()` must include `advertising.*` scopes
3. **New dependencies installed** (only what's actually missing):
   ```bash
   npm install @tanstack/react-table@^8 @tanstack/react-query@^5 react-hook-form@^7 @hookform/resolvers@^3 zod@^3 date-fns@^3
   ```
   > `@casl/ability`, `@casl/react`, `recharts`, `lucide-react` already in `package.json`.

---

## Constraints (ENFORCED BY CI)

| Rule | Source |
|------|--------|
| **Zero JSX** — all `.js` files, `createElement` only | AGENTS.md |
| `const e = createElement;` alias pattern | Existing `stock-detail/`, `dashboard/` |
| All strings via `useI18n()` → `vi.js`/`en.js` | AGENTS.md |
| Styling: Tailwind classes + CSS variables (no `soc.module.css` in this module — use existing token system) | Existing pattern |
| `npx tsc --noEmit` → 0 errors before commit | AGENTS.md |
| `npm run build` → success | AGENTS.md |
| No `any` except adapter cast | AGENTS.md |
| No inline styles except dynamic values | AGENTS.md |

---

## Architecture

### API Layer — Extend Existing Adapter

```
adapters/core/commercial.js  ← add createAdvertisingClient()
adapters/coreApiAdapter.js   ← import + spread into facade
```

No new `api/` directory. No `TypedApi` (does not exist). Follows `createSocClient` / `createCommercialClient` pattern exactly.

### Feature Module Structure

```
packages/web/src/features/advertising/
├── index.js                    # Barrel: Object.freeze export
├── components/
│   ├── index.js                # Barrel
│   ├── CampaignTable.js        # TanStack Table v8 (createElement)
│   ├── CampaignForm.js         # React Hook Form + Zod (createElement)
│   └── CampaignDetailDrawer.js # Side panel (createElement)
├── hooks/
│   ├── index.js                # Barrel
│   ├── useCampaigns.js         # List + filters + pagination
│   ├── useCampaignMutations.js # CRUD mutations
│   └── useCampaignMetrics.js   # Metrics & analytics
├── pages/
│   ├── index.js                # Barrel
│   ├── AdvertisingDashboard.js # Main admin dashboard
│   └── CampaignListPage.js     # Campaign management list
└── casl/
    └── advertisingAbilities.js # CASL rule builder
```

**All files `.js`.** No `.jsx`, no `.ts` in feature module (TS strictness via `tsc --noEmit` on the whole project).

### Route & Navigation Integration

Add to existing catalogs (NOT a separate `routes/` directory):

```js
// app/routeCatalog.js — add entry
{
  id: "advertising",
  path: "/advertising",
  titleKey: "routes.advertising",
  group: "admin",
  buildTargets: ["saas", "vip"],
  requiredCapabilities: ["admin.advertising.read"],
  adapter: "core",
  status: "baseline",
}

// app/navigationCatalog.js — add to "admin" group
{
  id: "admin",
  items: ["operations-center", "operations-center-mail-config", "advertising"],
}
```

### CASL Pattern (Existing)

```js
// features/advertising/casl/advertisingAbilities.js
import { createMongoAbility } from "@casl/ability";

export function buildAdvertisingAbilities(rules = []) {
  return createMongoAbility(
    rules.length > 0
      ? rules
      : [{ subject: "Advertising", actions: [] }]
  );
}

// Usage in pages:
// import Can from "../../components/shared/Can.jsx";
// e(Can, { I: "view", a: "Advertising", fallback: e(AccessDenied) },
//   e(CampaignListPage, null)
// )
```

### i18n Keys (Defined in Phase 0)

```js
// i18n/vi.js — add under advertising: {}
advertising: {
  title: "Quản lý quảng cáo",
  campaign: "Chiến dịch",
  createCampaign: "Tạo chiến dịch",
  editCampaign: "Sửa chiến dịch",
  deleteCampaign: "Xóa chiến dịch",
  campaignName: "Tên chiến dịch",
  status: "Trạng thái",
  statusDraft: "Nháp",
  statusActive: "Đang chạy",
  statusPaused: "Tạm dừng",
  statusCompleted: "Hoàn thành",
  impressions: "Lượt hiển thị",
  clicks: "Lượt nhấp",
  ctr: "Tỷ lệ nhấp",
  cpc: "Chi phí mỗi nhấp",
  budget: "Ngân sách",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  targeting: "Đối tượng mục tiêu",
  noCampaigns: "Chưa có chiến dịch nào.",
  confirmDelete: "Bạn có chắc muốn xóa chiến dịch này?",
  metricsSummary: "Tóm tắt số liệu",
  dailyTrend: "Xu hướng theo ngày",
  exportCsv: "Xuất CSV",
}

// i18n/en.js — add under advertising: {}
advertising: {
  title: "Advertising Management",
  campaign: "Campaign",
  createCampaign: "Create Campaign",
  editCampaign: "Edit Campaign",
  deleteCampaign: "Delete Campaign",
  campaignName: "Campaign Name",
  status: "Status",
  statusDraft: "Draft",
  statusActive: "Active",
  statusPaused: "Paused",
  statusCompleted: "Completed",
  impressions: "Impressions",
  clicks: "Clicks",
  ctr: "Click-through Rate",
  cpc: "Cost per Click",
  budget: "Budget",
  startDate: "Start Date",
  endDate: "End Date",
  targeting: "Targeting",
  noCampaigns: "No campaigns yet.",
  confirmDelete: "Are you sure you want to delete this campaign?",
  metricsSummary: "Metrics Summary",
  dailyTrend: "Daily Trend",
  exportCsv: "Export CSV",
}
```

---

## Phase Breakdown

### Phase 0: Foundation & CASL (1 day)

**Goal:** Scaffolding + security wired from day one.

**Files created/modified:**

| File | Action |
|------|--------|
| `adapters/core/commercial.js` | Add `createAdvertisingClient()` with 7 endpoints |
| `adapters/coreApiAdapter.js` | Import + spread `advertisingClient` into facade |
| `features/advertising/index.js` | Barrel export |
| `features/advertising/casl/advertisingAbilities.js` | `buildAdvertisingAbilities()` |
| `features/advertising/components/index.js` | Empty barrel `Object.freeze([])` |
| `features/advertising/hooks/index.js` | Empty barrel `Object.freeze([])` |
| `features/advertising/pages/index.js` | Empty barrel `Object.freeze([])` |
| `app/routeCatalog.js` | Add `advertising` route entry |
| `app/navigationCatalog.js` | Add `advertising` to admin group items |
| `i18n/vi.js` | Add `advertising` section (~25 keys) |
| `i18n/en.js` | Add `advertising` section (~25 keys) |

**Adapter client shape (added to `commercial.js`):**

```js
export function createAdvertisingClient({ coreGet, corePost, corePatch, coreDelete }) {
  return {
    listCampaigns(params = {}) {
      // server-side pagination: page, page_size, search, status, sort
      let url = "/advertising/campaigns/";
      const sp = new URLSearchParams();
      if (params.page) sp.append("page", params.page);
      if (params.page_size) sp.append("page_size", params.page_size);
      if (params.search) sp.append("search", params.search);
      if (params.status) sp.append("status", params.status);
      if (params.sort) sp.append("sort", params.sort);
      const q = sp.toString();
      if (q) url += `?${q}`;
      return coreGet(url);
    },
    getCampaign(id) {
      return coreGet(`/advertising/campaigns/${id}/`);
    },
    createCampaign(payload) {
      return corePost("/advertising/campaigns/", payload);
    },
    updateCampaign(id, payload) {
      return corePatch(`/advertising/campaigns/${id}/`, payload);
    },
    deleteCampaign(id) {
      return coreDelete(`/advertising/campaigns/${id}/`);
    },
    getCampaignMetrics(id) {
      return coreGet(`/advertising/campaigns/${id}/metrics/`);
    },
    getMetricsSummary() {
      return coreGet("/advertising/metrics/summary/");
    },
  };
}
```

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | route appears in nav for admin users.

---

### Phase 1: Campaign List Page (1.5 days)

**Goal:** Paginated table with search, filters, action menu.

**Files:**

| File | Lines est. | Notes |
|------|-----------|-------|
| `features/advertising/hooks/useCampaigns.js` | ~60 | `useState` + `useEffect` calling `listCampaigns()` |
| `features/advertising/components/CampaignTable.js` | ~120 | TanStack Table, `createElement`, server-side pagination |
| `features/advertising/pages/CampaignListPage.js` | ~80 | Composes table + search + filter bar |

**Key decisions:**
- TanStack Table v8 for column defs, sorting, pagination state
- Server-side pagination (no client-side fetch-all)
- Search by campaign name (debounced 300ms)
- Filter by status dropdown (Draft/Active/Paused/Completed)
- Action menu: View, Edit, Delete (with CASL checks via `Can`)
- Loading skeleton, error state, empty state — all i18n'd
- **Component >120 lines?** Extract `campaignColumns.js` (column defs) and `campaignFilters.js` (filter bar)

**CASL:** Every action button wrapped in `e(Can, { I: "update", a: "Campaign" }, ...)`.

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | `curl /core/v1/advertising/campaigns/` → 200 with `{results:[...], count:N}`.

---

### Phase 2: Create/Edit Campaign Form (1.5 days)

**Goal:** Modal form for create + edit with Zod validation.

**Files:**

| File | Lines est. | Notes |
|------|-----------|-------|
| `features/advertising/components/CampaignForm.js` | ~130 | React Hook Form + Zod resolver |
| `features/advertising/hooks/useCampaignMutations.js` | ~70 | `createCampaign` / `updateCampaign` with optimistic update |

**Key decisions:**
- React Hook Form for form state, Zod for validation
- Zod schema defined in `CampaignForm.js` (co-located, not separate `types/` dir)
- Fields: name, status, budget, start_date, end_date, targeting_rules (JSON textarea)
- Error display: field-level + API error banner
- On submit: call mutation → close drawer → refresh list
- **Component >120 lines?** Extract `campaignFormFields.js` (field config array)

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | `curl -X POST .../campaigns/` → 201.

---

### Phase 3: Campaign Detail & Metrics (1.5 days)

**Goal:** Detail view with metric cards + daily trend chart.

**Files:**

| File | Lines est. | Notes |
|------|-----------|-------|
| `features/advertising/hooks/useCampaignMetrics.js` | ~50 | Fetches `/campaigns/{id}/metrics/` |
| `features/advertising/components/CampaignDetailDrawer.js` | ~100 | Side panel with tabs |

**Key decisions:**
- Recharts for daily trend line chart (already in `package.json`)
- 4 metric cards: Impressions, Clicks, CTR, CPC
- Tabs: Overview, Daily Breakdown, Targeting Rules
- Responsive: drawer on desktop, full-page on mobile
- **Component >120 lines?** Extract metric card factory + chart config

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | chart renders with mock data.

---

### Phase 4: Advertising Dashboard (1.5 days)

**Goal:** Top-level admin dashboard with summary + recent campaigns.

**Files:**

| File | Lines est. | Notes |
|------|-----------|-------|
| `features/advertising/pages/AdvertisingDashboard.js` | ~110 | Summary cards + recent list + chart |

**Key decisions:**
- Summary cards: total campaigns, active count, total impressions, total spend
- Recent campaigns list (last 5)
- Performance trend chart (Recharts, reuse from Phase 3)
- CSV export button (client-side: convert JSON → CSV blob → download)
- Uses `ShellPageTemplate` wrapper pattern (see `components/ShellPageTemplate.js`)
- **Component >120 lines?** Extract dashboard stat cards + export util

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | dashboard renders at `/advertising`.

---

### Phase 5: Delete Confirmation + Polish (0.5 day)

**Goal:** Delete flow, error boundaries, edge cases.

**Files:**

| File | Notes |
|------|-------|
| `features/advertising/components/CampaignTable.js` | Add delete confirmation modal |
| `features/advertising/hooks/useCampaignMutations.js` | Add `deleteCampaign` mutation |

**Key decisions:**
- Delete uses existing `ConfirmModal` pattern or inline confirmation
- CASL: `e(Can, { I: "delete", a: "Campaign" }, ...)` on delete button
- Optimistic delete: remove from local list, rollback on error
- Error boundary wrapping the entire advertising feature

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | `curl -X DELETE .../campaigns/{id}/` → 204.

---

### Phase 6: Testing & i18n Audit (1.5 days)

**Goal:** Unit tests, i18n verification, accessibility baseline.

**Testing commands (match existing toolchain):**

```bash
# Unit tests (Jest)
node --experimental-vm-modules node_modules/jest/bin/jest.js --no-coverage -- --testPathPattern=advertising

# E2E / Visual (Playwright)
npx playwright test --grep "advertising"
```

**Test files:**

| File | Coverage target |
|------|----------------|
| `features/advertising/__tests__/advertisingClient.test.js` | Adapter methods (mock transport) |
| `features/advertising/__tests__/useCampaigns.test.js` | Hook state transitions |
| `features/advertising/__tests__/CampaignForm.test.js` | Validation, submit, error states |
| `features/advertising/__tests__/advertising.i18n.test.js` | All keys present in vi.js + en.js |

**i18n audit:**

```bash
# Grep for hardcoded Vietnamese/English strings in feature
rg -n '"[A-ZÀ-Ỹ][a-zà-ỹ]' packages/web/src/features/advertising/ --include='*.js'
# Expected: 0 matches (all strings use t("advertising.xxx"))
```

**Accessibility:** Verify all interactive elements have `aria-label` via i18n keys.

**Gate:** `tsc --noEmit` ✓ | `npm run build` ✓ | tests pass | grep hardcoded = 0.

---

## File Manifest (Final)

```
# Modified (2 files)
adapters/core/commercial.js              # +createAdvertisingClient()
adapters/coreApiAdapter.js               # +import +spread

# New — Feature Module (11 files)
features/advertising/index.js
features/advertising/casl/advertisingAbilities.js
features/advertising/components/index.js
features/advertising/components/CampaignTable.js
features/advertising/components/CampaignForm.js
features/advertising/components/CampaignDetailDrawer.js
features/advertising/hooks/index.js
features/advertising/hooks/useCampaigns.js
features/advertising/hooks/useCampaignMutations.js
features/advertising/hooks/useCampaignMetrics.js
features/advertising/pages/index.js
features/advertising/pages/AdvertisingDashboard.js
features/advertising/pages/CampaignListPage.js

# New — Config (0 files, modified existing)
app/routeCatalog.js                     # +advertising entry
app/navigationCatalog.js                # +advertising in admin group
i18n/vi.js                              # +advertising section
i18n/en.js                              # +advertising section

# New — Tests (4 files)
features/advertising/__tests__/advertisingClient.test.js
features/advertising/__tests__/useCampaigns.test.js
features/advertising/__tests__/CampaignForm.test.js
features/advertising/__tests__/advertising.i18n.test.js
```

**Total: 4 modified, 15 new files.**

---

## Delivery Timeline

| Day | Phase | Deliverable | Gate |
|-----|-------|-------------|------|
| 1 | Phase 0 | Adapter + CASL + routes + i18n keys + barrels | tsc ✓ build ✓ nav visible |
| 2-3 | Phase 1 | Campaign list page with table, search, filters | curl list → 200 |
| 4-5 | Phase 2 | Create/edit form with validation | curl create → 201 |
| 6-7 | Phase 3 | Detail drawer with metrics + chart | chart renders |
| 8-9 | Phase 4 | Admin dashboard with summary + export | dashboard at /advertising |
| 9 | Phase 5 | Delete flow + error boundaries | curl delete → 204 |
| 10-11 | Phase 6 | Unit tests + i18n audit + accessibility | tests pass, grep=0 |
| **12** | **DONE** | Feature ready for code review | All gates pass |

---

## Commit Convention

```
feat(advertising): Phase N - <description> [verify: tsc✓ build✓ docker✓ curl✓]
```

Each phase = 1 PR. CI enforces: `tsc --noEmit` → 0 errors, `npm run build` → success.

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Backend endpoints not ready | Use `coreApiAdapter` mock mode; contract test against OpenAPI spec |
| TanStack Table + createElement complexity | Keep column defs in separate `campaignColumns.js` |
| Recharts SSR issues | Lazy-load chart component with `React.lazy` + Suspense |
| CASL rules mismatch with backend | Log `ability.rules` in dev mode, validate against backend `_build_abilities()` |
