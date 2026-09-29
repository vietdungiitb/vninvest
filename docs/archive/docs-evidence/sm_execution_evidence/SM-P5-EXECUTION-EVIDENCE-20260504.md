# SM-P5 — Infrastructure Hardening: Execution Evidence

**Phase**: SM-P5 (Infrastructure Hardening)  
**Date**: 2026-05-04 (continued session)  
**Status**: COMPLETE

---

## 1. Files Changed

| File | Change | Slice |
|------|--------|-------|
| `infra/pgbouncer/pgbouncer.ini` | CREATED — PgBouncer config (max 500 client conns, pool 20) | SM-P5.1 |
| `infra/pgbouncer/userlist.txt.example` | CREATED — Credential template (md5 hash format) | SM-P5.1 |
| `docker-compose.prod.yml` | MODIFIED — Added pgbouncer, prometheus, grafana services + volumes | SM-P5.1/P5.2 |
| `infra/prometheus/prometheus.yml` | CREATED — Prometheus scrape config (core-api, backend, redis, pgbouncer) | SM-P5.2 |
| `infra/grafana/provisioning/datasources/prometheus.yml` | CREATED — Auto-provision Prometheus datasource | SM-P5.2 |
| `infra/grafana/provisioning/dashboards/dashboard-provider.yml` | CREATED — Dashboard file provider config | SM-P5.2 |
| `infra/grafana/dashboards/api-overview.json` | CREATED — API Overview dashboard (request rate, p95, errors, PgBouncer, Redis) | SM-P5.2 |
| `packages/core/backend/requirements.txt` | MODIFIED — Added sentry-sdk[django], django-prometheus | SM-P5.3 |
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFIED — Sentry init (conditional on SENTRY_DSN), django-prometheus middleware + app, daily-db-backup beat schedule | SM-P5.3/P5.5 |
| `packages/core/backend/src/vninvest_core/urls.py` | MODIFIED — Added django_prometheus.urls (exposes /metrics/) | SM-P5.2 |
| `packages/core/backend/src/ops_audit/tasks.py` | CREATED — daily_db_backup task (pg_dump → gzip → S3/R2 optional upload) | SM-P5.5 |
| `.github/workflows/core-api.yml` | CREATED — CI: test → build Docker image on push to main | SM-P5.4 |
| `.github/workflows/web.yml` | CREATED — CI: frontend lint + build on push to main/dev | SM-P5.4 |
| `backend/portfolio/migrations/0069_partition_intradaytick.py` | CREATED — Monthly RANGE partitioning for portfolio_intradaytick | SM-P5.6 |
| `backend/portfolio/tasks.py` | MODIFIED — Added create_next_month_partition task | SM-P5.6 |
| `backend/config/settings.py` | MODIFIED — Added create-next-month-partition beat schedule | SM-P5.6 |
| `infra/load-tests/api-load.js` | CREATED — k6 load test (500 VUs, p95 < 200ms threshold) | SM-P5.7 |

---

## 2. Validation Commands and Results

### Python syntax check (6 files)

```
OK packages/core/backend/src/vninvest_core/settings.py
OK packages/core/backend/src/vninvest_core/urls.py
OK packages/core/backend/src/ops_audit/tasks.py
OK backend/portfolio/tasks.py
OK backend/config/settings.py
OK backend/portfolio/migrations/0069_partition_intradaytick.py
```

### docker-compose.prod.yml config validation

```
docker compose -f docker-compose.prod.yml config --quiet → Exit: 0
(with required env vars set: POSTGRES_PASSWORD, CORE_DB_PASSWORD, CORE_DJANGO_SECRET_KEY,
 CORE_ALLOWED_HOSTS, CORE_CORS_ALLOWED_ORIGINS, GRAFANA_ADMIN_PASSWORD)
```

---

## 3. Infrastructure Summary

### SM-P5.1 PgBouncer
- Config: `infra/pgbouncer/pgbouncer.ini`
- Max client connections: 500
- Default pool size: 20 per database
- Pool mode: transaction
- Bitnami PgBouncer image (env-var driven config)

### SM-P5.2 Prometheus + Grafana
- Prometheus: scrapes core-api (/metrics/), backend, pgbouncer, redis
- Grafana: auto-provisioned with Prometheus datasource + API Overview dashboard
- Dashboard alerts: p95 > 500ms

### SM-P5.3 Sentry
- `sentry-sdk[django]` + `django-prometheus` added to requirements
- Conditional init (only activates if SENTRY_DSN env set)
- PII disabled, traces_sample_rate=0.1

### SM-P5.4 GitHub Actions
- `core-api.yml`: test (Postgres 16 + Redis services) → push Docker image to GHCR on main
- `web.yml`: install → build frontend → upload artifact on main

### SM-P5.5 Daily Backup
- Beat schedule: 02:00 AM daily
- `pg_dump` → gzip compression
- Optional S3/R2 upload (BACKUP_S3_BUCKET env)
- 2 GB size guard warning

### SM-P5.6 IntradayTick Partitioning
- Migration `0069` creates RANGE-partitioned table (by trade_date)
- Partitions: 2026-01 through 2026-06 pre-created
- Auto-partition task runs on 20th of each month at 02:15 AM

### SM-P5.7 k6 Load Test
- 4 stages: ramp 100→300→500 VUs, hold 2m, ramp down
- Thresholds: p95 < 200ms, error_rate < 1%
- Tests: /health, /api/whale-alerts/, snapshot, daily-prices

---

## 4. Residual Risks

- PgBouncer `userlist.txt` must be generated with proper md5 hashes before prod deploy (do NOT use plain passwords)
- `infra/grafana/dashboards/api-overview.json` uses `django_http_requests_*` metric names from `django-prometheus` — verify metric names after first deploy
- `0069_partition_intradaytick.py`: run only AFTER full backup verified; SQL uses INSERT INTO for data migration between Jan-Jun 2026 only — data outside this range remains in `_archive` table
- Sentry DSN must be provisioned and set in prod env before error tracking activates
- k6 load test requires `CORE_PAT` env var for authenticated endpoints

---

## 5. Phase 5 DoD Checklist

- [x] SM-P5.1: PgBouncer config + compose service
- [x] SM-P5.2: Prometheus + Grafana setup with 4 dashboards/panels + alerts
- [x] SM-P5.3: Sentry SDK integrated (conditional init), django-prometheus for metrics
- [x] SM-P5.4: GitHub Actions CI (core-api.yml + web.yml)
- [x] SM-P5.5: daily_db_backup task (pg_dump → gzip → S3/R2)
- [x] SM-P5.6: IntradayTick RANGE partitioning migration + auto-partition Celery task
- [x] SM-P5.7: k6 load test script (500 VUs, p95 < 200ms threshold)
- [x] All Python files pass syntax check
- [x] docker-compose.prod.yml config validates
