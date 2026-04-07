# Deploy VNInvest to docker.edusuccess.vn

## 1) Prepare server

```bash
ssh root@docker.edusuccess.vn
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
- `DJANGO_ALLOWED_HOSTS=docker.edusuccess.vn,...`
- `CORS_ALLOWED_ORIGINS=https://docker.edusuccess.vn,http://docker.edusuccess.vn`
- `CSRF_TRUSTED_ORIGINS=https://docker.edusuccess.vn,http://docker.edusuccess.vn`
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
- `http://docker.edusuccess.vn`

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
