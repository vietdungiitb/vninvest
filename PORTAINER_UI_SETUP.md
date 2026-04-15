# 🎯 Hướng Dẫn Tạo Stack Trên Portainer UI

> **Ngày**: 15/04/2026  
> **Phương pháp**: Git Repository → Docker Compose (UI-based)

---

## 📋 Yêu Cầu Trước

- [ ] Portainer đã được cài đặt và chạy
- [ ] Có thể truy cập Portainer UI (http://portainer-host:9000)
- [ ] Tài khoản Portainer admin
- [ ] GitHub repo: `https://github.com/vietdungiitb/vninvest.git`
- [ ] Branch: `deploy`

---

## 🚀 Từng Bước Trên Portainer UI

### **Bước 1: Truy cập Portainer Dashboard**

```
URL: http://localhost:9000  (hoặc IP của server chạy Portainer)
Hoặc: https://portainer.edusuccess.vn (nếu có domain)

Đăng nhập bằng admin account
```

---

### **Bước 2: Vào mục Stacks**

**Trên Portainer UI:**
```
Sidebar → Stacks
Click "+ Add Stack"
```

**Bạn sẽ thấy 3 lựa chọn:**
- [ ] Web editor (dán compose file text)
- [x] Git repository (pull từ GitHub) ← **CHỌN CÁI NÀY**
- [ ] Upload file

---

### **Bước 3: Chọn "Git repository"**

**Form sẽ hiện ra:**

```
┌─────────────────────────────────────────────────────┐
│  CREATE STACK                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Stack name: [vninvest_production        ]          │
│                                                     │
│  ✓ Git repository                                   │
│                                                     │
│  Repository URL: [https://github.com/...  ]         │
│  Reference: [deploy                    ]  [dropdown]│
│                                                     │
│  Compose file: [docker-compose.yml     ]           │
│                                                     │
│  Authentication (optional)                         │
│  ☐ Use Git credentials                            │
│    Username: [ ]                                   │
│    Personal access token: [ ]                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Điền thông tin:**

| Field | Giá Trị |
|-------|---------|
| **Stack name** | `vninvest_production` |
| **Git repository** | `https://github.com/vietdungiitb/vninvest.git` |
| **Reference** | `deploy` (chọn từ dropdown) |
| **Compose file** | `docker-compose.yml` |
| **Authentication** | ☐ Không cần (repo public) |

---

### **Bước 4: Cấu Hình Environment Variables**

**Scroll xuống phía dưới, bạn sẽ thấy:**

```
┌─────────────────────────────────────────────────────┐
│  VARIABLES SECTION                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ☐ Load variables from .env file                   │
│                                                     │
│  Variable name      │ Value                         │
│  ─────────────────────────────────────────────────  │
│  POSTGRES_DB        │ vninvest                      │
│  POSTGRES_USER      │ postgres                      │
│  POSTGRES_PASSWORD  │ ••••••••••  [show]            │
│  ...                │ ...                           │
│                                                     │
│  [+ Add variable]                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Nhập từng variable:**

```
Chú ý: Portainer sẽ parse các ${VAR} từ docker-compose.yml
      và yêu cầu bạn nhập giá trị cho mỗi variable
```

---

### **Bước 4a: Variables Cần Thiết**

Portainer sẽ tự động phát hiện và yêu cầu nhập các biến này:

#### **Database & Auth:**
```
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ThaoLinh@2007
```

#### **Django Security:**
```
DJANGO_SECRET_KEY=django-insecure-b9v@m#_!z$3xp&9kq2r=t^u%w8c$d_6e@f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1,*.edusuccess.vn
```

#### **Domain & URLs:**
```
FRONTEND_PORT=80
```

#### **Tùy Chọn (nếu Portainer yêu cầu):**
```
REALTIME_REDIS_URL=redis://redis:6379/0
STREAM_REDIS_URL=redis://redis:6379/1
```

**Cách nhập trên Portainer UI:**

```
1. Click vào ô [Value]
2. Nhập giá trị (nếu có khoảng trắng, sử dụng quotes: "value with spaces")
3. Ấn Tab hoặc click ô tiếp theo
4. Lặp lại cho các variable khác
```

---

### **Bước 5: Cấu Hình Docker Compose File (Optional)**

**Nếu bạn muốn override docker-compose.yml, bạn có 2 cách:**

#### **Cách A: Dùng Text Editor trong Portainer**

```
Portainer sẽ hiển thị nội dung docker-compose.yml
Bạn có thể edit trực tiếp trong UI (Web editor)

Button: [Show Compose file]
→ Sẽ hiện modal với text editor
→ Bạn có thể sửa và save
```

#### **Cách B: Để mặc định (Recommended)**

```
Để Portainer pull từ GitHub
→ Nó sẽ tự động pull docker-compose.yml từ repo
→ Không cần sửa gì
```

---

### **Bước 6: Deploy Stack**

**Bottom của form:**

```
┌─────────────────────────────────────────────────────┐
│  [Deploy the stack]  [Cancel]                       │
└─────────────────────────────────────────────────────┘
```

**Click "Deploy the stack"**

→ Portainer sẽ:
1. Pull code từ GitHub (branch `deploy`)
2. Parse docker-compose.yml
3. Inject environment variables
4. Build images (nếu cần)
5. Start containers

---

### **Bước 7: Monitor Deployment**

**Portainer sẽ chuyển bạn đến trang Stack Details:**

```
┌──────────────────────────────────────────────┐
│  Stack: vninvest_production                  │
├──────────────────────────────────────────────┤
│                                              │
│  Status: [Checking...]  → [Running]          │
│                                              │
│  Services:                                   │
│  ✓ vninvest-db                (healthy)      │
│  ✓ vninvest-redis             (healthy)      │
│  ✓ vninvest-mailpit           (running)      │
│  ✓ vninvest-backend           (healthy)      │
│  ✓ vninvest-celery-worker     (running)      │
│  ✓ vninvest-celery-beat       (running)      │
│  ✓ vninvest-frontend          (running)      │
│                                              │
│  [Logs] [Console] [Inspect] [Refresh]        │
│                                              │
└──────────────────────────────────────────────┘
```

**Xem Logs để verify:**

```
1. Click Tab "Logs"
2. Chọn service: vninvest-backend
3. Xem output của Django migrations, static files, Daphne startup
```

---

## ✅ Expected Success Output

**Backend logs sẽ hiện:**

```
[entrypoint] Running migrations...
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, django_admin_log, ...
Running migrations:
  ...
  OK

[entrypoint] Collecting static files...
123 static files copied to '/app/staticfiles'

[entrypoint] Starting Daphne...
Listening on http://127.0.0.1:8000
```

**Health check status:**

```
vninvest-db: Up (healthy)
vninvest-backend: Up (healthy)
```

---

## 🧪 Test Sau Deploy

**Từ Portainer UI:**

```
1. Vào Stack → vninvest_production
2. Click service vninvest-frontend
3. Xem Port mappings → note lại port (thường 80 hoặc 8080)
4. Mở browser: http://localhost:<port>/admin/
```

**Hoặc từ terminal server:**

```bash
# Test API
curl http://localhost/api/health/

# Expected output:
# {"status": "ok"}  (hoặc tương tự)
```

---

## ⚠️ Nếu Deployment Fail

**Xem logs chi tiết:**

```
Portainer UI → Stack → Logs → [Service name]
Scroll để xem full error message
```

**Common errors & fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `env: no such file or directory` | .env.production không mount | Verify volumes trong docker-compose.yml |
| `Connection refused (db)` | Database chưa ready | Wait 30s, check `POSTGRES_PASSWORD` match |
| `Module not found` | Dependencies chưa install | Dockerfile needs rebuild |
| `301 Moved Permanently` | SSL redirect trên | DJANGO_SECURE_SSL_REDIRECT=False (đã disable) |

---

## 🔄 Update Stack (Lần Sau)

**Khi có changes mới:**

```
1. Push code lên GitHub (branch deploy)
2. Portainer UI → Stacks → vninvest_production
3. Click [Recreate] hoặc [Update]
4. Chọn "Pull latest version from Git"
5. Deploy
```

---

## 📸 Screenshot Markers (Nếu Cần)

**Khu vực cần click trên Portainer:**

```
Sidebar:
└─ Stacks          ← CLICK
   └─ Add Stack    ← CLICK
      └─ Git repository     ← CLICK
         └─ Deploy the stack ← CLICK
```

---

## 🎉 Hoàn Tất!

Stack đã chạy trên Portainer. Bây giờ:

- ✅ Container tự động restart nếu bị crash
- ✅ Logs accessible từ Portainer UI
- ✅ Dễ dàng scale services (nếu cần)
- ✅ Có thể pause/resume/stop từ UI

**Next:** Setup Nginx reverse proxy + SSL certificate

