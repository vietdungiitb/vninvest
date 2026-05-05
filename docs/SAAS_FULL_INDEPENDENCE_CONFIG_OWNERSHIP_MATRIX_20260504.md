# CONFIG OWNERSHIP MATRIX — SaaS Full Independence

**Ngày**: 2026-05-04

---

## 1. Environment variables

| Biến | Owner | Phase | Dev default | Prod requirement | File đặt |
|------|-------|-------|------------|-----------------|---------|
| `LEGACY_BACKEND_URL` | DevOps | B1 | `http://backend:8000` | `http://backend:8000` (internal) | `docker-compose.dev.yml`, `docker-compose.prod.yml` |
| `EMAIL_HOST` | DevOps | B2 | `mailpit` | SMTP hostname | compose |
| `EMAIL_PORT` | DevOps | B2 | `1025` | `587` | compose |
| `EMAIL_HOST_USER` | DevOps | B2 | `""` | email address | compose secret |
| `EMAIL_HOST_PASSWORD` | DevOps | B2 | `""` | `${EMAIL_HOST_PASSWORD:?error}` | compose secret |
| `EMAIL_USE_TLS` | DevOps | B2 | `false` | `true` | compose |
| `OPENAI_API_KEY` | Tech Lead | B5 | `""` | `${OPENAI_API_KEY:?error}` | compose secret |
| `OPENAI_MODEL` | Backend Lead | B5 | `gpt-4o-mini` | configurable | compose |
| `AI_ADVISORY_MAX_TOKENS` | Backend Lead | B5 | `4096` | configurable | compose |
| `CHANNELS_REDIS_URL` | DevOps | B7 | `redis://redis:6379/4` | Redis URL | compose |
| `CORE_DATABASE_URL` | DevOps | existing | dev postgres | `${CORE_DATABASE_URL:?error}` | compose secret |
| `CORE_PAT_PEPPER` | Tech Lead | existing | dev string | `${CORE_PAT_PEPPER:?error}` | compose secret |
| `SENTRY_DSN` | DevOps | existing | `""` | Sentry DSN | compose |

---

## 2. Files config ownership

| File | Owner | Được phép sửa | Không được sửa |
|------|-------|--------------|----------------|
| `packages/core/backend/src/vninvest_core/settings.py` | Backend Lead | Thêm env vars mới, app config | Xóa security guards |
| `packages/core/backend/src/vninvest_core/urls.py` | Backend Lead | Thêm/xóa routes | Thứ tự routes (proxy phải ở cuối) |
| `packages/core/backend/src/vninvest_core/legacy_proxy.py` | Backend Lead | Exclusion list | Timeout < 5s |
| `frontend/docker/nginx.conf` | DevOps + Backend Lead | Routing rules | Xóa WebSocket timeout |
| `docker-compose.dev.yml` | DevOps | Dev config | Thêm lại port 8000 sau B1 |
| `docker-compose.prod.yml` | DevOps | Prod config | Wildcard ALLOWED_HOSTS |
| `packages/core/backend/src/vninvest_core/db_router.py` | Tech Lead | — | Không được sửa (security) |
| `scripts/migrate_portfolios_to_core.py` | Backend Dev 2 | Migration logic | Không được xóa parity check |

---

## 3. Deployment ownership

| Action | Requires approval | Who can execute |
|--------|------------------|----------------|
| B1 cutover (nginx routing change) | Backend Lead review | DevOps |
| B4 cutover (portfolio switch to core DB) | Tech Lead sign-off + parity gate | Backend Dev 2 + DevOps |
| B8 decommission (stop legacy containers) | Tech Lead + tất cả 7 gates | DevOps |
| Rollback bất kỳ phase | Backend Lead | Any dev |
| Thêm env var vào prod compose | Tech Lead | DevOps |
| Thay đổi db_router.py | Tech Lead only | Tech Lead only |

---

## 4. Secret rotation policy

| Secret | Rotation frequency | Procedure |
|--------|--------------------|-----------|
| `CORE_PAT_PEPPER` | Không rotate (breaking change) | Phải migrate tất cả PAT nếu thay |
| `OPENAI_API_KEY` | Khi compromised | Update compose, restart core-worker |
| `EMAIL_HOST_PASSWORD` | Mỗi 90 ngày | Update compose, restart core-api |
| `CORE_DATABASE_URL` | Khi compromised | Full stack restart |

---

## 5. Nginx routing ownership

| Location | Owner | Last review |
|---------|-------|------------|
| `/api/*` → core-api | DevOps | B1 |
| `/core/v1/*` → core-api | DevOps | Phase 4 (existing) |
| `/ws/*` → core-api | DevOps | B7 |
| `/admin/*` → backend (internal) | DevOps | B1 (temporary) → B8 (remove) |
| `location /` → React SPA | DevOps | existing |
