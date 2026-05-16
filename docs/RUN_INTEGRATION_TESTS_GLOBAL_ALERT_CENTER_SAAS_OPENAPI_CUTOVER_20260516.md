# Run Integration Tests — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Backend baseline suites

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py test market_data.tests.test_global_symbol_registry --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test market_data.tests.test_global_symbol_coverage --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test market_data.tests.test_global_symbol_planner --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test service_ops.tests.test_soc_api_domain --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test service_ops.tests.test_soc_tasks --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test signal_intelligence.tests.test_materializers --keepdb
Pop-Location
```

---

## 2. Required new backend suites before cutover

1. `signal_intelligence.tests.test_alert_center_api`
2. `signal_intelligence.tests.test_user_alert_delivery`
3. `signal_intelligence.tests.test_market_anomaly_events`
4. `signal_intelligence.tests.test_ai_signal_lane`

---

## 3. Frontend / packages-web tests

```powershell
Push-Location ./packages/web
npm test -- --runInBand --watch=false src/adapters/coreApiAdapter.test.js
Pop-Location
```

Required new suites before cutover:

1. packages/web alert hub page tests
2. packages/web AI lane page tests
3. temporary frontend bridge regression tests

---

## 4. Runtime smoke

```powershell
.\start_dev.ps1
```

Smoke expectations:

1. `/core/v1/health` = 200
2. schema generation works
3. native alert-center endpoints return auth challenge or valid data, not 404
4. packages/web build/runtime points to `/core/v1/` contracts

---

## 5. Mandatory cutover gate

Không được coi integration test là đủ cho legacy sunset nếu thiếu:

1. shadow run evidence
2. parity score evidence
3. rollback path evidence

Gói này không chấp nhận “skip soak/shadow validation”.
