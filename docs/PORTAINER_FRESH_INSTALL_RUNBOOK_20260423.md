# Portainer Fresh Install Runbook (VNInvest)

Ngay cap nhat: 2026-04-23
Pham vi: Cai dat moi hoac khoi phuc toan bo he thong tren server Linux dung Portainer + Docker.

## 1) Muc tieu

Tai lieu nay giup ban:
- Trien khai lai tu dau ma khong can hoi lai quy trinh.
- Tranh loi deploy code cu do tai su dung tag khong doi.
- Xu ly nhanh su co 502 Bad Gateway va migration history conflict.

## 2) Kien truc runtime

- `db`: PostgreSQL
- `redis`: Redis
- `backend`: Django + Gunicorn (API)
- `celery_worker`, `celery_beat`: background jobs
- `frontend`: Nginx static + reverse to backend noi bo
- `proxy_net`: `nginx-proxy_default` (external)
- `app_net`: `vninvest_app_net` (internal)

Compose stack su dung file: `portainer-stack-nginx-proxy.yml`.

## 3) Dieu kien tien quyet

Tren server can co:
- Docker Engine va Docker Compose plugin
- Portainer da san sang
- Repo VNInvest co du file `.env.production`
- DNS domain da tro den nginx-proxy host

Kiem tra nhanh:

```bash
docker --version
docker compose version
```

## 4) Chuan bi code tren server

```bash
cd /opt/vninvest

# Neu gap loi dubious ownership
sudo git config --global --add safe.directory /opt/vninvest

git fetch --all --prune
git checkout dev
git pull origin dev
```

Neu ban deploy theo commit SHA cu the:

```bash
APP_RELEASE=$(git rev-parse --short HEAD)
echo "$APP_RELEASE"
```

## 5) Build image moi (bat buoc)

Khong dung lai tag cu. Luon build theo release moi:

```bash
cd /opt/vninvest
APP_RELEASE=$(git rev-parse --short HEAD)

docker build -t vninvest-backend:${APP_RELEASE} --build-arg APP_RELEASE=${APP_RELEASE} ./backend
docker build -t vninvest-frontend:${APP_RELEASE} --build-arg APP_RELEASE=${APP_RELEASE} ./frontend

docker image ls | grep vninvest-
```

## 6) Deploy stack tren Portainer

Trong Portainer -> Stacks -> Add stack / Update stack:
- Web editor content: `portainer-stack-nginx-proxy.yml`
- Env vars can nhap toi thieu:
  - `APP_RELEASE=<commit_sha>`
  - `BACKEND_IMAGE=vninvest-backend`
  - `FRONTEND_IMAGE=vninvest-frontend`
  - Cac bien DB/Django/domain tu `.env.production`

Gia tri khuyen nghi:
- `APP_RELEASE`: dung gia tri vua build (vd `b0f9c9bd`)
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS`: gom domain production

Stack da set `pull_policy: never`, nen Portainer se dung image local tren chinh Docker host.

## 7) Kiem tra sau deploy

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

docker inspect vninvest-backend --format '{{.Config.Image}}'
docker inspect vninvest-frontend --format '{{.Config.Image}}'
```

Kiem tra API:

```bash
curl -i https://vninvest.edusuccess.vn/api/health/
curl -i https://vninvest.edusuccess.vn/api/admin-ops/stats/
```

Ky vong:
- Health tra `200`
- Khong con `502 Bad Gateway`
- Container dung dung tag `:${APP_RELEASE}`

## 8) Incident playbook: 502 Bad Gateway

### Trieu chung
- Nginx edge tra `HTTP/2 502`
- Backend restart loop

### Chan doan nhanh

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
docker logs vninvest-backend --tail 200
docker logs vninvest-frontend --tail 200
```

### Nguyen nhan thuong gap
- Backend fail migration (InconsistentMigrationHistory)
- Backend chua len xong trong luc frontend/proxy da nhan request
- Network attach sai (`app_net`/`proxy_net`)

## 9) Incident playbook: Migration 0052 truoc 0051

Neu thay loi:
- `InconsistentMigrationHistory: 0052 ... applied before dependency 0051`

Chay block sau:

```bash
set -euo pipefail

docker stop vninvest-backend vninvest-celery-worker vninvest-celery-beat || true

PGUSER=$(docker exec vninvest-db printenv POSTGRES_USER)
PGDB=$(docker exec vninvest-db printenv POSTGRES_DB)

docker exec -i vninvest-db psql -U "$PGUSER" -d "$PGDB" <<'SQL'
BEGIN;

ALTER TABLE portfolio_trackedsymbol
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS portfolio_trackedsymbol_is_active_idx
ON portfolio_trackedsymbol (is_active);

INSERT INTO django_migrations(app,name,applied)
SELECT 'portfolio','0051_trackedsymbol_is_active_alter_crawlauditlog_id_and_more', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM django_migrations
  WHERE app='portfolio'
    AND name='0051_trackedsymbol_is_active_alter_crawlauditlog_id_and_more'
);

COMMIT;
SQL

docker start vninvest-backend vninvest-celery-worker vninvest-celery-beat

docker logs vninvest-backend --tail 200
```

## 10) Checklist moi lan release

- [ ] `git pull` dung branch can deploy
- [ ] Build image moi voi tag moi (`APP_RELEASE`)
- [ ] Update stack env `APP_RELEASE`
- [ ] Confirm container image dang chay dung tag moi
- [ ] Test `api/health` va endpoint chinh
- [ ] Kiem tra log backend khong con crash/restart loop

## 11) Lenh su dung nhanh

```bash
# Xem service status
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Xem log backend
docker logs vninvest-backend --tail 200

# Xem network attach
docker inspect vninvest-backend --format '{{json .NetworkSettings.Networks}}'
docker inspect vninvest-frontend --format '{{json .NetworkSettings.Networks}}'

# Retest public API
curl -i https://vninvest.edusuccess.vn/api/health/
```

## 12) Ghi chu van hanh

- Canh bao `Your models in app(s): 'support' have changes ...` khong gay sap he thong ngay, nhung can tao migration rieng sau.
- Neu stack van chay code cu, gan nhu chac chan do chua doi `APP_RELEASE` hoac chua rebuild image theo tag moi.
- Neu Portainer va Docker daemon khong cung host, image local se khong thay duoc nhau.
