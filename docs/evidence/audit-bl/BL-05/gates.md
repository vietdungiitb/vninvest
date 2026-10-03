# BL-05 gates — nối PgBouncer prod (PARTIAL; soak sau deploy) (2026-09-24)

## Change (`docker-compose.prod.yml`)
- 5 Django services (`core-api`, `core-worker`, `realtime-prefetch`, `realtime-stream`, `core-beat`): `CORE_DATABASE_URL` → `@pgbouncer:6432` + `CORE_DB_CONN_MAX_AGE=0` (tránh double-pooling).
- `core-api` `depends_on` thêm `pgbouncer: service_healthy`.
- New `infra/pgbouncer/RUNBOOK.md` (check pools, bypass drill <10 phút, soak).

## Gates
- `docker compose -f docker-compose.prod.yml config --quiet` (dummy env): **exit 0**.
- Grep: 5 URL pooler + 5 `CONN_MAX_AGE=0`, 0 sót `core-db:5432` trong Django URLs.
- Transaction-mode compat: Django + `CONN_MAX_AGE=0` là cấu hình chuẩn cho pooler (không dùng prepared-statement persistent); verify runtime thuộc soak.

## Còn lại (sau deploy prod)
- [ ] Boot prod: `SHOW POOLS` có client, api healthy.
- [ ] Soak 24h (`sv_active`/`cl_waiting`/pooler errors) + bypass drill → `drill-YYYYMM.md` (gộp với BL-13 nếu trùng lịch).

## DoD tick
- [x] config valid · [x] runbook · [ ] soak + drill (post-deploy).
