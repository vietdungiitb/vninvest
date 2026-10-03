# Run Integration Tests - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Backend focused suites

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py test service_ops.tests.test_soc_api_domain --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test service_ops.tests.test_soc_tasks --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test data_ingest.tests.test_tasks --keepdb
Pop-Location
```

## 2. Frontend focused suites

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

## 3. OpenAPI validation

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py spectacular --file openapi_scheduler_control_center.yaml
Pop-Location
```

Expected:
1. Khong error schema generation.
2. Endpoints scheduler moi xuat hien day du.
3. Request/response schemas dung contract.

## 4. Runtime smoke

```powershell
./start_dev.ps1
```

Smoke expectations:
1. Core API health OK.
2. Frontend health OK.
3. Scheduler plan endpoint return payload hop le.
4. Action endpoint deny/allow semantics dung ownership.

## 5. Rollout gates

1. Read-only mode soak >= 24h (khong stale false positive).
2. Write-mode pilot voi nhom jobs han che, co rollback evidence.
