# TASKBOARD — SaaS Full Independence: Loại bỏ Hoàn toàn Phụ thuộc Legacy

**Ngày**: 2026-05-04  
**Mục tiêu**: Điều phối triển khai từng slice để core-api trở thành single entry point duy nhất.

**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Phase B1 — Proxy Gateway ⚡ PHẢI XONG TRƯỚC MỌI PHASE KHÁC

> **Gate**: Không bắt đầu B2+ nếu B1 chưa PASS smoke test.

---

- [ ] `SFI-B1.1` **Thêm httpx vào core requirements**  
  Owner: Backend Lead  
  Estimate: 15 phút  
  DoD:  
  - `httpx>=0.27,<1.0` có trong `packages/core/backend/requirements.txt`  
  - `pip install` không lỗi  
  Req IDs: SFI-REQ-01  
  Files: `packages/core/backend/requirements.txt`

---

- [ ] `SFI-B1.2` **Tạo legacy_proxy.py — transparent HTTP proxy**  
  Owner: Backend Lead  
  Estimate: 3h  
  DoD:  
  - `vninvest_core/legacy_proxy.py` tồn tại  
  - Proxy forward đúng: method, path, query string, body, headers (trừ hop-by-hop)  
  - Timeout: connect=5s, read=120s  
  - Exclusion list: `/api/auth/token/`, `/api/auth/token/refresh/`, `/api/auth/me/`, `/api/portfolio/userconfig/`, `/api/portfolio/portfolios/` (compat layer đã handle)  
  - Log: `[PROXY] {method} {path} → {status}` ở level DEBUG  
  - Không crash khi legacy backend down (trả 502 với JSON error body)  
  Test gate: unit test mock httpx response → kiểm tra header forwarding  
  Req IDs: SFI-REQ-01  
  Files: `packages/core/backend/src/vninvest_core/legacy_proxy.py` (new)

---

- [ ] `SFI-B1.3` **Đăng ký proxy route cuối trong urls.py**  
  Owner: Backend Lead  
  Estimate: 30 phút  
  DoD:  
  - `path('api/<path:remaining>', legacy_proxy_view)` là route CUỐI cùng trong `urlpatterns`  
  - Route này đứng sau tất cả native routes  
  - `/api/auth/token/` vẫn dùng native view (không qua proxy)  
  Test gate: `curl http://localhost:8100/api/health/` → 200 (qua proxy về legacy)  
  Req IDs: SFI-REQ-01  
  Files: `packages/core/backend/src/vninvest_core/urls.py`

---

- [ ] `SFI-B1.4` **Thêm LEGACY_BACKEND_URL vào settings.py**  
  Owner: Backend Lead  
  Estimate: 15 phút  
  DoD:  
  - `LEGACY_BACKEND_URL = os.environ.get('LEGACY_BACKEND_URL', 'http://backend:8000')`  
  - Không có default hardcode ngoài dev fallback  
  Req IDs: SFI-REQ-01  
  Files: `packages/core/backend/src/vninvest_core/settings.py`

---

- [ ] `SFI-B1.5` **Sửa nginx.conf: /api/ → core-api:8100**  
  Owner: DevOps / Backend Lead  
  Estimate: 30 phút  
  DoD:  
  - `location /api/` proxy đến `http://core-api:8100` (không còn `$backend_upstream`)  
  - `proxy_read_timeout 300s` (admin-ops cần)  
  - `location /admin/` vẫn proxy đến backend (Django admin)  
  - Không còn `set $backend_upstream backend:8000` trong bất kỳ context nào ngoài admin  
  Test gate: rebuild frontend → `curl http://localhost/api/health/` → 200  
  Req IDs: SFI-REQ-02  
  Files: `frontend/docker/nginx.conf`

---

- [ ] `SFI-B1.6` **Sửa docker-compose.dev.yml**  
  Owner: DevOps  
  Estimate: 30 phút  
  DoD:  
  - `core-api.environment.LEGACY_BACKEND_URL: http://backend:8000` đã thêm  
  - `backend.ports` không còn `"8000:8000"`  
  - `frontend.depends_on` không còn `backend: service_healthy`  
  - `frontend.depends_on` chỉ còn `core-api: service_healthy`  
  Test gate: `docker ps --format "table {{.Names}}\t{{.Ports}}" | Select-String "8000"` → không có kết quả  
  Req IDs: SFI-REQ-02  
  Files: `docker-compose.dev.yml`

---

- [ ] `SFI-B1.7` **Smoke test toàn bộ B1 + rebuild stack**  
  Owner: Backend Lead  
  Estimate: 1h  
  DoD:  
  - `docker compose -f docker-compose.dev.yml up -d --build frontend core-api` exit 0  
  - `curl http://localhost/api/health/` → 200  
  - `curl http://localhost/api/portfolio/portfolios/` → 401 (không phải 502 hay 404)  
  - `curl http://localhost/api/realtime/ticker/VIC/` → 200 với data  
  - `curl http://localhost/core/v1/health` → 200  
  - `curl http://localhost/api/realtime/whale-feed/VIC/` → 200 với data  
  - Port 8000 KHÔNG exposed: `docker ps` confirm  
  Evidence: screenshot terminal output + payload snapshot  
  Req IDs: SFI-REQ-01, SFI-REQ-02  

---

## Phase B2 — Auth Native

> **Gate**: B1 phải PASS. B2 có thể chạy song song với B3 và B6.

---

- [ ] `SFI-B2.1` **Email backend config trong settings.py**  
  Owner: Backend Dev  
  Estimate: 30 phút  
  DoD:  
  - `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT` config từ env vars  
  - Dev default: mailpit (host=mailpit, port=1025)  
  - Prod: cần `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`  
  Files: `packages/core/backend/src/vninvest_core/settings.py`

---

- [ ] `SFI-B2.2` **RegisterView trong identity_access**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD:  
  - `POST /api/auth/register/` → 201 với user created + verification email sent  
  - Email gửi qua configured backend  
  - Validation: email unique, password min 8 chars  
  - Dev: email visible tại mailpit UI (port 8025)  
  Files: `packages/core/backend/src/identity_access/views_auth.py`, `compat_urls.py`

---

- [ ] `SFI-B2.3` **Email verify + resend verification**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD:  
  - `POST /api/auth/verify-email/` với token → account active  
  - `POST /api/auth/resend-verification/` → email mới gửi  
  - Token expiry: 24h  
  Files: `packages/core/backend/src/identity_access/views_auth.py`, `compat_urls.py`

---

- [ ] `SFI-B2.4` **Password reset flow**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD:  
  - `POST /api/auth/password-reset/request/` → email với reset link  
  - `POST /api/auth/password-reset/confirm/` → password đổi thành công  
  - Token expiry: 1h  
  Files: `packages/core/backend/src/identity_access/views_auth.py`, `compat_urls.py`

---

- [ ] `SFI-B2.5` **User migration script**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD:  
  - `scripts/migrate_users_to_core.py` tồn tại  
  - Script copy `auth_user` từ legacy DB → `identity_access_userprofile` trong core DB  
  - Idempotent: chạy nhiều lần không tạo duplicate  
  - Output: `Migrated: X users, Skipped: Y (already exist)`  
  Files: `scripts/migrate_users_to_core.py` (new)

---

- [ ] `SFI-B2.6` **Smoke test B2 + cập nhật proxy exclusion list**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - Register → verify email → login → success  
  - Password reset: request → receive email → confirm → login với password mới  
  - Proxy exclusion list updated: auth endpoints không còn forwarded  

---

## Phase B3 — Market & Realtime Native

> **Gate**: B1 phải PASS. B3 có thể chạy song song với B2 và B6.

---

- [ ] `SFI-B3.1` **Realtime ticker endpoints**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD:  
  - `GET /api/realtime/ticker/<symbol>/` → 200 với price data  
  - `GET /api/realtime/tickers/?symbols=VIC,VHM` → 200 với list  
  - Data từ legacy readonly DB (không cần vnbroker trực tiếp)  
  - Response schema khớp với legacy (verified bằng diff tool)  
  Files: `packages/core/backend/src/signal_intelligence/views.py`, `urls.py`

---

- [ ] `SFI-B3.2` **Whale feed + unified alerts endpoints**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD:  
  - `GET /api/realtime/whale-feed/<symbol>/` → 200 với whale events  
  - `GET /api/realtime/whale-feed/aggregate/` → 200  
  - `GET /api/realtime/whale-campaigns/` → 200  
  - `GET /api/realtime/unified-alerts/` → alias hoặc redirect → `/core/v1/signals/unified-alert`  
  - Data parity với legacy: random sample 10 symbols, compare top-10 events  
  Files: `packages/core/backend/src/signal_intelligence/views.py`, `urls.py`

---

- [ ] `SFI-B3.3` **Intraday + price-board + breadth + RVOL + depth-chart**  
  Owner: Backend Dev 1  
  Estimate: 1.5 ngày  
  DoD:  
  - 5 endpoints hoạt động với data từ legacy readonly  
  - Parity confirmed  
  Files: `packages/core/backend/src/signal_intelligence/views.py`, `urls.py`

---

- [ ] `SFI-B3.4` **Stock profile + overview + chart + order-flow**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD:  
  - `GET /api/stock-management/stocks/<symbol>/` → profile data  
  - `GET /api/stock-management/stocks/<symbol>/overview/` → extended  
  - `GET /api/stock-management/stocks/<symbol>/chart/?days=30` → OHLCV  
  - `GET /api/stock-management/stocks/<symbol>/order-flow/` → order flow  
  Files: `packages/core/backend/src/market_data/views.py`, `urls.py`

---

- [ ] `SFI-B3.5` **Technicals, groups, tracked-symbols, news, financials**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD:  
  - Tất cả endpoints hoạt động  
  - `/api/stock-management/tracked-symbols/` CRUD đầy đủ  
  Files: `packages/core/backend/src/market_data/views.py`, `urls.py`

---

- [ ] `SFI-B3.6` **Parity report B3 + cập nhật proxy exclusion list**  
  Owner: Backend Dev 1  
  Estimate: 0.5 ngày  
  DoD:  
  - Parity script chạy và report ≥ 99% cho 20 sample symbols  
  - Proxy exclusion list updated  
  - k6 test 50 VUs: p95 < 200ms cho market endpoints  

---

## Phase B4 — Portfolio & Workspace Native

> **Gate**: B3 phải PASS. Shadow run 3 ngày BLOCKING.

---

- [ ] `SFI-B4.1` **Models SubAccount + Transaction + migrations**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD:  
  - `SubAccount`, `Transaction` models tồn tại trong `user_workspace`  
  - Migration files tạo thành công  
  - `python manage.py migrate` exit 0  
  Files: `packages/core/backend/src/user_workspace/models.py`, `migrations/`

---

- [ ] `SFI-B4.2` **Dual-write shadow mode**  
  Owner: Backend Dev 2  
  Estimate: 0.5 ngày  
  DoD:  
  - Mọi POST/PATCH/DELETE đến `/api/portfolio/*` được ghi vào CẢ legacy DB (qua proxy) VÀ core DB  
  - Read vẫn từ legacy DB  
  - Dual-write errors được log nhưng không block response  
  Files: `packages/core/backend/src/user_workspace/views.py`

---

- [ ] `SFI-B4.3` **Data migration script portfolios + transactions**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD:  
  - `scripts/migrate_portfolios_to_core.py` tồn tại  
  - Copy `portfolio_portfolio`, `portfolio_subaccount`, `portfolio_transaction` từ legacy → core  
  - Idempotent, có dry-run mode  
  - Output: migration summary với count  
  Files: `scripts/migrate_portfolios_to_core.py` (new)

---

- [ ] `SFI-B4.4` **Portfolio + subaccounts + transactions CRUD views**  
  Owner: Backend Dev 2  
  Estimate: 1.5 ngày  
  DoD:  
  - 15 CRUD endpoints hoạt động  
  - Auth: chỉ xem/sửa portfolio của chính user  
  Files: `packages/core/backend/src/user_workspace/views.py`, `urls.py`

---

- [ ] `SFI-B4.5` **Holdings + summary + chart + equity-curve + allocation + analytics**  
  Owner: Backend Dev 2  
  Estimate: 2 ngày  
  DoD:  
  - 7 computed endpoints hoạt động  
  - P&L calculations khớp ±0.01% với legacy (test 5 portfolios)  
  Files: `packages/core/backend/src/user_workspace/views.py`

---

- [ ] `SFI-B4.6` **Shadow run 3 ngày trade + parity report** ⚠️ BLOCKING  
  Owner: Backend Dev 2 + QA  
  Estimate: 3 ngày (không thể rút ngắn)  
  DoD:  
  - `parity_score >= 0.99` trên tất cả portfolios (không exception)  
  - Parity report file lưu tại `docs/evidence/SFI-B4-parity-report.json`  
  - Không có transaction mismatch  
  - Cutover không được thực hiện nếu gate này chưa PASS  

---

- [ ] `SFI-B4.7` **Cutover: switch read → core DB**  
  Owner: Backend Dev 2  
  Estimate: 0.5 ngày  
  DoD:  
  - Read portfolio data từ core DB  
  - Dual-write tắt  
  - Proxy rules cho `/api/portfolio/*` bị xóa  
  - Monitor 2h sau cutover: không có error surge  

---

- [ ] `SFI-B4.8` **Watchlist CRUD views**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD:  
  - 6 watchlist endpoints hoạt động  
  - Seed và sync endpoints hoạt động  
  Files: `packages/core/backend/src/user_workspace/views.py`, `urls.py`

---

## Phase B5 — AI Advisory Native

> **Gate**: B4 phải PASS.

---

- [ ] `SFI-B5.1` **Models AdvisorySession + AdvisoryComponent + AdvisoryObservability**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  Files: `packages/core/backend/src/advisory/models.py`, `migrations/`

---

- [ ] `SFI-B5.2` **Advisory session endpoints (GET, POST, DELETE)**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD: 4 session management endpoints hoạt động  
  Files: `packages/core/backend/src/advisory/views.py`, `urls.py`

---

- [ ] `SFI-B5.3` **Components CRUD (toggle, refresh, restore, delete)**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD: 6 component endpoints hoạt động  
  Files: `packages/core/backend/src/advisory/views.py`

---

- [ ] `SFI-B5.4` **Summary regenerate + ai-options + ai-config + system-ai-settings**  
  Owner: Backend Dev 1  
  Estimate: 1 ngày  
  DoD: 4 config/summary endpoints hoạt động  
  Files: `packages/core/backend/src/advisory/views.py`, `ops_audit/views.py`

---

- [ ] `SFI-B5.5` **AI Advisory proxy exclusion + smoke test**  
  Owner: Backend Dev 1  
  Estimate: 0.5 ngày  

---

## Phase B6 — Admin Ops Native

> **Gate**: B1 phải PASS. Có thể chạy song song B2, B3.

---

- [ ] `SFI-B6.1` **Stats + runtime-kpi + system-ai-settings trong ops_audit**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD: 5 endpoints hoạt động  
  Files: `packages/core/backend/src/ops_audit/views.py`, `urls.py`

---

- [ ] `SFI-B6.2` **vnbroker-config CRUD + changelog**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD: 5 vnbroker config endpoints hoạt động  
  Files: `packages/core/backend/src/ops_audit/views.py`

---

- [ ] `SFI-B6.3` **Signal admin — universe, governance, retention, jobs**  
  Owner: Backend Dev 2  
  Estimate: 1.5 ngày  
  DoD: ~15 signal admin endpoints hoạt động  
  Files: `packages/core/backend/src/signal_intelligence/admin_views.py` (new)

---

- [ ] `SFI-B6.4` **Celery tasks cho prefetch, market-groups, intraday-universe**  
  Owner: Backend Dev 2  
  Estimate: 1 ngày  
  DoD: 3 async task triggers hoạt động; tasks chạy trong core-worker  
  Files: `packages/core/backend/src/data_ingest/tasks.py`, `ops_audit/tasks.py`

---

## Phase B7 — WebSocket Migration

> **Gate**: B3 phải PASS.

---

- [ ] `SFI-B7.1` **Thêm channels[daphne] vào requirements**  
  Owner: Backend Lead  
  Estimate: 30 phút  
  Files: `packages/core/backend/requirements.txt`

---

- [ ] `SFI-B7.2` **ASGI config**  
  Owner: Backend Lead  
  Estimate: 30 phút  
  DoD: `vninvest_core/asgi.py` có ProtocolTypeRouter với http + websocket  
  Files: `packages/core/backend/src/vninvest_core/asgi.py`

---

- [ ] `SFI-B7.3` **Port WebSocket consumers**  
  Owner: Backend Lead  
  Estimate: 1.5 ngày  
  DoD:  
  - Consumer `TickerConsumer`, `WhaleFeedConsumer`, `PortfolioConsumer` tồn tại  
  - Channel groups đúng tên  
  - Test: kết nối WebSocket → nhận data realtime  
  Files: `packages/core/backend/src/signal_intelligence/consumers.py` (new)

---

- [ ] `SFI-B7.4` **Sửa nginx WebSocket routing → core-api**  
  Owner: DevOps  
  Estimate: 30 phút  
  DoD: `location /ws/` proxy đến core-api, WebSocket upgrade headers đúng  
  Files: `frontend/docker/nginx.conf`

---

- [ ] `SFI-B7.5` **WebSocket smoke test**  
  Owner: Backend Lead  
  Estimate: 1h  
  DoD: JS WebSocket test script kết nối thành công, nhận 3+ messages trong 60s  

---

## Phase B8 — Legacy Decommission

> **Gate**: TẤT CẢ B1–B7 PASS + 7 gates A–G theo `docs/SM-P6-DECOMMISSION-RUNBOOK.md`.

---

- [ ] `SFI-B8.1` **Chạy pre-decommission gates check**  
  Owner: Tech Lead  
  DoD: `python scripts/pre_decommission_gates_check.py` → tất cả 7 gates PASS  

---

- [ ] `SFI-B8.2` **Xóa proxy fallback route trong urls.py**  
  Owner: Backend Lead  
  DoD: `path('api/<path:remaining>', legacy_proxy_view)` đã xóa  

---

- [ ] `SFI-B8.3` **Xóa legacy services khỏi docker-compose files**  
  Owner: DevOps  
  DoD: `backend`, `celery_worker`, `celery_beat` không còn trong bất kỳ compose file nào  

---

- [ ] `SFI-B8.4` **Stop và remove legacy containers**  
  Owner: DevOps  
  DoD: `docker ps | Select-String "backend\|celery"` → không có kết quả  

---

- [ ] `SFI-B8.5` **Git tag + archive legacy branch**  
  Owner: Tech Lead  
  DoD: `git tag v2.0-saas-only`, `git checkout -b archive/legacy-backend`  

---

- [ ] `SFI-B8.6` **Final smoke test + module tree regenerate**  
  Owner: All  
  DoD:  
  - `curl http://localhost/api/health/` → 200  
  - `curl http://localhost/api/portfolio/portfolios/` → 200 (sau auth)  
  - `curl http://localhost/api/realtime/whale-feed/VIC/` → 200  
  - `module_tree_full.md` regenerated  
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` updated  
  - `PROGRESS_DASHBOARD.md` updated  

---

## Trạng thái tổng quan

| Phase | Trạng thái | Blocking |
|-------|-----------|---------|
| B1 Proxy Gateway | `[ ]` Not started | — |
| B2 Auth Native | `[ ]` Not started | B1 |
| B3 Market+Realtime | `[ ]` Not started | B1 |
| B4 Portfolio | `[ ]` Not started | B3 + shadow run |
| B5 AI Advisory | `[ ]` Not started | B4 |
| B6 Admin Ops | `[ ]` Not started | B1 |
| B7 WebSocket | `[ ]` Not started | B3 |
| B8 Decommission | `[ ]` Not started | ALL |
