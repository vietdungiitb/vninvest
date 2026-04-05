# Backend Audit Daily Tracker 2026-04-05

Status: ACTIVE
Related board: docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md
Owner matrix: docs/BACKEND_AUDIT_OWNER_ASSIGNMENT_20260405.md
Run-day playbook: docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md

## 1) Usage

Muc dich:
- Theo doi tien do A1..E2 theo ngay.
- Co chung cu de ra quyet dinh GO/NO-GO.

Quy tac update:
1. 09:30 cap nhat status + plan trong ngay.
2. 13:30 cap nhat blocker + hanh dong go blocker.
3. 17:30 cap nhat metric + quyet dinh gate.

## 2) Daily status ledger

| Date | 09:30 status | 13:30 blocker update | 17:30 gate decision | Owner on duty | Evidence links |
|---|---|---|---|---|---|
| 2026-04-05 | Kickoff board and tracking docs completed | N/A | N/A | PM/BE | docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md |
| 2026-04-06 | Run-day kickoff theo playbook 20260406 | Theo doi BLK-001 + regression signal | Gate note theo KPI baseline cua ngay | PM-1 / BE-Lead-1 / Ops-Lead-1 | docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md |
| 2026-04-07 | TBD | TBD | TBD | TBD | TBD |
| 2026-04-08 | TBD | TBD | TBD | TBD | TBD |
| 2026-04-09 | TBD | TBD | TBD | TBD | TBD |

## 3) KPI capture by day

| Date | Intraday p95 ms | PriceBoard p95 ms | Whale Aggregate p95 ms | HTTP 5xx % | External timeout % | Fallback ratio % | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-04-05 | TBD | TBD | TBD | TBD | TBD | TBD | Baseline chua duoc dien |
| 2026-04-06 | TBD | TBD | TBD | TBD | TBD | TBD |  |
| 2026-04-07 | TBD | TBD | TBD | TBD | TBD | TBD |  |
| 2026-04-08 | TBD | TBD | TBD | TBD | TBD | TBD |  |
| 2026-04-09 | TBD | TBD | TBD | TBD | TBD | TBD |  |

## 4) Blocker register

| ID | Open date | Blocker | Impacted tasks | Owner | ETA unblock | Status | Note |
|---|---|---|---|---|---|---|---|
| BLK-001 | 2026-04-05 | Chua co baseline metric day du tren staging | D1,D2,D3,E1,E2 | DevOps | TBD | Open | Can bat dau thu metric tu benchmark script + dashboard |

## 5) GO/NO-GO checkpoint log

| Checkpoint | Window | Preconditions | Result | Approver |
|---|---|---|---|---|
| Canary 10% | TBD | A1-A4 done + baseline available | TBD | TBD |
| Canary 50% | TBD | B1-B3 done + no rollback trigger at 10% | TBD | TBD |
| Full 100% | TBD | C1-C3 + D1-D3 done + canary 50% stable | TBD | TBD |

## 6) Quick command snippets

PowerShell snippets de ghi evidence nhanh:

```powershell
# Count direct provider imports in legacy views
rg "from vnstock import Vnstock" backend/portfolio/views.py

# Verify market toggle routes
rg "_toggle_market_view\(" backend/portfolio/urls_realtime.py backend/portfolio/urls_stock.py

# Run focused market route tests
cd backend
python manage.py test portfolio.tests.test_api_routes --pattern="*api_routes*"
```
