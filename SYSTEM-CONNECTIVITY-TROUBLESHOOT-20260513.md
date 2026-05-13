# 🔧 System Connectivity Issue — VNBROKER_GITHUB_TOKEN Missing

**Problem**: Docker Compose cannot start because `VNBROKER_GITHUB_TOKEN` environment variable is not set.

**Error Message**:
```
error while interpolating services.core-beat.environment.VNBROKER_GITHUB_TOKEN: 
required variable VNBROKER_GITHUB_TOKEN is missing a value: 
VNBROKER_GITHUB_TOKEN must be set to install private vnbroker dependency
```

---

## ✅ SOLUTION

### Option 1: Set Token in compose.dev.env (RECOMMENDED)

1. **Create or get GitHub Personal Access Token (PAT)**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scope: `read:packages`
   - Copy token (example: `ghp_xxxxxxxxxxxxxxxxxxxxx`)

2. **Add to compose.dev.env**:
   ```bash
   # Add this line to compose.dev.env
   VNBROKER_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
   ```

3. **Run Docker Compose with env file**:
   ```bash
   docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build
   ```

### Option 2: Set as Environment Variable (TEMPORARY)

```powershell
# PowerShell
$env:VNBROKER_GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxx"

# Then run
docker compose -f docker-compose.dev.yml up -d --build
```

### Option 3: Inline in Docker Command

```bash
VNBROKER_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx docker compose -f docker-compose.dev.yml up -d --build
```

---

## 🔍 CURRENT SYSTEM STATUS

### ✅ What's Running
- Python 3.11-slim (base image cached)
- Python 3.13-slim (base image cached)
- vninvest-dev-frontend (frontend image cached)
- PostgreSQL container (may be running from previous session)
- Redis container (may be running from previous session)

### ❌ What's NOT Running
- core-api service (blocked by VNBROKER_GITHUB_TOKEN)
- core-worker services (blocked by VNBROKER_GITHUB_TOKEN)
- core-beat service (blocked by VNBROKER_GITHUB_TOKEN)

### 📋 Health Check

Run this to verify what's actually running:

```bash
docker ps
```

If you see containers from previous session, they may be stale.  
Clean them up:

```bash
docker compose -f docker-compose.dev.yml down
docker volume prune -f
docker system prune -f
```

---

## 🚀 QUICK START (AFTER SETTING TOKEN)

### Step 1: Set Token

**Edit compose.dev.env**:
```bash
# Add this line (replace with your real token)
VNBROKER_GITHUB_TOKEN=ghp_your_github_token_here
```

### Step 2: Start Stack

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Step 3: Wait for Services to Be Healthy

```bash
# Check status (repeat until all "healthy")
docker compose -f docker-compose.dev.yml ps
```

Expected output:
```
NAME                                    STATUS          PORTS
vninvest-dev-db                         healthy         5432
vninvest-dev-redis                      healthy         6379
vninvest-dev-mailpit                    running
vninvest-dev-core-api                   healthy         8001:8100
vninvest-dev-core-worker                running
vninvest-dev-core-worker-realtime-prefetch  running
vninvest-dev-core-beat                  running
vninvest-dev-frontend                   running         80
```

### Step 4: Test Connectivity

```bash
# Test frontend
curl http://localhost

# Test API (without auth, may get 401)
curl http://localhost/api/health

# Test core health
curl http://localhost:8001/core/v1/health
```

### Step 5: Login

Visit: http://localhost/  
Use test credentials (see FRONTEND-DEVELOPER-QUICK-START guide)

---

## 📊 Why This Happens

**vnbroker** is a private Python package published to GitHub Packages.

**In docker-compose.dev.yml**:
```yaml
environment:
  VNBROKER_GITHUB_TOKEN: ${VNBROKER_GITHUB_TOKEN:?VNBROKER_GITHUB_TOKEN must be set...}
```

Docker Compose reads this and **requires** the token to be set (either in environment or in .env file).

**During container build** (`docker compose up --build`):
```dockerfile
RUN pip install -r requirements.txt -q
```

If requirements.txt contains vnbroker, pip tries to authenticate to GitHub Packages using the token.

**Solution**: Either
1. Provide the token (Option 1-3 above)
2. Remove vnbroker from requirements.txt (not recommended)
3. Use pre-built image (if available)

---

## ✅ VERIFICATION CHECKLIST

After starting services, verify:

- [ ] `docker compose ps` shows all containers "healthy" or "running"
- [ ] `curl http://localhost` returns HTML (React SPA)
- [ ] `curl http://localhost/api/auth/login/` works (may require JSON POST)
- [ ] Logs show no Python import errors: `docker logs vninvest-dev-core-api | grep -i error`
- [ ] Database healthy: `docker logs vninvest-dev-db | grep "database system is ready"`
- [ ] Redis healthy: `docker logs vninvest-dev-redis | grep "ready to accept connections"`

---

## 🆘 If Still Having Issues

### Check Logs

```bash
# Core API logs
docker logs vninvest-dev-core-api

# Worker logs
docker logs vninvest-dev-core-worker

# Database logs
docker logs vninvest-dev-db

# Frontend logs
docker logs vninvest-dev-frontend
```

### Clean Slate Restart

```bash
# Stop all containers
docker compose -f docker-compose.dev.yml down -v

# Remove any hanging containers
docker ps -a | grep vninvest | awk '{print $1}' | xargs -r docker rm

# Rebuild from scratch
docker compose -f docker-compose.dev.yml up -d --build
```

### Verify Network

```bash
# Check if containers can reach each other
docker compose -f docker-compose.dev.yml exec core-api ping db
docker compose -f docker-compose.dev.yml exec core-api ping redis
```

---

## 📝 SUMMARY

| Issue | Status | Solution |
|-------|--------|----------|
| VNBROKER_GITHUB_TOKEN missing | ❌ BLOCKER | Add token to compose.dev.env |
| Docker images | ✅ CACHED | Already have python:3.13-slim, frontend |
| Network connectivity | ✅ READY | Once token is set, compose will start |
| API endpoints | ✅ READY | 46 routes live (once started) |
| Frontend | ✅ READY | React SPA served by nginx |

**Next Action**: Set VNBROKER_GITHUB_TOKEN and restart stack.

---

**Report Date**: 2026-05-13  
**Status**: ❌ System blocked on token (not a network issue)  
**Fix Time**: ~2 minutes (set token + docker restart)
