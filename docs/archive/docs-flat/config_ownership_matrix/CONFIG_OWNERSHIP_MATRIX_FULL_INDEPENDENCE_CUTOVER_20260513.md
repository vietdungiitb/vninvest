# CONFIG OWNERSHIP MATRIX — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Scope**: Env vars, files, secrets cho C1–C7  

---

## 1. Environment variables

### Variables hiện tại (không thay đổi trong C1–C7)

| Biến | Owner | Phase | Dev default | Prod requirement | Ghi chú |
|------|-------|-------|------------|-----------------|---------|
| `LEGACY_BACKEND_URL` | DevOps | **DELETE at C7** | `http://backend:8000` | **REMOVE** | Xóa khỏi compose tại C7 |
| `LEGACY_DATABASE_URL` | DevOps | **DELETE at C7** | legacy postgres URL | **REMOVE** | Xóa khỏi compose tại C7 |
| `CORE_DATABASE_URL` | DevOps | existing | sqlite dev | `${CORE_DATABASE_URL:?error}` | Không đổi |
| `CORE_PAT_PEPPER` | Tech Lead | existing | dev string | `${CORE_PAT_PEPPER:?error}` | Không đổi |
| `REDIS_URL` | DevOps | existing | `redis://redis:6379/1` | Redis URL | Không đổi |
| `OPENAI_API_KEY` | Tech Lead | existing (B5) | `""` | `${OPENAI_API_KEY:?error}` | Không đổi |
| `OPENAI_DEFAULT_MODEL` | Backend Lead | existing | `gpt-4o-mini` | configurable | Không đổi |
| `EMAIL_BACKEND` | DevOps | existing (B2) | console | SMTP class | Không đổi |
| `EMAIL_HOST` | DevOps | existing | `mailpit` | SMTP host | Không đổi |
| `CHANNELS_REDIS_URL` | DevOps | existing (B7) | `redis://redis:6379/4` | Redis URL | Không đổi |

### Variables mới trong C1–C7

| Biến | Owner | Phase added | Dev default | Prod requirement | File đặt |
|------|-------|------------|------------|-----------------|---------|
| (không có biến mới) | — | — | — | — | Tất cả dùng existing env vars |

> **Kết luận C1–C7 không cần env var mới.** Chỉ cần xóa `LEGACY_BACKEND_URL` và `LEGACY_DATABASE_URL` tại C7.

---

## 2. Files thay đổi — quyền sở hữu

| File | Owner | Được phép sửa | Không được sửa | Slice |
|------|-------|--------------|----------------|-------|
| `packages/core/backend/src/vninvest_core/settings.py` | Backend Lead | Thêm beat schedule | Xóa security guards, CoreRouter | C1 |
| `packages/core/backend/src/market_serving/views.py` | Backend Dev | Thêm native views | Xóa existing native views (UnifiedAlerts, Whale*) | C2 |
| `packages/core/backend/src/market_serving/api_urls.py` | Backend Dev | Re-wire 9 routes → native | Xóa 3 routes đã native | C2 |
| `packages/core/backend/src/market_data/views.py` | Backend Dev | Thêm native views | Xóa existing StockProfile/DailyPrice views | C3 |
| `packages/core/backend/src/market_data/public_urls.py` | Backend Dev | Re-wire 11 routes → native | — | C3 |
| `packages/core/backend/src/user_workspace/views.py` | Backend Dev 2 | Thêm analytics views | — | C4 |
| `packages/core/backend/src/user_workspace/urls.py` | Backend Dev 2 | Re-wire analytics routes | — | C4 |
| `packages/core/backend/src/user_workspace/legacy_views.py` | Backend Dev 2 | Remove stubs + bridge | — | C4, C7 |
| `packages/core/backend/src/identity_access/views_auth.py` | Backend Dev | Thêm VerifyEmailView | Xóa existing auth views | C5 |
| `packages/core/backend/src/identity_access/models.py` | Backend Dev | Thêm EmailVerificationToken | — | C5 (nếu cần) |
| `packages/core/backend/src/identity_access/compat_urls.py` | Backend Dev | Thêm verify URL | — | C5 |
| `packages/core/backend/src/vninvest_core/urls.py` | Backend Lead | Thêm telegram/sub-account routes | Route order (proxy cuối) | C6 |
| `packages/core/backend/src/vninvest_core/legacy_http_bridge.py` | Tech Lead | **DELETE ONLY** | Không được thêm code | C7 |
| `packages/core/backend/src/market_serving/legacy_views.py` | Backend Lead | Remove `RealtimeLegacyBridgeView` class | Keep native views | C7 |
| `docker-compose.dev.yml` | DevOps | Remove backend services | Thêm lại port 8000; restore backend | C7 |
| `docker-compose.prod.yml` | DevOps | Remove backend services | Wildcard ALLOWED_HOSTS | C7 |

---

## 3. File ownership — không được sửa

| File | Lý do |
|------|-------|
| `packages/core/backend/src/vninvest_core/db_router.py` | Security guard — CoreRouter block write to legacy |
| `packages/core/backend/src/market_serving/legacy_views.py` (native views section) | `RealtimeUnifiedAlertsView`, `RealtimeWhaleFeedAggregateView`, `RealtimeWhaleCampaignsView` — đã native, đừng chạm |
| `frontend/docker/nginx.conf` | Đã done B1, không cần sửa trong C1–C7 |
| `packages/core/backend/src/vninvest_core/asgi.py` | Đã done B7, không cần sửa |

---

## 4. Deployment ownership

| Action | Requires approval | Who can execute |
|--------|-----------------|----------------|
| C1 beat schedule change | Backend Lead review | Backend Dev |
| C2+C3 view cutover | Code review | Backend Dev |
| C4 portfolio analytics | Backend Lead review | Backend Dev 2 |
| C5 auth view | Backend Lead review | Backend Dev |
| C7 decommission (stop legacy containers) | Tech Lead sign-off + Gates A–G PASS | DevOps |
| C7 delete legacy_http_bridge.py | Tech Lead sign-off | Backend Lead |
| C7 compose update | Tech Lead sign-off | DevOps |
| Rollback bất kỳ slice | Backend Lead | Any dev |

---

## 5. C7 — Variables bị xóa

Tại C7, xóa khỏi `docker-compose.dev.yml` và `docker-compose.prod.yml`:

```yaml
# XÓA HOÀN TOÀN các dòng sau:
LEGACY_BACKEND_URL: http://backend:8000
LEGACY_DATABASE_URL: postgresql://...
```

Đồng thời xóa các services trong compose:
```yaml
# DECOMMISSIONED at C7 — 2026-05-13
# backend:
#   ...
# backend-worker:
#   ...
# backend-beat:
#   ...
```

---

## 6. Secret rotation policy (không đổi từ existing)

| Secret | Rotation frequency | Procedure |
|--------|--------------------|-----------|
| `CORE_PAT_PEPPER` | Không rotate (breaking) | Phải re-hash tất cả PAT nếu thay |
| `OPENAI_API_KEY` | Khi compromised | Update compose, restart core-worker |
| `CORE_DATABASE_URL` | Khi compromised | Full stack restart |
| `EMAIL_HOST_PASSWORD` | Mỗi 90 ngày | Update compose, restart core-api |

---

## 7. Post-C7 compose state (expected)

```yaml
# docker-compose.dev.yml sau C7:
services:
  core-api:      # ✅ running
  core-beat:     # ✅ running (C1: ingest active)
  core-worker:   # ✅ running
  frontend:      # ✅ running
  redis:         # ✅ running
  postgres:      # ✅ running
  # backend      # REMOVED at C7
  # backend-worker # REMOVED at C7
```

---

*Không cần env var mới cho C1–C7. Chỉ thao tác duy nhất trên config là: (1) thêm beat entry ở C1, và (2) xóa LEGACY_* vars + services ở C7.*
