# Sprint 33 Go-Live Command Sheet

Date: 2026-04-10
Mode: Operator quick-run
Scope: backend + frontend + celery + smoke + rollback

## 0) Preconditions

- Release branch merged and images/build artifacts ready.
- Production env files populated from templates.
- Access to host with Docker Compose and project checkout.

## 1) Pre-deploy checks (host)

```powershell
Set-Location "C:\Mujoco Projects\vninvest"
git rev-parse --short HEAD
docker compose version
docker compose ps
```

Expected:
- Command success.
- Current stack status visible.

## 2) Environment sanity

Verify backend production env includes:
- `DJANGO_DEBUG=False`
- `DJANGO_SECURE_SSL_REDIRECT=True`
- `DJANGO_SESSION_COOKIE_SECURE=True`
- `DJANGO_CSRF_COOKIE_SECURE=True`
- `DJANGO_SECURE_HSTS_SECONDS=31536000`

Optional:
- `DJANGO_SECURE_HSTS_PRELOAD=True` only after preload readiness review.

## 3) Build/deploy sequence

```powershell
Set-Location "C:\Mujoco Projects\vninvest"
docker compose pull
docker compose build --no-cache backend frontend
docker compose up -d db redis
docker compose up -d backend celery-worker celery-beat frontend
docker compose ps
```

Expected:
- All services are `Up`.

## 4) Django post-deploy checks

```powershell
Set-Location "C:\Mujoco Projects\vninvest"
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py check --deploy
```

Expected:
- Migrate and collectstatic success.
- Deploy check has no blocking errors.

## 5) Runtime health checks

```powershell
Set-Location "C:\Mujoco Projects\vninvest"
docker compose logs backend --tail=120
docker compose logs celery-worker --tail=120
docker compose logs celery-beat --tail=120
```

Expected:
- No crash loop.
- No repeated critical traceback.

## 6) Sprint 33 smoke execution

Run and tick these docs in order:
1. `docs/SPRINT33_STAGING_EXECUTION_CHECKLIST.md`
2. `docs/SPRINT33_FRONTEND_SMOKE_CHECKLIST.md`

Mandatory smoke outcomes before go-live:
- Login mapping OK (invalid creds, unverified, resend, network/server fallback).
- UserConfig persistence OK.
- Event toggle OFF blocks whale/dark/reversal enqueue for test user.
- Event toggle ON allows event-based advisory.

## 7) Final go decision

Go if all are true:
- P0 acceptance pass.
- No open blocker from FE/BE/QA.
- Release note finalized: `docs/SPRINT33_RELEASE_NOTES_20260410.md`.

## 8) Fast rollback commands

```powershell
Set-Location "C:\Mujoco Projects\vninvest"
git log --oneline -n 5
# checkout previous stable tag/commit before running next commands
docker compose down
docker compose up -d db redis
docker compose up -d backend celery-worker celery-beat frontend
docker compose ps
docker compose logs backend --tail=80
```

After rollback:
- Re-run minimal auth + advisory smoke from runbook.

## 9) Evidence capture

Attach to execution log:
- service status snapshot
- smoke screenshots/recordings
- backend/celery log snippets
- sign-off FE/BE/QA/PM

Use template:
- `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`

Release-day timeline:
- `docs/SPRINT33_RELEASE_DAY_TIMELINE_20260410.md`

Known runtime lesson from local validation:
- Existing Postgres volumes may preserve an older password; if backend restart loop shows auth failure, align the DB user password before considering destructive volume reset.