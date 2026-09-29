# Sprint 33 Local Stack Execution Evidence

Date: 2026-04-10
Environment: local docker-compose validation
Commit SHA: e31f1d62

## 1) Preflight

- `git rev-parse --short HEAD` -> `e31f1d62`
- `docker compose version` -> `Docker Compose version v5.1.0`
- Initial `docker compose ps` -> no running services.

## 2) Stack startup

Commands executed:

```powershell
docker compose up -d db redis
docker compose up -d backend celery_worker celery_beat frontend
```

## 3) Runtime blocker found

Observed issue:
- Backend entered restart loop.
- Root cause from backend logs: PostgreSQL password authentication failed for user `postgres`.

Diagnosis:
- Existing Postgres volume had an older password than the configured `.env.production` value.

Resolution executed:

```powershell
docker compose exec db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'change_me_db_password';"
docker compose restart backend celery_worker celery_beat
docker compose up -d frontend
```

Result:
- Backend recovered.
- Celery beat became healthy.
- Frontend started successfully.

## 4) Final stack status

Observed `docker compose ps` state after recovery:

- `vninvest-backend` -> healthy
- `vninvest-db` -> healthy
- `vninvest-redis` -> healthy
- `vninvest-celery-beat` -> healthy
- `vninvest-frontend` -> started on `http://localhost`
- `vninvest-celery-worker` -> up and still completing health start window at capture time

## 5) End-to-end checks

- `Invoke-WebRequest http://localhost/api/health/` -> `{"status": "ok", "service": "vninvest-backend"}`
- `Invoke-WebRequest http://localhost/` -> `200`

## 5.1) Auth API smoke

- Invalid credentials:
	- status: `401`
	- body: `{"detail":"No active account found with the given credentials"}`
- Unverified email account:
	- status: `401`
	- body: `{"detail":"Tài khoản chưa xác thực email. Vui lòng kiểm tra email và kích hoạt tài khoản trước khi đăng nhập."}`
- Resend verification:
	- initial status: `503`
	- initial body: `{"detail":"Không thể gửi lại email xác thực: Chua co cau hinh tai khoan gui mail mac dinh trong trang quan tri."}`
	- after env fallback + Mailpit:
		- status: `200`
		- body: `{"message":"Nếu tài khoản tồn tại và chưa xác thực, hệ thống đã gửi lại email xác thực."}`
		- Mailpit evidence: 1 message captured for `smoke_unverified@example.com`, subject `[VNInvest] Xac thuc email tai khoan`

Interpretation:
- Login gating behavior is working as designed.
- Resend verification now succeeds once a mail transport is configured.

## 5.2) Celery runtime validation

- Found and fixed runtime bug in `trim_streams` task.
- After rebuild, direct execution returned: `{'status': 'ok', 'trimmed': 0}`.
- Celery worker ping returned `pong` and recent logs no longer show the previous `ImportError` for `trim_streams`.

## 6) Operational note

- If a persistent Postgres volume was initialized with a prior password, backend startup can fail even when current env files are internally consistent.
- Preferred non-destructive recovery: align the DB user password to the configured env before considering volume reset.
- Mail resend smoke requires a configured default outbound mail account in admin/runtime data.
- In this validated stack, env fallback + Mailpit satisfied that requirement without changing auth business logic.