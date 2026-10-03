# BL-04 gates — backup schedule + restore drill (PARTIAL; prod drill còn lại) (2026-09-24)

## Change
- New `infra/backup/pg-backup.sh` (custom `-Fc -Z6`, sha256, retention 30, alert hook) + `infra/backup/README.md` (cron, procedure, RTO/RPO).

## Drill dev (data-plane PASS, lệnh thật trên `vininvest-dev-core-db`)
- `pg_dump`: 151MB / 232.4s, sha256 `82afea0d…1369d2`.
- `CREATE DATABASE restore_drill` + `pg_restore --no-owner`: 142.3s.
- Verify: `django_migrations` 142 = nguồn; `auth_user` 4 rows.
- Cleanup: DROP + rm dump (container sạch).
- RTO data-plane (dev): ~6.2 phút. RPO policy: ≤24h.

## Còn lại (cần prod/outage window)
- [ ] Cài cron prod + 3 kỳ backup đúng lịch + alert-fail drill.
- [ ] Prod restore drill app-plane (trỏ api sang DB restore: boot + login + portfolio).
- [ ] Lặp hàng tháng → `drill-YYYYMM.md`.

## DoD tick
- [x] script + doc · [x] drill dev data-plane · [ ] cron prod · [ ] prod app-plane drill · [ ] RTO/RPO prod số.
