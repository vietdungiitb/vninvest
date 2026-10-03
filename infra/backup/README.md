# BL-04 — Backup/Restore vận hành (PostgreSQL)

## Lịch (prod host, cron)
`0 2 * * * /opt/vninvest/infra/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1`
Env bắt buộc: `PGHOST PGDATABASE PGUSER PGPASSWORD BACKUP_DIR`, tùy chọn `ALERT_WEBHOOK`, `RETENTION_DAYS=30`.
Script: `pg-backup.sh` (custom format `-Fc -Z6`, `sha256`, giữ 30 bản, alert khi fail).

## Restore drill (đã chạy trên dev 2026-09-24 — data-plane PASS)
1. `pg_dump … -Fc -f drill.dump` → 151MB / 232s (dev DB).
2. `CREATE DATABASE restore_drill` + `pg_restore --no-owner` → 142s.
3. Verify: `django_migrations` 142 = nguồn 142; `auth_user` 4 rows đọc được.
4. Dọn: `DROP DATABASE restore_drill`, xóa dump.
5. RTO data-plane (dev): ~6.2 phút (dump 232s + restore 142s). RPO policy: ≤24h (cron hàng ngày).

## Còn lại cho prod drill (cần outage window — chưa làm)
- App-plane: trỏ `core-api` sang DB restore, verify boot + login + đọc portfolio, rồi failback.
- Fail giả lập backup (kill pg_dump giữa chừng) → xác nhận alert tới kênh.
- Lặp lại hàng tháng; ghi RTO/RPO mỗi kỳ vào `docs/evidence/audit-bl/BL-04/drill-YYYYMM.md`.
