# BL-10 gates — verify CDN headers + topology (2026-09-24) — PARTIAL/BLOCKED

## Đã làm được (từ máy dev, có bằng chứng)
- DNS: `saas.edusuccess.vn` CNAME → `docker.edusuccess.vn` → A `14.225.208.68` (single IPv4 công khai — Fact, `Resolve-DnsName` output).
- HTTPS trực tiếp: `curl -sSI --max-time 15 https://saas.edusuccess.vn/` → **timeout (exit 28)** từ máy này (egress/tường lửa, không phải kết luận về prod).

## BLOCKED (trung thực — cần host có quyền vào prod)
- [ ] `curl -sI https://saas.edusuccess.vn/` + `/api/health/` — đọc `content-security-policy`, `strict-transport-security`, `x-frame-options` (lệnh chuẩn cho người có access, chạy từ VPS hoặc CI có egress).
- [ ] Xác nhận topology: managed PG/Redis (RDS/Elasticache?) hay chính compose (single DB/Redis) — quyết định SPOF Unknown→có/không.
- [ ] Nếu CDN thiếu headers → mở BL-10b (thêm ở `packages/web/docker/nginx.conf`); nếu đủ → đóng SEC-F/R-08.

## DoD tick
- [x] DNS evidence · [ ] live headers (blocked, cần access) · [ ] topology verdict (blocked, cần access). Item giữ OPEN, không cố đóng.
