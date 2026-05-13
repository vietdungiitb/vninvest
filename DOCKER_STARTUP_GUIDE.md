# Docker Dev Stack Startup Guide

## Quick Start: Full Docker Dev Stack

### 1. Set GitHub Token (REQUIRED)

Docker needs GitHub PAT to clone private vnbroker dependency during image build.

**Option A: PowerShell (Recommended)**
```powershell
cd "c:\Mujoco Projects\vninvest"

# Export token to current session
$env:VNBROKER_GITHUB_TOKEN = "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"

# Start full stack
docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build
```

**Option B: Using Helper Script**
```powershell
.\docker-start.ps1
```

### 2. Monitor Build Progress

Check container status:
```powershell
docker compose -f docker-compose.dev.yml ps
```

Follow logs:
```powershell
docker compose -f docker-compose.dev.yml logs -f
```

Or specific service (e.g., core-api):
```powershell
docker compose -f docker-compose.dev.yml logs -f core-api
```

### 3. Expected Services

Once fully started, you should see:

```
NAME                               STATUS
vninvest-dev-frontend             Up (healthy)
vninvest-dev-backend-legacy        Up (healthy)
vninvest-dev-core-api              Up (healthy)
vninvest-dev-db                    Up (healthy)
vninvest-dev-redis                 Up (healthy)
vninvest-dev-core-worker           Up
vninvest-dev-celery-worker         Up
vninvest-dev-celery-beat           Up
...
```

### 4. Verify Services

Once stack is up:

```powershell
# Frontend health
curl http://localhost

# Backend legacy health
curl http://localhost:8000/api/health/

# Core API health
curl http://localhost:8001/health/

# Redis
docker exec vninvest-dev-redis redis-cli ping

# PostgreSQL - verify both vninvest and core_db databases
docker exec -it vninvest-dev-db psql -U postgres -d vninvest -c "SELECT 1"
docker exec -it vninvest-dev-db psql -U postgres -d core_db -c "SELECT 1"
```

### 4a. Dual Database Setup (core_db & vninvest)

As of P2-T01, the system uses **two PostgreSQL databases**:

- **vninvest**: Legacy schema, used by backend (port 8000)
- **core_db**: Core SaaS schema, exclusively used by core-api (port 8001)

**Verification:**
```powershell
# List all databases
docker exec vninvest-dev-db psql -U postgres -l | grep -E "core_db|vninvest"

# Should show:
#  core_db    | postgres | UTF8     | C       | C            | 
#  vninvest   | postgres | UTF8     | C       | C            |

# Verify core-api is connected to core_db
docker exec vninvest-dev-core-api python /app/src/manage.py shell -c \
  "from django.db import connections; print('Connected to:', connections.databases['default']['NAME'])"

# Should output: Connected to: core_db
```

**Data Initialization:**
- `core_db` is auto-created by Docker entrypoint script (`init-core-db.sql`)
- Core tables (identity_access, commercial, user_workspace, etc.) are created via Django migrations
- Historical data from vninvest is optionally copied via `scripts/copy_core_tables.sh` for testing/validation

### 5. Setup Admin User & Test Auth

Once Django migrations complete:

```powershell
cd backend
$env:VNBROKER_GITHUB_TOKEN = "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"

# Docker exec into backend container
docker exec -it vninvest-dev-backend-legacy bash

# Inside container:
python setup_dev_auth.py   # Create admin + default tenant
```

### 6. Test API Endpoints

```powershell
# Get auth token
curl -X POST http://localhost:8000/api/auth/token/ `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"test@123456"}'

# Use token to fetch portfolios
curl http://localhost:8000/api/portfolios/ `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Issue: "VNBROKER_GITHUB_TOKEN is missing a value"

**Solution**: Export the token in your PowerShell session BEFORE running docker compose:

```powershell
$env:VNBROKER_GITHUB_TOKEN = "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"
docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build
```

### Issue: Core-API Build Fails

Check logs:
```powershell
docker compose -f docker-compose.dev.yml logs core-api
```

Common reasons:
1. **Invalid GitHub token** - Verify token at: https://github.com/settings/tokens
2. **Token expired** - Generate new token with "repo" scope
3. **Network issue** - Check internet connection, firewall rules

### Issue: Container Crashes After Starting

Check service logs:
```powershell
docker compose -f docker-compose.dev.yml logs backend-legacy
docker compose -f docker-compose.dev.yml logs core-api
```

Common issues:
- Database migrations pending
- Redis not ready
- Port already in use

### Issue: Core-API Cannot Connect to core_db

**Symptoms**: Core-API logs show `DatabaseError` or `FATAL: database "core_db" does not exist`

**Root Cause**: Docker entrypoint script did not auto-create core_db on first stack start

**Solution**:
```powershell
# Manual database creation
docker exec vninvest-dev-db psql -U postgres -c "CREATE DATABASE core_db;"

# Verify
docker exec vninvest-dev-db psql -U postgres -l | grep core_db

# Restart core-api container
docker compose -f docker-compose.dev.yml restart core-api
```

**Prevention**: For next fresh stack:
1. Ensure `scripts/init-core-db.sql` is mounted in `docker-compose.dev.yml` db service volumes
2. Verify mount path is `/docker-entrypoint-initdb.d/01-init-core-db.sql` (leading 01- ensures execution order)
3. Tear down and rebuild with `docker compose down -v` before next `up -d --build`

### Issue: core_db Tables Empty or Missing Data

**Scenario**: Migrations ran but tables have no data from vninvest

**Optional Data Copy** (for dev/testing):
```powershell
# Copy historical data from vninvest to core_db (pg_dump approach)
docker cp scripts/copy_core_tables.sh vninvest-dev-db:/tmp/copy_core_tables.sh
docker exec vninvest-dev-db bash /tmp/copy_core_tables.sh

# Verify copy succeeded
docker exec vninvest-dev-db psql -U postgres -d core_db -c \
  "SELECT COUNT(*) as total_records FROM 
   (SELECT COUNT(*) as c FROM user_workspace_portfolio
    UNION ALL SELECT COUNT(*) FROM user_workspace_watchlist
    UNION ALL SELECT COUNT(*) FROM signal_intelligence_whalealertcanonical) t"
```

**Note**: Production deploys do NOT copy legacy data; core_db starts fresh per tenant isolation design.

### Clean Up Everything

```powershell
docker compose -f docker-compose.dev.yml down -v
docker system prune -f
docker volume prune -f
```

## Notes

- **Frontend**: nginx:1.27-alpine (port 80)
- **Backend Legacy**: python:3.11-slim (port 8000, auto-migrate on start)
- **Core API**: python:3.13-slim (port 8001)
- **Database**: PostgreSQL 15 (port 5432, internal only)
- **Redis**: Redis 7 (port 6379, internal only)
- **Workers**: Celery workers + beat scheduler

All services are connected via internal Docker network. Frontend/Backend/Core API ports are exposed to host.
