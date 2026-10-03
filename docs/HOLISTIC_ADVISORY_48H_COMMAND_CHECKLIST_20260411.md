# HOLISTIC ADVISORY 48H COMMAND CHECKLIST (2026-04-11)

## 1) Muc tieu

Checklist lenh thuc thi nhanh cho H0.5 trong 48h dau, de team chay nhat quan va de truy vet artifact.

## 2) Chuan bi moi truong

1. Kich hoat venv:

```powershell
& "c:\Mujoco Projects\vninvest\.venv\Scripts\Activate.ps1"
```

2. Di chuyen vao repo root:

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
```

3. Kiem tra nhanh git status:

```powershell
git status --short
```

## 3) Lenh test theo tung gate

### Gate A: Correctness unit/integration (nhanh)

```powershell
cd backend
python manage.py test portfolio.tests.test_whale_advisory_task --keepdb
python manage.py test portfolio.tests.test_order_flow --keepdb
python manage.py test portfolio.tests.test_realtime_compute --keepdb
```

### Gate B: API smoke whale scope

```powershell
cd backend
python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests -k whale --keepdb
```

### Gate C: Migration skeleton validation (sau PR-4)

```powershell
cd backend
python manage.py makemigrations --check
python manage.py migrate
python manage.py showmigrations portfolio
```

## 4) Lenh evidence capture

1. Luu test output ra file:

```powershell
cd backend
python manage.py test portfolio.tests.test_whale_advisory_task --keepdb *> ..\test_output_holistic_h0_whale_advisory.txt
python manage.py test portfolio.tests.test_order_flow --keepdb *> ..\test_output_holistic_h0_order_flow.txt
python manage.py test portfolio.tests.test_realtime_compute --keepdb *> ..\test_output_holistic_h0_realtime_compute.txt
python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests -k whale --keepdb *> ..\test_output_holistic_h0_api_whale.txt
```

2. Chot danh sach file doi:

```powershell
git diff --name-only > changed_files_holistic_h0.txt
```

## 5) Lenh branch/commit de xuat

```powershell
git checkout -b feat/holistic-h0-pr1-correctness-severity
# ... edit + test ...
git add -A
git commit -m "fix(holistic-h0): normalize dark-flow source/severity semantics in advisory merge path"
```

```powershell
git checkout -b feat/holistic-h0-pr2-timeframe-tickrate
# ... edit + test ...
git add -A
git commit -m "fix(holistic-h0): align tick-rate mapping and timeframe propagation for advisory components"
```

```powershell
git checkout -b feat/holistic-h0-pr3-threshold-first-create
# ... edit + test ...
git add -A
git commit -m "fix(holistic-h0): enforce symbol threshold override semantics on first advisory creation"
```

```powershell
git checkout -b feat/holistic-h0-pr4-snapshot-model-skeleton
# ... edit + test ...
git add -A
git commit -m "feat(holistic-h0): add AdvisoryAggregateSnapshot and AdvisoryAggregateAuditLog model skeleton"
```

```powershell
git checkout -b feat/holistic-h0-pr5-baseline-metrics-instrumentation
# ... edit + test ...
git add -A
git commit -m "feat(holistic-h0): add baseline metrics instrumentation and docs evidence"
```

## 6) Exit checklist truoc GO/NO-GO

1. Tat ca gate tests PASS.
2. Co artifact output files.
3. Co baseline KPI report file trong docs.
4. Co note rollback cho tung PR.
5. Khong co dirty changes khong lien quan truoc khi merge.
