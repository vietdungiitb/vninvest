# STAGING VERIFY — R1 Header realtime indicator (2026-11-19)

- Sau khi PR #442 merge vào `dev` (`3fa9b2d96`), deploy staging theo runbook:
  ```
  ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47
  cd /opt/vninvest && REPO_BRANCH=dev bash scripts/deploy-staging.sh
  ```
- Kết quả deploy: compose config hợp lệ, API health `GET /api/health/` = 2xx, **0 container chết/restart**, 5 worker không healthcheck đều đang chạy (core-worker, realtime-prefetch, realtime-stream, beat, redis-exporter). Frontend container `vninvest-frontend` up.
- Dọn worktree tạm `/tmp/wt-header-r1` (node_modules Linux trả lại `/tmp/wt-gatep0-fix` trước khi remove) — `git worktree list` chỉ còn cây chính + 2 worktree cũ có sẵn.

## Kiểm chứng bundle thật trên staging

```
curl -s http://127.0.0.1:8080/ → assets/index-DkovF6Nd.js (mới; bản cũ `index-BeAZ-ejy.js`)
grep -a 'layout.realtime.idle' trên các asset initial
→ FOUND_IN assets/index-DkovF6Nd.js
```
⇒ Key i18n mới của R1 có mặt trong bundle đang phục vụ tại `https://docker.edusuccess.vn/`.

## Trước / sau

- Trước (ảnh báo lỗi): header hiện chấm đỏ **Offline** trên `/operations-center?tab=dataops` dù DataOps đã load số liệu thật; 2 dòng 404 (`advisory/latest/VMG`, `billing/subscription`) là empty-state có chủ đích.
- Sau: `idle`/không có symbol → nhãn **"Chưa theo dõi"**, chấm xám; chỉ `disconnected` mới hiện "Offline". Mapping đúng AC0–AC5 (13/13 vitest trên VPS).

## CHƯA CHẠY

- Chụp ảnh Playwright 375–1440 trên staging sau deploy (cần phiên đăng nhập; không có credential trong phiên này). Không báo PASS cho hạng mục này.
- E2E full suite / BE test (không liên quan đến slice FE này).
