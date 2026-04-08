# Portainer Deploy Guide for vninvest.edusuccess.vn

## Scope

This guide is for deploying VNInvest on Docker via Portainer using the existing shared reverse proxy stack:
- nginx-proxy
- nginx-proxy-acme (acme companion)

Target domain:
- https://vninvest.edusuccess.vn

---

## 1. Prerequisites

1. Portainer is reachable and you can create/update stacks.
2. Shared reverse proxy stack is already running:
   - container: nginx-proxy
   - container: nginx-proxy-acme
3. DNS A record exists:
   - vninvest.edusuccess.vn -> your server public IP
4. External Docker network used by nginx-proxy exists:
   - usually nginx-proxy_default
5. Repository access is valid in Portainer:
   - for private repository, use GitHub PAT (not account password)

---

## 2. Repository Settings in Portainer

Create stack with Repository mode:

1. Portainer -> Stacks -> Add stack.
2. Name: vninvest
3. Build method: Repository
4. Repository URL:
   - https://github.com/vietdungiitb/vninvest.git
5. Reference:
   - refs/heads/main
6. Compose path:
   - portainer-stack-nginx-proxy.yml
7. Authentication (if private repo):
   - Username: your GitHub username
   - Password: GitHub PAT token

---

## 3. Required Environment Variables

Use these values in Portainer stack environment section:

- DOMAIN=vninvest.edusuccess.vn
- LETSENCRYPT_EMAIL=vietdung@edusuccess.vn
- PROXY_NETWORK=nginx-proxy_default

- POSTGRES_DB=vninvest
- POSTGRES_USER=postgres
- POSTGRES_PASSWORD=<strong_db_password>

- DJANGO_SECRET_KEY=<very_long_random_secret>
- DJANGO_DEBUG=False
- DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1

- CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
- CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
- FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

- REALTIME_ENABLED=True
- WATCHLIST_SYNC_ENABLED=True
- WATCHLIST_SYNC_MINUTES=15
- WATCHLIST_SYNC_DAYS=5
- ENABLE_NEW_MARKET_VIEWS=False
- ENABLE_NEW_TRADING_VIEWS=False

- OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
- OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
- OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
- OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
- OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
- OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
- OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120

Optional but recommended when using Google OAuth in admin mail settings:
- GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/

Important:
1. Do not leave numeric variables empty (for example WATCHLIST_SYNC_MINUTES, WATCHLIST_SYNC_DAYS).
2. In Portainer, an empty value is passed as an empty string and can crash backend at startup.
3. If you do not use an optional variable, remove it instead of leaving it blank.

### 3.1 One-shot copy/paste env block (Portainer)

Paste this block into Portainer Stack Environment variables (adjust secrets before deploy):

```env
# Domain and SSL
DOMAIN=vninvest.edusuccess.vn
LETSENCRYPT_EMAIL=vietdung@edusuccess.vn
PROXY_NETWORK=nginx-proxy_default

# Database
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD

# Django
DJANGO_SECRET_KEY=CHANGE_ME_VERY_LONG_RANDOM_SECRET
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1

# Frontend/API origins
CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

# Optional OAuth callback (recommended if using Google OAuth in Admin)
GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/

# Runtime flags
REALTIME_ENABLED=True
WATCHLIST_SYNC_ENABLED=True
WATCHLIST_SYNC_MINUTES=15
WATCHLIST_SYNC_DAYS=5
ENABLE_NEW_MARKET_VIEWS=False
ENABLE_NEW_TRADING_VIEWS=False

# Note: never leave integer values blank; use defaults shown here.

# OpenCore quota
OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120

# Celery and stream scheduling (optional advanced overrides)
STREAM_CONSUMER_INTERVAL=3
TICKER_PREFETCH_INTERVAL=20
ORDER_FLOW_DETECTION_ENABLED=True
ORDER_FLOW_DETECTION_INTERVAL_SECONDS=30
MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED=True
MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS=60
MISSION_CONTROL_ANOMALY_MONITOR_ENABLED=True
MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS=60

# DRF throttling (optional advanced overrides)
DRF_REALTIME_RATE=60/minute
DRF_REALTIME_TICKER_RATE=120/minute
DRF_REALTIME_INTRADAY_RATE=90/minute
DRF_REALTIME_PRICE_BOARD_RATE=120/minute
DRF_REALTIME_BREADTH_RATE=90/minute
DRF_REALTIME_WHALE_FEED_RATE=90/minute
DRF_REALTIME_WHALE_AGG_RATE=120/minute
DRF_REALTIME_RVOL_RATE=60/minute
DRF_REALTIME_CHART_RATE=90/minute

# Email verification token expiry (seconds)
EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS=86400
```

---

## 4. Deploy Procedure

1. Click Deploy the stack.
2. Wait for all services to be created.
3. Verify containers are running:
   - vninvest-db (healthy)
   - vninvest-redis (healthy)
   - vninvest-backend (Up)
   - vninvest-frontend (Up)
   - vninvest-celery-worker (Up)
   - vninvest-celery-beat (Up)
4. Verify shared proxy containers are Up:
   - nginx-proxy
   - nginx-proxy-acme

---

## 5. Post-Deploy Validation

Run health checks:

- https://vninvest.edusuccess.vn
- https://vninvest.edusuccess.vn/api/health/
- https://vninvest.edusuccess.vn/admin/

Expected:

1. HTTP redirects to HTTPS.
2. Homepage loads without MIME errors on CSS/JS.
3. API health returns success.
4. Admin path is served by Django (not redirected to frontend login route).

---

## 6. Update Procedure (New Code Release)

Use Stack -> Update the stack.

Required settings during update:

1. Keep reference as refs/heads/main.
2. Enable options equivalent to:
   - re-pull/rebuild image
   - force recreate containers
3. Redeploy and re-check health endpoints.

Important:
If frontend or backend config changed (for example nginx.conf, Django admin routing, auth/mail fixes), normal recreate without rebuild can keep old image and old behavior.

---

## 7. Known Issues and Quick Fixes

### 7.1 Portainer cannot fetch repository

Symptoms:
- Unable to fetch git repository
- Invalid username or token

Fix:
1. Use GitHub PAT instead of account password.
2. Ensure reference is refs/heads/main.

### 7.2 External network not found

Symptoms:
- network declared as external, but could not be found

Fix:
1. Set PROXY_NETWORK to actual network name used by nginx-proxy.
2. Typical value: nginx-proxy_default.

### 7.3 Static files served as text/html or 404

Symptoms:
- Refused to apply style/script because MIME type text/html

Fix:
1. Rebuild frontend image and force recreate frontend container.
2. Ensure frontend nginx config does not proxy app static bundle to backend.

### 7.4 Admin URL redirects to frontend login

Symptoms:
- /admin goes to /login in SPA

Fix:
1. Ensure frontend nginx routes /admin and /static/admin to backend.
2. Rebuild frontend image and redeploy.

### 7.5 Google Client Secret required when saving mail account

Symptoms:
- Validation error saying Google Client Secret is required, even when field is filled.

Fix:
1. Make sure backend image includes latest admin form fix.
2. Rebuild backend image and force recreate backend container.

### 7.6 502 Bad Gateway

Symptoms:
- API or admin returns 502

Fix:
1. Check db/redis/backend are really Up (not Created).
2. Start db and redis first, then backend, then celery services.

---

## 8. Operational Notes

1. Keep production secrets outside repository when possible.
2. Rotate GitHub PAT and mail credentials regularly.
3. After major deploy, test:
   - login
   - /api/health
   - portfolio API
   - admin access
   - mail test send (if configured)
