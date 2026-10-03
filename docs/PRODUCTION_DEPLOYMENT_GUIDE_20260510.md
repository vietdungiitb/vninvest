# PRODUCTION DEPLOYMENT GUIDE
**Target:** docker.edusuccess.vn  
**Updated:** 2026-05-10  
**Status:** Ready for deployment

---

## 📋 Pre-Deployment Checklist

- [ ] Code committed and pushed to `enterprise` branch
- [ ] `compose.prod.env` created and configured (copy from `compose.prod.env.example`)
- [ ] Production secrets generated (Django keys, DB passwords, API keys)
- [ ] SSH access verified (user: `pham`, host: `docker.edusuccess.vn`)
- [ ] Sufficient disk space on server (~20GB minimum for images + data)
- [ ] Docker & Docker Compose installed on server
- [ ] Firewall rules allow 443 (HTTPS), 80 (HTTP)

---

## 🚀 Deployment Methods

### Method 1: Automated PowerShell Deployment (from Windows)

**Fastest way to deploy from your local machine:**

```powershell
# 1. Prepare environment file
Copy-Item compose.prod.env.example compose.prod.env
# Edit compose.prod.env with production values

# 2. Commit & push to enterprise
git add compose.prod.env
git commit -m "Configure production environment"
git push origin enterprise

# 3. Run deployment script
.\scripts\deploy-remote.ps1 `
    -Host docker.edusuccess.vn `
    -User pham `
    -Password "ThanhLam@2010" `
    -Branch enterprise `
    -DeployPath /opt/vninvest
```

**Expected Duration:** 10-15 minutes  
**Output:** Full deployment log with health checks

---

### Method 2: Manual SSH Deployment

**If you prefer step-by-step control:**

```bash
# 1. SSH into server
ssh pham@docker.edusuccess.vn

# 2. Navigate to deploy directory
mkdir -p /opt/vninvest
cd /opt/vninvest

# 3. Clone or update repository
git clone --branch enterprise https://github.com/vietdungiitb/vninvest.git .
# OR if already cloned:
git fetch origin && git checkout enterprise && git pull origin enterprise

# 4. Configure production environment
cp compose.prod.env.example compose.prod.env
# Edit with nano or vi:
nano compose.prod.env
# Enter production secrets (see Configuration section below)

# 5. Run deployment script
bash scripts/deploy-server.sh
```

**Expected Duration:** 15-20 minutes

---

## ⚙️ Configuration (compose.prod.env)

### Required Secrets (MUST BE SET)

```bash
# Core API Database Password (generate random)
CORE_DB_PASSWORD=generate_random_password_here

# Core API Django Secret Key
CORE_DJANGO_SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# Legacy Backend Django Secret Key
DJANGO_SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# PAT Pepper (for token validation)
CORE_PAT_PEPPER=$(openssl rand -hex 32)

# Legacy Database Password
POSTGRES_PASSWORD=generate_random_password_here
```

### Recommended Customizations

```bash
# Update for your domain
CORE_ALLOWED_HOSTS=docker.edusuccess.vn,app.edusuccess.vn,127.0.0.1
CORE_CORS_ALLOWED_ORIGINS=https://docker.edusuccess.vn,https://app.edusuccess.vn

# Email configuration (optional)
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_specific_password

# VNBroker API (optional)
VNBROKER_API_KEY=your_api_key_from_broker
```

---

## 🔍 Post-Deployment Verification

### 1. Service Health Check

```bash
# SSH into server and check status
ssh pham@docker.edusuccess.vn
cd /opt/vninvest

# List all containers
docker compose ps

# Expected output (all RUNNING):
# vninvest-db              ✓ Up (healthy)
# vninvest-redis           ✓ Up (healthy)
# vninvest-core-db         ✓ Up (healthy)
# vninvest-core-redis      ✓ Up (healthy)
# vninvest-core-api        ✓ Up (healthy)
# vninvest-core-worker     ✓ Up
# vninvest-core-beat       ✓ Up
# vninvest-backend         ✓ Up
# vninvest-frontend        ✓ Up
```

### 2. API Health Check

```bash
# Core API health endpoint
curl -s https://docker.edusuccess.vn/core/v1/health | jq .

# Expected response:
{
  "status": "ok",
  "version": "enterprise",
  "timestamp": "2026-05-10T21:30:00Z"
}
```

### 3. Frontend Accessibility

```bash
# Open browser
https://docker.edusuccess.vn

# Expected: VNInvest dashboard loads successfully
```

### 4. Database Connectivity

```bash
# Check database migrations applied
docker compose exec core-api python manage.py showmigrations

# All should show [X] (applied)
```

---

## 🔄 Common Operations

### View Logs

```bash
# Core API logs
docker compose logs -f core-api

# Backend logs
docker compose logs -f backend

# All services
docker compose logs -f
```

### Restart Service

```bash
# Restart specific service
docker compose restart core-api

# Restart all services
docker compose restart

# Hard restart (remove + recreate)
docker compose down
docker compose up -d
```

### Database Backup

```bash
# Automatic backup (done during deployment)
ls -lh /opt/vninvest/backups/

# Manual backup
mkdir -p backups
docker compose exec -T core-db pg_dump -U vninvest vninvest_core | gzip > backups/core_$(date +%s).sql.gz
```

### Database Restore

```bash
# Restore from backup
gunzip < backups/vninvest_core_20260510_210000.sql.gz | \
  docker compose exec -T core-db psql -U vninvest vninvest_core
```

---

## ⚠️ Troubleshooting

### Services not starting

```bash
# Check logs
docker compose logs

# Common issues:
# 1. Port conflicts: netstat -tulpn | grep LISTEN
# 2. Out of disk space: df -h
# 3. Memory limits: free -h
# 4. Permission issues: ls -l /opt/vninvest/
```

### Database connection errors

```bash
# Test database connectivity
docker compose exec core-db psql -U vninvest -c "SELECT 1"

# Check password in compose.prod.env
grep CORE_DB_PASSWORD compose.prod.env
```

### API returning 500 errors

```bash
# Check for recent migrations or config issues
docker compose logs core-api | tail -50

# Run Django checks
docker compose exec core-api python manage.py check
```

---

## 📅 Deployment Timeline

| Time | Task | Duration |
|------|------|----------|
| T+0  | SSH connect, git sync | 1 min |
| T+1  | Build Docker images | 5-8 min |
| T+9  | Run migrations | 2-3 min |
| T+12 | Backup databases | 2-3 min |
| T+15 | Deploy stack, health check | 3-5 min |
| T+20 | **Deployment complete** | - |

---

## 🎯 Success Criteria

✅ Deployment successful when:
1. All containers running and healthy
2. Core API responds to health endpoint
3. Frontend accessible via HTTPS
4. Database migrations applied
5. Backups created in /opt/vninvest/backups/

---

## 📞 Support

**If deployment fails:**

1. Check logs: `docker compose logs`
2. Verify SSH access works
3. Ensure compose.prod.env has all required fields
4. Check disk space: `df -h`
5. Review environment variables: `cat compose.prod.env | grep -v "^#"`

---

## 🔐 Security Notes

- **Never commit** `compose.prod.env` with real secrets to git
- Use `.gitignore` to prevent accidental commits:
  ```
  compose.prod.env
  backups/
  ```
- Rotate secrets quarterly (especially `CORE_PAT_PEPPER`)
- Use SSH keys instead of password when possible

---

## 📝 Next Steps After Deployment

1. **Monitor** services for 24 hours
2. **Test** critical workflows (login, portfolio, transactions)
3. **Run** integration tests: `bash scripts/run-integration-tests.sh`
4. **Schedule** automated backups
5. **Configure** monitoring & alerting

---

**Last Updated:** 2026-05-10  
**Tested On:** docker.edusuccess.vn  
**Branch:** enterprise
