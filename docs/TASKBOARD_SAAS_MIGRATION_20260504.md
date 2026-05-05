# TASKBOARD — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Điều phối triển khai theo slice cho toàn bộ chương trình di cư SaaS production-grade, loại bỏ hoàn toàn legacy monolith.

**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Phase 0 — Fix Immediate Blockers (CRITICAL)

> **Gate**: Phải hoàn thành trước bất kỳ phase nào. Không có exception.

---

- [ ] `SM-P0.1` **Fix materializers SQL — SymbolSnapshot + SessionFacts + UnifiedAlerts**  
  Owner: Backend Lead  
  Estimate: 4h  
  DoD:  
  - `materialize_symbol_snapshot` upsert > 0 records từ `portfolio_tickersessionclose`  
  - `materialize_session_facts` upsert > 0 records từ `portfolio_advisoryaggregatesnapshot` JSONB  
  - `materialize_unified_alerts` upsert > 0 records từ `portfolio_whalealertevent`  
  - `/core/v1/market/symbol-snapshot/` trả data không rỗng  
  Test gate: `python manage.py shell` materializer smoke test + API endpoint check  
  Evidence: command output + API payload snapshot với `upserted > 0`  
  Req IDs: SM-REQ-01, SM-REQ-02  
  Files: `packages/core/backend/src/market_serving/materializers.py`

---

- [ ] `SM-P0.2` **Add CONN_MAX_AGE to legacy backend settings**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - `CONN_MAX_AGE = 60` đã set với env var override  
  - `OPTIONS.connect_timeout = 10` đã set  
  - Legacy backend restart không có ConnectTimeout errors  
  Test gate: `docker compose logs backend --tail=50 | grep -i error` phải sạch sau restart  
  Evidence: settings diff + log output  
  Req IDs: SM-REQ-15  
  Files: `backend/config/settings.py`

---

- [ ] `SM-P0.3` **Tạo Dockerfile cho packages/core (immutable build)**  
  Owner: DevOps / Backend Lead  
  Estimate: 3h  
  DoD:  
  - `packages/core/backend/Dockerfile` tồn tại và build thành công  
  - `docker-compose.prod.yml` không còn volume mount `./packages/core/backend:/workspace`  
  - Image build từ Dockerfile, không cài pip khi start  
  - `python manage.py check --deploy` pass trong container  
  Test gate: `docker build -t test packages/core/backend/ && docker run --rm test python manage.py check`  
  Evidence: build log + check output  
  Req IDs: SM-REQ-16  
  Files: `packages/core/backend/Dockerfile` (new), `docker-compose.prod.yml`

---

- [ ] `SM-P0.4` **Tách manage.py migrate ra khỏi container startup**  
  Owner: Backend Lead  
  Estimate: 1h  
  DoD:  
  - `packages/core/backend/entrypoint.sh` tồn tại  
  - `entrypoint.sh` chạy migrate trước khi exec gunicorn  
  - `docker-compose.prod.yml` dùng entrypoint script  
  - Container không crash loop nếu migration lỗi (set -e bắt lỗi đúng)  
  Test gate: Chạy container với migration intentionally broken → phải fail gracefully, không spin  
  Evidence: entrypoint content + test run output  
  Req IDs: SM-REQ-16  
  Files: `packages/core/backend/entrypoint.sh` (new), `docker-compose.prod.yml`

---

## Phase 1 — Security Hardening (HIGH PRIORITY)

> **Gate**: Tất cả 6 security issues từ audit phải resolved trước Phase 2 production deployment.

---

- [ ] `SM-P1.1` **Enable JWT Token Blacklist**  
  Owner: Backend Lead  
  Estimate: 2h  
  DoD:  
  - `rest_framework_simplejwt.token_blacklist` trong INSTALLED_APPS  
  - `BLACKLIST_AFTER_ROTATION = True`  
  - `ROTATE_REFRESH_TOKENS = True`  
  - Migration cho blacklist tables đã chạy  
  - Test: refresh token sau logout → 401  
  Test gate: `backend.portfolio.tests.test_jwt_blacklist` suite PASS  
  Evidence: test output + curl proof (dùng refresh token cũ → 401)  
  Req IDs: SM-REQ-03  
  Files: `backend/config/settings.py`, `backend/requirements.txt`

---

- [ ] `SM-P1.2` **Fix PAT HMAC pepper — tạo management command rotate**  
  Owner: Backend Lead  
  Estimate: 4h  
  ⚠️ **CRITICAL: Phải tạo rotate command TRƯỚC khi apply hash change**  
  DoD:  
  - `_hash_pat_secret` ở cả hai nơi dùng `hmac.new(pepper, secret, sha256)`  
  - `rotate_all_pat_tokens` management command tồn tại và tested  
  - Có script/doc hướng dẫn service accounts nhận new credentials  
  - Test: PAT với hash cũ không authenticate được sau khi rotate  
  Test gate: unit test hash function + integration test authenticate với new hash  
  Evidence: hash function diff + rotate command output + auth test  
  Req IDs: SM-REQ-04  
  Files: `backend/portfolio/models.py`, `packages/core/backend/src/identity_access/models.py`, `backend/portfolio/management/commands/rotate_all_pat_tokens.py` (new)

---

- [ ] `SM-P1.3` **Lock ALLOWED_HOSTS — Core API**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - `ALLOWED_HOSTS = '*'` đã xoá  
  - Không set `DJANGO_ALLOWED_HOSTS` → `ImproperlyConfigured` raise trong production  
  - Dev mode: fallback về localhost/core-api  
  Test gate: `docker run --rm -e DEBUG=0 vninvest-core-api:test python manage.py check` phải raise ImproperlyConfigured  
  Evidence: test output  
  Req IDs: SM-REQ-05  
  Files: `packages/core/backend/src/vninvest_core/settings.py`

---

- [ ] `SM-P1.4` **Lock CORS — không dùng DEBUG làm gate**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - `CORS_ALLOW_ALL_ORIGINS = DEBUG` đã xoá  
  - CORS origins chỉ từ `CORS_ALLOWED_ORIGINS` env var  
  - Production không có env var → raise ImproperlyConfigured  
  Test gate: test với DEBUG=True và không set CORS env → vẫn phải dùng explicit list  
  Evidence: settings diff + curl test với wrong origin → 403  
  Req IDs: SM-REQ-05  
  Files: `packages/core/backend/src/vninvest_core/settings.py`

---

- [ ] `SM-P1.5` **Remove default passwords từ docker-compose.prod.yml**  
  Owner: DevOps  
  Estimate: 2h  
  DoD:  
  - Tất cả hardcoded passwords thay bằng `${VAR:?error}` syntax  
  - `docker compose config` fail khi thiếu env vars  
  - Có file `.env.prod.example` với tất cả required vars  
  Test gate: `docker compose -f docker-compose.prod.yml config` fail nếu thiếu `POSTGRES_PASSWORD`  
  Evidence: compose diff + `config` fail output + `.env.prod.example`  
  Req IDs: SM-REQ-06  
  Files: `docker-compose.prod.yml`, `.env.prod.example` (new)

---

- [ ] `SM-P1.6` **Email credential decryption guard + long-term Fernet key**  
  Owner: Backend Dev  
  Estimate: 3h  
  DoD:  
  - Runtime warning khi SystemEmailAccount không decrypt được  
  - `SystemEmailAccount` migrate sang Fernet key riêng (không phụ thuộc SECRET_KEY)  
  - SECRET_KEY rotation không break email credentials  
  Test gate: test với wrong SECRET_KEY → warning, không crash; test decrypt với Fernet key  
  Evidence: test output + startup log sample  
  Req IDs: SM-REQ-07  
  Files: `backend/portfolio/models.py`, `backend/portfolio/apps.py`

---

## Phase 2 — SaaS Data Plane Live

> **Gate**: Core API serving real data, real workers running, DB separated.

---

- [ ] `SM-P2.1` **Activate core-db PostgreSQL — separate database**  
  Owner: Backend Lead  
  Estimate: 4h  
  DoD:  
  - `core-db` service active trong dev + prod compose  
  - `vninvest_core` database exists, migrations applied  
  - `CoreRouter` đang route đúng: core models → `default`, legacy reads → `legacy`  
  - Thử ghi vào legacy từ core → bị block (RuntimeError)  
  Test gate: `python manage.py migrate --database=default` PASS + DB router test  
  Evidence: migrate output + router unit tests  
  Req IDs: SM-REQ-08  
  Files: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `packages/core/backend/src/vninvest_core/settings.py`, `packages/core/backend/src/vninvest_core/db_router.py` (new)

---

- [ ] `SM-P2.2` **Activate real Celery workers (thay stub)**  
  Owner: DevOps / Backend Lead  
  Estimate: 3h  
  DoD:  
  - `core-worker` chạy `celery worker` thật, không phải stub  
  - `core-beat` chạy `celery beat` thật với DatabaseScheduler  
  - `django-celery-beat` installed  
  - Beat schedule đang trigger `materialize_symbol_snapshot` mỗi 60 giây  
  Test gate: `celery inspect active` trả worker info; `docker logs core-beat | grep Sending` có output  
  Evidence: inspect output + beat log screenshot  
  Req IDs: SM-REQ-09  
  Files: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `packages/core/backend/requirements.txt`

---

- [ ] `SM-P2.3` **data_ingest domain skeleton**  
  Owner: Backend Dev  
  Estimate: 5h  
  DoD:  
  - `packages/core/backend/src/data_ingest/` tồn tại với models, tasks, migrations  
  - `IngestJob`, `IngestRun` models đã migrate vào core-db  
  - `fetch_and_upsert_price_board` task có thể trigger thủ công  
  - Task đọc từ vnstock adapter và upsert vào `market_serving.SymbolSnapshot`  
  Test gate: `python manage.py shell -c "from data_ingest.tasks import fetch_and_upsert_price_board; fetch_and_upsert_price_board.apply()"` PASS  
  Evidence: task output + SymbolSnapshot row count tăng  
  Req IDs: SM-REQ-10  
  Files: `packages/core/backend/src/data_ingest/` (new directory)

---

- [ ] `SM-P2.4` **Redis cache layer cho market endpoints**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD:  
  - `SymbolSnapshot` và `SessionFacts` views có cache layer (TTL 15 giây)  
  - Cache key format: `core:snapshot:{symbol}:{session_date}`  
  - Cache miss fallback về DB  
  - `source` trong response meta phân biệt `cache-hit` vs `db-read`  
  Test gate: Gọi API 2 lần liên tiếp → lần 2 phải nhanh hơn đáng kể; check Redis key  
  Evidence: timing comparison + Redis key check  
  Req IDs: SM-REQ-11  
  Files: `packages/core/backend/src/market_serving/views.py`

---

- [ ] `SM-P2.5` **Live endpoint verification — integration smoke**  
  Owner: QA Lead  
  Estimate: 2h  
  DoD:  
  - Tất cả endpoints trong bảng `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 11.1 trả response hợp lệ  
  - Response meta có `source`, `freshness_ts`, `is_complete`  
  - Không có 500 errors  
  Test gate: Script smoke test toàn bộ endpoints với PAT thật  
  Evidence: curl output log cho từng endpoint  
  Req IDs: SM-REQ-01, SM-REQ-02  
  Files: `scripts/smoke_test_core_api.sh` (new)

---

## Phase 3 — Business Logic Migration

> **Gate**: Từng domain phải pass parity >= 99% và shadow run >= 3 ngày trade trước cutover.

---

### Phase 3.1 — identity_access

- [ ] `SM-P3.1.1` **Tạo UserProfile model và API endpoint**  
  Owner: Backend Dev  
  Estimate: 5h  
  DoD:  
  - `identity_access.UserProfile` model tạo với schema đúng spec  
  - API endpoint `GET/PATCH /core/v1/identity/profile/` hoạt động  
  - Migration đã apply  
  Test gate: integration test CRUD UserProfile  
  Evidence: API payload snapshot + test output  
  Req IDs: SM-REQ-12  
  Files: `packages/core/backend/src/identity_access/models.py`, `views.py`, `serializers.py`

- [ ] `SM-P3.1.2` **Data migration script — UserConfig → UserProfile**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD:  
  - Management command `migrate_userprofiles_to_core` chạy được  
  - `--dry-run` không ghi gì  
  - Parity >= 99% trên full run  
  Test gate: `python manage.py migrate_userprofiles_to_core --dry-run` rồi `--execute`  
  Evidence: migration output + parity percentage  
  Req IDs: SM-REQ-13  
  Files: `packages/core/backend/src/identity_access/management/commands/migrate_userprofiles_to_core.py` (new)

---

### Phase 3.2 — commercial

- [ ] `SM-P3.2.1` **Subscription + Quota models**  
  Owner: Backend Dev  
  Estimate: 6h  
  DoD:  
  - `commercial.Subscription`, `commercial.Quota`, `commercial.PlanAuditLog` models  
  - API endpoints subscription và quota  
  - Plan enforcement middleware  
  Test gate: test plan enforcement — free user không access pro feature  
  Evidence: model migration + API test + enforcement test  
  Req IDs: SM-REQ-14  
  Files: `packages/core/backend/src/commercial/`

- [ ] `SM-P3.2.2` **Data migration — UserConfig plan → Subscription**  
  Owner: Backend Dev  
  Estimate: 3h  
  DoD: Parity >= 99%  
  Test gate: migration script dry-run + execute + parity verify  
  Req IDs: SM-REQ-13, SM-REQ-14  

- [ ] `SM-P3.2.3` **Shadow run + cutover: process_plan_lifecycle_transitions**  
  Owner: Backend Dev  
  Estimate: 1 tuần shadow  
  DoD: Parity >= 99% trong 3 ngày liên tiếp → cutover  
  Test gate: parity logs review  
  Req IDs: SM-REQ-09  

---

### Phase 3.3 — signal_intelligence

- [ ] `SM-P3.3.1` **UnifiedAlert + OrderFlowEvent models**  
  Owner: Backend Lead  
  Estimate: 6h  
  DoD: Models, migrations, API endpoints  
  Test gate: integration test alert ingestion + retrieval  
  Req IDs: SM-REQ-17  
  Files: `packages/core/backend/src/signal_intelligence/`

- [ ] `SM-P3.3.2` **Data migration — WhaleAlertEvent → UnifiedAlert**  
  Owner: Backend Dev  
  Estimate: 5h  
  DoD: Parity >= 99%, event_id preserved  
  Test gate: parity check script  
  Req IDs: SM-REQ-13, SM-REQ-17  

- [ ] `SM-P3.3.3` **Shadow run: detect_and_store_global_whale_alerts**  
  Owner: Backend Lead  
  Estimate: 1 tuần shadow + 48h verify  
  DoD: 3 ngày trade với parity >= 99% → cutover  
  Test gate: `log_shadow_parity` metrics review  
  Req IDs: SM-REQ-09, SM-REQ-17  

- [ ] `SM-P3.3.4` **Shadow run: detect_and_store_order_flow**  
  Owner: Backend Dev  
  Estimate: 1 tuần shadow  
  DoD: Parity >= 99%  
  Dependency: SM-P3.3.3 cutover  

- [ ] `SM-P3.3.5` **ForensicWindow model + carve-out logic**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Physical L5 table, không tag-only, có expiry timestamp  
  Req IDs: SM-REQ-20  

---

### Phase 3.4 — advisory

- [ ] `SM-P3.4.1` **AdvisoryRecord model + SystemAISettings + AI client**  
  Owner: Backend Lead  
  Estimate: 8h  
  DoD: Models, ai_client.py, prompt_engine.py, migrations  
  Req IDs: SM-REQ-18  
  Files: `packages/core/backend/src/advisory/`

- [ ] `SM-P3.4.2` **Data migration — WhaleAdvisory → AdvisoryRecord**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Parity >= 99%  
  Req IDs: SM-REQ-13, SM-REQ-18  

- [ ] `SM-P3.4.3` **API endpoints: advisory latest + refresh + history**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Endpoints trả advisory thật, có token budget enforcement  
  Req IDs: SM-REQ-18  

- [ ] `SM-P3.4.4` **Shadow run: generate_whale_advisory_task**  
  Owner: Backend Lead  
  Estimate: 1 tuần shadow  
  DoD: 3 ngày parity >= 99% → cutover  
  Req IDs: SM-REQ-09, SM-REQ-18  

---

### Phase 3.5 — user_workspace

- [ ] `SM-P3.5.1` **Portfolio + Transaction + Watchlist models**  
  Owner: Backend Dev  
  Estimate: 6h  
  DoD: Models, migrations, CRUD API endpoints  
  Req IDs: SM-REQ-19  
  Files: `packages/core/backend/src/user_workspace/`

- [ ] `SM-P3.5.2` **Data migration — Portfolio/Transaction/Watchlist**  
  Owner: Backend Dev  
  Estimate: 5h  
  DoD: Parity >= 99%  
  Req IDs: SM-REQ-13, SM-REQ-19  

- [ ] `SM-P3.5.3` **Shadow run: sync_user_watch_assets**  
  Owner: Backend Dev  
  Estimate: 1 tuần shadow  
  Req IDs: SM-REQ-09, SM-REQ-19  

---

### Phase 3.6 — market_data

- [ ] `SM-P3.6.1` **DailyPrice + StockProfile + VnstockRuntimeConfig models**  
  Owner: Backend Dev  
  Estimate: 5h  
  Req IDs: SM-REQ-21  
  Files: `packages/core/backend/src/market_data/`

- [ ] `SM-P3.6.2` **Data migration — DailyPrice + StockProfile**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Parity >= 99%  
  Req IDs: SM-REQ-13, SM-REQ-21  

- [ ] `SM-P3.6.3` **vnstock adapter migration**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: `market_data/adapters/vnstock.py` thay thế legacy adapter  
  Req IDs: SM-REQ-21  

- [ ] `SM-P3.6.4` **Shadow run: prefetch_realtime_ticker_shard → fetch_symbol_batch**  
  Owner: Backend Lead  
  Estimate: 1 tuần shadow  
  DoD: Parity >= 99%  
  Req IDs: SM-REQ-09, SM-REQ-21  

---

## Phase 4 — Frontend Cutover

> **Parallelism**: Có thể bắt đầu sau Phase 2, không cần chờ Phase 3 hoàn toàn.

---

- [ ] `SM-P4.1` **coreApiAdapter.js — expand coverage**  
  Owner: Frontend Lead  
  Estimate: 3h  
  DoD: Tất cả endpoints từ spec mục 8.1 có method wrapper  
  Req IDs: SM-REQ-22  
  Files: `packages/web/src/adapters/coreApiAdapter.js`

- [ ] `SM-P4.2` **Compat layer expansion**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Legacy `/api/` paths có compat mapping sang `/core/v1/` cho paths chưa migrate  
  Req IDs: SM-REQ-22  
  Files: `packages/core/backend/src/vninvest_core/compat_portfolio.py`

- [ ] `SM-P4.3` **Dashboard page migration**  
  Owner: Frontend Lead  
  Estimate: 8h  
  DoD: `packages/web/src/pages/DashboardPage.jsx` functional, i18n, dùng coreApiAdapter  
  Test gate: `npm run build` PASS + smoke test route  
  Req IDs: SM-REQ-22, SM-REQ-23  
  Files: `packages/web/src/pages/DashboardPage.jsx` (new)

- [ ] `SM-P4.4` **WhaleAlerts page migration**  
  Owner: Frontend Lead  
  Estimate: 8h  
  DoD: `WhaleAlertsPage.jsx` functional với data từ core API  
  Req IDs: SM-REQ-22, SM-REQ-23  
  Files: `packages/web/src/pages/WhaleAlertsPage.jsx` (new)

- [ ] `SM-P4.5` **StockDetail page migration**  
  Owner: Frontend Lead  
  Estimate: 12h  
  DoD: `StockDetailPage.jsx` với KLineChart, CVD pane, strength pane, advisory  
  Dependency: SM-P3.3.1 (UnifiedAlert API), SM-P3.4.3 (Advisory API)  
  Req IDs: SM-REQ-22, SM-REQ-23, SM-REQ-24  
  Files: `packages/web/src/pages/StockDetailPage.jsx` (new)

- [ ] `SM-P4.6` **Portfolio + Transactions pages migration**  
  Owner: Frontend Dev  
  Estimate: 8h  
  DoD: CRUD portfolio và transactions functional  
  Dependency: SM-P3.5.2 (data migration complete)  
  Req IDs: SM-REQ-22, SM-REQ-23  

- [ ] `SM-P4.7` **UserConfig page migration**  
  Owner: Frontend Dev  
  Estimate: 4h  
  Req IDs: SM-REQ-22, SM-REQ-23  

- [ ] `SM-P4.8` **Nginx routing cutover**  
  Owner: DevOps  
  Estimate: 2h  
  DoD: Tất cả `/api/*` traffic → `core-api:8100`; nginx access log verify  
  Test gate: `nginx -t` PASS + access log 0 requests to `backend:8000`  
  Req IDs: SM-REQ-22  
  Files: `infra/nginx/`, `docker-compose.prod.yml`

---

## Phase 5 — Infrastructure Hardening

> **Parallelism**: Bắt đầu song song với Phase 3 sau khi Phase 2 complete.

---

- [ ] `SM-P5.1` **PgBouncer connection pooling**  
  Owner: DevOps  
  Estimate: 4h  
  DoD: PgBouncer running, max 500 client conns, pool size 20  
  Test gate: `pgbouncer -d -q /etc/pgbouncer/pgbouncer.ini` + load test 200 concurrent  
  Req IDs: SM-REQ-25  
  Files: `infra/pgbouncer/`, `docker-compose.prod.yml`

- [ ] `SM-P5.2` **Prometheus + Grafana setup**  
  Owner: DevOps  
  Estimate: 6h  
  DoD: 4 dashboards running, alerts configured cho API p95 > 500ms  
  Test gate: Grafana accessible, all scrape targets UP  
  Req IDs: SM-REQ-26  
  Files: `infra/prometheus/`, `infra/grafana/`

- [ ] `SM-P5.3` **Sentry error tracking**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD: Sentry DSN configured, test exception captured  
  Req IDs: SM-REQ-27  
  Files: `packages/core/backend/requirements.txt`, `packages/core/backend/src/vninvest_core/settings.py`

- [ ] `SM-P5.4` **GitHub Actions CI/CD pipeline**  
  Owner: DevOps  
  Estimate: 8h  
  DoD: Push to main → test → build → deploy pipeline; test job phải fail trước khi deploy nếu tests fail  
  Test gate: Trigger pipeline trên test PR, verify all jobs  
  Req IDs: SM-REQ-28  
  Files: `.github/workflows/core-api.yml` (new), `.github/workflows/web.yml` (new)

- [ ] `SM-P5.5` **Automated daily DB backup**  
  Owner: DevOps  
  Estimate: 4h  
  DoD: `daily_db_backup` Celery task chạy 2 AM; backup file upload R2/S3; restore test thành công trên staging  
  Req IDs: SM-REQ-29  
  Files: `packages/core/backend/src/ops_audit/tasks.py`

- [ ] `SM-P5.6` **IntradayTick table partitioning**  
  Owner: Backend Dev  
  Estimate: 4h  
  DoD: Monthly partitions cho `portfolio_intradaytick`; auto-create next month partition  
  Req IDs: SM-REQ-30  
  Files: `backend/portfolio/migrations/xxxx_partition_intradaytick.py` (new)

- [ ] `SM-P5.7` **Load test verification**  
  Owner: QA Lead  
  Estimate: 4h  
  DoD: `k6` load test: 500 VUs, 0 errors, p95 < 200ms  
  Req IDs: SM-REQ-25  
  Files: `infra/load-tests/api-load.js` (new)

---

## Phase 6 — Legacy Decommission

> **HARD GATE**: Tất cả 7 pre-decommission gates phải PASS và được Tech Lead sign off.

---

- [ ] `SM-P6.0` **Pre-decommission gates verification** ← Tất cả gates phải PASS  
  Owner: Tech Lead + QA Lead  
  Estimate: 1 ngày  
  DoD: Checklist 7 gates đầy đủ signed:  
  - Gate A: Data parity >= 99% (all domains)  
  - Gate B: All API endpoints covered by core  
  - Gate C: 0 frontend traffic to legacy (nginx log)  
  - Gate D: 0 critical Sentry alerts in 72h  
  - Gate E: Backup restore test PASS  
  - Gate F: p95 < 200ms at 500 VUs  
  - Gate G: 0 legacy Celery tasks in Redis queue  
  Evidence: signed checklist + screenshots/logs for each gate  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.1` **Tắt legacy containers — monitor 24h**  
  Owner: DevOps  
  Estimate: 30 phút + 24h monitoring  
  DoD: `backend`, `celery_worker`, `celery_beat` containers stopped; 24h không incident  
  Req IDs: SM-REQ-31  
  Files: `docker-compose.prod.yml`

- [ ] `SM-P6.2` **Xoá nginx legacy routing block**  
  Owner: DevOps  
  Estimate: 1h  
  DoD: Nginx không còn proxy tới `backend:8000`; access log verify 0 requests  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.3` **Git archive tag + xoá frontend/ legacy code**  
  Owner: Tech Lead  
  Estimate: 2h  
  DoD: `git tag legacy-monolith-archive-20260504`; `git rm -r frontend/`; deploy; 24h monitoring  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.4` **Xoá backend/ legacy code**  
  Owner: Tech Lead  
  Estimate: 2h  
  DoD: `git rm -r backend/`; deploy; 48h monitoring  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.5` **Rename legacy DB tables → _deprecated_ prefix**  
  Owner: Backend Lead  
  Estimate: 2h  
  DoD: Tất cả `portfolio_*` tables renamed; giữ 30 ngày  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.6` **Cleanup root-level legacy files**  
  Owner: Backend Dev  
  Estimate: 2h  
  DoD: Xoá debug_*.py, check_setting.py, test_ticker*.py, gen_token.py  
  Req IDs: SM-REQ-31  

- [ ] `SM-P6.7` **Regenerate module_tree_full.md + update progress docs**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD: `module_tree_full.md` reflect cấu trúc mới; `PROGRESS_DASHBOARD.md` + `CODE_CHANGE_AUDIT_LEDGER.md` updated  
  Req IDs: SM-REQ-32  
  Files: `module_tree_full.md`, `PROGRESS_DASHBOARD.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`

---

## Phase 7 — Post-Production Validation (Ongoing)

---

- [ ] `SM-P7.1` **Week 1 monitoring — zero incidents target**  
  Owner: Tất cả  
  DoD: 7 ngày liên tiếp không có unhandled exception mới trong Sentry  
  Req IDs: SM-REQ-33  

- [ ] `SM-P7.2` **VNPay subscription integration thật**  
  Owner: Backend Lead  
  Estimate: 2 tuần  
  Req IDs: SM-REQ-34  

- [ ] `SM-P7.3` **Quota enforcement activation**  
  Owner: Backend Dev  
  Estimate: 3h  
  DoD: Free users bị từ chối advisory generation khi vượt token budget  
  Req IDs: SM-REQ-14, SM-REQ-34  

---

## Tổng kết tasks theo số lượng

| Phase | Total tasks | Critical path |
|---|---|---|
| Phase 0 | 4 | YES |
| Phase 1 | 6 | YES |
| Phase 2 | 5 | YES |
| Phase 3 | 22 | YES |
| Phase 4 | 8 | YES |
| Phase 5 | 7 | PARALLEL |
| Phase 6 | 7 | FINAL GATE |
| Phase 7 | 3 | ONGOING |
| **Total** | **62** | — |
