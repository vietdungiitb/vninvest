# Huong Dan Cai Dat Mac Dinh An Toan (2026-04-12)

## Muc tieu

Tai lieu nay giup khoi tao du an voi cau hinh an toan mac dinh, khong can tao file env thu cong.

Ap dung cho ca 2 cach chay:
- local backend khong Docker
- Docker dev stack

## 1) One-time bootstrap

Chay lenh sau tai root project:

```powershell
.\scripts\dev-setup.ps1
```

Script se tu dong tao (neu chua co):
- `backend/.env`
- `backend/.env.dev`
- `frontend/.env`

Va tu dong sinh `DJANGO_SECRET_KEY` ngau nhien an toan bang CSPRNG.

## 2) Chay local backend (khong Docker)

```powershell
cd backend
python manage.py migrate
python manage.py runserver
```

Mac dinh local:
- `DB_ENGINE=sqlite`
- `REALTIME_CHANNEL_LAYER=inmemory`

## 3) Chay Docker dev stack

```powershell
.\start_dev.ps1
```

`start_dev.ps1` da duoc cap nhat de:
- tu kiem tra `backend/.env.dev`
- tu goi `scripts/dev-setup.ps1` neu file chua ton tai

Mac dinh Docker dev:
- Postgres host: `db`
- Redis host: `redis`
- Mail fallback host: `mailpit`

## 4) Quy tac an toan SECRET_KEY

`backend/config/settings.py` hien tai co hanh vi:
- Neu co `DJANGO_SECRET_KEY` trong env -> dung key do.
- Neu thieu key va `DEBUG=True` -> tao ephemeral key tam thoi + warning.
- Neu thieu key va `DEBUG=False` -> dung app ngay (fail-fast) de tranh deploy khong an toan.

Khuyen nghi:
- Local/dev: luon giu `backend/.env` hoac `backend/.env.dev` do script tao.
- Production: bat buoc set `DJANGO_SECRET_KEY` qua bien moi truong/secrets manager.

## 5) Khi can tao lai env files

De ghi de va regen toan bo env files:

```powershell
.\scripts\dev-setup.ps1 -Force
```

Nen dung khi:
- can rotate `DJANGO_SECRET_KEY` cho local/dev
- can reset file env ve default an toan

## 6) Troubleshooting nhanh

1. Loi khong tim thay `.env.dev` khi chay Docker:
- Chay lai `.\scripts\dev-setup.ps1`

2. App bao loi `DJANGO_SECRET_KEY phai duoc set trong production`:
- Ban dang chay voi `DJANGO_DEBUG=False` nhung thieu key
- Bo sung `DJANGO_SECRET_KEY` vao env production

3. Muon ve cau hinh goc sau khi da sua tay file env:
- Chay `.\scripts\dev-setup.ps1 -Force`

## 7) Files lien quan

- `scripts/dev-setup.ps1`
- `start_dev.ps1`
- `backend/config/settings.py`
- `backend/.env.example`
- `frontend/.env.example`
