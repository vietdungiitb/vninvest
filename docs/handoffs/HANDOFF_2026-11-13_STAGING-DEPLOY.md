# HANDOFF — Deploy staging sau chương trình widget-backend (backend-only OK, frontend BLOCKED)

> Ngày: 2026-11-13 · VPS: `14.225.255.47` (`/opt/vninvest`) · Người chạy: PM-proxy (toàn quyền) · Ledger: Entry 485

## 1. Kết quả: BACKEND deploy xong, FRONTEND chặn token

- **Deploy**: `bash scripts/deploy-staging.sh` thất bại ở `frontend builder: npm ci E401` — `GITHUB_TOKEN` trong `compose.staging.env` bị GitHub Packages từ chối khi tải `@vninvestcharts/widget-pro@0.4.4` (`User cannot be authenticated`). Không phải lỗi code.
- **Quyết định PM-proxy**: build + up riêng 5 service backend (`core-api`, `core-worker`, `core-worker-realtime-prefetch`, `core-worker-realtime-stream`, `core-beat`) — S1/S2 là BE-only, additive, an toàn. `--verify` sau deploy: **xanh hết** (config hợp lệ, API healthy qua nginx, 0 container chết, workers 0 restart).
- **Kiểm chứng code mới trên staging thật**: `GET /api/health/` 200 · `POST /core/v1/auth/ws-ticket/` 401 khi không auth (route đã mount) · `GET .../market-data/index/vn30/constituents/` 401 (đã mount) · `showmigrations commercial`: `0008_licensekey [X]`.

## 2. Trạng thái repo staging trước deploy (đã xử lý, CÓ backup)

- `/opt/vninvest` bẩn (local debug chưa commit) + detached HEAD cũ `00477653f` + branch `dev` diverge (5 commit local cũ).
- Đã làm (đảo ngược được): `git stash push -u` → `stash@{0}` ("staging-local-debug-pre-deploy-20261113-PM-proxy"); branch backup `staging-local-backup-20261113` giữ 5 commit local; `git reset --hard origin/dev` → `787bc9b5d` (= dev GitHub). So sánh `origin/dev` vs backup: lệch 137 commit mới / backup chỉ cũ — backup giữ lại phòng hờ.
- **Chưa đụng tới**: `/tmp/wt-gatep0*` (của slice cũ, để coordinator).

## 3. Việc cần Owner (BLOCKED, ngoài quyền PM-proxy)

1. **Cấp GitHub PAT mới** (classic, scope `read:packages`, SSO-authorize org chứa `vninvestcharts/*` nếu org enforce) → cập nhật `GITHUB_TOKEN` trong `/opt/vninvest/compose.staging.env` → chạy lại `bash scripts/deploy-staging.sh` (full, gồm frontend).
2. Review `stash@{0}` + branch `staging-local-backup-20261113`: nếu không còn gì dùng thì `git stash drop` + `git branch -D` (ghi nhận trước khi xóa).
3. Widget team: bật `wsTicketEnabled` + E2E WS từ ngoài; verify constituents/financials trên staging (ghi CHƯA CHẠY tới lúc có kết quả).

## 4. Rủi ro đã biết — CẬP NHẬT 2026-11-14: ĐÃ XONG full deploy (Entry 486)

- Owner đã cấp PAT mới → `npm view widget-pro` = 0.4.5 → full deploy PASS, staging chạy dev mới nhất.
- Còn lại: widget team E2E (CHƯA CHẠY); review `stash@{0}` + branch backup trên VPS rồi drop.

- Staging DB đã migrate lên `0008_licensekey` (additive, entrypoint tự chạy). Không backup DB trước migrate (đúng script chuẩn) — lần deploy full sau nên `pg_dump` trước nếu DB đã có dữ liệu quan trọng.
- Frontend staging vẫn image 2 ngày tuổi (có widget 0.4.4) — đủ dùng cho demo BE mới; UI mới nhất (S1/S2 không đổi FE) không ảnh hưởng.
