# TRACEABILITY MATRIX — SaaS Full Independence

**Ngày**: 2026-05-04  
**Scope**: Option B — core-api single entry point

---

## 1. Requirements

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| SFI-REQ-01 | core-api phải xử lý tất cả `/api/*` requests (kể cả proxy fallback) | P0 | B1 |
| SFI-REQ-02 | nginx không được route thẳng đến backend:8000 cho `/api/*` | P0 | B1 |
| SFI-REQ-03 | Auth register, verify, password-reset phải hoạt động trong core | P1 | B2 |
| SFI-REQ-04 | Email verification phải được gửi thông qua configured SMTP backend | P1 | B2 |
| SFI-REQ-05 | Tất cả realtime endpoints phải trả data khớp với legacy (parity ≥ 99%) | P1 | B3 |
| SFI-REQ-06 | Tất cả stock management endpoints phải hoạt động native trong core | P1 | B3 |
| SFI-REQ-07 | Portfolio user data phải được migrate với parity ≥ 99% | P0 | B4 |
| SFI-REQ-08 | Shadow run ≥ 3 ngày trade bắt buộc trước portfolio cutover | P0 | B4 |
| SFI-REQ-09 | P&L calculations phải khớp ±0.01% với legacy | P0 | B4 |
| SFI-REQ-10 | AI advisory sessions + components phải hoạt động trong core | P1 | B5 |
| SFI-REQ-11 | OPENAI_API_KEY phải được cấu hình trong prod qua env var (không hardcode) | P0 | B5 |
| SFI-REQ-12 | Tất cả admin ops endpoints phải hoạt động trong core | P2 | B6 |
| SFI-REQ-13 | Signal admin phải có IsCoreOperator permission guard | P0 | B6 |
| SFI-REQ-14 | WebSocket connections phải kết nối thành công qua core-api | P1 | B7 |
| SFI-REQ-15 | Legacy backend container phải bị tắt sau B8 | P0 | B8 |
| SFI-REQ-16 | 7 pre-decommission gates phải PASS trước B8 | P0 | B8 |
| SFI-REQ-17 | Proxy timeout phải đủ dài cho admin-ops endpoints (≥ 120s) | P1 | B1 |
| SFI-REQ-18 | Port 8000 không được expose ra host sau B1 | P1 | B1 |
| SFI-REQ-19 | CoreRouter phải tiếp tục block writes vào legacy DB từ core | P0 | ALL |
| SFI-REQ-20 | Không có default passwords trong prod compose | P0 | ALL |

---

## 2. Requirement → Slice mapping

| Req ID | Slice(s) | Verification method |
|--------|---------|-------------------|
| SFI-REQ-01 | SFI-B1.2, SFI-B1.3 | Smoke test: curl /api/health/ → 200 |
| SFI-REQ-02 | SFI-B1.5 | nginx config review + curl test |
| SFI-REQ-03 | SFI-B2.2, SFI-B2.3, SFI-B2.4 | E2E register flow |
| SFI-REQ-04 | SFI-B2.1, SFI-B2.2 | Mailpit UI verification |
| SFI-REQ-05 | SFI-B3.1 → B3.5 | Parity script: 20 symbols |
| SFI-REQ-06 | SFI-B3.4, SFI-B3.5 | Endpoint response comparison |
| SFI-REQ-07 | SFI-B4.3, SFI-B4.6 | `parity_score >= 0.99` from report |
| SFI-REQ-08 | SFI-B4.6 | 3 calendar days elapsed check |
| SFI-REQ-09 | SFI-B4.5 | P&L diff < 0.01% test |
| SFI-REQ-10 | SFI-B5.2, SFI-B5.3 | E2E advisory session test |
| SFI-REQ-11 | SFI-B5.1 | settings.py review + env check |
| SFI-REQ-12 | SFI-B6.1 → B6.4 | Manual test all admin ops pages |
| SFI-REQ-13 | SFI-B6.1 | Permission test: non-admin → 403 |
| SFI-REQ-14 | SFI-B7.3, SFI-B7.4 | WS connection test script |
| SFI-REQ-15 | SFI-B8.3, SFI-B8.4 | `docker ps | grep backend` → empty |
| SFI-REQ-16 | SFI-B8.1 | Gate check script output |
| SFI-REQ-17 | SFI-B1.2, SFI-B1.5 | nginx timeout config review |
| SFI-REQ-18 | SFI-B1.6 | `docker ps --format Ports` check |
| SFI-REQ-19 | (existing) | CoreRouter test: write → exception |
| SFI-REQ-20 | (existing) | compose file review |

---

## 3. Slice → Files mapping

| Slice | Files thay đổi |
|-------|---------------|
| SFI-B1.1 | `packages/core/backend/requirements.txt` |
| SFI-B1.2 | `packages/core/backend/src/vninvest_core/legacy_proxy.py` (new) |
| SFI-B1.3 | `packages/core/backend/src/vninvest_core/urls.py` |
| SFI-B1.4 | `packages/core/backend/src/vninvest_core/settings.py` |
| SFI-B1.5 | `frontend/docker/nginx.conf` |
| SFI-B1.6 | `docker-compose.dev.yml`, `docker-compose.prod.yml` |
| SFI-B2.1 | `packages/core/backend/src/vninvest_core/settings.py` |
| SFI-B2.2–B2.4 | `packages/core/backend/src/identity_access/views_auth.py`, `compat_urls.py` |
| SFI-B2.5 | `scripts/migrate_users_to_core.py` (new) |
| SFI-B3.1–B3.3 | `packages/core/backend/src/signal_intelligence/views.py`, `urls.py` |
| SFI-B3.4–B3.5 | `packages/core/backend/src/market_data/views.py`, `urls.py` |
| SFI-B4.1 | `packages/core/backend/src/user_workspace/models.py`, `migrations/` |
| SFI-B4.3 | `scripts/migrate_portfolios_to_core.py` (new) |
| SFI-B4.4–B4.5, B4.8 | `packages/core/backend/src/user_workspace/views.py`, `urls.py` |
| SFI-B5.1 | `packages/core/backend/src/advisory/models.py`, `migrations/` |
| SFI-B5.2–B5.4 | `packages/core/backend/src/advisory/views.py`, `urls.py` |
| SFI-B6.1–B6.2 | `packages/core/backend/src/ops_audit/views.py`, `urls.py` |
| SFI-B6.3 | `packages/core/backend/src/signal_intelligence/admin_views.py` (new) |
| SFI-B6.4 | `packages/core/backend/src/data_ingest/tasks.py`, `ops_audit/tasks.py` |
| SFI-B7.1 | `packages/core/backend/requirements.txt` |
| SFI-B7.2 | `packages/core/backend/src/vninvest_core/asgi.py` |
| SFI-B7.3 | `packages/core/backend/src/signal_intelligence/consumers.py` (new) |
| SFI-B7.4 | `frontend/docker/nginx.conf` |
| SFI-B8.2–B8.3 | `packages/core/backend/src/vninvest_core/urls.py`, `docker-compose.dev.yml`, `docker-compose.prod.yml` |

---

## 4. Test coverage matrix

| Domain | Unit tests | Integration tests | E2E tests |
|--------|-----------|-------------------|-----------|
| Proxy Gateway (B1) | `test_legacy_proxy.py` | Smoke test suite | — |
| Auth Native (B2) | `test_auth_views.py` | Register → verify → login | — |
| Market+Realtime (B3) | `test_realtime_views.py` | Parity script | — |
| Portfolio (B4) | `test_workspace_views.py` | Shadow parity report | Portfolio CRUD |
| AI Advisory (B5) | `test_advisory_views.py` | Session CRUD | — |
| Admin Ops (B6) | `test_admin_ops.py` | Manual test | — |
| WebSocket (B7) | `test_consumers.py` | WS connection test | — |
