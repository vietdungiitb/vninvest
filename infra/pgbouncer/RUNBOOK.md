# BL-05 — PgBouncer Runbook (prod)

## Trạng thái
`docker-compose.prod.yml`: mọi Django service (`core-api`, `core-worker`, `core-worker-realtime-prefetch`, `core-worker-realtime-stream`, `core-beat`) đi qua `pgbouncer:6432` (transaction mode, pool 20, `SHOW POOLS` để kiểm tra `sv_active`/`cl_waiting`), `CORE_DB_CONN_MAX_AGE=0` (tránh double-pooling). `core-api` chờ `pgbouncer` healthy mới boot.

## Kiểm tra pooler sống
`docker exec vninvest-pgbouncer psql -h 127.0.0.1 -p 6432 -U vninvest -d vninvest_core -c "SHOW POOLS;"`
Pass khi: `sv_active` > 0 sau khi api/worker boot, `cl_waiting` = 0 ở tải thường.

## Bypass drill (< 10 phút, khi pooler sự cố)
1. Trên prod host: `export CORE_DATABASE_URL_OVERRIDE=postgresql://vninvest:$CORE_DB_PASSWORD@core-db:5432/vninvest_core` (ghi đè tạm — compose đọc `CORE_DATABASE_URL` trực tiếp nên sửa env file hoặc `docker compose up -d` với `-e`).
Cách nhanh nhất không sửa file: `docker compose -f docker-compose.prod.yml run --rm -e CORE_DATABASE_URL=postgresql://vninvest:$CORE_DB_PASSWORD@core-db:5432/vninvest_core -e CORE_DB_CONN_MAX_AGE=60 core-api` để smoke, rồi revert compose về pooler khi xong.
2. Verify: `curl --fail http://127.0.0.1:8100/core/v1/health`.
3. Ghi biên bản drill vào `docs/evidence/audit-bl/BL-05/drill-YYYYMM.md`.

## Soak (follow-up sau deploy, BL-05/BL-13)
24h quan sát `sv_active`, `cl_waiting`, lỗi `pooler error` trong log api/worker. Ngưỡng: `cl_waiting` sustained > 0 → tăng `DEFAULT_POOL_SIZE` hoặc tách pool.
