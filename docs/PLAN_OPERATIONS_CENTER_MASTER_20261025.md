# MASTER PLAN — Nâng cấp Module Operations Center (SOC DataOps)

**Ngày:** 2026-10-25  
**Owner scope:** Frontend SOC + SOC client adapter + backend `service_ops` + tests/docs.  
**Bằng chứng audit:** `docs/AUDIT_OPERATIONS_CENTER_SOC_20261025.md`, `docs/AUDIT_OPERATIONS_CENTER_DEEP_20261025.md`.  
**Diagram:** `.archify/architecture-operations-center-20261025-090000/operations-center-architecture.html`, `.archify/dataflow-operations-center-20261025-090000/operations-center-dataflow.html`.

## 1. Mục tiêu

Nâng cấp module Operations Center từ trạng thái “parity legacy ~95%” lên mức production-grade: đồng bộ tab/deep-link, realtime refresh, bundle/perf, maintainability, observability, và test coverage.

## 2. Phạm vi và không phạm vi

**In scope:**
- FE: `ShellOperationsCenterPage`, `DataOpsContext`, `SocRuntimeKpiPanel`, tab router, polling, bundle split.
- Adapter: `soc.js` domain split.
- BE: `service_ops/urls.py`, `tasks.py` split, contract tests.
- Tests/docs/i18n.

**Out of scope (giai đoạn sau):**
- DAG lineage full (Airflow-like).
- Config diff/rollback approval workflow.
- Per-tenant RBAC redesign.
- Native app/PWA.

## 3. Baseline gates (đo ngày 2026-10-25)

- `npx tsc --noEmit`: PASS (0).
- `npm run lint`: chưa chạy trong slice này.
- `npm run test` / `test:components`: chưa chạy.
- BE tests: chưa chạy (cần Postgres/VPS).
- `check-multi-agent.mjs`: chưa chạy trong slice này.

## 4. Phases

### Phase A — Correctness/UX (P0)
A1. Unify tab router (URL single source).  
A2. I18n hardcode labels.  
A3. DataOps visibility-aware polling.  
A4. Signals live feed polling/stream.

### Phase B — Performance/Maintainability (P1)
B1. Code-split tabs/sections.  
B2. Split `soc.js` by domain.  
B3. Runtime KPI use SOC client.  
B4. Standardize error state + retry.

### Phase C — Backend cleanup (P1/P2)
C1. Split `service_ops/urls.py`.  
C2. Split `service_ops/tasks.py`.  
C3. Contract/integration tests ownership/audit.

### Phase D — Commercial parity (P2)
D1. DAG/run lineage view.  
D2. Config diff/rollback.  
D3. Alert escalation/notification.  
D4. Observability traces/percentiles.

## 5. Acceptance criteria (master)

- Deep-link `/operations-center?tab=...&dataops_tab=...` hoạt động và back/forward đồng bộ.
- DataOps tự refresh khi tab active/visible.
- Signals có live feed mode.
- Không còn hardcode “OPERATIONS CENTER/LIVE”.
- Bundle SOC giảm hoặc code-split có hiệu lực.
- `tsc --noEmit` PASS.
- Docs/ledger cập nhật.

## 6. Risks

- i18n files đang có claim in-progress từ agent khác → merge conflict.
- BE tests cần Postgres/VPS → ghi `CHƯA CHẠY` nếu không chạy.
- Multi-agent protocol: không commit shared files (`AGENTS.md`, `package.json`, etc.) trực tiếp.

## 7. Execution order

Phase A → Phase B → Phase C → Phase D. Mỗi phase có plan chi tiết riêng và audit độc lập.