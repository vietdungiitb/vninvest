# Holistic Advisory H4 Rollout Runbook (Cohort + Governance)

Status: READY
Date: 2026-04-11
Owner: Backend/Ops

## 1) Muc tieu

Runbook nay chuan hoa rollout Holistic Advisory V1 theo cohort de giam rui ro release, dong bo voi governance observability va release gate regression.

## 2) Bien moi truong can quan ly

Ap dung cho backend runtime:

- `HOLISTIC_ADVISORY_V1_ENABLED` (`true|false`)
- `HOLISTIC_ADVISORY_V1_COHORT_MODE` (`all|staff|allowlist`)
- `HOLISTIC_ADVISORY_V1_COHORT_USERNAMES` (comma-separated usernames)
- `HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD` (float >= 0)
- `HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD` (float >= warning)
- `HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD` (float >= 0)

## 3) Cohort rollout templates

### 3.1 Pre-release lock (tat toan bo)

```
HOLISTIC_ADVISORY_V1_ENABLED=false
HOLISTIC_ADVISORY_V1_COHORT_MODE=all
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=
```

### 3.2 Canary staff

```
HOLISTIC_ADVISORY_V1_ENABLED=true
HOLISTIC_ADVISORY_V1_COHORT_MODE=staff
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=
```

### 3.3 Canary allowlist

```
HOLISTIC_ADVISORY_V1_ENABLED=true
HOLISTIC_ADVISORY_V1_COHORT_MODE=allowlist
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=phamvietdung,testuser
```

### 3.4 Full rollout

```
HOLISTIC_ADVISORY_V1_ENABLED=true
HOLISTIC_ADVISORY_V1_COHORT_MODE=all
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=
```

## 4) Governance threshold templates

### 4.1 Baseline khuyen nghi

```
HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD=2.0
HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD=4.0
HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD=2.0
```

### 4.2 Alert-sensitive

```
HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD=1.5
HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD=3.0
HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD=1.0
```

Luu y: nguong nay co the duoc admin cap nhat runtime trong AdminOps, khong bat buoc restart service.

## 5) Release sequence (khuyen nghi)

1. Push branch `deploy` de trigger workflow `Governance Release Gate`.
2. Chay tay workflow (Run workflow) neu can GO/NO-GO pre-check doc lap.
3. Neu gate xanh, deploy backend va restart web + celery worker/beat.
4. Ap dung mode `staff` trong 30-60 phut dau.
5. Theo doi observability deny trend va severity badge trong StockDetail.
6. Nang len `allowlist` hoac `all` theo quyet dinh ops.

## 6) Smoke checklist sau moi lan doi cohort

1. Session API deny contract: user ngoai cohort nhan `403` + `reason=holistic_disabled`.
2. Observability API deny contract: user ngoai cohort nhan `403` + `reason=holistic_disabled`.
3. Governance panel hien du `delta_thresholds` dung voi runtime.
4. AdminOps cap nhat duoc 3 threshold va luu thanh cong.
5. Run regression nhanh:

```powershell
$env:POSTGRES_PASSWORD='***'
.\scripts\ops\sprint31_governance_postgres_regression.ps1
```

## 7) Rollback nhanh

### 7.1 Rollback cohort ngay lap tuc

```
HOLISTIC_ADVISORY_V1_ENABLED=false
HOLISTIC_ADVISORY_V1_COHORT_MODE=all
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=
```

### 7.2 Rollback ve staff-only

```
HOLISTIC_ADVISORY_V1_ENABLED=true
HOLISTIC_ADVISORY_V1_COHORT_MODE=staff
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=
```

### 7.3 Action sau rollback

1. Chay lai release gate workflow.
2. Xac nhan health endpoint va advisory APIs.
3. Mo postmortem item + assign owner truoc lan rollout tiep theo.

## 8) References

- `docs/HOLISTIC_ADVISORY_UPGRADE_MASTERPLAN_20260411.md`
- `docs/HOLISTIC_ADVISORY_H3_RELEASE_SMOKE_20260411.md`
- `scripts/ops/sprint30_run_release_gate.ps1`
- `scripts/ops/sprint31_governance_postgres_regression.ps1`
- `.github/workflows/governance-release-gate.yml`
