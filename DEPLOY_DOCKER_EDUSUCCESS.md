# Deploy VNInvest to vninvest.edusuccess.vn

## 1) Prepare server

```bash
ssh root@vninvest.edusuccess.vn
apt update
apt install -y docker.io docker-compose-plugin git
systemctl enable docker
systemctl start docker
mkdir -p /opt/vninvest
cd /opt/vninvest
```

## 2) Clone repo

```bash
git clone https://github.com/vietdungiitb/vninvest.git .
git checkout main
```

## 3) Create env files

```bash
cp .env.production.example .env.production
cp backend/.env.production.example backend/.env.production
```

### 3.1 One-time copy template for `.env.production`

Paste this whole block into `.env.production` at repo root:

```env
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_db_password
```

### 3.2 One-time copy template for `backend/.env.production`

Paste this whole block into `backend/.env.production`:

```env
DJANGO_SECRET_KEY=change-me-very-long-random-string
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False

DB_ENGINE=postgres
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_db_password
POSTGRES_HOST=db
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn
DEFAULT_FROM_EMAIL=noreply@vninvest.edusuccess.vn

SYSTEM_EMAIL_FALLBACK_ENABLED=False
SYSTEM_EMAIL_FALLBACK_HOST=
SYSTEM_EMAIL_FALLBACK_PORT=1025
SYSTEM_EMAIL_FALLBACK_USE_TLS=False
SYSTEM_EMAIL_FALLBACK_USE_SSL=False
SYSTEM_EMAIL_FALLBACK_TIMEOUT_SECONDS=20
SYSTEM_EMAIL_FALLBACK_FROM_EMAIL=noreply@vninvest.edusuccess.vn
SYSTEM_EMAIL_FALLBACK_FROM_NAME=VNInvest

CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CACHE_REDIS_URL=redis://redis:6379/2
REALTIME_REDIS_URL=redis://redis:6379/0
REALTIME_CHANNEL_LAYER=redis
REALTIME_ENABLED=True
VNSTOCK_PRICE_UNIT=THOUSAND_VND

WATCHLIST_SYNC_ENABLED=True
WATCHLIST_SYNC_MINUTES=15
WATCHLIST_SYNC_DAYS=5
ENABLE_NEW_MARKET_VIEWS=False
ENABLE_NEW_TRADING_VIEWS=False

OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120

GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/
WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER=True
STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE=True
STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER=True

ADVISORY_AUTO_GENERATION_ENABLED=True
ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES=240
ADVISORY_AUTO_GENERATION_BATCH_SIZE=200
ADVISORY_AUTO_GENERATION_JOB_LOCK_SECONDS=1800
ADVISORY_AUTO_GENERATION_QUEUE_LOCK_SECONDS=1800
ADVISORY_AUTO_GENERATION_ESTIMATED_TOKENS=250
ADVISORY_AUTO_GENERATION_JITTER_MIN_SECONDS=5
ADVISORY_AUTO_GENERATION_JITTER_MAX_SECONDS=15
ADVISORY_CONCISE_BUDGET_THRESHOLD=1200

REVERSAL_DETECTION_ENABLED=True
REVERSAL_DETECTION_INTERVAL_SECONDS=30
REVERSAL_WINDOW_MINUTES=15
REVERSAL_MIN_CONSECUTIVE_BUY=3
REVERSAL_MIN_SELL_VALUE_VND=5000000000
REVERSAL_COOLDOWN_SECONDS=300
```

Replace at least these values before deploy:
- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`

## 4) Run deployment

```bash
chmod +x deploy_prod.sh
./deploy_prod.sh
```

## 5) Validate

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Open in browser:
- `http://vninvest.edusuccess.vn`

## 6) SSL (recommended)

Use Cloudflare Tunnel, Caddy, or Nginx Proxy Manager in front of this stack.
If using a reverse proxy, forward to `frontend:80`.

## 7) Update release

```bash
cd /opt/vninvest
git pull origin main
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

## 8) Portainer + HTTPS (Recommended)

Use stack file: `portainer-stack-https.yml`

### Portainer Steps

1. Go to **Stacks** -> **Add stack**.
2. Choose **Repository** mode.
3. Repository URL: `https://github.com/vietdungiitb/vninvest.git`
4. Branch: `main`
5. Compose path: `portainer-stack-https.yml`
6. Set all environment variables below.
7. Deploy stack.

### Required Stack Environment Variables

For Portainer, use the one-time copy block at section `9.3` below.

### Notes

- Port 80 and 443 must be open to the internet for Let's Encrypt challenge.
- If another reverse proxy is already using 80/443, stop it or change routing plan.
- Caddy in this stack handles TLS termination and auto-renew certificates.

## 9) Portainer with existing nginx_proxy + nginx-proxy-acme

If your server already runs `nginx_proxy` and `nginx-proxy-acme`, use this stack instead of Caddy.

Use stack file: `portainer-stack-nginx-proxy.yml`

### 9.1 Prepare shared Docker network

Your existing proxy stack usually has a shared external network (for example `nginx-proxy_default`).
In Portainer, check the exact network name used by `nginx_proxy`, then use that value for `PROXY_NETWORK`.

### 9.2 Portainer deploy steps

1. Go to **Stacks** -> **Add stack**.
2. Choose **Repository** mode.
3. Repository URL: `https://github.com/vietdungiitb/vninvest.git`
4. Branch: `main`
5. Compose path: `portainer-stack-nginx-proxy.yml`
6. Set all environment variables below.
7. Deploy stack.

### 9.3 Required environment variables

Paste this full block into Portainer `Environment variables` (copy one time):

```env
DOMAIN=vninvest.edusuccess.vn
LETSENCRYPT_EMAIL=vietdung@edusuccess.vn
PROXY_NETWORK=nginx-proxy_default

POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_db_password

DJANGO_SECRET_KEY=change-me-very-long-random-string
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn
GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/

REALTIME_ENABLED=True
WATCHLIST_SYNC_ENABLED=True
WATCHLIST_SYNC_MINUTES=15
WATCHLIST_SYNC_DAYS=5
ENABLE_NEW_MARKET_VIEWS=False
ENABLE_NEW_TRADING_VIEWS=False

OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120

ADVISORY_AUTO_GENERATION_ENABLED=True
ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES=240
ADVISORY_AUTO_GENERATION_BATCH_SIZE=200
ADVISORY_AUTO_GENERATION_JOB_LOCK_SECONDS=1800
ADVISORY_AUTO_GENERATION_QUEUE_LOCK_SECONDS=1800
ADVISORY_AUTO_GENERATION_ESTIMATED_TOKENS=250
ADVISORY_AUTO_GENERATION_JITTER_MIN_SECONDS=5
ADVISORY_AUTO_GENERATION_JITTER_MAX_SECONDS=15
ADVISORY_CONCISE_BUDGET_THRESHOLD=1200

REVERSAL_DETECTION_ENABLED=True
REVERSAL_DETECTION_INTERVAL_SECONDS=30
REVERSAL_WINDOW_MINUTES=15
REVERSAL_MIN_CONSECUTIVE_BUY=3
REVERSAL_MIN_SELL_VALUE_VND=5000000000
REVERSAL_COOLDOWN_SECONDS=300

DB_MEM_LIMIT=2g
DB_CPUS=1.5
REDIS_MEM_LIMIT=1g
REDIS_CPUS=1.0
BACKEND_MEM_LIMIT=1500m
BACKEND_CPUS=1.5
CELERY_WORKER_MEM_LIMIT=2g
CELERY_WORKER_CPUS=2.0
CELERY_BEAT_MEM_LIMIT=750m
CELERY_BEAT_CPUS=0.75
FRONTEND_MEM_LIMIT=750m
FRONTEND_CPUS=0.75
```

At minimum, replace these before deploy:
- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`

Recommended for production:
- Keep `DJANGO_SECURE_SSL_REDIRECT=True`, `DJANGO_SESSION_COOKIE_SECURE=True`, `DJANGO_CSRF_COOKIE_SECURE=True`.
- Keep HSTS enabled with `DJANGO_SECURE_HSTS_SECONDS=31536000` and `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True`.

### 9.4 Notes for nginx_proxy/acme mode

- Do not publish ports `80:80` or `443:443` in this app stack.
- `nginx_proxy` must be connected to the same external network in `PROXY_NETWORK`.
- TLS certificate issuance is handled by `nginx-proxy-acme` using `VIRTUAL_HOST` and `LETSENCRYPT_HOST`.

## 10) Session Log (2026-04-10) - Local Docker Test/Dev

Muc tieu session:
- Chay local Docker stack de test truc quan.
- Khac phuc loi dang nhap admin va on dinh stack dev.
- Tao bo tai khoan test theo tier.

### 10.1 Files da tao/cap nhat

- Tao moi: `backend/.env.dev`
- Tao moi: `docker-compose.dev.yml`
- Tao moi: `start_dev.ps1`
- Tao moi: `docker_external_reset_and_start.ps1`
- Tao moi: `run_external_dev_stack.bat`
- Cap nhat: `docker-compose.yml`
	- mailpit ports dung env vars:
		- `MAILPIT_SMTP_PORT`
		- `MAILPIT_UI_PORT`
- Cap nhat: `backend/.env.dev`
	- bo sung origin cho `localhost:8080` de pass CSRF admin login.

### 10.2 Van de da gap va cach xu ly

1. Admin URL khong vao duoc (`http://localhost:8080/admin/`)
- Trieu chung: nginx timeout hoac 403 origin check fail.
- Nguyen nhan:
	- backend container co luc bi `unhealthy`.
	- `CSRF_TRUSTED_ORIGINS` chua co `http://localhost:8080`.
- Xu ly:
	- restart backend container.
	- bo sung origin 8080 trong `backend/.env.dev`:
		- `CORS_ALLOWED_ORIGINS` co `http://localhost:8080,http://127.0.0.1:8080`
		- `CSRF_TRUSTED_ORIGINS` co `http://localhost:8080,http://127.0.0.1:8080`

2. Xung dot port mailpit voi stack khac
- Trieu chung: bind port 1025/8025 that bai.
- Xu ly:
	- override dev stack sang 1026/8026.
	- tham so hoa port trong compose base bang env vars.

3. VS Code de bi treo khi thao tac Docker nang
- Xu ly:
	- tao script chay PowerShell ngoai VS Code:
		- `run_external_dev_stack.bat`
		- `docker_external_reset_and_start.ps1`
	- script co logic tu dong bo sung origin 8080 truoc khi `docker compose up`.

### 10.3 Tai khoan da tao trong moi truong dev

- Admin:
	- username: `admin`
	- password: `admin123`

- Test tiers:
	- `testfree / test123` -> plan `free`
	- `testpro / test123` -> plan `pro`
	- `testpremium / test123` -> plan `enterprise`

Tat ca duoc xac nhan `status=active` trong `DPILicense`.

### 10.4 Lenh nhanh can nho

Khoi dong stack dev:

```powershell
docker compose -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Khoi dong lai backend khi bi treo:

```powershell
docker restart vninvest-dev-backend
```

Kiem tra health:

```powershell
curl http://localhost:8000/api/health/
```

### 10.5 URL test local

- App: `http://localhost:8080`
- Admin: `http://localhost:8080/admin/`
- API health: `http://localhost:8000/api/health/`
- Mailpit UI: `http://localhost:8026`
token test: [REDACTED - rotate immediately]
### 10.6 Note tam dung

- Trang thai hien tai: local stack da truy cap duoc admin login.
- Session tam dung tai day de tiep tuc test chuc nang theo UI.
