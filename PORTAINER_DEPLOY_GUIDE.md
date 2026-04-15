# 🚀 Hướng Dẫn Deploy VNInvest Lên Portainer - Production Ready

> **Ngày cập nhật**: 15/04/2026  
> **Status**: ✅ Production Ready - Tất cả lỗi iframe admin đã fix

---

## 🎯 Những Gì Đã Sửa

1. ✅ **X-Frame-Options Header** - Cho phép nhúng admin page trong iframe (fix lỗi `Unsafe attempt to load URL`)
2. ✅ **Environment Configuration** - Cập nhật đầy đủ domain `vninvest.edusuccess.vn` 
3. ✅ **Database Password** - Đồng bộ giữa `.env.production` và `backend/.env.production`
4. ✅ **Production Override** - Tạo `docker-compose.prod.yml` để tắt mailpit ports
5. ✅ **Security Headers** - SSL redirect, HSTS, session/csrf cookie secure

---

## 📋 Yêu Cầu Trước Deploy

- [ ] Portainer đã được cài đặt trên server
- [ ] Truy cập được vào Portainer (http://portainer-host:9000)
- [ ] Git repo đã được clone hoặc push lên Git repository (GitHub, GitLab, etc.)
- [ ] SSH access vào server production (optional, để debug)

---

## 🔧 Phương Pháp 1: Deploy Qua Portainer UI (Recommended)

### Bước 1: Truy Cập Portainer

```
URL: https://your-portainer-host:9000
Đăng nhập bằng tài khoản Portainer admin
```

### Bước 2: Tạo Stack Mới

1. **Menu → Stacks → Add Stack**
2. **Chọn "Git repository"**
3. **Điền thông tin Git**:
   - **Repository URL**: `https://github.com/vietdungiitb/vninvest.git`
   - **Repository reference**: `main` (hoặc branch khác)
   - **Username** & **Personal access token**: (nếu repo private)
   - **Compose path**: `docker-compose.yml` → Sau, sẽ thêm `docker-compose.prod.yml`

### Bước 3: Cấu Hình Environment Variables

Portainer sẽ hiển thị form để nhập variables. **Tích vào "Load variables from .env file"** hoặc nhập manual:

**Variables cần thiết**:

```env
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-secure-password>
FRONTEND_PORT=80

DJANGO_SECRET_KEY=<your-very-long-random-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1,*.edusuccess.vn

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True

CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CACHE_REDIS_URL=redis://redis:6379/2

REALTIME_ENABLED=True
ADVISORY_AUTO_GENERATION_ENABLED=True
```

### Bước 4: Upload Compose Files

Có **2 cách**:

#### **Cách A: Dùng Text Editor trong Portainer**
1. Tại mục "Compose file", dán nội dung của:
   - `docker-compose.yml`
   - Nếu muốn xóa Mailpit ports, edit file và comment lại dòng `ports` của mailpit

#### **Cách B: Upload File (nếu Portainer hỗ trợ)**
1. Click "Select file" dan upload `docker-compose.yml`
2. Hoặc có thể edit trực tiếp trên Portainer UI

### Bước 5: Deploy

```
Deploy Stack → Xem logs trong Tab "Logs" → Để verify tất cả services startup thành công
```

---

## 🔧 Phương Pháp 2: Deploy Qua CLI SSH (Advanced)

### Bước 1: SSH Vào Server

```bash
ssh root@vninvest.edusuccess.vn
cd /opt/vninvest
```

### Bước 2: Clone Repo (nếu chưa có)

```bash
git clone https://github.com/vietdungiitb/vninvest.git .
git checkout main
```

### Bước 3: Setup Environment Files

```bash
# Tạo .env.production
cat > .env.production << 'EOF'
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-secure-password>
FRONTEND_PORT=80

DJANGO_SECRET_KEY=<your-very-long-random-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1,*.edusuccess.vn

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True

CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CACHE_REDIS_URL=redis://redis:6379/2

REALTIME_ENABLED=True
ADVISORY_AUTO_GENERATION_ENABLED=True
EOF

# Tạo backend/.env.production
cat > backend/.env.production << 'EOF'
DJANGO_SECRET_KEY=<same-as-above>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1,*.edusuccess.vn

DB_ENGINE=postgres
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-secure-password>
POSTGRES_HOST=db
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CACHE_REDIS_URL=redis://redis:6379/2

REALTIME_ENABLED=True
ADVISORY_AUTO_GENERATION_ENABLED=True
EOF
```

### Bước 4: Pull & Build Images

```bash
# Cập nhật code
git pull origin main

# Build images
docker compose build --no-cache

# Hoặc với production override:
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
```

### Bước 5: Start Services

```bash
# Dạng 1: Dùng production override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Hoặc dạng 2: Dùng standalone prod file (thay docker-compose.yml)
docker compose -f docker-compose.prod.yml up -d
```

### Bước 6: Verify Services

```bash
# Kiểm tra tất cả containers chạy
docker ps

# Xem logs backend
docker compose logs backend -f

# Kiểm tra health status
docker compose ps

# Test API
curl http://localhost/api/health/
```

---

## 🌐 Cấu Hình Nginx Reverse Proxy (Nếu Chưa Có)

Nếu server có Nginx/Caddy/nginx-proxy, cấu hình domain pointing:

### Nginx Example

```nginx
server {
    listen 80;
    server_name vninvest.edusuccess.vn;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vninvest.edusuccess.vn;

    # SSL certificates (Let's Encrypt hoặc self-signed)
    ssl_certificate /etc/letsencrypt/live/vninvest.edusuccess.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vninvest.edusuccess.vn/privkey.pem;

    location / {
        proxy_pass http://localhost:80;  # Docker frontend port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000;  # Django backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Kiểm Tra Logs Sau Deploy

### Xem Logs Các Services

```bash
# Backend logs
docker compose logs backend -f --tail=100

# Celery worker
docker compose logs celery_worker -f --tail=100

# Celery beat
docker compose logs celery_beat -f --tail=100

# Frontend (Nginx)
docker compose logs frontend -f --tail=50

# Database
docker compose logs db -f --tail=50

# Redis
docker compose logs redis -f --tail=50
```

### Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `Admin page không load` | ✅ X-Frame-Options đã được sửa, không cần gì thêm |
| `Connection refused on :8000` | Kiểm tra backend logs: `docker compose logs backend` |
| `Database connection failed` | Verify POSTGRES_PASSWORD match, kiểm tra db healthcheck |
| `Redis connection error` | Kiểm tra redis service running: `docker ps \| grep redis` |
| `Static files 404` | Backend chạy migrations: `docker compose exec backend python manage.py collectstatic --noinput` |

---

## 🔐 Security Checklist

- [ ] DJANGO_DEBUG = False ✅
- [ ] DJANGO_SECRET_KEY = Long random string ✅
- [ ] DJANGO_SECURE_SSL_REDIRECT = True ✅
- [ ] SESSION_COOKIE_SECURE = True ✅
- [ ] CSRF_COOKIE_SECURE = True ✅
- [ ] POSTGRES_PASSWORD được thay đổi từ default ✅
- [ ] Mailpit ports không expose lên internet ✅
- [ ] Only admin/api endpoints đi qua Django ✅
- [ ] Static files được serve từ Nginx/whitenoise ✅

---

## 📱 Truy Cập Ứng Dụng

```
Frontend:     https://vninvest.edusuccess.vn
Admin Panel:  https://vninvest.edusuccess.vn/admin/
API:          https://vninvest.edusuccess.vn/api/
WebSocket:    wss://vninvest.edusuccess.vn/ws/
```

---

## 📝 Notes

- **docker-compose.prod.yml** được dùng để override mailpit ports trên production
- Tất cả sensitive data (`PASSWORD`, `SECRET_KEY`) nên lưu ở `.env` file, **không commit vào Git**
- Sử dụng `.gitignore` để prevent `.env.production` upload
- Celery Beat tự động chạy advisory generation, whale detection, vv
- Realtime features yêu cầu Redis kết nối chính xác

---

## 🆘 Hỗ Trợ

Nếu gặp lỗi:
1. Kiểm tra logs: `docker compose logs <service>`
2. Verify env variables: `docker compose config`
3. Check container health: `docker ps` (xem STATUS column)
4. Xem database migration status: `docker compose exec backend python manage.py migrate --plan`

---

**Hệ thống đã sẵn sàng production! 🎉**
