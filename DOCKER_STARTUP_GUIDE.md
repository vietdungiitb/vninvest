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

# PostgreSQL
docker exec -it vninvest-dev-db psql -U postgres -d vninvest -c "SELECT 1"
```

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
