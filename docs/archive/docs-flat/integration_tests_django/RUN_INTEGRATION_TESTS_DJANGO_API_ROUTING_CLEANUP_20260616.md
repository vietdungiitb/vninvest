# Run Integration Tests: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Test Suites by Phase

### Phase 0 — Immediate Cleanup

| Suite | Command | Target Apps | Expected Duration | Pass Criteria |
|-------|---------|-------------|-------------------|---------------|
| **Identity Access** | `python manage.py test identity_access` | `identity_access` | ~60s | 0 failures |
| **Signal Intelligence** | `python manage.py test signal_intelligence` | `signal_intelligence` | ~45s | 0 failures |
| **Routing Smoke** | `python scripts/smoke/curl_smoke.sh --phase=0` | `vninvest_core`, `identity_access` | ~10s | 4/4 endpoints 200 |

### Phase 1 — Identity & Workspace

| Suite | Command | Target Apps | Expected Duration | Pass Criteria |
|-------|---------|-------------|-------------------|---------------|
| **Identity Access** | `python manage.py test identity_access` | `identity_access` | ~60s | 0 failures |
| **User Workspace** | `python manage.py test user_workspace` | `user_workspace` | ~90s | 0 failures |
| **Full Backend** | `python manage.py test` | All backend | ~5min | 0 failures |
| **Frontend Unit** | `cd packages/web && npm test` | `packages/web` | ~2min | 0 failures |
| **Frontend Build** | `cd packages/web && npm run build` | `packages/web` | ~3min | Exit 0 |
| **Frontend E2E** | `cd packages/web && npm run test:e2e` | `packages/web` | ~5min | 0 failures |
| **Routing Smoke** | `python scripts/smoke/curl_smoke.sh --phase=1` | All `/core/v1/` | ~15s | 7/7 endpoints 200 |

### Phase 2 — Market Data & Signals

| Suite | Command | Target Apps | Expected Duration | Pass Criteria |
|-------|---------|-------------|-------------------|---------------|
| **Market Serving** | `python manage.py test market_serving` | `market_serving` | ~60s | 0 failures |
| **Market Data** | `python manage.py test market_data` | `market_data` | ~60s | 0 failures |
| **Signal Intelligence** | `python manage.py test signal_intelligence` | `signal_intelligence` | ~45s | 0 failures |
| **Full Backend** | `python manage.py test` | All backend | ~5min | 0 failures |
| **Routing Smoke** | `python scripts/smoke/curl_smoke.sh --phase=2` | All `/core/v1/` | ~15s | 7/7 endpoints 200 |

### Phase 3 — Final Verification

| Suite | Command | Target Apps | Expected Duration | Pass Criteria |
|-------|---------|-------------|-------------------|---------------|
| **Full Backend** | `python manage.py test` | All backend | ~5min | 0 failures |
| **Frontend Unit** | `cd packages/web && npm test` | `packages/web` | ~2min | 0 failures |
| **Frontend Build** | `cd packages/web && npm run build` | `packages/web` | ~3min | Exit 0 |
| **Frontend E2E** | `cd packages/web && npm run test:e2e` | `packages/web` | ~5min | 0 failures |
| **Routing Smoke** | `python scripts/smoke/curl_smoke.sh --phase=3` | All `/core/v1/` | ~15s | 7/7 endpoints 200 |
| **Swagger Validation** | `python manage.py spectacular --validate` | All | ~10s | 0 errors |
| **Route Crawl** | `python scripts/audit/crawl_core_v1.py` | All `/core/v1/` | ~30s | 0 404s |
| **Coverage Report** | `coverage report --fail-under=80` | All backend | ~30s | All targets met |

---

## 2. Smoke Test Script (`scripts/smoke/curl_smoke.sh`)

```bash
#!/bin/bash
# Usage: ./curl_smoke.sh [--phase=0|1|2|3]

BASE_URL="${BASE_URL:-http://localhost:8000}"
PHASE="${1#--phase=}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"
    local auth_header="${4:-}"
    
    if [ -n "$auth_header" ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" -H "$auth_header" "$BASE_URL$url")
    else
        code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$url")
    fi
    
    if [ "$code" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name ($url) → $code"
        return 0
    else
        echo -e "${RED}✗${NC} $name ($url) → $code (expected $expected)"
        return 1
    fi
}

echo "=== Smoke Test: Phase $PHASE ==="
echo "Base URL: $BASE_URL"
echo ""

FAIL=0

# Phase 0+ : Always required
test_endpoint "Health" "/core/v1/health" 200 || FAIL=1
test_endpoint "Capability Bootstrap" "/core/v1/capability-bootstrap" 200 || FAIL=1
test_endpoint "Auth Me (unauth)" "/core/v1/auth/me" 401 || FAIL=1
test_endpoint "Compat Health" "/api/health" 200 || FAIL=1

# Phase 1+ : Requires auth token
if [ "$PHASE" -ge 1 ] && [ -n "$AUTH_TOKEN" ]; then
    test_endpoint "Auth Me (auth)" "/core/v1/auth/me" 200 "Authorization: Bearer $AUTH_TOKEN" || FAIL=1
    test_endpoint "Workspace Portfolios" "/core/v1/workspace/portfolios/" 200 "Authorization: Bearer $AUTH_TOKEN" || FAIL=1
    test_endpoint "Partner Tenant" "/core/v1/partner/tenant" 200 "Authorization: Bearer $AUTH_TOKEN" || FAIL=1
fi

# Phase 2+ : Market data
if [ "$PHASE" -ge 2 ] && [ -n "$AUTH_TOKEN" ]; then
    test_endpoint "Symbol Investigation" "/core/v1/realtime/symbol-investigation/VCB" 200 "Authorization: Bearer $AUTH_TOKEN" || FAIL=1
fi

# Phase 3 : Swagger
if [ "$PHASE" -eq 3 ]; then
    test_endpoint "OpenAPI Schema" "/core/v1/schema/" 200 || FAIL=1
    test_endpoint "Swagger UI" "/core/v1/schema/swagger-ui/" 200 || FAIL=1
fi

echo ""
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}ALL SMOKE TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}SMOKE TESTS FAILED${NC}"
    exit 1
fi
```

---

## 3. Route Crawl Script (`scripts/audit/crawl_core_v1.py`)

```python
#!/usr/bin/env python
"""
Crawl all /core/v1/ endpoints and verify no 404s.
Run against running Django instance.
"""
import requests
import sys
from urllib.parse import urljoin

BASE_URL = "http://localhost:8000"
PREFIX = "/core/v1/"

# Known endpoints from TECH_SPEC routing matrix
ENDPOINTS = [
    # identity_access
    "health",
    "capability-bootstrap",
    "auth/login",
    "auth/me",
    "auth/logout",
    "access/capabilities",
    "onboarding/register",
    "tenant",
    "service-accounts",
    "service-accounts/test-sa",
    "pat",
    "identity/profile",
    "operator/mail-configs",
    "operator/mail-config",
    # identity_access_partner
    "partner/tenant",
    "partner/service-accounts",
    "partner/pats",
    "partner/usage/meters",
    "partner/usage/quotas",
    "partner/billing/subscription",
    "partner/billing/invoices",
    # user_workspace
    "workspace/portfolios",
    "workspace/watchlists",
    "workspace/whale-analytics/VCB",
    "workspace/ai-command-center",
    # market_data
    "stock-management/groups",
    "stock-management/tracked-symbols",
    "stock-management/price-alerts",
    "stock-management/stocks/VCB",
    "stock-management/stocks/VCB/overview",
    "stock-management/stocks/VCB/chart",
    "stock-management/stocks/VCB/news",
    "stock-management/stocks/VCB/financials",
    "stock-management/stocks/VCB/bars",
    "stock-management/portfolio/news-digest",
    # market_serving
    "symbol-snapshot",
    "symbol-snapshot/VCB",
    "session-facts",
    "session-facts/VCB",
    "realtime/ticker/VCB",
    "realtime/tickers",
    "realtime/intraday/VCB",
    "realtime/price-board/VCB",
    "realtime/breadth/VCB",
    "realtime/whale-feed/VCB",
    "realtime/rvol/VCB",
    "realtime/depth-chart/VCB",
    "realtime/symbol-investigation/VCB",
    # signal_intelligence
    "signals/alert-center/feed",
    "signals/alert-center/summary",
    "signals/ai-alerts/feed",
    "whale-feed",
    "signals/order-flow/VCB",
    # commercial
    "billing/subscription",
    "billing/quota",
    "billing/invoices",
    # advisory
    "advisory/latest/VCB",
    "advisory/history/VCB",
    # ops_audit
    "audit-log",
    # support
    "tickets",
    # advertising
    "operator/ads/campaigns",
    "operator/ads/analytics",
    # data_ingest
    "data-ingest/jobs",
    "data-ingest/runs",
]

def test_endpoint(path):
    url = urljoin(BASE_URL, PREFIX + path)
    try:
        # Most endpoints need auth; health/capability-bootstrap don't
        headers = {}
        if path not in ["health", "capability-bootstrap"]:
            headers["Authorization"] = "Bearer test-token"  # Will get 401 not 404
        
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 404:
            return False, f"404 Not Found"
        elif resp.status_code in [200, 401, 403]:
            return True, f"{resp.status_code} OK"
        else:
            return False, f"{resp.status_code} Unexpected"
    except Exception as e:
        return False, f"Error: {e}"

def main():
    print(f"Crawling {BASE_URL}{PREFIX}...")
    print(f"Testing {len(ENDPOINTS)} endpoints\n")
    
    failed = []
    for ep in ENDPOINTS:
        ok, msg = test_endpoint(ep)
        status = "✓" if ok else "✗"
        print(f"  {status} {PREFIX}{ep} → {msg}")
        if not ok:
            failed.append((ep, msg))
    
    print(f"\n=== Result: {len(ENDPOINTS) - len(failed)}/{len(ENDPOINTS)} passed ===")
    if failed:
        print("\nFailures:")
        for ep, msg in failed:
            print(f"  {PREFIX}{ep} → {msg}")
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

## 4. Test Environment Setup

### Backend (Django)
```bash
# 1. Activate venv
source venv/bin/activate

# 2. Set test settings
export DJANGO_SETTINGS_MODULE=vninvest_core.settings.test
export DJANGO_DEBUG=true

# 3. Run migrations
python manage.py migrate --run-syncdb

# 4. Create test tenant/user (if needed)
python manage.py shell -c "
from identity_access.models import Tenant, User
tenant = Tenant.objects.create(name='Test Tenant', slug='test')
user = User.objects.create_user(email='test@test.com', password='testpass', tenant=tenant)
print('Test user:', user.id)
"
```

### Frontend (React)
```bash
cd packages/web

# 1. Install deps
npm ci

# 2. Set test env
cp .env.test .env.local
# Ensure REACT_APP_CORE_API_BASE_URL=/core/v1 in .env.test

# 3. Run tests
npm test
```

---

## 5. CI Pipeline Integration

```yaml
# .github/workflows/django-api-routing-cleanup.yml
name: Django API Routing Cleanup Tests

on:
  pull_request:
    paths:
      - 'packages/core/backend/src/**/urls.py'
      - 'packages/core/backend/src/**/api_urls.py'
      - 'packages/core/backend/src/**/public_urls.py'
      - 'packages/web/src/config/api.ts'
      - 'packages/web/.env*'

jobs:
  phase-0:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install deps
        run: pip install -r packages/core/backend/requirements.txt
      - name: Run Phase 0 Tests
        run: |
          python manage.py test identity_access signal_intelligence
          ./scripts/smoke/curl_smoke.sh --phase=0
      - name: Grep Checks
        run: |
          grep -r "api_urls" packages/core/backend/src/ && exit 1 || true
          grep -E "LegacyWatchlist|GenericEmpty" packages/core/backend/src/user_workspace/urls.py && exit 1 || true

  phase-1:
    needs: phase-0
    if: github.event.pull_request.labels.*.name contains 'phase-1'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Frontend Tests
        run: |
          cd packages/web && npm ci && npm test && npm run build
      - name: Frontend Grep Checks
        run: |
          grep -r "/api/portfolio/" packages/web/src/ && exit 1 || true
          grep -r "/api/auth/" packages/web/src/ && exit 1 || true
          grep -r "/api/core/v1/partner/" packages/web/src/ && exit 1 || true

  phase-2:
    needs: phase-0
    if: github.event.pull_request.labels.*.name contains 'phase-2'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Run Phase 2 Tests
        run: |
          python manage.py test market_serving market_data
          ./scripts/smoke/curl_smoke.sh --phase=2

  final:
    needs: [phase-0, phase-1, phase-2]
    if: github.event.pull_request.labels.*.name contains 'final'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Full Test Suite
        run: |
          python manage.py test
          cd packages/web && npm test
          ./scripts/smoke/curl_smoke.sh --phase=3
          python manage.py spectacular --validate
          python scripts/audit/crawl_core_v1.py
          coverage report --fail-under=80
```

---

## 6. Mandatory Gate: Runtime Smoke Test

**No PR merges without passing smoke test against running instance.**

| Environment | When | Command |
|-------------|------|---------|
| Local | Pre-push | `./scripts/smoke/curl_smoke.sh --phase=X` |
| Staging | Post-deploy | `./scripts/smoke/curl_smoke.sh --phase=X` |
| CI | Every PR | GitHub Actions (above) |

**Required for merge:** Phase-appropriate smoke test PASS + test suite PASS.

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*