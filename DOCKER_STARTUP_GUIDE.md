# Docker Dev Stack Startup Guide

## Quick Start: Full Docker Dev Stack

### 1. Set GitHub Token (REQUIRED)

Docker needs GitHub PAT to clone private vnbroker dependency during image build.

**Option A: PowerShell (Recommended) — use repo canonical entrypoint**
```powershell
cd "c:\Mujoco Projects\vninvest"
.\start_dev.ps1                 # canonical: --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml
# Hoặc thủ công (tương đương):
# $env:VNBROKER_GITHUB_TOKEN = "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"
# docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

**Option B: Using Helper Script**
```powershell
.\docker-start.ps1
```

### 2. Monitor Build Progress

Check container status:
```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml ps
```

Follow logs:
```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f
```

Or specific service (e.g., core-api):
```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f core-api
```

### 3. Expected Services (saas-native — không còn backend legacy)

Once fully started, you should see:

```
NAME                                      STATUS
vninvest-dev-frontend                     Up (healthy) 0.0.0.0:80->80
vninvest-dev-core-api                     Up (healthy) 127.0.0.1:8001->8100
vninvest-dev-core-db                      Up (healthy) 127.0.0.1:5433->5432
vninvest-dev-core-redis                   Up (healthy) 127.0.0.1:6380->6379
vninvest-dev-mailpit                      Up             0.0.0.0:8026->8025, 0.0.0.0:1026->1025
vninvest-dev-core-worker                  Up
vninvest-dev-core-worker-realtime-*       Up
vninvest-dev-core-worker-analytics        Up
vninvest-dev-core-worker-screener         Up
vninvest-dev-core-beat                    Up
...
```

### 4. Verify Services

Once stack is up:

```powershell
# Frontend — force IPv4 if localhost timeout via ::1
curl http://127.0.0.1/                 # or http://localhost:80/
curl http://127.0.0.1/api/health      # via nginx proxy to core-api

# Core API direct (dev mapping)
curl http://127.0.0.1:8001/core/v1/health

# Redis (service name core-redis, container vninvest-dev-core-redis)
docker exec vninvest-dev-core-redis redis-cli ping

# PostgreSQL — single DB vninvest_core (saas-native, không còn vninvest legacy)
docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -c "SELECT 1"
```

### 4a. Single Database (saas-native dev)

- **vninvest_core**: Single DB saas-native, used by core-api. `CORE_DATABASE_URL postgresql://vninvest:devpassword@core-db:5432/vninvest_core` (`docker-compose.dev.yml:75`, `compose.dev.env:10`).

**Verification:**
```powershell
docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -c "SELECT 1"
docker exec vninvest-dev-core-db psql -U vninvest -l | Select-String vninvest_core
docker exec vninvest-dev-core-api python src/manage.py shell -c "from django.db import connections; print(connections.databases['default']['NAME'])"
# Should output: vninvest_core
```

### 5. Setup Admin User & Test Auth (saas-native)

```powershell
docker exec vninvest-dev-core-api python src/manage.py createsuperuser
# hoặc seed dev data
docker exec vninvest-dev-core-api python src/manage.py shell -c "from identity_access.models import CoreTenant; print(CoreTenant.objects.count())"
```

### 6. Test API Endpoints (saas-native dev)

```powershell
# Core API health
curl http://127.0.0.1:8001/core/v1/health
curl http://127.0.0.1/api/health

# Get auth token (saas-native)
curl -X POST http://127.0.0.1:8001/core/v1/auth/login/ -H "Content-Type: application/json" -d '{"username":"admin","password":"test@123456"}'
```

## Troubleshooting

### Issue: "VNBROKER_GITHUB_TOKEN is missing a value"

**Solution**: Export the token in your PowerShell session BEFORE running docker compose (prefer `.\start_dev.ps1` which auto-uses `gh auth token`):

```powershell
$env:VNBROKER_GITHUB_TOKEN = "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"
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Issue: Core-API Build Fails

Check logs:
```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs core-api
```

Common reasons:
1. **Invalid GitHub token** - Verify token at: https://github.com/settings/tokens
2. **Token expired** - Generate new token with "repo" scope
3. **Network issue** - Check internet connection, firewall rules

### Issue: Container Crashes After Starting

Check service logs:
```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs core-api
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs core-worker
```

Common issues:
- Database migrations pending
- Redis not ready
- Port already in use

### Issue: Core-API Cannot Connect to vninvest_core

**Symptoms**: Core-API logs show `DatabaseError` or `FATAL: database "vninvest_core" does not exist`

**Solution**:
```powershell
docker exec vninvest-dev-core-db psql -U vninvest -d postgres -c "CREATE DATABASE vninvest_core OWNER vninvest;"
docker exec vninvest-dev-core-db psql -U vninvest -l | Select-String vninvest_core
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml restart core-api
```

**Prevention**: For next fresh stack:
1. Ensure `scripts/init-core-db.sql` is mounted in `docker-compose.dev.yml` db service volumes
2. Verify mount path is `/docker-entrypoint-initdb.d/01-init-core-db.sql` (leading 01- ensures execution order)
3. Tear down and rebuild with `docker compose down -v` before next `up -d --build`

### Issue: frontend http://localhost timeout nhưng http://127.0.0.1 OK

**Root Cause**: Docker Desktop Windows NAT resolves `localhost` -> `::1` (IPv6) gây `CLOSE_WAIT`; nginx listen `80` vẫn OK nhưng host IPv6 path bị treo.

**Fix**: dùng `http://127.0.0.1/` hoặc `http://127.0.0.1:80/` thay `localhost`, hoặc đổi `FRONTEND_PORT` trong `compose.dev.env` sang `8080`.

### Clean Up Everything

```powershell
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml down
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml down -v  # xóa volumes
```

## Notes (saas-native)

- **Frontend**: nginx:1.27-alpine (`${FRONTEND_PORT:-80}:80`, `compose.dev.env:8`)
- **Core API**: python:3.13-slim (`127.0.0.1:8001:8100` dev, `8100` prod)
- **Database**: postgres:16-alpine (`127.0.0.1:5433:5432` dev)
- **Redis**: redis:7-alpine (`127.0.0.1:6380:6379` dev, DB 3)
- **Mailpit**: axllent/mailpit (`${MAILPIT_UI_PORT:-8026}:8025`, `${MAILPIT_SMTP_PORT:-1026}:1025`)
- **Workers**: 7 dedicated queues (celery, enrichment_offhours, manual_on_demand, analytics_heavy, realtime_prefetch/stream, screener)

All services on `vninvest-dev_vninvest_network`. Canonical start: `.\start_dev.ps1` (`--env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml`).
