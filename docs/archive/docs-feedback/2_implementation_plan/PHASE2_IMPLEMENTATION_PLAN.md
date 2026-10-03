# Phase 2 Implementation Plan: Stripe Billing & Usage History Charts

**Project:** VNInvest Workspace  
**Author:** Antigravity (Advanced Agentic Coding Agent)  
**Date:** 2026-06-16  
**Status:** Ready for Implementation  

---

## Overview

Phase 2 focuses on two major features:
1. **Stripe Billing Portal Integration** - Global payment support alongside VNPay
2. **Usage History Charts** - 30-day historical visualization of API consumption

---

## 1. Backend: Stripe Billing Portal Integration (Priority: P2)

### 1.1 Add Stripe Dependencies & Configuration
- **Files:** `requirements.txt`, `packages/core/backend/src/config/settings.py`, `.env.example`
- **Action:** Add `stripe` Python package, configure Stripe keys, webhook secret, price ID mapping

### 1.2 Create Stripe Service Layer
- **File:** `packages/core/backend/src/billing/stripe_service.py`
- **Action:** Encapsulate Stripe API calls (Customer, Checkout Session, Portal Session, Webhook verification)

### 1.3 Extend CoreTenant Model for Stripe
- **Files:** `packages/core/backend/src/identity_access/models.py` + migration
- **Fields to add:**
  - `stripe_customer_id` (CharField, unique, nullable)
  - `stripe_subscription_id` (CharField, nullable)
  - `stripe_price_id` (CharField, nullable)
  - `stripe_current_period_end` (DateTimeField, nullable)

### 1.4 Implement Checkout Session Endpoint
- **Endpoint:** `POST /api/core/v1/partner/billing/stripe/session/`
- **File:** `packages/core/backend/src/billing/views.py`
- **Input:** `{ "price_id": "price_...", "success_url": "...", "cancel_url": "..." }`
- **Output:** `{ "session_id": "...", "url": "https://checkout.stripe.com/..." }`
- **Logic:** Get/create Stripe Customer → Create Checkout Session for subscription

### 1.5 Implement Customer Portal Session Endpoint
- **Endpoint:** `POST /api/core/v1/partner/billing/stripe/portal/`
- **File:** `packages/core/backend/src/billing/views.py`
- **Input:** `{ "return_url": "..." }`
- **Output:** `{ "url": "https://billing.stripe.com/..." }`
- **Logic:** Create Billing Portal Session for existing Stripe Customer

### 1.6 Implement Stripe Webhook Handler
- **Endpoint:** `POST /api/core/v1/billing/stripe/webhook/`
- **File:** `packages/core/backend/src/billing/webhooks.py`
- **Events to handle:**
  - `customer.subscription.created` / `updated` / `deleted`
  - `invoice.payment_succeeded` / `payment_failed`
  - `customer.subscription.trial_will_end`
- **Logic:** Verify signature → Update `CoreTenant` fields → Sync plan/status

### 1.7 Unit Tests for Stripe Flows
- **File:** `packages/core/backend/tests/test_stripe_billing.py`
- **Coverage:** Checkout session creation, portal session, webhook signature verification, tenant sync

---

## 2. Frontend: Stripe Integration in Billing Page (Priority: P2)

### 2.1 Add "Upgrade Plan" Button
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.js`
- **Action:** Call `/partner/billing/stripe/session/` → Redirect to `session.url`

### 2.2 Add "Manage Billing" Button
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.js`
- **Action:** Call `/partner/billing/stripe/portal/` → Redirect to `portal.url`

### 2.3 Display Stripe Subscription Status
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.js`
- **Action:** Show current plan, billing cycle, next invoice date from Stripe-synced fields

---

## 3. Backend: Usage History API (Priority: P2)

### 3.1 Create QuotaHistory Model
- **Files:** `packages/core/backend/src/ops_audit/models.py` + migration
- **Model:** `QuotaHistory(tenant, meter_code, date, consumed_amount, entitled_amount)`
- **Index:** Composite index on `(tenant, meter_code, date)`

### 3.2 Daily Snapshot Background Job
- **File:** `packages/core/backend/src/ops_audit/tasks.py`
- **Schedule:** Celery Beat - daily at 00:05 UTC
- **Logic:** For each active tenant + meter, snapshot current `consumed_amount` into `QuotaHistory`

### 3.3 Implement History Endpoint
- **Endpoint:** `GET /api/core/v1/partner/usage/history/?meter_code=&days=30`
- **File:** `packages/core/backend/src/ops_audit/views.py`
- **Response:** `{ "meter_code": "...", "history": [{ "date": "2026-06-01", "consumed": 1234, "entitled": 10000 }, ...] }`
- **Pagination:** Cursor-based (consistent with audit logs)

### 3.4 Unit Tests for History Endpoint
- **File:** `packages/core/backend/tests/test_usage_history.py`
- **Coverage:** Filter by meter_code, date range, pagination, empty states

---

## 4. Frontend: Usage History Charts (Priority: P2)

### 4.1 Add Recharts Dependency
- **File:** `packages/web/package.json`
- **Action:** `npm install recharts`

### 4.2 Create UsageHistoryChart Component
- **File:** `packages/web/src/components/UsageHistoryChart.js`
- **Features:**
  - Area chart (primary) + Bar chart (toggle)
  - 30-day X-axis (date labels)
  - Y-axis: consumed amount
  - Tooltip with date, consumed, entitled, % used
  - Risk color coding (green/yellow/red zones)
  - Responsive, dark mode compatible
  - Loading & empty states

### 4.3 Integrate Chart into Usage Page
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.js`
- **Action:** For each meter, fetch history → render `UsageHistoryChart` in expandable panel

---

## Implementation Order (4 Weeks)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| **1** | 1.1 → 1.2 → 1.3 → 1.4 → 1.5 | Stripe Checkout & Portal APIs working |
| **2** | 1.6 → 1.7 → 2.1 → 2.2 → 2.3 | Webhook sync + Frontend Stripe buttons |
| **3** | 3.1 → 3.2 → 3.3 → 3.4 | Usage History API + daily snapshots |
| **4** | 4.1 → 4.2 → 4.3 | Recharts integration + visual polish |

---

## Environment Variables Required

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# Frontend (Vite)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Quality Gates

- Backend test coverage ≥ 85% for new billing/usage modules
- Frontend: No TypeScript/ESLint errors, production build succeeds
- Stripe webhook: Signature verification mandatory, idempotency handled
- Charts: Accessible (ARIA labels), responsive down to 320px

---

## Notes

- **Checkbox Policies** (Phase 2 item in master plan) → **Already completed in Phase 1** ✅
- **VNPay** remains as domestic payment option; Stripe adds international
- **QuotaHistory** is separate from real-time `QuotaRecord` - allows historical trends without impacting live metering performance