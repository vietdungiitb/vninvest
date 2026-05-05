# Audit Report: SaaS Infrastructure Transition (2026-05-04)

## 1. Executive Summary
The transition of VNInvest to a SaaS model infrastructure has been successfully initialized. Core services (API, Worker, Beat) are now isolated in a dedicated Docker stack, while the legacy application layer has been decoupled. Administrative access has been established, and connectivity between services is stable. However, critical data synchronization gaps exist between the legacy database and the new Core materializers.

## 2. Infrastructure Configuration
### 2.1 Docker Stack Status
- **Core API**: Operational on port `8100`. Healthy.
- **Core Worker/Beat**: Operational (Stubs). Connected to Redis and DB.
- **Database (PostgreSQL)**: Shared `vninvest` database.
- **Redis**: Isolated to `db 3` for Core services, avoiding conflicts with legacy `db 0/1/2`.
- **Legacy Services**: `celery_worker` and `celery_beat` are currently running but redundant; decommissioning is recommended.

### 2.2 Administrative Access
- **Superuser**: `admin` / `test@123456`
- **Core Tenant**: `vni-saas` (Enterprise Plan)
- **Service Account**: `Default Service Account`
- **Authentication**: `CorePATAuthentication` verified via capability bootstrap.

## 3. Audit Findings & Issues

### 3.1 [CRITICAL] Materialization Drift
The `core-api` materializers (responsible for syncing data from the legacy DB) are currently failing or skipping.
- **Symptom**: The code expects tables `portfolio_symbolsnapshot` and `portfolio_sessionfacts`.
- **Root Cause**: These tables do not exist in the current legacy database schema. Legacy data is stored in `portfolio_dailyprice`, `portfolio_tickersessionclose`, and `portfolio_advisoryaggregatesnapshot` (JSONB).
- **Impact**: No market data is currently flowing into the SaaS `SymbolSnapshot` and `SessionFacts` models.

### 3.2 [MAJOR] Identity Table Fragmentation
- **Finding**: Two sets of "Core" tables exist in the database:
    1. `identity_access_coretenant` (used by `core-api`)
    2. `portfolio_coretenant` (created by legacy migrations)
- **Impact**: Changes made in the legacy admin panel for tenants will not reflect in the SaaS API and vice versa.

### 3.3 [MINOR] Container Healthchecks
- **Finding**: `core-api` healthcheck depends on `gunicorn` being fully initialized.
- **Observation**: Startup is successful, but initial health checks may show "starting" for up to 30 seconds due to worker boot time.

## 4. Verification Results
| Endpoint | Status | Result |
| :--- | :--- | :--- |
| `/core/v1/health` | **PASS** | `{"status": "healthy"}` |
| `/core/v1/capability-bootstrap` | **PASS** | Returns `build_target: saas` |
| Administrative Auth | **PASS** | Admin user created and mapped to CoreTenant |
| Database Connectivity | **PASS** | Both Core and Legacy connections functional |

## 5. Recommended Actions

### Phase 1: Data Alignment
1. **Update Materializers**: Refactor `packages/core/backend/src/market_serving/materializers.py` to map data from `portfolio_dailyprice` and `portfolio_advisoryaggregatesnapshot` (extracting CVD/Strength from `state_json`).
2. **Table Unification**: Rename or alias `identity_access_coretenant` to the legacy canonical name if parity with existing admin tools is required.

### Phase 2: Decommissioning
1. **Legacy Cleanup**: Remove `celery_worker` and `celery_beat` from `docker-compose.dev.yml` to save resources and stop background job duplication.
2. **Frontend Redirection**: Update local frontend `.env` to point `REACT_APP_API_BASE_URL` to `http://localhost:8100`.

### Phase 3: Validation
1. **Run Integration Tests**: Execute `backend/portfolio/tests/test_whale_orders_ssot_parity.py` against the new `core-api` endpoint.
