# Hướng dẫn: GHCR CI/CD Pipeline & Production Deployment

**Phiên bản:** GHCR-1 (2026-05-05)  
**Áp dụng cho:** VNInvest SaaS — môi trường production  

---

## 1. Tổng quan kiến trúc

```
Developer Push
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  GitHub Actions (tự động)                           │
│                                                     │
│  Push → enterprise  ──► :latest  (production)       │
│  Push → main        ──► :main    (staging)          │
│  Push → dev         ──► test only, không push image │
└─────────────────────────────────────────────────────┘
     │
     ▼
GitHub Container Registry (ghcr.io)
  ghcr.io/vietdungiitb/vninvest-core-api:latest
  ghcr.io/vietdungiitb/vninvest-backend:latest
  ghcr.io/vietdungiitb/vninvest-frontend:latest
     │
     ▼
Server Production
  docker compose -f docker-compose.ghcr.yml pull
  docker compose -f docker-compose.ghcr.yml up -d --no-build
```

**Server production KHÔNG cần source code** — chỉ cần 2 file:
- `docker-compose.ghcr.yml`
- `.env` (copy từ `.env.ghcr.example`, điền secrets)

---

## 2. CI/CD Workflows

### 2.1 Ba workflows tự động

| Workflow | File | Trigger paths | Build image |
|----------|------|--------------|-------------|
| Core API | `.github/workflows/core-api.yml` | `packages/core/backend/**` | `vninvest-core-api` |
| Backend  | `.github/workflows/backend.yml`  | `backend/**` | `vninvest-backend` |
| Frontend | `.github/workflows/web.yml`       | `frontend/**`, `packages/web/**` | `vninvest-frontend` |

### 2.2 Logic trigger

```
Branch dev      → chạy test (pytest / npm build), KHÔNG push Docker image
Branch main     → test + push image với tag :main + :<sha>
Branch enterprise → test + push image với tag :latest + :<sha>  ← PRODUCTION
```

Mỗi workflow chỉ chạy khi **đúng path** thay đổi. Ví dụ: push chỉ sửa `frontend/` → chỉ workflow web chạy.

### 2.3 Xem kết quả CI

```
https://github.com/vietdungiitb/vninvest/actions
```

Sau khi push enterprise, chờ ~5-10 phút để tất cả 3 workflows hoàn thành.

---

## 3. Setup server production (lần đầu)

### Bước 1 — Cài Docker trên server

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout và login lại
```

### Bước 2 — Tải file deploy (không cần clone toàn bộ repo)

```bash
mkdir -p /opt/vninvest && cd /opt/vninvest

# Lấy file compose từ GitHub
curl -O https://raw.githubusercontent.com/vietdungiitb/vninvest/enterprise/docker-compose.ghcr.yml

# Lấy template env
curl -O https://raw.githubusercontent.com/vietdungiitb/vninvest/enterprise/.env.ghcr.example
cp .env.ghcr.example .env
```

### Bước 3 — Điền secrets vào `.env`

```bash
nano .env  # Hoặc vi .env
```

Các giá trị BẮT BUỘC phải đổi (không để mặc định):

```env
APP_RELEASE=latest
GHCR_OWNER=vietdungiitb

# Passwords — sinh ngẫu nhiên
POSTGRES_PASSWORD=<strong-random-password>
CORE_DB_PASSWORD=<strong-random-password>

# Django secret keys — tối thiểu 50 ký tự ngẫu nhiên
CORE_DJANGO_SECRET_KEY=<50-char-random>
DJANGO_SECRET_KEY=<50-char-random>

# Domain server
CORE_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORE_CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

**Sinh secret key nhanh:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Bước 4 — Login GHCR (nếu repo private)

```bash
# Tạo Personal Access Token tại: GitHub → Settings → Developer settings
# → Personal access tokens → Tokens (classic)
# Scope cần: read:packages

echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u vietdungiitb --password-stdin
```

> Nếu repo public: bỏ qua bước này, GHCR images public miễn phí.

### Bước 5 — Tạo file backend env

File này chứa các biến đặc thù cho legacy backend:

```bash
cat > /opt/vninvest/.env.backend.production << 'EOF'
DJANGO_SETTINGS_MODULE=config.settings
# Thêm các biến env cần thiết cho backend legacy
EOF
```

### Bước 6 — Khởi chạy lần đầu

```bash
cd /opt/vninvest

# Pull tất cả images
APP_RELEASE=latest docker compose -f docker-compose.ghcr.yml --env-file .env pull

# Chạy (database migrations tự động trong entrypoint)
APP_RELEASE=latest docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-build

# Kiểm tra trạng thái
docker compose -f docker-compose.ghcr.yml ps
```

### Bước 7 — Kiểm tra health

```bash
# Core API
curl http://localhost/core/v1/health/

# Legacy backend
curl http://localhost/api/health/

# Logs nếu có lỗi
docker logs vninvest-core-api --tail 50
docker logs vninvest-backend --tail 50
docker logs vninvest-frontend --tail 20
```

---

## 4. Deploy phiên bản mới (rolling update)

### Deploy nhanh — dùng tag :latest

```bash
cd /opt/vninvest

# Pull images mới nhất
docker compose -f docker-compose.ghcr.yml --env-file .env pull

# Restart từng service (zero-downtime cho stateless services)
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-deps --no-build core-api
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-deps --no-build core-worker core-beat
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-deps --no-build backend celery-worker celery-beat
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-deps --no-build frontend
```

### Deploy pin version cụ thể (rollback-safe)

```bash
# Lấy SHA từ GitHub Actions → workflow run → "Derive image tags"
export APP_RELEASE=a1b2c3d  # 7-char git SHA

docker compose -f docker-compose.ghcr.yml --env-file .env pull
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-build
```

### Rollback về version trước

```bash
# Đổi APP_RELEASE về SHA cũ trong .env
sed -i 's/APP_RELEASE=.*/APP_RELEASE=<old-sha>/' .env

docker compose -f docker-compose.ghcr.yml --env-file .env pull
docker compose -f docker-compose.ghcr.yml --env-file .env up -d --no-build
```

---

## 5. Quy trình phát triển hàng ngày

```
1. Developer làm việc trên branch dev
   git checkout dev
   # ... code, test local ...
   git push origin dev
   → GitHub chạy test, KHÔNG build Docker

2. Merge dev → enterprise để release production
   git checkout enterprise
   git merge dev --no-edit
   git push origin enterprise
   → GitHub: test → build → push :latest lên GHCR (~5-10 phút)

3. Deploy lên server
   docker compose -f docker-compose.ghcr.yml pull
   docker compose -f docker-compose.ghcr.yml up -d --no-build
```

---

## 6. Cấu trúc images và containers

| Container | Image | Port (internal) | Mục đích |
|-----------|-------|----------------|---------|
| `vninvest-core-api` | `vninvest-core-api:latest` | 8100 | SaaS Django API |
| `vninvest-core-worker` | `vninvest-core-api:latest` | — | Celery worker |
| `vninvest-core-beat` | `vninvest-core-api:latest` | — | Celery beat scheduler |
| `vninvest-backend` | `vninvest-backend:latest` | 8000 | Legacy Django + WebSocket |
| `vninvest-celery-worker` | `vninvest-backend:latest` | — | Legacy Celery worker |
| `vninvest-celery-beat` | `vninvest-backend:latest` | — | Legacy Celery beat |
| `vninvest-frontend` | `vninvest-frontend:latest` | **80** | nginx + React SPA |
| `vninvest-db` | `postgres:15-alpine` | 5432 | Legacy DB |
| `vninvest-core-db` | `postgres:16-alpine` | 5432 | Core SaaS DB |
| `vninvest-redis` | `redis:7-alpine` | 6379 | Legacy Redis |
| `vninvest-core-redis` | `redis:7-alpine` | 6379 | Core Redis |

**Chỉ port 80 được expose ra ngoài.** Tất cả services khác giao tiếp qua Docker network nội bộ `vninvest_network`.

---

## 7. Backup database

```bash
# Backup legacy DB
docker exec vninvest-db pg_dump -U postgres vninvest > backup_legacy_$(date +%Y%m%d).sql

# Backup core DB
docker exec vninvest-core-db pg_dump -U vninvest vninvest_core > backup_core_$(date +%Y%m%d).sql

# Restore
cat backup_legacy_20260505.sql | docker exec -i vninvest-db psql -U postgres vninvest
```

---

## 8. Xử lý sự cố thường gặp

### Container không start

```bash
# Xem logs chi tiết
docker logs vninvest-core-api --tail 100

# Kiểm tra health check
docker inspect vninvest-core-api | grep -A 10 '"Health"'
```

### Image không pull được (repo private / token hết hạn)

```bash
# Renew login
echo "NEW_GITHUB_TOKEN" | docker login ghcr.io -u vietdungiitb --password-stdin
```

### Migration lỗi sau deploy mới

```bash
# Chạy migration thủ công
docker exec vninvest-core-api python /workspace/manage.py migrate
docker exec vninvest-backend python manage.py migrate
```

### Xem tất cả logs cùng lúc

```bash
docker compose -f docker-compose.ghcr.yml logs -f --tail 50
```

---

## 9. Files liên quan

| File | Vị trí | Mục đích |
|------|--------|---------|
| [docker-compose.ghcr.yml](../docker-compose.ghcr.yml) | Root | Deploy file cho server production |
| [.env.ghcr.example](../.env.ghcr.example) | Root | Template env — copy thành `.env` trên server |
| [.dockerignore](../.dockerignore) | Root | Giảm build context frontend 1.1GB → ~30MB |
| [.github/workflows/core-api.yml](../.github/workflows/core-api.yml) | Root | CI/CD cho core-api (SaaS Django) |
| [.github/workflows/backend.yml](../.github/workflows/backend.yml) | Root | CI/CD cho legacy Django |
| [.github/workflows/web.yml](../.github/workflows/web.yml) | Root | CI/CD cho React frontend |
