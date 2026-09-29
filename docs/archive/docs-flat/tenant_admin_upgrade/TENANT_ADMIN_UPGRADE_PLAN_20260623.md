b# Kế Hoạch Nâng Cấp Toàn Diện Trang Tenant Admin

> **Ngày:** 2026-06-23
> **Phiên bản:** 1.0
> **Trạng thái:** Đã phê duyệt — chờ implement Phase 0

---

## 1. Tổng Quan

Tài liệu này đề xuất kế hoạch nâng cấp trang `tenant-admin/home` và toàn bộ khu vực Tenant Admin từ trạng thái hiện tại (các trang thông tin tĩnh, CRUD cơ bản) thành một **command center quản trị đầy đủ** với monitoring, analytics, forecasting, security và lifecycle automation.

### 1.1 Phạm vi

- **Frontend:** `packages/web/src/pages/tenant-admin/*` (9 pages hiện tại + pages mới)
- **Backend API:** `packages/core/backend/src/identity_access/*` + `commercial/*`
- **Shared components:** `packages/web/src/components/ShellPageTemplate.js`
- **Adapter layer:** `packages/web/src/adapters/core/*`

### 1.2 Mục tiêu

| KPI                        | Hiện tại      | Mục tiêu                                  |
| -------------------------- | ------------- | ----------------------------------------- |
| Số lượng dashboard widgets | 4 metric text | 8+ widgets (chart, activity, health)      |
| Usage history              | Không có      | 7d/30d/90d trend charts                   |
| Forecasting                | Không có      | Projected exhaustion date                 |
| Real-time monitoring       | Không có      | SSE-polled activity feed                  |
| Security dashboard         | Không có      | Login activity, sessions, IP allowlisting |
| Lifecycle automation       | Thủ công      | Trial reminders, upgrade flow, webhooks   |

---

## 2. Hiện Trạng

### 2.1 Frontend Pages

| Page                 | Route                            | Chức năng                                            | API Endpoint(s)                                | Tình trạng       |
| -------------------- | -------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | ---------------- |
| **Home**             | `/tenant-admin/`                 | 4 metric cards, identity card, quota card, nav links | `GET /partner/tenant/`                         | 🟡 Minimal       |
| **Members**          | `/tenant-admin/members`          | Member list + invite CRUD + remove                   | `/tenant-members/`, `/tenant-members/invites/` | 🟢 Đầy đủ CRUD   |
| **Service Accounts** | `/tenant-admin/service-accounts` | SA list + create/edit/delete                         | `/partner/service-accounts/`                   | 🟢 Đầy đủ        |
| **PATs**             | `/tenant-admin/pats`             | PAT list + issue/rotate/revoke CIDR                  | `/partner/pats/` + issue/rotate/revoke         | 🟢 Đầy đủ        |
| **Usage**            | `/tenant-admin/usage`            | Meters + quotas progress bars, risk state            | `/partner/usage/meters/`, `/quotas/`           | 🟡 Snapshot tĩnh |
| **Billing**          | `/tenant-admin/billing`          | Subscription info + invoice list                     | `/partner/billing/subscription/`, `/invoices/` | 🟡 Read-only     |
| **Capabilities**     | `/tenant-admin/capabilities`     | Abilities + quota caps list                          | (từ context)                                   | 🟡 Flat list     |
| **Audit Logs**       | `/tenant-admin/audit-logs`       | Cursor-paginated event log                           | `/partner/audit-logs/`                         | 🟢 OK            |
| **SSO**              | `/tenant-admin/sso`              | SAML config (idP URL, cert)                          | `/partner/sso/`                                | 🟢 OK            |

### 2.2 Backend Models

| Model                | Key Fields                                                                  | Usage                       |
| -------------------- | --------------------------------------------------------------------------- | --------------------------- |
| `CoreTenant`         | plan, status, features, billing dates, trial_ends_at                        | Tenant identity + lifecycle |
| `CoreServiceAccount` | name, scopes, status                                                        | Service identity            |
| `CorePATCredential`  | token_prefix, scopes, status, expires_at, last_used_at, allowed_cidr_blocks | API keys                    |
| `UserProfile`        | language, theme, preferences                                                | User preferences            |
| `TenantMember`       | user, tenant, role                                                          | Member management           |
| `TenantInvite`       | email, token, role, status, expires_at                                      | Invitations                 |
| `TenantSSOConfig`    | idp config, domain_hint, cert                                               | SSO                         |

### 2.3 Backend API Endpoints Existing

Tất cả endpoints dưới prefix `/core/v1/`:

| Method                | Path                              | View                               | Permission                          |
| --------------------- | --------------------------------- | ---------------------------------- | ----------------------------------- |
| GET/PATCH             | `tenant`                          | `TenantDetailView`                 | `manage_tenant`, owner/admin        |
| GET                   | `tenant/lifecycle`                | `TenantLifecycleView`              | `IsAuthenticated`                   |
| GET/POST              | `service-accounts`                | `ServiceAccountListView`           | `manage_service_accounts`           |
| GET/PUT/PATCH/DELETE  | `service-accounts/<id>`           | `ServiceAccountDetailView`         | `manage_service_accounts`           |
| GET                   | `pat`                             | `PATListView`                      | `manage_pats`                       |
| POST                  | `service-accounts/<id>/pat/issue` | `issue_pat`                        | `manage_pats`                       |
| GET/POST              | `tenant-members/invites`          | `TenantInvitesCombinedView`        | `manage_tenant`                     |
| DELETE                | `tenant-members/<member_id>`      | `TenantMemberRemoveView`           | `manage_tenant`                     |
| GET                   | `tenant-members`                  | `TenantMemberListView`             | `manage_tenant`                     |
| GET/POST/PATCH/DELETE | `partner/*`                       | Multiple partner views             | partner scopes                      |
| GET                   | `partner/usage/meters`            | `PartnerUsageMetersView`           | `manage_tenant`                     |
| GET                   | `partner/usage/quotas`            | `PartnerUsageQuotasView`           | `manage_tenant`                     |
| GET                   | `partner/usage/history`           | `PartnerUsageHistoryView`          | `manage_tenant`                     |
| GET                   | `partner/billing/subscription`    | `PartnerBillingSubscriptionView`   | `manage_tenant`                     |
| GET                   | `partner/billing/invoices`        | `PartnerBillingInvoicesView`       | `manage_tenant`                     |
| POST                  | `partner/billing/stripe/session`  | `PartnerStripeCheckoutSessionView` | `manage_tenant`                     |
| POST                  | `partner/billing/stripe/portal`   | `PartnerStripePortalSessionView`   | `manage_tenant`                     |
| GET                   | `partner/audit-logs`              | `PartnerAuditLogsView`             | `IsAuthenticated`, `IsTenantActive` |
| GET/POST              | `partner/sso`                     | `PartnerSSOConfigView`             | `manage_tenant`                     |
| GET/POST              | `partner/service-accounts`        | `ServiceAccountListView`           | `manage_service_accounts`           |
| GET                   | `partner/pats`                    | `PATListView`                      | `manage_pats`                       |
| POST                  | `partner/pats/issue`              | `partner_issue_pat`                | `manage_pats`                       |
| POST                  | `partner/pats/<id>/rotate`        | `partner_rotate_pat`               | `manage_pats`                       |
| POST                  | `partner/pats/<id>/revoke`        | `partner_revoke_pat`               | `manage_pats`                       |

### 2.4 Tenant Admin Abilities (từ `_build_abilities`)

Tất cả plan đều có:

- `read TenantAdminHome`, `read TenantCapabilityView`, `read TenantUsageView`, `read TenantBillingView`, `read TenantMemberAdmin`
- `read TenantServiceAccountAdmin`, `read TenantPATAdmin`

---

## 3. Gap Analysis vs Commercial Benchmarks

| Tính năng                                 | Stripe | Grafana | GitHub | AWS | **VNInvest Hiện tại** |
| ----------------------------------------- | ------ | ------- | ------ | --- | --------------------- |
| **Dashboard metrics với sparkline**       | ✅     | ✅      | ✅     | ✅  | ❌                    |
| **Usage history chart (7d/30d/90d)**      | ✅     | ✅      | ✅     | ✅  | ❌                    |
| **Forecasting (dùng hết quota khi nào)**  | ✅     | ❌      | ❌     | ❌  | ❌                    |
| **Activity feed realtime**                | ✅     | ✅      | ✅     | ✅  | ❌                    |
| **Member activity (last active)**         | ✅     | ✅      | ✅     | ✅  | ❌                    |
| **Alerting/threshold config**             | ✅     | ✅      | ❌     | ✅  | ❌                    |
| **Billing tự phục vụ**                    | ✅     | ❌      | ✅     | ✅  | 🟡 Stripe redirect    |
| **Report export/schedule**                | ✅     | ✅      | ✅     | ✅  | ❌                    |
| **Security dashboard (sessions, IPs)**    | ✅     | ✅      | ❌     | ✅  | ❌                    |
| **Webhook management**                    | ✅     | ✅      | ❌     | ❌  | ❌                    |
| **Lifecycle workflow (trial→paid→churn)** | ✅     | ❌      | ✅     | ✅  | ❌                    |
| **Custom roles**                          | 🟡     | ✅      | ✅     | ✅  | ❌                    |

---

## 4. Kiến Trúc Đề Xuất

### 4.1 Tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                    Tenant Admin SPA                      │
├─────────────────────────────────────────────────────────┤
│  ShellPageChrome (hero + metrics + banner)              │
├─────────┬──────────┬──────────┬──────────┬──────────────┤
│  Home   │ Members  │   PATs   │  Usage   │   Billing    │
│  (P0)   │  (done)  │  (done)  │ (P1+P2)  │   (P2+P4)    │
├─────────┼──────────┼──────────┼──────────┼──────────────┤
│  Audit  │   SSO    │ Security │ Webhooks │ Capabilities │
│  (P1)   │  (done)  │   (P3)   │   (P4)   │    (done)    │
└─────────┴──────────┴──────────┴──────────┴──────────────┘
                             ▲
                    coreApiAdapter (SSOT)
                             │
                    ┌────────┴────────┐
                    │                 │
              identity_access    commercial
              (tenant CRUD,     (usage, billing,
               members, PATs,    quotas, Stripe,
               SA, SSO, audit)   VNPay)
```

### 4.2 Data Flow cho Dashboard Home

```
TenantAdminHomePage
  ├── GET /partner/dashboard/summary/      ← composite payload
  │     ├── health_score (từ API success rate + quota headroom + member activity)
  │     ├── members_active_today / total
  │     ├── api_calls_today / limit
  │     ├── quota_headroom_pct
  │     ├── plan_status + trial_remaining_days
  │     ├── service_accounts (active/disabled)
  │     ├── pats_expiring_soon (count)
  │     └── recent_events (last 10 audit log entries)
  │
  ├── GET /partner/dashboard/usage-trend/?days=7
  │     └── daily: [{date, api_calls, active_members, alerts_generated}]
  │
  └── WebSocket/SSE: /partner/dashboard/events/stream
        └── real-time push: member.joined, pat.issued, quota.warning
```

---

## 5. Kế Hoạch Chi Tiết Theo Phase

### Phase 0 — Dashboard Home Redesign (Tuần 1-2, ~40h)

#### 5.1 Mục tiêu

Biến trang chủ từ 4 metric text + nav links thành **command center**:

```
┌─────────────────────────────────────────────────────────────┐
│  [Tenant Health: 92%] [Active Today: 3] [API Calls: 1,452] │
│  [Quota: 71% ███████░░░] [Plan: Pro] [Trial: —]             │
├─────────────────────────────────────────────────────────────┤
│  Usage Trend (7 days)                     ┌───────────────┐│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │ Quick Actions ││
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │ ───────────── ││
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │ + Invite      ││
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │ + Issue PAT   ││
│  M  T  W  T  F  S  S                     │ + Billing     ││
├──────────────────────────────────────────┤ + SSO Config  ││
│  Recent Activity                         └───────────────┘│
│  🔑 PAT issued by admin (2 min ago)                        │
│  👤 member@email.com joined (1 hour ago)                   │
│  ⚙️ SA "prod-bot" created (3 hours ago)                    │
│  🚨 Quota warning: API calls at 80% (5 hours ago)          │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 Backend — New Endpoints

##### `GET /partner/dashboard/summary/`

```python
# views_dashboard.py
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsTenantActive])
@require_human_session
def partner_dashboard_summary(request):
    tenant = _get_request_tenant(request)
    today = date.today()

    # 1. Health score — composite
    api_calls_today = QuotaRecord.objects.filter(
        tenant=tenant, meter_code='api_calls', date=today
    ).aggregate(total=Sum('consumed'))['total'] or 0
    api_calls_limit = UsageMeter.objects.get_or_none(
        tenant=tenant, meter_code='api_calls'
    )?.entitled_amount or 5000
    api_headroom = max(0, 100 - int((api_calls_today / max(api_calls_limit, 1)) * 100))

    members_active_today = TenantMember.objects.filter(
        tenant=tenant, user__last_login__date=today
    ).count()
    members_total = TenantMember.objects.filter(tenant=tenant).count()
    member_activity_pct = int((members_active_today / max(members_total, 1)) * 100) if members_total > 0 else 100

    health_score = int((api_headroom * 0.4) + (member_activity_pct * 0.3) + 30)

    # 2. Service account stats
    sa_active = CoreServiceAccount.objects.filter(tenant=tenant, status='active').count()
    sa_disabled = CoreServiceAccount.objects.filter(tenant=tenant, status='disabled').count()

    # 3. PATs expiring within 7 days
    pats_expiring = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status='active',
        expires_at__lte=now() + timedelta(days=7),
        expires_at__gte=now(),
    ).count()

    # 4. Recent events (last 10)
    recent_events = list(TenantLifecycleEvent.objects.filter(
        tenant=tenant
    ).order_by('-created_at')[:10].values(
        'event_type', 'created_at', 'actor__username', 'description'
    ))

    return Response({
        'health_score': health_score,
        'members_active_today': members_active_today,
        'members_total': members_total,
        'api_calls_today': api_calls_today,
        'api_calls_limit': api_calls_limit,
        'quota_headroom_pct': api_headroom,
        'plan': tenant.plan,
        'plan_status': tenant.status,
        'trial_remaining_days': (
            (tenant.trial_ends_at - date.today()).days
            if tenant.trial_ends_at and tenant.status == 'trial' else None
        ),
        'service_accounts': {'active': sa_active, 'disabled': sa_disabled},
        'pats_expiring_soon': pats_expiring,
        'recent_events': recent_events,
    })
```

##### `GET /partner/dashboard/usage-trend/?days=7`

```python
def partner_dashboard_usage_trend(request):
    tenant = _get_request_tenant(request)
    days = min(int(request.GET.get('days', 7)), 90)
    start = date.today() - timedelta(days=days - 1)

    daily = []
    for d in (start + timedelta(n) for n in range(days)):
        q = QuotaRecord.objects.filter(tenant=tenant, date=d)
        daily.append({
            'date': d.isoformat(),
            'api_calls': q.filter(meter_code='api_calls').aggregate(s=Sum('consumed'))['s'] or 0,
            'active_members': TenantMember.objects.filter(
                tenant=tenant, user__last_login__date=d
            ).count(),
        })

    return Response({'daily': daily, 'days': days})
```

#### 5.3 Frontend — New Components

| Component         | File                                   | Purpose                      |
| ----------------- | -------------------------------------- | ---------------------------- |
| `DashboardKpiRow` | inline trong `TenantAdminHomePage.tsx` | Hero KPI cards với sparkline |
| `UsageTrendChart` | inline                                 | Recharts area chart          |
| `ActivityFeed`    | inline                                 | Recent events list           |
| `QuickActionGrid` | inline                                 | Quick action buttons         |

#### 5.4 Frontend — Data Layer

```javascript
// packages/web/src/adapters/core/operator.js (add)
getDashboardSummary() {
  return coreGet('/partner/dashboard/summary/');
},
getUsageTrend(days = 7) {
  return coreGet(`/partner/dashboard/usage-trend/?days=${days}`);
},
```

#### 5.5 Files Changed

```
Modified:
  packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx    ← full rewrite
  packages/web/src/adapters/core/operator.js                     ← new methods
  packages/web/src/adapters/coreApiAdapter.js                    ← wire new methods

New:
  packages/core/backend/src/identity_access/views_dashboard.py   ← dashboard views
  packages/core/backend/src/identity_access/urls.py              ← register routes
```

#### 5.6 Dependencies

- `recharts` hoặc `chart.js` npm package cho chart
- `date-fns` nếu chưa có

---

### Phase 1 — Monitoring & Activity (Tuần 3-4, ~50h)

#### 6.1 Mục tiêu

Thêm real-time monitoring, activity visualization, configurable alert thresholds.

#### 6.2 Backend

##### New Endpoints

| Method | Path                                                 | Purpose                             |
| ------ | ---------------------------------------------------- | ----------------------------------- |
| GET    | `/partner/usage/trend/?meter_code=api_calls&days=90` | Per-meter daily consumption history |
| GET    | `/partner/usage/alert-config/`                       | Current threshold preferences       |
| PATCH  | `/partner/usage/alert-config/`                       | Update thresholds                   |
| GET    | `/partner/usage/forecast/?meter_code=api_calls`      | Projected exhaustion date           |

##### New Model

```python
class UsageAlertConfig(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE)
    meter_code = models.CharField(max_length=64)
    warning_pct = models.IntegerField(default=80)
    critical_pct = models.IntegerField(default=95)
    enabled = models.BooleanField(default=True)
    notify_email = models.BooleanField(default=True)
```

#### 6.3 Frontend

- `TenantAdminUsagePage.tsx`: thêm tab "History" với trend chart
- `TenantAdminAuditLogsPage.tsx`: thêm calendar heatmap, event pie chart
- Filter improvements: event_type, date range, actor

---

### Phase 2 — Analytics & Forecasting (Tuần 5-6, ~60h)

#### 7.1 Mục tiêu

Usage forecasting, scheduled reports, cost analytics.

#### 7.2 Backend

##### New Endpoints

| Method | Path                                              | Purpose                 |
| ------ | ------------------------------------------------- | ----------------------- |
| GET    | `/partner/reports/forecast/?meter_code=api_calls` | Exhaustion forecast     |
| POST   | `/partner/reports/schedule/`                      | Create scheduled report |
| GET    | `/partner/reports/`                               | List scheduled reports  |
| DELETE | `/partner/reports/<id>/`                          | Remove scheduled report |
| GET    | `/partner/billing/cost-trend/?months=6`           | Monthly cost history    |

##### Forecast Logic

```python
def forecast_exhaustion(tenant, meter_code):
    records = QuotaRecord.objects.filter(
        tenant=tenant, meter_code=meter_code
    ).order_by('-date')[:30]  # last 30 days

    if len(records) < 7:
        return None  # insufficient data

    daily_rates = [r.consumed for r in records]
    avg_daily = sum(daily_rates) / len(daily_rates)

    meter = UsageMeter.objects.get(tenant=tenant, meter_code=meter_code)
    remaining = meter.entitled_amount - meter.consumed_amount

    if avg_daily <= 0:
        return {'days_remaining': None, 'forecast_exhaust_date': None}

    days_remaining = int(remaining / avg_daily)
    return {
        'daily_rate': round(avg_daily, 1),
        'days_remaining': days_remaining,
        'forecast_exhaust_date': (date.today() + timedelta(days=days_remaining)).isoformat(),
        'confidence': 'high' if len(records) >= 21 else ('medium' if len(records) >= 14 else 'low'),
    }
```

#### 7.3 Frontend

- `TenantAdminBillingPage.tsx`: cost trend bar chart (monthly)
- `TenantAdminUsagePage.tsx`: projection banner trên mỗi meter ("At current rate, you'll exhaust in 12 days")
- `TenantAdminHomePage.tsx`: add forecasting alert in hero section

---

### Phase 3 — Security & Compliance (Tuần 7-8, ~40h)

#### 8.1 Mục tiêu

Security dashboard với login activity, session management, IP allowlisting UI.

#### 8.2 Backend

##### New Endpoints

| Method | Path                                         | Purpose                        |
| ------ | -------------------------------------------- | ------------------------------ |
| GET    | `/partner/security/login-activity/?days=30`  | Login history (success + fail) |
| GET    | `/partner/security/sessions/`                | Active human sessions          |
| POST   | `/partner/security/sessions/<pat_id>/revoke` | Revoke active session          |

##### New Model

```python
class LoginAttempt(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, null=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    username = models.CharField(max_length=150)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    success = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
```

#### 8.3 Frontend

- **New** `TenantAdminSecurityPage.tsx`:
  - Login activity chart (success vs fail over time)
  - Active sessions table with revoke button
  - Failed attempts geo heatmap (IP → city)
- `TenantAdminPATsPage.tsx`: thêm "Last Used" column, "Unused > 90 days" filter

---

### Phase 4 — Lifecycle Automation (Tuần 9-10, ~60h)

#### 9.1 Mục tiêu

Trial management, in-app upgrade, webhook events, deprovisioning.

#### 9.2 Backend

##### New Endpoints

| Method   | Path                                 | Purpose                 |
| -------- | ------------------------------------ | ----------------------- |
| GET/POST | `/partner/webhooks/`                 | Webhook CRUD            |
| GET      | `/partner/webhooks/<id>/deliveries/` | Delivery log            |
| POST     | `/partner/webhooks/<id>/test/`       | Test webhook            |
| POST     | `/partner/subscription/change-plan/` | In-app plan change      |
| POST     | `/partner/tenant/deactivate/`        | Initiate deprovisioning |

##### New Model

```python
class TenantWebhookConfig(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE)
    url = models.URLField()
    secret = models.CharField(max_length=64)  # HMAC signing
    events = models.JSONField()  # ['member.joined', 'pat.revoked', ...]
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class WebhookDelivery(models.Model):
    config = models.ForeignKey(TenantWebhookConfig, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=64)
    payload = models.JSONField()
    status = models.CharField(max_length=16)  # success, failed, retrying
    response_code = models.IntegerField(null=True)
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### 9.3 Frontend

- **New** `TenantAdminWebhooksPage.tsx`:
  - Webhook list + create/edit form
  - Delivery log with retry button
  - Event type checkboxes
- `TenantAdminBillingPage.tsx`: upgrade UI (plan comparison table, upgrade button thay vì Stripe redirect)

---

## 6. File Manifest (Toàn Bộ)

### Modified Files

| File                                                               | Phase | What                                     |
| ------------------------------------------------------------------ | ----- | ---------------------------------------- |
| `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx`      | P0    | 🟢 Full rewrite                          |
| `packages/web/src/adapters/core/operator.js`                       | P0-P4 | Add dashboard, security, webhook methods |
| `packages/web/src/adapters/coreApiAdapter.js`                      | P0-P4 | Wire new clients                         |
| `packages/core/backend/src/identity_access/urls.py`                | P0-P4 | Register new routes                      |
| `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx`     | P1-P2 | Add history tab, chart, forecast         |
| `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx`   | P2-P4 | Add cost chart, upgrade UI               |
| `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | P1    | Add heatmap, event breakdown             |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx`      | P3    | Add last used, unused filter             |
| `packages/web/src/pages/pageRegistry.js`                           | P3-P4 | Register new pages                       |

### New Files

| File                                                              | Phase | What                            |
| ----------------------------------------------------------------- | ----- | ------------------------------- |
| `packages/core/backend/src/identity_access/views_dashboard.py`    | P0    | Dashboard summary + trend views |
| `packages/core/backend/src/identity_access/views_alert_config.py` | P1    | Alert threshold CRUD            |
| `packages/core/backend/src/identity_access/views_forecast.py`     | P2    | Usage forecasting               |
| `packages/core/backend/src/identity_access/views_webhooks.py`     | P4    | Webhook CRUD + delivery         |
| `packages/core/backend/src/identity_access/views_security.py`     | P3    | Login activity + sessions       |
| `packages/core/backend/src/commercial/views_analytics.py`         | P2    | Cost analytics                  |
| `packages/web/src/pages/tenant-admin/TenantAdminSecurityPage.tsx` | P3    | Security dashboard              |
| `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx` | P4    | Webhook management              |

---

## 7. Roadmap Timeline

```
Tuần 1  2  3  4  5  6  7  8  9  10
├──────────┤
│ Phase 0  │ Dashboard Home Redesign (40h)
│           ├──────────┤
│           │ Phase 1  │ Monitoring & Activity (50h)
│                      ├──────────┤
│                      │ Phase 2  │ Analytics & Forecasting (60h)
│                                 ├──────────┤
│                                 │ Phase 3  │ Security & Compliance (40h)
│                                            ├──────────┤
│                                            │ Phase 4  │ Lifecycle Automation (60h)
```

- **Tổng effort:** ~250 giờ
- **Dependencies:** Không có blocking dependency giữa các phase (có thể chạy song song Phase 1-3 nếu đủ resource)

---

## 8. Rủi Ro & Mitigation

| Rủi ro                                              | Tác động                           | Mitigation                                                                      |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `commercial` app models chưa migrate đầy đủ         | Phase 2 forecast có thể thiếu data | Graceful fallback: "Insufficient data" message; migrate commercial tables first |
| Stripe portal redirect không support in-app upgrade | Phase 4 upgrade UX kém             | Implement Stripe Customer Portal với `return_url` về trang billing              |
| Webhook delivery có thể chậm/retry nhiều            | Phase 4 reliability                | Celery task + exponential backoff + max 5 retries                               |
| Chart library bundle size                           | Page load time                     | Dynamic import chart components, tree-shaking                                   |
| Permission granularity cho custom roles             | Phase 4 scope creep                | Tách thành feature riêng (Phase 5)                                              |

---

## 9. Code Quality Constraints

Tuân thủ các hard constraints hiện tại:

1. **SSOT:** `coreApiAdapter.js` là SSOT duy nhất cho mọi API call — cấm direct fetch
2. **i18n:** Mọi text mới phải qua i18n tiếng Việt đầy đủ dấu
3. **No `except: pass`:** Tuyệt đối cấm trong API view code
4. **Mọi API response** phải dùng khung chuẩn `{detail, code, timestamp, request_id}`
5. **Permission check:** Endpoint tenant-scoped bắt buộc filter tenant ở query layer
6. **No leak:** `_build_abilities` không được leak tenant-only abilities ra ngoài tenant context
7. **Build:** Mọi PR phải pass `npm run build` + type check trước khi merge

---

## 10. Tiến Hành

1. ✅ Phase 0 được chọn làm ưu tiên đầu tiên
2. ⏳ Backend endpoints cho dashboard summary + trend
3. ⏳ Frontend rewrite `TenantAdminHomePage.tsx` với chart + activity + KPI
4. ⏳ Chạy `start_dev.ps1`, smoke test, evidence
