# CONFIG OWNERSHIP MATRIX - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Environment ownership

| Config / secret | Owner | Action |
|---|---|---|
| `LEGACY_BACKEND_URL` | DevOps / Backend | Remove from production compose and runtime envs |
| `LEGACY_DATABASE_URL` | DevOps / Backend | Remove from production compose and runtime envs |
| `CORE_DJANGO_SECRET_KEY` | DevOps | Keep; not related to legacy decommission |
| `CORE_ALLOWED_HOSTS` | DevOps | Keep; must remain explicit in prod |
| `CORE_CORS_ALLOWED_ORIGINS` | DevOps / Frontend | Keep; verify no wildcard |
| `APP_RELEASE` | DevOps | Keep; used for image pinning |

---

## 2. File ownership

| File / area | Owner | Action |
|---|---|---|
| `packages/core/backend/src/vninvest_core/urls.py` | Backend | Remove proxy catch-all route |
| `packages/core/backend/src/vninvest_core/legacy_proxy.py` | Backend | Delete |
| `packages/core/backend/src/vninvest_core/compat_portfolio.py` | Backend | Remove runtime compat shims after native promotion |
| `packages/core/backend/src/identity_access/compat_urls.py` | Backend | Replace with native URLConfs and delete compat mount |
| `packages/core/backend/src/user_workspace/compat_urls.py` | Backend | Replace with native URLConfs and delete compat mount |
| `packages/core/backend/src/market_serving/compat_urls.py` | Backend | Replace with native URLConfs and delete compat mount |
| `packages/core/backend/src/signal_intelligence/compat_urls.py` | Backend | Replace with native URLConfs and delete compat mount |
| `packages/core/backend/src/market_data/compat_urls.py` | Backend | Replace with native URLConfs and delete compat mount |
| `frontend/src/api/client.js` | Frontend | Keep contract stable during route migration |
| `docker-compose.ghcr.yml` | DevOps | Remove legacy env hooks from prod path |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Backend Lead | Update after each slice |
| `PROGRESS_DASHBOARD.md` | Backend Lead | Update after each slice |

---

## 3. Approval rules

1. No production config change that reintroduces legacy backend as a silent fallback.
2. No route deletion without a native owner and test coverage.
3. No new compat route mount after N1 freeze.
