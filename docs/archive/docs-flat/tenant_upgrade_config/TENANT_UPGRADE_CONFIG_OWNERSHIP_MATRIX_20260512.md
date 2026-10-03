# CONFIG OWNERSHIP MATRIX — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## 1. Django Settings

| Config Key | File | Default Value | Owner | Changed By | Notes |
|---|---|---|---|---|---|
| `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` | `vninvest_core/settings.py` | `[IsAuthenticated]` | Tech Lead | TENANT-T03 | Thêm `IsTenantActive` |
| `MIDDLEWARE` (TenantQuotaMiddleware) | `vninvest_core/settings.py` | Không có | Tech Lead | TENANT-T04 | Vị trí: sau `AuthenticationMiddleware` |
| `INSTALLED_APPS` (tenant_lifecycle) | `vninvest_core/settings.py` | Không có | Tech Lead | TENANT-T06 | Thêm `'tenant_lifecycle'` |
| `CELERY_BEAT_SCHEDULE` (quota flush) | `settings.py` / `celery_app.py` | Không có | Backend Dev | TENANT-T05 | Schedule 60s |
| `CELERY_BEAT_SCHEDULE` (monthly invoices) | `settings.py` / `celery_app.py` | Không có | Backend Dev | TENANT-T05 | 1st of month 00:05 |
| `CELERY_BEAT_SCHEDULE` (lifecycle tasks) | `settings.py` / `celery_app.py` | Không có | Backend Dev | TENANT-T06 | 4 tasks |
| `CACHES` (Redis backend) | `vninvest_core/settings.py` | Đã có | Infra | Không đổi | Phải dùng Redis, không phải LocMemCache |

---

## 2. Environment Variables

| Variable | Required By | Default / Example | Secret? | Owner | Notes |
|---|---|---|---|---|---|
| `REDIS_URL` | TenantQuotaMiddleware | `redis://redis:6379/0` | No | Infra | Phải là Redis thật trong production |
| `CELERY_BROKER_URL` | Celery tasks | `redis://redis:6379/1` | No | Infra | Đã có, không đổi |
| `DJANGO_SECRET_KEY` | PAT HMAC pepper | N/A | **Yes** | Infra | Phải là random 50+ char string |
| `PAT_HMAC_PEPPER` | `_hash_pat_secret()` | N/A | **Yes** | Infra | Giá trị riêng, không dùng SECRET_KEY |
| `DEFAULT_TRIAL_DAYS` | T08 onboarding view | `14` | No | Product | Có thể override để test |
| `QUOTA_SUSPEND_AFTER_OVERDUE_DAYS` | T05 check_overdue | `7` | No | Product | Số ngày invoice overdue trước khi suspend |

---

## 3. Database Tables (new tables)

| Table | Created By | Migration | Owner | Notes |
|---|---|---|---|---|
| `identity_access_tenantmember` | TENANT-T09 | `identity_access/migrations/000X_tenantmember.py` | Backend Dev | additive, nullable FK |
| `identity_access_tenantinvite` | TENANT-T09 | same migration | Backend Dev | additive |
| `tenant_lifecycle_event` | TENANT-T06 | `tenant_lifecycle/migrations/0001_initial.py` | Backend Dev | append-only |

---

## 4. Redis Keys

| Key Pattern | Used By | TTL | Owner | Notes |
|---|---|---|---|---|
| `quota:api_calls:{tenant_public_id}:{date}` | TenantQuotaMiddleware | 48 hours | T04 | INCR counter |
| `quota:warning_sent:{tenant_id}:{date}:{percent}` | commercial/tasks.py | 25 hours | T05 | Dedup key |
| `tenant_lifecycle:trial_warn:{tenant_id}:{days}` | tenant_lifecycle/tasks.py | 48 hours | T06 | Dedup warning |

---

## 5. URL Routes (new routes)

| Route | View | Method | Auth | Added By |
|---|---|---|---|---|
| `/api/core/v1/operator/tenants/{id}/` | `operator_tenant_update_api` | PATCH | IsAdminUser | T07 |
| `/api/core/v1/operator/tenants/{id}/suspend/` | `operator_tenant_suspend_api` | POST | IsAdminUser | T07 |
| `/api/core/v1/operator/tenants/{id}/activate/` | `operator_tenant_activate_api` | POST | IsAdminUser | T07 |
| `/api/core/v1/operator/tenants/{id}/change-plan/` | `operator_tenant_change_plan_api` | POST | IsAdminUser | T07 |
| `/api/core/v1/operator/tenants/` | `operator_tenant_provision_api` | POST | IsAdminUser | T07 |
| `/api/core/v1/operator/tenants/{id}/lifecycle-events/` | `operator_tenant_lifecycle_events_api` | GET | IsAdminUser | T11 |
| `/api/core/v1/onboarding/register/` | `RegisterTenantView` | POST | IsAuthenticated | T08 |
| `/api/core/v1/members/` | `TenantMemberListView` | GET | IsAuthenticated + IsTenantActive | T09 |
| `/api/core/v1/members/invite/` | `TenantInviteCreateView` | POST | IsAuthenticated + IsTenantActive | T09 |
| `/api/core/v1/members/{user_id}/` | `TenantMemberDeleteView` | DELETE | IsAuthenticated + IsTenantActive | T09 |
| `/api/core/v1/invites/accept/` | `TenantInviteAcceptView` | GET | AllowAny | T09 |

---

## 6. Celery Task Registry

| Task Name | Module | Schedule | Retry | Owner |
|---|---|---|---|---|
| `commercial.flush_quota_counters` | `commercial/tasks.py` | Every 60s | max_retries=3 | Backend Dev |
| `commercial.generate_monthly_invoices` | `commercial/tasks.py` | 1st of month 00:05 | max_retries=2 | Backend Dev |
| `commercial.check_overdue_invoices` | `commercial/tasks.py` | Daily 08:00 | max_retries=2 | Backend Dev |
| `commercial.send_quota_warning` | `commercial/tasks.py` | Ad-hoc | max_retries=3 | Backend Dev |
| `tenant_lifecycle.auto_expire_trials` | `tenant_lifecycle/tasks.py` | Daily 01:00 | max_retries=2 | Backend Dev |
| `tenant_lifecycle.auto_suspend_quota_overflow` | `tenant_lifecycle/tasks.py` | Every 1h | max_retries=2 | Backend Dev |
| `tenant_lifecycle.send_trial_expiry_warning` | `tenant_lifecycle/tasks.py` | Daily 09:00 | max_retries=3 | Backend Dev |
| `tenant_lifecycle.auto_deprovision_stale` | `tenant_lifecycle/tasks.py` | Weekly Sun 02:00 | max_retries=2 | Backend Dev |

---

## 7. Permissions Ownership

| Permission Class | File | Applied To | Override? | Owner |
|---|---|---|---|---|
| `IsAuthenticated` | DRF built-in | DEFAULT_PERMISSION_CLASSES | `AllowAny` per-view | DRF |
| `IsTenantActive` | `identity_access/permissions.py` | DEFAULT_PERMISSION_CLASSES | `AllowAny` per-view | TENANT-T03 |
| `IsAdminUser` | DRF built-in | Operator endpoints only | — | DRF |

---

## 8. Responsibility Matrix (RACI)

| Component | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|---|---|---|---|---|
| T01 SSOT migration | Backend Dev | Tech Lead | — | Team |
| T02 ORM refactor | Backend Dev | Tech Lead | — | Team |
| T03 IsTenantActive | Backend Dev | Tech Lead | Security | Team |
| T04 Quota middleware | Backend Dev | Tech Lead | Infra | Team |
| T05 Commercial tasks | Backend Dev | Tech Lead | Product | Team |
| T06 tenant_lifecycle app | Backend Dev | Tech Lead | — | Team |
| T07 Operator write API | Backend Dev | Tech Lead | Product | Ops |
| T08 Onboarding | Backend Dev | Product | — | Marketing |
| T09 Multi-member | Backend Dev | Tech Lead | Product | Team |
| T10 Data isolation | Backend Dev | Tech Lead | DBA | Team |
| T11 Audit trail | Backend Dev | Tech Lead | Compliance | Team |
| Redis config | Infra | Infra Lead | Backend Dev | — |
| Env vars (secrets) | Infra | Infra Lead | Tech Lead | — |
