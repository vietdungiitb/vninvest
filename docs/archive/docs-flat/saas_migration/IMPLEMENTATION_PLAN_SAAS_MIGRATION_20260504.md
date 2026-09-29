# IMPLEMENTATION PLAN — SaaS Production Migration & Legacy Monolith Decommission

**Ngày tạo**: 2026-05-04  
**Scope**: Toàn bộ migration từ hybrid legacy sang SaaS production-grade  
**Level**: A (major architecture overhaul, multi-domain, multi-team)  
**Status**: APPROVED — READY FOR EXECUTION

---

## 1. Business objective

### Vấn đề cần giải quyết

Hệ thống VNInvest hiện đang ở trạng thái **hybrid không ổn định**:

1. `packages/core/backend/` (SaaS core) không có data do materializers trỏ sai bảng.
2. `backend/` (legacy monolith) đang gánh toàn bộ production traffic nhưng không scalable.
3. Bảo mật có ít nhất 6 lỗ hổng xác định từ audit (JWT, PAT hash, CORS, secrets).
4. Production Docker compose mount source code trực tiếp — không phải immutable build.
5. Không có monitoring, không có backup tự động, không có CI/CD.
6. Hai frontend (`frontend/src/` và `packages/web/src/`) tồn tại song song gây confusion.

### Mục tiêu nghiệp vụ

1. Dừng hoàn toàn legacy monolith mà không ảnh hưởng users.
2. SaaS core phục vụ toàn bộ traffic với bảo mật và hiệu năng tốt hơn.
3. Codebase sạch, một nguồn code duy nhất, dễ maintain và extend.
4. Infrastructure production-grade với monitoring, backup và CI/CD.

### KPI đầu ra

| Chỉ số | Baseline (hiện tại) | Target |
|---|---|---|
| API p95 latency | ~400ms | < 200ms |
| Max concurrent users | ~80 | 500+ |
| Security issues (audit count) | 6 critical | 0 |
| MTTR khi incident | Unknown | < 30 phút |
| Deployment downtime | Manual, risky | < 5 phút (blue-green) |
| Test coverage core | Unknown | >= 80% branches |
| Docker containers in prod | ~8 hybrid | ~7 clean SaaS |
| Lines of code | ~150k (+ legacy) | ~80k (core only) |

---

## 2. Scope và non-scope

### In-scope

1. Sửa materializers để core API có data (Phase 0).
2. Sửa 6 lỗ hổng bảo mật đã audit (Phase 1).
3. Tách database và kích hoạt real Celery (Phase 2).
4. Di cư 6 domains business logic từ legacy sang core (Phase 3).
5. Di cư frontend sang packages/web (Phase 4).
6. PgBouncer, Prometheus, Grafana, Sentry, CI/CD, partitioning (Phase 5).
7. Xoá legacy code sau khi verify parity (Phase 6).

### Out-of-scope (trong chương trình này)

1. Không thay đổi chart engine (KLineChart giữ nguyên).
2. Không thay đổi selected-session semantics trong whale route.
3. Không thay đổi vnbroker provider logic (giữ nguyên KBS/VCI adapter).
4. Không build mobile app hoặc OpenCore public SDK.
5. Không refactor AI prompt logic ngoài di cư domain advisory.

---

## 3. Phase 0 — Fix immediate blockers (Ưu tiên CRITICAL)

**Ước tính**: 3-5 ngày làm việc  
**Owner**: Backend Lead  
**Prerequisite**: Không có — phải làm đầu tiên

### P0.1 — Fix materializers SQL (Blocker #1)

**Vấn đề gốc**: `packages/core/backend/src/market_serving/materializers.py` query bảng không tồn tại (`portfolio_symbolsnapshot`, `portfolio_sessionfacts`).

**File cần sửa**: `packages/core/backend/src/market_serving/materializers.py`

**Hành động**:
1. Rewrite `_materialize_symbol_snapshot()` với SQL đúng từ `portfolio_tickersessionclose`.
2. Rewrite `_materialize_session_facts()` với SQL đúng từ `portfolio_advisoryaggregatesnapshot` JSONB extraction.
3. Rewrite `_materialize_unified_alerts()` với SQL đúng từ `portfolio_whalealertevent`.
4. Thêm `source_table` field vào logging để trace.
5. Thêm unit test cho mỗi SQL query.

**Validation**:
```bash
# Chạy materializer thủ công
docker compose -f docker-compose.dev.yml exec core-api \
  python manage.py shell -c "
from market_serving.materializers import materialize_symbol_snapshot, materialize_session_facts
r1 = materialize_symbol_snapshot()
r2 = materialize_session_facts()
print('SymbolSnapshot:', r1)
print('SessionFacts:', r2)
assert r1['upserted'] > 0, 'FAIL: No data upserted for SymbolSnapshot'
assert r2['upserted'] > 0, 'FAIL: No data upserted for SessionFacts'
print('PASS: Materializers working')
"

# Verify via API
curl -H "Authorization: Bearer <PAT>" \
  http://localhost:8100/core/v1/market/symbol-snapshot/ | python -m json.tool
```

**Exit criteria**: API `/core/v1/market/symbol-snapshot/` trả về `data` không rỗng, `upserted > 0`.

---

### P0.2 — Add CONN_MAX_AGE to legacy backend (Performance blocker)

**File cần sửa**: `backend/config/settings.py`

**Hành động**:
```python
DATABASES = {
    "default": {
        ...,
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}
```

**Validation**:
```bash
docker compose -f docker-compose.dev.yml restart backend
# Check không có ConnectTimeout trong logs sau restart
docker compose logs backend --tail=50 | grep -i "error\|connect"
```

---

### P0.3 — Create Dockerfile cho packages/core (Remove source mount)

**File cần tạo**: `packages/core/backend/Dockerfile`  
**File cần sửa**: `docker-compose.prod.yml` (xoá volume mount), `docker-compose.dev.yml` (giữ mount nhưng đổi command)

**Hành động**:
1. Tạo multi-stage Dockerfile theo spec tại `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 9.1.
2. Tạo `packages/core/backend/entrypoint.sh` (migrate trước start).
3. Update `docker-compose.prod.yml` — xoá `volumes: - ./packages/core/backend:/workspace`.
4. Update `docker-compose.prod.yml` — đổi `command` từ `api_stub` sang `gunicorn`.

**Validation**:
```bash
# Build thử
docker build -t vninvest-core-api:test packages/core/backend/
# Phải build thành công không lỗi

# Test container start
docker run --rm -e DEBUG=0 -e DJANGO_SECRET_KEY=test-key \
  vninvest-core-api:test python manage.py check --deploy
```

---

### P0.4 — Separate migrate from startup

**File cần tạo**: `packages/core/backend/entrypoint.sh`  
**File cần sửa**: `docker-compose.dev.yml`, `docker-compose.prod.yml`

**Xem spec chi tiết tại**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 9.2

---

## 4. Phase 1 — Security hardening (HIGH PRIORITY)

**Ước tính**: 5-7 ngày làm việc  
**Owner**: Backend Lead + Tech Lead review  
**Prerequisite**: Phase 0 complete  
**Gate**: Tất cả 6 security issues từ audit phải resolved trước khi move on

### P1.1 — Enable JWT Token Blacklist

**Files cần sửa**:
- `backend/config/settings.py`
- `backend/requirements.txt`

**Hành động**:
1. Thêm `'rest_framework_simplejwt.token_blacklist'` vào `INSTALLED_APPS`.
2. Set `'BLACKLIST_AFTER_ROTATION': True` trong `SIMPLE_JWT`.
3. Set `'ROTATE_REFRESH_TOKENS': True`.
4. Chạy `python manage.py migrate` để tạo blacklist tables.
5. Test: login → logout → dùng refresh token cũ → phải nhận 401.

**Validation**:
```bash
cd backend
../.venv/Scripts/python.exe manage.py migrate
../.venv/Scripts/python.exe manage.py test \
  portfolio.tests.test_jwt_blacklist --keepdb -v 2
```

---

### P1.2 — Fix PAT HMAC pepper

**Files cần sửa**:
- `backend/portfolio/models.py` — function `_hash_pat_secret`
- `packages/core/backend/src/identity_access/models.py` — function `_hash_pat_secret`

⚠️ **CRITICAL: Phải tạo management command rotate trước khi deploy**

**Hành động**:
1. Sửa hàm `_hash_pat_secret` ở cả hai nơi — xem spec tại `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 4.2.
2. Tạo management command `backend/portfolio/management/commands/rotate_all_pat_tokens.py`.
3. Test command rotate trên staging trước khi deploy production.
4. Thông báo cho tất cả service accounts 48h trước khi deploy.
5. Sau khi rotate, verify tất cả existing PAT đều invalid với hash cũ và valid với hash mới.

**Management command**:
```python
# backend/portfolio/management/commands/rotate_all_pat_tokens.py
class Command(BaseCommand):
    help = 'Rehash tất cả PAT tokens với HMAC pepper mới. Chạy TRƯỚC khi deploy hash fix.'
    
    def handle(self, *args, **options):
        # 1. Đọc tất cả PAT còn active
        # 2. Với mỗi PAT: generate new raw secret, hash lại với HMAC, update DB
        # 3. Email/log mapping old_token_id → new_raw_secret cho service accounts
        pass
```

---

### P1.3 — Lock ALLOWED_HOSTS (Core API)

**File cần sửa**: `packages/core/backend/src/vninvest_core/settings.py`  
**Xem spec**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 4.3

**Validation**:
```bash
# Test không set env var → phải raise ImproperlyConfigured
docker run --rm -e DEBUG=0 -e DJANGO_SECRET_KEY=test \
  vninvest-core-api:test python -c "
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'vninvest_core.settings'
import django
try:
    django.setup()
    print('FAIL: Should have raised ImproperlyConfigured')
except Exception as e:
    if 'DJANGO_ALLOWED_HOSTS' in str(e):
        print('PASS: Correctly raised ImproperlyConfigured')
    else:
        raise
"
```

---

### P1.4 — Lock CORS

**File cần sửa**: `packages/core/backend/src/vninvest_core/settings.py`  
**Xem spec**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 4.4

---

### P1.5 — Remove default passwords from prod compose

**File cần sửa**: `docker-compose.prod.yml`

**Hành động**: Thay tất cả hardcoded passwords bằng `${VAR:?error}` syntax.  
**Xem spec**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 4.5

**Validation**:
```bash
# Phải fail khi thiếu env vars
docker compose -f docker-compose.prod.yml config 2>&1 | grep -i "must be set"
```

---

### P1.6 — Email credential guard

**File cần sửa**: `backend/portfolio/apps.py` hoặc `AppConfig.ready()`  
**Xem spec**: `docs/SAAS_PRODUCTION_MIGRATION_MASTER_PLAN_20260504.md` Phase 1 mục 1.5

---

## 5. Phase 2 — SaaS data plane live (HIGH PRIORITY)

**Ước tính**: 2-3 tuần  
**Owner**: Backend Lead  
**Prerequisite**: Phase 0 + Phase 1 complete

### P2.1 — Activate core-db PostgreSQL

**Files cần sửa**: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `packages/core/backend/src/vninvest_core/settings.py`

**Hành động**:
1. Uncomment `core-db` service trong `docker-compose.prod.yml`.
2. Thêm `legacy` database connection (readonly) vào core settings — xem spec mục 5.
3. Implement `CoreRouter` — xem spec mục 5.2.
4. Chạy `python manage.py migrate` để tạo tất cả core tables.
5. Verify readonly constraint: thử ghi vào legacy từ core → phải bị block.

---

### P2.2 — Activate real Celery workers (Replace stubs)

**Files cần sửa**: `docker-compose.dev.yml`, `docker-compose.prod.yml`

**Hành động**:
1. Đổi `core-worker` command từ stub sang: `celery -A vninvest_core worker -l info -Q core,ingest --concurrency=2`.
2. Đổi `core-beat` command từ stub sang: `celery -A vninvest_core beat -l info --scheduler=django_celery_beat.schedulers:DatabaseScheduler`.
3. Thêm `django-celery-beat` vào `packages/core/backend/requirements.txt`.
4. Verify beat schedule từ `packages/core/backend/src/vninvest_core/celery.py` đang trigger đúng.

**Validation**:
```bash
# Verify worker nhận task
docker compose exec core-api \
  celery -A vninvest_core inspect active
# Phải trả về worker info, không phải timeout

# Verify beat schedule
docker compose logs core-beat --tail=20
# Phải thấy "Scheduler: Sending due task materialize_symbol_snapshot"
```

---

### P2.3 — data_ingest domain skeleton

**Thư mục cần tạo**: `packages/core/backend/src/data_ingest/`

**Files cần tạo**:
- `models.py` — `IngestJob`, `IngestRun`, `MarketFeedEvent`
- `vnbroker_feed.py` — Wrapper vnbroker (clone từ legacy `adapters/vnbroker_adapter.py`)
- `tasks.py` — `fetch_and_upsert_price_board`
- `apps.py`, `migrations/`

**Scope Phase 2**: Chỉ cần skeleton + basic ingest task. Full migration Celery tasks là Phase 3.

---

### P2.4 — Verify live endpoints

Sau khi P2.1 + P2.2 hoàn thành:

```bash
# Verify tất cả endpoints sống
PAT="<test-pat>"

# SymbolSnapshot
curl -sf -H "Authorization: Bearer $PAT" \
  http://localhost:8100/core/v1/market/symbol-snapshot/?symbol=VNM | python -m json.tool

# SessionFacts
curl -sf -H "Authorization: Bearer $PAT" \
  http://localhost:8100/core/v1/market/session-facts/?symbol=VNM | python -m json.tool

# UnifiedAlerts
curl -sf -H "Authorization: Bearer $PAT" \
  http://localhost:8100/core/v1/signals/unified-alerts/?symbol=VNM | python -m json.tool
```

---

## 6. Phase 3 — Business logic migration

**Ước tính**: 4-6 tuần  
**Owner**: Backend Lead + Backend Dev  
**Prerequisite**: Phase 2 complete  
**Approach**: Từng domain theo thứ tự dependency (xem `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 2.1)

### Thứ tự thực hiện

1. `identity_access` — UserProfile + Subscription merge
2. `commercial` — full Subscription + Quota + Plan enforcement
3. `signal_intelligence` — UnifiedAlert + OrderFlowEvent + ForensicWindow
4. `advisory` — AdvisoryRecord + TokenBudget + SystemAISettings
5. `user_workspace` — Portfolio + Transaction + Watchlist
6. `market_data` — DailyPrice + StockProfile + VnbrokerRuntimeConfig

### Quy tắc chung cho mỗi domain migration

1. **Tạo model mới trong core domain** theo spec mục 6.
2. **Viết data migration script** đọc từ legacy DB và insert vào core DB.
3. **Test parity**: sample 1000 records từ legacy vs core, verify >= 99% match.
4. **Shadow run tasks** ít nhất 3 ngày trade trước cutover.
5. **Viết API endpoint** và integration test.
6. **Cutover**: tắt legacy task, verify 48 giờ không có incident.

### P3.1 — identity_access completion

**Legacy models cần migrate**:
- `portfolio.UserConfig` (phi-commercial fields) → `identity_access.UserProfile`
- `portfolio.TelegramProfile` → `identity_access.NotificationProfile`
- `portfolio.OnboardingPlanPolicy` → `commercial.TrialPolicy`

**Management commands cần tạo**:
```bash
python manage.py migrate_userprofiles_to_core --dry-run
python manage.py migrate_userprofiles_to_core --execute
```

### P3.2 — commercial domain

**Legacy models cần migrate**:
- `portfolio.UserConfig` (plan, plan_expires_at, advisory_max_tokens_per_day) → `commercial.Subscription` + `commercial.Quota`
- `portfolio.PlanAssignmentLog` → `commercial.PlanAuditLog`

**Celery tasks cần migrate**:
- `tasks_plan.process_plan_lifecycle_transitions` → `commercial.tasks.process_subscriptions`

### P3.3 — signal_intelligence domain

**Legacy models cần migrate**:
- `portfolio.WhaleAlertEvent` → `signal_intelligence.UnifiedAlert` (domain='whale')
- `portfolio.OrderFlowSignal` → `signal_intelligence.OrderFlowEvent`
- `portfolio.MoneyFlowForensicWindow` → `signal_intelligence.ForensicWindow`
- `portfolio.SignalVerification` → `signal_intelligence.SignalAudit`

**Celery tasks cần migrate (shadow run)**:
- `tasks_whale_service.detect_and_store_global_whale_alerts`
- `tasks_order_flow.detect_and_store_order_flow`
- `tasks_order_flow.detect_whale_reversal`
- `tasks_order_flow.distribute_order_flow_signal`

### P3.4 — advisory domain

**Legacy models cần migrate**:
- `portfolio.WhaleAdvisory` → `advisory.AdvisoryRecord`
- `portfolio.SystemAISettings` → `advisory.SystemAISettings`
- `portfolio.AITokenUsageLog` → `advisory.TokenUsageLog`

**Legacy service files cần migrate**:
- `portfolio/ai_service.py` → `advisory/ai_client.py`
- `portfolio/ai_prompt_config_ssot.py` → `advisory/prompt_engine.py`
- `portfolio/openclaw_client.py` → `advisory/providers/openclaw.py`

**Celery tasks cần migrate (shadow run)**:
- `tasks_whale_advisory.generate_whale_advisory_task`
- `tasks_whale_generation.auto_generate_advisories_for_all_tracked`
- `tasks_whale_auto_generation.schedule_advisory_refresh`

### P3.5 — user_workspace domain

**Legacy models cần migrate**:
- `portfolio.Portfolio` → `user_workspace.Portfolio`
- `portfolio.SubAccount` → `user_workspace.SubAccount`
- `portfolio.Transaction` → `user_workspace.Transaction`
- `portfolio.WatchlistGroup` → `user_workspace.WatchlistGroup`
- `portfolio.WatchlistItem` → `user_workspace.WatchlistItem`

**Celery tasks cần migrate**:
- `tasks_portfolio.sync_user_watch_assets`
- `tasks_portfolio.generate_all_portfolio_news_digests_task`

### P3.6 — market_data domain

**Legacy models cần migrate**:
- `portfolio.DailyPrice` → `market_data.DailyPrice`
- `portfolio.StockProfile` → `market_data.StockProfile`
- `portfolio.RuntimeVnbrokerConfig` → `market_data.VnbrokerRuntimeConfig`

**Legacy service files cần migrate**:
- `portfolio/adapters/vnbroker_adapter.py` → `market_data/adapters/vnbroker.py`
- `portfolio/market_data_service.py` → `market_data/service.py`

**Celery tasks cần migrate**:
- `tasks_prefetch.prefetch_realtime_ticker_shard` → `data_ingest.tasks.fetch_symbol_batch`
- `tasks_realtime.collect_and_publish_realtime` → `data_ingest.tasks.publish_realtime_snapshot`
- `tasks_marketdata.sync_stock_profiles` → `market_data.tasks.sync_stock_profiles`

---

## 7. Phase 4 — Frontend cutover

**Ước tính**: 2-3 tuần  
**Owner**: Frontend Lead  
**Prerequisite**: Phase 3 domains = signal_intelligence + market_serving hoàn thành (vì StockDetail cần cả hai)  
**Parallelism**: Có thể bắt đầu song song với Phase 3

### Thứ tự migration pages

1. Dashboard (P4.1) — signal đơn giản nhất, data source rõ
2. WhaleAlerts (P4.2) — core feature, test user traffic cao nhất
3. StockDetail (P4.3) — phức tạp nhất, cần KLineChart + CVD + advisory
4. Portfolio + Transactions (P4.4)
5. UserConfig + Settings (P4.5)
6. Admin pages (P4.6)

### P4.1 — Dashboard migration

**Legacy source**: `frontend/src/pages/Dashboard.jsx`  
**Target**: `packages/web/src/pages/DashboardPage.jsx`

**Quy tắc**:
- Không copy-paste từ legacy.
- Viết lại hoàn toàn theo React 19 patterns trong packages/web.
- Dùng `coreApiAdapter.js` cho mọi API call.
- Text tiếng Việt phải qua i18n file.

### P4.2 — WhaleAlerts + StockDetail

**Legacy source**: `frontend/src/pages/WhaleAlertsDashboard.jsx`, `StockDetail.jsx`  
**Constraint từ AGENTS.md**: Không sửa `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx` (immutable sources).

### P4.3 — Compat layer expansion

**File cần sửa**: `packages/core/backend/src/vninvest_core/compat_portfolio.py`

Mở rộng compat layer để cover tất cả endpoints mà legacy frontend đang dùng, trong khi pages chưa migrate xong.

### P4.4 — Nginx routing cutover

Sau khi tất cả pages đã migrate và test:
1. Update nginx để chuyển traffic từ `backend:8000` sang `core-api:8100` cho các paths đã cutover.
2. Giữ legacy routing trong 48 giờ để hotfix nếu cần.
3. Remove legacy nginx block sau 48 giờ ổn định.

---

## 8. Phase 5 — Infrastructure hardening

**Ước tính**: 2-3 tuần  
**Owner**: DevOps  
**Prerequisite**: Phase 2 complete  
**Parallelism**: Phần lớn có thể chạy song song với Phase 3-4

### P5.1 — PgBouncer

**Files cần tạo**: `infra/pgbouncer/pgbouncer.ini`, `infra/pgbouncer/userlist.txt`  
**Files cần sửa**: `docker-compose.prod.yml`  
**Xem spec**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 9.3

### P5.2 — Prometheus + Grafana

**Files cần tạo**: `infra/prometheus/prometheus.yml`, `infra/grafana/dashboards/*.json`  
**Files cần sửa**: `docker-compose.prod.yml`, `packages/core/backend/requirements.txt`  
**Xem spec**: `TECH_SPEC_SAAS_MIGRATION_20260504.md` mục 9.4

**Dashboards tối thiểu**:
1. Infrastructure Overview (containers, DB, Redis health)
2. API Performance (latency p50/p95/p99 per endpoint)
3. Business KPIs (DAU, advisory gen count, whale alert volume)
4. Celery Health (queue depth, task success rate, processing time)

### P5.3 — Sentry integration

**Files cần sửa**: `packages/core/backend/requirements.txt`, `packages/core/backend/src/vninvest_core/settings.py`

### P5.4 — GitHub Actions CI/CD

**Files cần tạo**: `.github/workflows/core-api.yml`, `.github/workflows/web.yml`

Pipeline tối thiểu:
1. `test` job: pytest, coverage >= 80%.
2. `build` job: docker build + push to ghcr.io.
3. `deploy` job: rolling update trên production.

### P5.5 — IntradayTick partitioning

**Files cần tạo**: `backend/portfolio/migrations/xxxx_partition_intradaytick.py`

Tạo monthly partitions cho `portfolio_intradaytick` để giảm index size và cleanup hiệu quả hơn.

### P5.6 — Automated DB backup

**Files cần tạo**: `packages/core/backend/src/ops_audit/tasks.py` — `daily_db_backup` task  
**Schedule**: `crontab(hour=2, minute=0)` — 2:00 AM hàng ngày  
**Destination**: Cloudflare R2 hoặc AWS S3 bucket `vninvest-backups`

---

## 9. Phase 6 — Legacy decommission

**Ước tính**: 1-2 tuần  
**Owner**: Tech Lead + Backend Lead + DevOps  
**Prerequisite**: Phase 3 + Phase 4 + Phase 5 ALL complete  
**Gate**: Tất cả 7 pre-decommission gates PASS — xem `SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`

### Decommission sequence

1. **D1** — Tắt legacy containers (backend, celery_worker, celery_beat). Monitor 24h.
2. **D2** — Verify zero traffic tới legacy endpoints. Xoá nginx legacy routing block.
3. **D3** — Git tag `legacy-monolith-archive-$(date +%Y%m%d)` trước khi xoá.
4. **D4** — `git rm -r frontend/`. Commit. Deploy. Monitor 24h.
5. **D5** — `git rm -r backend/`. Commit. Deploy. Monitor 48h.
6. **D6** — Rename legacy DB tables sang `_deprecated_` prefix. Giữ 30 ngày.
7. **D7** — Cleanup root-level legacy scripts và audit files.
8. **D8** — Regenerate `module_tree_full.md`.
9. **D9** — Update `PROGRESS_DASHBOARD.md` và `CODE_CHANGE_AUDIT_LEDGER.md`.

---

## 10. Phase 7 — Post-production validation

**Owner**: Tất cả  
**Ongoing**: Liên tục sau decommission

### Tuần 1 — Monitoring intensive

- Daily review Sentry — zero unhandled exceptions.
- Daily check Grafana — p95 latency < 200ms, uptime > 99.9%.
- Weekly backup restore test trên staging.
- Daily Celery health check — queue depth và success rate.

### Tháng 1 — SaaS billing activation

1. Integrate VNPay subscription endpoint thật.
2. Enable MoMo recurring payment.
3. Activate `commercial.Quota` enforcement.
4. Set up Stripe nếu cần international users.

### Ongoing — Codebase health

1. Weekly dependency vulnerability scan (`pip-audit`, `npm audit`).
2. Monthly performance review và tuning.
3. Quarterly capacity planning review.

---

## 11. Phụ lục — Migration data script template

```python
# Template cho mỗi domain migration script
# Tạo tại: packages/core/backend/src/<domain>/management/commands/migrate_<domain>_from_legacy.py

class Command(BaseCommand):
    help = 'Di cư <domain> data từ legacy DB sang core DB'
    
    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Kiểm tra mà không ghi thật')
        parser.add_argument('--batch-size', type=int, default=1000,
                            help='Số records mỗi batch')
        parser.add_argument('--from-date', type=str,
                            help='Ngày bắt đầu (YYYY-MM-DD)')
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        
        # 1. Count legacy records
        legacy_count = self._count_legacy_records()
        self.stdout.write(f'Legacy records: {legacy_count}')
        
        # 2. Batch read từ legacy, write vào core
        migrated = 0
        errors = 0
        for batch in self._read_legacy_batches(batch_size):
            try:
                if not dry_run:
                    self._write_core_batch(batch)
                migrated += len(batch)
            except Exception as e:
                errors += len(batch)
                self.stderr.write(f'Error in batch: {e}')
        
        # 3. Verify parity
        if not dry_run:
            core_count = self._count_core_records()
            parity = core_count / legacy_count * 100 if legacy_count > 0 else 0
            self.stdout.write(f'Parity: {parity:.1f}% ({core_count}/{legacy_count})')
            if parity < 99.0:
                raise CommandError(f'Parity below threshold: {parity:.1f}% < 99%')
        
        self.stdout.write(self.style.SUCCESS(
            f'DONE: migrated={migrated}, errors={errors}'
        ))
```
