# RUN INTEGRATION TESTS - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Test order

Run theo thu tu sau de giam nghieng scope:

1. Route resolver and backend domain tests.
2. Frontend build and bootstrap smoke.
3. Production compose pull/recreate if slice touches runtime images.
4. Browser smoke and console/network validation.

---

## 2. Suggested commands

### Backend focused checks

```powershell
Push-Location ./packages/core/backend
..\.venv\Scripts\python.exe manage.py test tests.test_identity_access --keepdb
..\.venv\Scripts\python.exe manage.py test tests.test_user_workspace --keepdb
..\.venv\Scripts\python.exe manage.py test tests.test_market_data --keepdb
..\.venv\Scripts\python.exe manage.py test tests.test_signal_intelligence --keepdb
Pop-Location
```

### Frontend build

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### Resolver smoke

Confirm these resolve to native owners:

1. `/api/auth/login/`
2. `/api/auth/me/`
3. `/api/portfolio/portfolios/`
4. `/api/stock-management/tracked-symbols/`
5. `/api/public/legal-pages/?locale=vi`

### Production smoke

1. Pull/recreate GHCR images for touched services.
2. Reload browser on production.
3. Verify zero console errors and zero 5xx network responses.

---

## 3. Pass criteria

1. All focused backend tests pass.
2. Frontend build passes.
3. Route resolver returns native handlers for active endpoints.
4. Browser smoke shows no 502 or other proxy symptoms.
