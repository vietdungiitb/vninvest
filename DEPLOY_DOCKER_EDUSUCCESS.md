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

Edit both files:
- `.env.production`: set `POSTGRES_PASSWORD`
- `backend/.env.production`: set `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, domain vars

Important values in `backend/.env.production`:
- `DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,...`
- `CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `POSTGRES_HOST=db`
- `CELERY_BROKER_URL=redis://redis:6379/0`

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

- `DOMAIN=vninvest.edusuccess.vn`
- `LETSENCRYPT_EMAIL=vietdung@edusuccess.vn`
- `POSTGRES_DB=vninvest`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=<strong_db_password>`
- `DJANGO_SECRET_KEY=<very_long_random_secret>`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1`
- `CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `FRONTEND_BASE_URL=https://vninvest.edusuccess.vn`
- `REALTIME_ENABLED=True`
- `WATCHLIST_SYNC_ENABLED=True`
- `WATCHLIST_SYNC_MINUTES=15`
- `WATCHLIST_SYNC_DAYS=5`
- `ENABLE_NEW_MARKET_VIEWS=False`
- `ENABLE_NEW_TRADING_VIEWS=False`
- `OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True`
- `OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300`
- `OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0`
- `OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000`
- `OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30`
- `OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000`
- `OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120`

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

- `DOMAIN=vninvest.edusuccess.vn`
- `LETSENCRYPT_EMAIL=vietdung@edusuccess.vn`
- `PROXY_NETWORK=nginx-proxy_default`
- `POSTGRES_DB=vninvest`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=<strong_db_password>`
- `DJANGO_SECRET_KEY=<very_long_random_secret>`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1`
- `CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
- `FRONTEND_BASE_URL=https://vninvest.edusuccess.vn`
- `REALTIME_ENABLED=True`
- `WATCHLIST_SYNC_ENABLED=True`
- `WATCHLIST_SYNC_MINUTES=15`
- `WATCHLIST_SYNC_DAYS=5`
- `ENABLE_NEW_MARKET_VIEWS=False`
- `ENABLE_NEW_TRADING_VIEWS=False`
- `OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True`
- `OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300`
- `OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0`
- `OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000`
- `OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30`
- `OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000`
- `OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120`

### 9.4 Notes for nginx_proxy/acme mode

- Do not publish ports `80:80` or `443:443` in this app stack.
- `nginx_proxy` must be connected to the same external network in `PROXY_NETWORK`.
- TLS certificate issuance is handled by `nginx-proxy-acme` using `VIRTUAL_HOST` and `LETSENCRYPT_HOST`.
