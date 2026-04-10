# Sprint 34 Go/No-Go One-Page

Sprint: 34
Theme: Dark Money Integrity & Usability Phase 1 (non-AI)
Decision owner: PM-Lead
Decision cadence: Gate G1 (mid-sprint), Gate G2 (end-sprint)

## 1) Go criteria (must all pass)

1. Scope lock
- In-scope A1/A2/B1 khong bi chen scope ngoai P0.

2. Delivery status
- A1 complete with deterministic identity evidence.
- A2 complete with cursor v2 parity evidence.
- B1 complete with severity rulebook and mapping evidence.

3. Quality gates
- Contract + paging regression pass.
- Severity regression pass.
- Khong con blocker critical mo > 48h.

4. KPI gates
- Duplicate event rate < 1%.
- Pagination consistency > 99.9%.
- Dark-flow severity profile khong info-collapsed.

5. Operational readiness
- Evidence pack complete (logs, KPI snapshots, defect closure).
- Sprint closeout note da cap nhat roadmap/backlog.

## 2) No-Go criteria (any trigger blocks release)

1. Scope drift
- Co item ngoai A1/A2/B1 lam anh huong tiem nang den quality gate.

2. Critical defects
- Ton tai defect P0/P1 critical chua co workaround an toan.

3. Contract instability
- Cursor v2 van duplicate/missing event trong test traversal.

4. KPI failure
- KPI correctness khong dat nguong toi thieu.

5. Missing evidence
- Khong co before/after KPI va QA sign-off.

## 3) Decision outputs

### If GO
1. Close Sprint 34 with acceptance checklist signed.
2. Move next scope to Phase 2 shortlist: A3/B2/B3/D3.
3. Publish release note and handoff package.

### If NO-GO
1. Freeze release.
2. Open hotfix sub-scope chi tap trung vao gate fail.
3. Re-run gate within agreed recovery window (24-72h).

## 4) Required evidence list

1. Contract/paging regression report.
2. Severity regression report.
3. KPI before/after snapshot.
4. Defect closure list.
5. PM/QA/BE sign-off line.

## 5) Sign-off block

- PM-Lead: ______________________ Date: __________
- QA-Lead: ______________________ Date: __________
- BE-Lead: ______________________ Date: __________
- FE-Lead (contract consumer): ____ Date: __________
- DevOps-Lead (KPI evidence): ____ Date: __________
