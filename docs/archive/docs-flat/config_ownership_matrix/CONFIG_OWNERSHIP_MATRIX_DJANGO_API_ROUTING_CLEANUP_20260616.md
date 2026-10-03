# Config Ownership Matrix: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Canonical Writer per Concern

| Concern | Current Owner (Writer) | Transition Owner | End-State Owner | Config Location | Notes |
|---------|------------------------|------------------|-----------------|-----------------|-------|
| **Root URL Routing** | Backend Team | Backend Team (Phase 0) | Backend Team | `packages/core/backend/src/vninvest_core/urls.py` | Single source of truth for all mounts |
| **identity_access Routes** | Backend Team | Backend Team (Phase 0) | Backend Team | `packages/core/backend/src/identity_access/urls.py` | Merged from api_urls.py |
| **identity_access Partner Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/identity_access/partner_urls.py` | Unchanged |
| **user_workspace Routes** | Backend Team | Backend Team (Phase 1) | Backend Team | `packages/core/backend/src/user_workspace/urls.py` | Legacy stubs removed |
| **market_data Routes (core)** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/market_data/core_urls.py` | Unchanged |
| **market_data Public Routes** | Backend Team | Product + Backend (Phase 2) | Product Owner | `packages/core/backend/src/market_data/public_urls.py` | Decision pending |
| **market_serving Routes** | Backend Team | Backend Team (Phase 2) | Backend Team | `packages/core/backend/src/market_serving/urls.py` | Added symbol-investigation |
| **signal_intelligence Routes** | Backend Team | Backend Team (Phase 0) | Backend Team | `packages/core/backend/src/signal_intelligence/urls.py` | Unchanged |
| **commercial Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/commercial/urls.py` | Unchanged |
| **commercial Public Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/commercial/public_urls.py` | Unchanged |
| **advisory Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/advisory/urls.py` | Unchanged |
| **ops_audit Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/ops_audit/urls.py` | Unchanged |
| **support Routes** | Backend Team | Backend Team (Phase 0) | Backend Team | `packages/core/backend/src/support/urls.py` | Duplicate mount removed |
| **advertising Routes (operator)** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/advertising/urls.py` | Unchanged |
| **advertising Public Tracking** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/advertising/api_urls.py` | Unchanged |
| **data_ingest Routes** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/data_ingest/urls.py` | Unchanged |
| **Frontend Base URL Config** | Frontend Team | Frontend Team (Phase 1) | Frontend Team | `packages/web/.env.*`, `packages/web/src/config/api.ts` | `REACT_APP_CORE_API_BASE_URL` |
| **Frontend API Adapter** | Frontend Team | Frontend Team (Phase 1) | Frontend Team | `packages/web/src/adapters/coreApiAdapter.ts` | `baseURL` property |
| **Nginx/Ingress Routing** | DevOps | DevOps | DevOps | `infra/nginx/conf.d/` | No change expected |
| **Health Check Endpoints** | Backend Team | Backend Team | Backend Team | `packages/core/backend/src/vninvest_core/views_health.py` | Unchanged |

---

## 2. Transition Ownership Timeline

| Phase | Concern | Transition Owner | Handoff Criteria | End-State Owner |
|-------|---------|------------------|------------------|-----------------|
| **Phase 0** | Root URL Routing (duplicate removal) | Backend Engineer | 4 mounts removed, 2 files deleted, tests pass | Backend Team |
| **Phase 0** | identity_access Routes (merge) | Backend Engineer | All api_urls routes in urls.py, singular+plural mail-config | Backend Team |
| **Phase 0** | signal_intelligence Routes (cleanup) | Backend Engineer | api_urls.py deleted, no references | Backend Team |
| **Phase 0** | support Routes (duplicate removal) | Backend Engineer | Duplicate mount removed | Backend Team |
| **Phase 1** | Frontend Base URL Config | Frontend Engineer | Env var = `/core/v1/`, adapter updated | Frontend Team |
| **Phase 1** | Frontend API Calls (portfolio, auth, partner) | Frontend Engineer | Grep shows zero old paths | Frontend Team |
| **Phase 1** | user_workspace Routes (legacy removal) | Backend Engineer | Legacy stubs + portfolio/* routes removed | Backend Team |
| **Phase 1** | Root URL Routing (user_workspace mount) | Backend Engineer | Mount removed from /api/ | Backend Team |
| **Phase 2** | market_serving Routes (cleanup) | Backend Engineer | api_urls.py deleted, symbol-investigation added | Backend Team |
| **Phase 2** | market_data Public Routes (decision) | Product Owner | Sign-off documented | Product Owner |
| **Phase 2** | Root URL Routing (market_serving/market_data mounts) | Backend Engineer | Mounts removed per decision | Backend Team |
| **Phase 3** | All Concerns (final verification) | QA + Tech Lead | All gates pass, artifacts updated | Respective Teams |

---

## 3. Configuration Drift Prevention

| Config | Drift Risk | Prevention Mechanism | Detection |
|--------|------------|----------------------|-----------|
| `vninvest_core/urls.py` | Accidental re-add of deleted mounts | CI: `grep -c "api_urls\|market_data_api\|support_api" vninvest_core/urls.py` must be 0 | Automated |
| `identity_access/urls.py` | Missing merged routes | CI: Route coverage script validates all expected routes present | Automated |
| `user_workspace/urls.py` | Legacy stubs re-introduced | CI: `grep -c "LegacyWatchlist\|GenericEmpty" user_workspace/urls.py` must be 0 | Automated |
| Frontend `.env` | Base URL reverts to `/api/` | CI: `grep "REACT_APP_CORE_API_BASE_URL" packages/web/.env*` must equal `/core/v1/` | Automated |
| `market_data/public_urls.py` | Unauthorized re-add if removed | CI: File existence check aligned with product decision | Automated |

---

## 4. Secrets & Sensitive Config

| Secret | Current Location | Rotation Policy | Access |
|--------|------------------|-----------------|--------|
| JWT Signing Key | `vninvest_core/settings.py` (env var) | 90 days | Backend Team Lead |
| VNPay Credentials | `commercial/views.py` (env var) | Per vendor | Backend + Commercial Team |
| Database Credentials | `vninvest_core/settings.py` (env var) | 90 days | DevOps |
| Redis Credentials | `vninvest_core/settings.py` (env var) | 90 days | DevOps |

**Note:** This program does not modify any secrets. Listed for completeness.

---

## 5. Environment Parity Matrix

| Config | Local | Staging | Production | Drift Tolerance |
|--------|-------|---------|------------|-----------------|
| `vninvest_core/urls.py` | ✅ | ✅ | ✅ | Zero |
| `identity_access/urls.py` | ✅ | ✅ | ✅ | Zero |
| `user_workspace/urls.py` | ✅ | ✅ | ✅ | Zero |
| `market_data/public_urls.py` | ✅ | ✅ | ✅ | Zero (or file absent) |
| `market_serving/urls.py` | ✅ | ✅ | ✅ | Zero |
| Frontend `.env` | ✅ | ✅ | ✅ | Zero |
| Frontend `api.ts` | ✅ | ✅ | ✅ | Zero |
| Nginx routing | ✅ | ✅ | ✅ | Zero |

---

## 6. Ownership Handoff Checklist (Per Transition)

When ownership transitions, verify:

- [ ] New owner has write access to config files
- [ ] New owner understands constitutional invariants (INV-01 to INV-08)
- [ ] CI drift prevention checks are active and passing
- [ ] Documentation (this matrix) updated with new owner
- [ ] No pending PRs modifying the config without new owner approval
- [ ] Secrets access granted if needed (rare for routing config)

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*