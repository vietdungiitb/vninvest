# Staging deploy verification — corporate-actions endpoint (2026-11-23)

## Trạng thái trước
- `https://docker.edusuccess.vn/core/v1/stock-management/stocks/VIC/corporate-actions/` → **404** dù PR #518/#519 đã merge vào `dev`.
- `/news/` → 401 (route có sẵn, cần PAT).

## Đã làm
- VPS `/opt/vninvest` fetch `origin/dev` @ `d302d89f4`.
- `bash scripts/deploy-staging.sh` **thất bại** ở bước build frontend: E401 `npm.pkg.github.com/download/@vninvestcharts/engine-react@0.5.8` (thiếu `GITHUB_TOKEN` transient). Không lặp lại token đã lộ ở phiên trước.
- Giải pháp tạm: build+restart **riêng** `core-api` (không đụng file override `docker-compose.nginx-proxy.yml` trên VPS):
  `docker compose ... build core-api` → `up -d --no-deps core-api` → container running, migrate 0, collectstatic 168 files.

## Verify sau deploy
- Public curl `corporate-actions` → **401** (route tồn tại, đúng fail-closed; 404 đã hết).
- Django test client (user thật, `HTTP_HOST=docker.edusuccess.vn`) → **200**, envelope shape:
  `{"data": {"symbol": "VIC", "from": "2025-11-23", "to": "2026-11-23", "count": 3, "actions": [...]}, "meta": {...}}`.
  → Đúng cấu trúc `{data:{actions}}` mà widget team báo; adapter vninvest đã đọc cả `payload.actions ?? payload.data.actions` (`chartAdapter.js:227-244`).
- FE staging (`vninvest-frontend`): `grep -rl "corporate-actions" /usr/share/nginx/html/assets` → **0 hit** ⇒ bundle frontend trên staging vẫn là bản cũ, chưa có wiring PR #518.

## Cần Owner
- Cấp `GITHUB_TOKEN` transient có quyền `read:packages` trên VPS để chạy lại full `deploy-staging.sh` (build frontend). Sau đó check-staging + curl lại để xác nhận badge events hiển thị.
- Widget team đang deploy bản `083f3ab9` (fix parse envelope + auto PAT); phía BE đã sẵn sàng.
