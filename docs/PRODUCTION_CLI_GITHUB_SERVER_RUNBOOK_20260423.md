# Production CLI Runbook - GitHub Server Pull

## Muc tieu

Tai lieu nay dung cho truong hop server production `git clone` truc tiep tu GitHub va deploy bang `docker compose`, khong dung Portainer.

Ap dung cho repo VNInvest hien tai voi:
- branch deploy: `main`
- compose file: `docker-compose.prod.yml`
- deploy script: `deploy_prod.sh`

## Dieu kien tien quyet

Tren server Linux can co san:

```bash
apt update
apt install -y docker.io docker-compose-plugin git
systemctl enable docker
systemctl start docker
```

Kiem tra nhanh:

```bash
docker --version
docker compose version
git --version
```

## Thu muc deploy chuan

Vi du server dung thu muc:

```bash
mkdir -p /opt/vninvest
cd /opt/vninvest
```

## Lan dau clone repo

```bash
git clone https://github.com/vietdungiitb/vninvest.git .
git checkout main
git pull origin main
```

## Tao file env production

Tao 2 file sau:
- `.env.production`
- `backend/.env.production`

Neu chua co, copy tu file mau:

```bash
cp .env.production.example .env.production
cp backend/.env.production.example backend/.env.production
```

Sau do sua gia tri that:

```bash
nano .env.production
nano backend/.env.production
```

Bat buoc doi it nhat:
- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`
- domain/origin production neu khac domain mac dinh

## Cach deploy khuyen nghi

Repo da co script deploy chuan. Day la cach nen dung:

```bash
cd /opt/vninvest
git checkout main
git pull origin main
chmod +x deploy_prod.sh
./deploy_prod.sh
```

Script nay tu dong:
- pull code moi nhat tu `main`
- gan `APP_RELEASE` theo commit SHA hien tai
- build lai `backend`, `frontend`, `celery_worker`, `celery_beat`
- `up -d --force-recreate`
- in trang thai service va log backend cuoi

## Deploy thu cong tung lenh

Dung cach nay neu ban muon kiem soat tung buoc:

```bash
cd /opt/vninvest
git checkout main
git pull origin main
export APP_RELEASE=$(git rev-parse --short HEAD)

docker compose --env-file .env.production -f docker-compose.prod.yml build --pull backend celery_worker celery_beat frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate backend celery_worker celery_beat frontend
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=80 backend
```

## Khi nghi image cu bi cache

Neu vua pull code moi ma production van giong ban cu, ep release moi va build sach hon:

```bash
cd /opt/vninvest
git checkout main
git pull origin main
export APP_RELEASE=$(date +%Y%m%d%H%M%S)

docker compose --env-file .env.production -f docker-compose.prod.yml build --pull --no-cache backend celery_worker celery_beat frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate backend celery_worker celery_beat frontend
```

`APP_RELEASE` duoc dua vao build args, labels va runtime env de buoc container/image thay doi theo release moi.

## Kiem tra sau deploy

Xem trang thai:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Xem log backend:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

Xem log frontend:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
```

Xem log celery worker:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f celery_worker
```

## Lenh van hanh nhanh

Dung production stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Khoi dong lai rieng backend/celery/frontend:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate backend celery_worker celery_beat frontend
```

Xoa container va khoi tao lai app services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml rm -sf backend celery_worker celery_beat frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d backend celery_worker celery_beat frontend
```

## Quy trinh update production moi lan release

Moi lan cap nhat code, dung dung chuoi lenh sau:

```bash
cd /opt/vninvest
git checkout main
git pull origin main
./deploy_prod.sh
```

Khong dung chi `docker compose restart`, vi restart khong build lai image moi.

## Checklist ngan gon

Moi lan deploy, kiem tra du 5 diem sau:
- Dang o branch `main`
- `git pull origin main` thanh cong
- `.env.production` va `backend/.env.production` ton tai
- Chay `./deploy_prod.sh` hoac bo lenh `build --pull` + `up -d --force-recreate`
- Xac nhan `docker compose ps` va logs backend khong loi

## Ghi chu quan trong

- Tai lieu nay danh cho server Linux. Neu dung Windows server, nen chay qua WSL hoac Git Bash vi `deploy_prod.sh` la Bash script.
- File `docker-compose.prod.yml` trong repo hien tai da duoc cau hinh de deploy standalone production stack bang CLI.
- Neu can reverse proxy/SSL o tang ngoai, tiep tuc dat Nginx/Caddy/Cloudflare Tunnel truoc frontend production.
