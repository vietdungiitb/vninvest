# 🔧 Server Restart Guide - Stack từ Đầu

> **Ngày**: 15/04/2026  
> **Status**: ✅ Root cause fixes applied  
> **What Fixed**: 
> - ✅ Mount .env.production properly (không còn "not found" error)
> - ✅ Disable SSL redirect tạm thời (fix 301 loop - sẽ enable lại sau khi setup reverse proxy)
> - ✅ Docker build process - thêm comments rõ ràng

---

## 🚀 Hướng Dẫn Chạy Lại Stack Từ Đầu

### Bước 1: SSH vào Server

```bash
ssh root@vninvest.edusuccess.vn
cd /opt/vninvest
```

### Bước 2: Dừng và Xóa Stack Cũ (Clean Start)

```bash
# Stop tất cả containers
docker compose down

# Xóa volumes cũ (CẢNH BÁO: Điều này sẽ xóa dữ liệu database!)
# ⚠️ Chỉ làm nếu muốn reset từ đầu. Nếu muốn giữ dữ liệu, bỏ qua dòng này
# docker compose down -v

# Verify không còn containers chạy
docker ps

# (Optional) Xóa images cũ
docker image prune -a -f
```

### Bước 3: Pull Code Mới Từ GitHub

```bash
# Fetch latest từ repo
git fetch origin

# Checkout deploy branch
git checkout deploy

# Pull latest changes
git pull origin deploy

# Verify files được update
git log --oneline -5
```

### Bước 4: Verify Environment Files Tồn Tại

```bash
# Kiểm tra .env.production có tồn tại
ls -la .env.production

# Kiểm tra backend/.env.production có tồn tại
ls -la backend/.env.production

# Nếu chưa có, copy từ .example (nếu tồn tại)
# cp .env.production.example .env.production
# cp backend/.env.production.example backend/.env.production
```

### Bước 5: Build Images Mới (Đây là lần đầu tiên hoặc rebuild)

```bash
# Build backend, celery, frontend images
docker compose build --no-cache

# Hoặc nếu dùng production override:
# docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Kỳ vọng output:
# [+] Building 2.5s
# vninvest-backend ✓
# vninvest-celery-worker ✓
# vninvest-celery-beat ✓
# vninvest-frontend ✓
```

### Bước 6: Start Stack (Up Containers)

```bash
# Start tất cả services
docker compose up -d

# Hoặc nếu dùng production override:
# docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify tất cả containers đã start
docker ps
docker ps -a  # Xem tất cả containers (kể cả stopped)
```

### Bước 7: Verify Services Sạch Sẽ

```bash
# Xem logs backend
docker compose logs backend --tail=50

# Expected output:
# [entrypoint] Running migrations...
# [entrypoint] Collecting static files...
# [entrypoint] Starting Daphne...

# Kiểm tra healthcheck của backend
docker compose ps | grep backend

# Expected status: "Up (healthy)" hoặc "Up"

# Test API endpoint
curl http://localhost/api/health/

# Expected: 200 OK JSON response hoặc connection refused (nếu frontend chưa forward)
```

### Bước 8: Test Admin Page Without SSL (Debug Mode)

```bash
# Truy cập từ browser (hoặc curl)
curl -i http://localhost/admin/

# Expected: 200 hoặc 301 (chứ KHÔNG phải 301 loop)
# Nếu vẫn 301 loop → check Dockerfile comments và doc bên dưới

# Trực tiếp API
curl -i http://localhost/api/health/
```

### Bước 9: Kiểm Tra Logs Chi Tiết Nếu Gặp Lỗi

```bash
# Backend logs
docker compose logs backend -f --tail=100

# Celery worker logs
docker compose logs celery_worker -f --tail=100

# Database logs
docker compose logs db -f --tail=50

# Redis logs
docker compose logs redis -f --tail=50

# Frontend (Nginx) logs
docker compose logs frontend -f --tail=50
```

---

## ⚙️ Cấu Hình Chi Tiết

### Root Cause của Lỗi (Và Cách Fix)

**Vấn đề gốc:**
```
Error: env file /tmp/vninvest_build/backend/.env.production not found
```

**Nguyên nhân:**
- `.env.production` nằm trong `.gitignore` (không được commit)
- Docker build process tìm `.env.production` nhưng không tìm thấy trong build context
- Container startup fail vì không load được env variables

**Giải pháp:**
1. **Mount .env files** từ host vào container qua `docker-compose.yml` (đã sửa)
   ```yaml
   volumes:
     - ./backend/.env.production:/app/.env.production:ro
   ```
2. **Thêm comments** vào Dockerfile để rõ ràng (đã sửa)

### SSL Redirect - Tạm Disable (Debug)

```env
# backend/.env.production
DJANGO_SECURE_SSL_REDIRECT=False  # ⚠️ TEMPORARILY - Enable after reverse proxy setup
```

**Lý do:**
- 301 loop xảy ra vì Django redirect HTTP → HTTPS, nhưng frontend không phải HTTPS
- Cần setup reverse proxy (Nginx/Caddy) với SSL certificate trước

**Khi nào Enable Lại:**
```bash
# Sau khi reverse proxy (Nginx/Caddy) setup xong với SSL:
# 1. Cập nhật backend/.env.production:
#    DJANGO_SECURE_SSL_REDIRECT=True

# 2. Restart backend container:
docker compose restart backend

# 3. Test:
curl -i https://vninvest.edusuccess.vn/admin/
```

---

## 📊 Expected Status Sau Restart

```bash
$ docker compose ps

NAME                      STATE              
vninvest-db               Up (healthy)       
vninvest-redis            Up (healthy)       
vninvest-mailpit          Up                 
vninvest-backend          Up (healthy)       
vninvest-frontend         Up                 
vninvest-celery-worker    Up                 
vninvest-celery-beat      Up
```

---

## 🆘 Troubleshooting

| Lỗi | Fix |
|-----|-----|
| `backend exited with code 1` | `docker compose logs backend` - kiểm tra migration/static files |
| `Cannot connect to database` | Verify `POSTGRES_PASSWORD` match, check `db` container |
| `Redis connection refused` | Verify `redis` container running, check port 6379 |
| `Admin page still 301 loop` | 1) Check `DJANGO_SECURE_SSL_REDIRECT=False` 2) Restart backend 3) Clear browser cache |
| `Static files 404` | Chạy `docker compose exec backend python manage.py collectstatic --noinput` |

---

## Next Steps (Sau Khi Stack Chạy OK)

1. **Setup Reverse Proxy** (Nginx/Caddy) với SSL certificate (Let's Encrypt)
   - Point domain `vninvest.edusuccess.vn` → Docker frontend (port 80)
   - Enable HTTPS forwading

2. **Enable SSL Redirect** lại trong backend/.env.production
   - `DJANGO_SECURE_SSL_REDIRECT=True`
   - Restart backend container

3. **Verify Everything Works**
   - Test https://vninvest.edusuccess.vn/admin/
   - Test https://vninvest.edusuccess.vn/api/health/

---

**Stack ready to go! 🚀**
