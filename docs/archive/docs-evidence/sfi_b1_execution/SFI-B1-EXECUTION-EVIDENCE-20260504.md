# SFI-B1 Execution Evidence — Transparent Proxy Bridge

**Phase**: B1 — Transparent Proxy Bridge  
**Status**: ✅ COMPLETE  
**Timestamp**: 2026-05-04T23:19:17Z

---

## Slice Summary

| Slice | Description | Status |
|-------|-------------|--------|
| B1.1 | Add httpx dependency to requirements.txt | ✅ |
| B1.2 | Create legacy_proxy.py (sync WSGI-compatible) | ✅ |
| B1.3 | Add proxy route as last entry in urls.py | ✅ |
| B1.4 | Add LEGACY_BACKEND_URL to settings.py | ✅ |
| B1.5 | nginx.conf: /api/ → core-api:8100 | ✅ |
| B1.6 | docker-compose.dev.yml: LEGACY_BACKEND_URL, no port 8000, no backend dep | ✅ |
| B1.7 | Smoke tests | ✅ |

---

## Smoke Test Results

All tests run at 2026-05-04T23:19:17Z against `http://localhost`:

| Test ID | Endpoint | Expected | Actual | Result |
|---------|----------|----------|--------|--------|
| B1-01 | `GET /api/health/` | 200 | 200 | ✅ PASS |
| B1-02 | `GET /api/portfolio/portfolios/` | 401 | 401 | ✅ PASS |
| B1-03 | `GET /core/v1/health` | 200 | 200 | ✅ PASS |
| B1-04 | Port 8000 not public | HIDDEN | HIDDEN | ✅ PASS |

---

## Files Modified

| File | Change |
|------|--------|
| `packages/core/backend/requirements.txt` | Added `httpx>=0.27,<1.0` |
| `packages/core/backend/src/vninvest_core/legacy_proxy.py` | NEW — sync transparent proxy |
| `packages/core/backend/src/vninvest_core/urls.py` | Added proxy route as last urlpattern |
| `packages/core/backend/src/vninvest_core/settings.py` | Added LEGACY_BACKEND_URL from env |
| `frontend/docker/nginx.conf` | /api/ → core-api:8100 (single location, 300s timeout) |
| `docker-compose.dev.yml` | LEGACY_BACKEND_URL env, removed port 8000, removed backend dep from frontend |

---

## Key Design Decisions

1. **Sync proxy (not async)**: core-api runs gunicorn WSGI. Async Django views with AsyncClient cause RuntimeError under WSGI. Used synchronous `httpx.Client` instead.
2. **Proxy as LAST urlpattern**: Ensures native core-api routes take priority. Proxy only handles routes not matched natively.
3. **PROXY_EXCLUDED_PREFIXES**: Safety list for routes handled natively — prevents double-routing.
4. **DB password**: `POSTGRES_PASSWORD` host env var was overriding compose default. Reset DB password to `devpassword` to match core-api DATABASE_URL.
