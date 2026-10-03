# Sprint 23 - Acceptance Checklist

Status: READY FOR SIGN-OFF (CONDITIONAL GO)
Related plan: docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md

## A. Code architecture gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S23-A1 | External facade finalized | BE-Lead-1 | Error map and timeout policy thong nhat | Done | docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md |
| S23-A2 | Market endpoint imports cleaned | BE-1 | Endpoint scope khong con direct provider import | Done | docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md |
| S23-A3 | Workspace flow boundary one-way | BE-2 | Overview/chart di qua service boundary | Done | docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md |
| S23-A4 | Legacy views complexity reduced | BE-Lead-1 | views.py LOC giam >= 30% hoac approved exception | Done | docs/SPRINT_EXECUTION_LOG.md |
| S23-A5 | Validation contract unified | BE-2 | Top endpoints parse request nhat quan | Done | docs/SPRINT_EXECUTION_LOG.md |
| S23-A6 | Threshold policy centralized | BE-Lead-1 | Khong con duplicate logic drift | Done | docs/SPRINT_EXECUTION_LOG.md |

## B. Quality and regression gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S23-B1 | Unit tests adapters/services | QA-1 | PASS tren CI | Done | docs/SPRINT_EXECUTION_LOG.md |
| S23-B2 | API regression focused | QA-Lead-1 | PASS khong vo contract | Done | docs/SPRINT_EXECUTION_LOG.md |
| S23-B3 | Negative validation tests | QA-1 | Invalid params cho dung 4xx | Done | docs/SPRINT_EXECUTION_LOG.md |
| S23-B4 | Workspace integration tests | QA-Lead-1 | PASS end-to-end | Done | docs/SPRINT_EXECUTION_LOG.md |

## C. Runtime and rollout gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S23-C1 | Baseline KPI captured | Ops-Lead-1 | Co p95/5xx/fallback baseline | Done | docs/ops-evidence/sprint23/canary-10-market-observability.json |
| S23-C2 | Canary 10% stable | Ops-1 | Khong cham rollback trigger | Done | docs/SPRINT23_CANARY_LOG_20260406.md |
| S23-C3 | Canary 50% stable | Ops-1 | Trend on dinh 24h | Done | docs/SPRINT23_CANARY_LOG_20260406.md |
| S23-C4 | Full rollout 100% approved | PM-1 | Go/No-Go sign-off du chu ky | Done | docs/SPRINT23_GO_NO_GO_SIGNOFF_20260406.md |
| S23-C5 | Rollback rehearsal executed | Ops-Lead-1 | PASS theo protocol | Done | docs/SPRINT23_ROLLBACK_REHEARSAL_REPORT_20260406.md |

## D. Documentation gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S23-D1 | Daily tracker complete | PM-1 | Du 3 moc/ngay trong sprint | Done | docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md |
| S23-D2 | Endpoint checklist maintained | BE-1 | Moi endpoint doi status co evidence | Done | docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md |
| S23-D3 | Sprint log updated daily | PM-1 | Log cap nhat cuoi ngay | Done | docs/SPRINT_EXECUTION_LOG.md |

## E. Final sign-off

- Tech Lead: ____ / Date: ____
- QA Lead: ____ / Date: ____
- DevOps Lead: ____ / Date: ____
- PM: ____ / Date: ____
