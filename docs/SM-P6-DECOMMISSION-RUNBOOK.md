# SM-P6 Legacy Decommission Runbook

> **HARD GATE**: ALL 7 pre-decommission gates (A–G) must PASS with Tech Lead sign-off
> before executing any step in this runbook.
>
> Run first: `python scripts/pre_decommission_gates_check.py --core-url https://your-domain.com`

---

## Pre-flight

```powershell
# 1. Verify all 7 gates
python scripts/pre_decommission_gates_check.py `
  --core-url https://your-domain.com `
  --core-pat $env:CORE_PAT `
  --legacy-url https://your-domain.com `
  --output docs/evidence/SM-P6-gates-result.json

# 2. Take a full backup before ANY decommission step
# (Verify daily_db_backup ran last night, or trigger manually:)
docker exec vninvest-core-worker python manage.py shell -c "
from ops_audit.tasks import daily_db_backup
result = daily_db_backup.apply()
print(result.get())
"
```

---

## SM-P6.1: Stop legacy containers — monitor 24h

```powershell
# Stop legacy backend containers (does NOT remove volumes)
docker compose -f docker-compose.prod.yml stop backend celery_worker celery_beat

# Verify stopped
docker ps --filter name=vninvest-backend
docker ps --filter name=vninvest-celery

# Monitor for 24h — check Sentry and Caddy logs for errors
docker logs vninvest-caddy --tail 100 --follow
```

DoD: 24h pass with 0 incidents.

---

## SM-P6.2: Verify Caddy no longer proxies to legacy

```powershell
# Caddy already routes /api/* and /core/* to core-api:8100 (SM-P4.8)
# Verify: grep Caddy access logs for :8000 requests
docker logs vninvest-caddy 2>&1 | Select-String ':8000'
# Expected: no output
```

Note: `infra/caddy/Caddyfile` already removed legacy `backend:8000` proxy (done in SM-P4.8).
This step is verification-only — no code changes required.

---

## SM-P6.3: Git archive + remove frontend/ legacy code

```powershell
cd "C:\Mujoco Projects\vninvest"

# Create archive tag before deletion
git tag legacy-monolith-archive-$(Get-Date -Format 'yyyyMMdd')
git push origin --tags

# Remove legacy frontend (the new packages/web + GHCR build replaces this)
# WARNING: Destructive — ensure tag is pushed first
git rm -r frontend/
git commit -m "chore(SM-P6.3): remove legacy frontend — archived at tag legacy-monolith-archive"
git push origin main
```

Monitor for 24h after deploy.

---

## SM-P6.4: Remove backend/ legacy code

```powershell
# WARNING: Destructive — run ONLY after SM-P6.1 24h monitoring passes AND SM-P6.3 deploys
git rm -r backend/
git commit -m "chore(SM-P6.4): remove legacy backend monolith — archived at tag legacy-monolith-archive"
git push origin main
```

Monitor for 48h after deploy.

---

## SM-P6.5: Rename legacy DB tables → _deprecated_ prefix

```sql
-- Run against the vninvest (legacy) PostgreSQL database
-- Keep tables for 30 days before dropping

ALTER TABLE portfolio_intradaytick RENAME TO _deprecated_portfolio_intradaytick;
ALTER TABLE portfolio_whalealertcanonical RENAME TO _deprecated_portfolio_whalealertcanonical;
ALTER TABLE portfolio_portfolio RENAME TO _deprecated_portfolio_portfolio;
ALTER TABLE portfolio_transaction RENAME TO _deprecated_portfolio_transaction;
-- Repeat for all portfolio_* tables

-- Verify
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

---

## SM-P6.6: Cleanup root-level debug files

```powershell
# Remove debug/test helper files from root
Remove-Item debug_api_endpoint.py, debug_api_test.py, debug_payload_serialization.py,
  debug_realtime_ticker.py, debug_dark_money.py,
  check_setting.py, gen_token.py,
  test_api_from_docker.py, test_ticker_debug.py, test_ticker_fix.py -ErrorAction SilentlyContinue

git add -A
git commit -m "chore(SM-P6.6): remove legacy debug/test helper files"
git push origin main
```

---

## SM-P6.7: Regenerate module_tree_full.md + update progress docs

```powershell
# Regenerate module tree after decommission
cd "C:\Mujoco Projects\vninvest"
python -c "
import os, json
tree = {}
for root, dirs, files in os.walk('.'):
    # skip hidden, node_modules, __pycache__, .git
    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'build', 'dist')]
    for f in files:
        path = os.path.join(root, f).replace('\\\\', '/')
        tree[path] = os.path.getsize(os.path.join(root, f))
print(f'Total files: {len(tree)}')
" > module_tree_full.md 2>&1

# Update PROGRESS_DASHBOARD.md and CODE_CHANGE_AUDIT_LEDGER.md with Phase 6 completion
```

---

## Post-decommission sign-off checklist

| Gate | Status | Sign-off |
|------|--------|----------|
| SM-P6.0 gates A–G | ☐ | Tech Lead: _____________ |
| SM-P6.1: Legacy containers stopped 24h | ☐ | DevOps: ______________ |
| SM-P6.2: Caddy verified no :8000 traffic | ☐ | DevOps: ______________ |
| SM-P6.3: frontend/ removed, tag pushed | ☐ | Tech Lead: _____________ |
| SM-P6.4: backend/ removed, 48h monitoring | ☐ | Tech Lead: _____________ |
| SM-P6.5: Legacy tables renamed _deprecated_ | ☐ | Backend Lead: _____________ |
| SM-P6.6: Debug files cleaned | ☐ | Backend Dev: _____________ |
| SM-P6.7: module_tree_full.md regenerated | ☐ | Backend Dev: _____________ |
