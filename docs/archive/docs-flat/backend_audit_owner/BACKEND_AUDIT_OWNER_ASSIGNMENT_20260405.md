# Backend Audit Owner Assignment 2026-04-05

Status: ACTIVE
Related board: docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md

## 1) Role roster

- PM duty: PM-1
- BE lead duty: BE-Lead-1
- BE execution: BE-1, BE-2
- QA lead: QA-Lead-1
- QA execution: QA-1
- DevOps lead: Ops-Lead-1
- DevOps execution: Ops-1

Ghi chu:
- Neu team co ten that, thay PM-1/BE-1... bang ten nguoi trong ngay.
- Moi thay doi owner phai update dong bo vao daily tracker.

## 2) Task owner matrix (A1..E2)

| Task | Primary owner | Backup owner | Escalation |
|---|---|---|---|
| A1 | BE-Lead-1 | BE-1 | PM-1 |
| A2 | BE-1 | BE-2 | BE-Lead-1 |
| A3 | BE-2 | BE-1 | BE-Lead-1 |
| A4 | BE-Lead-1 | BE-2 | PM-1 |
| B1 | BE-Lead-1 | BE-1 | PM-1 |
| B2 | BE-1 | BE-2 | BE-Lead-1 |
| B3 | QA-Lead-1 | QA-1 | PM-1 |
| C1 | BE-2 | BE-1 | BE-Lead-1 |
| C2 | BE-Lead-1 | BE-2 | PM-1 |
| C3 | QA-1 | QA-Lead-1 | PM-1 |
| D1 | Ops-Lead-1 | Ops-1 | PM-1 |
| D2 | Ops-1 | Ops-Lead-1 | PM-1 |
| D3 | Ops-Lead-1 | QA-Lead-1 | PM-1 |
| E1 | QA-Lead-1 | Ops-1 | PM-1 |
| E2 | PM-1 | Ops-Lead-1 | Steering group |

## 3) Endpoint owner matrix (MKT-01..MKT-11)

| Endpoint ID | Scope | Primary owner | QA owner | Note |
|---|---|---|---|---|
| MKT-01 | ticker | BE-1 | QA-1 | realtime hot-path |
| MKT-02 | intraday | BE-1 | QA-1 | parsing + pagination |
| MKT-03 | price-board | BE-2 | QA-1 | cache + fallback |
| MKT-04 | breadth | BE-2 | QA-1 | sector mapping |
| MKT-05 | rvol | BE-1 | QA-1 | aggregation logic |
| MKT-06 | whale-feed | BE-Lead-1 | QA-Lead-1 | entitlement + source chain |
| MKT-07 | whale-feed aggregate | BE-Lead-1 | QA-Lead-1 | cursor contract |
| MKT-08 | depth-chart | BE-2 | QA-1 | depth band logic |
| MKT-09 | financials | BE-2 | QA-1 | provider parse guard |
| MKT-10 | workspace overview | BE-1 | QA-Lead-1 | enriched payload |
| MKT-11 | workspace chart | BE-1 | QA-Lead-1 | chart/time-range contract |

## 4) Daily owner-on-duty plan

| Date | PM | BE lead | BE executor | QA lead | DevOps lead |
|---|---|---|---|---|---|
| 2026-04-06 | PM-1 | BE-Lead-1 | BE-1 | QA-Lead-1 | Ops-Lead-1 |
| 2026-04-07 | PM-1 | BE-Lead-1 | BE-2 | QA-Lead-1 | Ops-1 |
| 2026-04-08 | PM-1 | BE-Lead-1 | BE-1 | QA-1 | Ops-Lead-1 |
| 2026-04-09 | PM-1 | BE-Lead-1 | BE-2 | QA-Lead-1 | Ops-1 |

## 5) Escalation SLA

1. Blocker > 2h khong go duoc: escalate tu primary -> backup.
2. Blocker > 4h: escalate len task escalation owner.
3. Blocker > 1 ngay: PM-1 mo incident board item va cap nhat sprint log.
