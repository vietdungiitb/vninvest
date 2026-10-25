# AUDIT CHI TIẾT — Module Operations Center (SOC DataOps)

**Ngày:** 2026-10-25  
**Phạm vi:** 9 tab SOC, adapter BE/FE, backend `service_ops`, luồng dữ liệu DataOps/Signals/Prefetch/Screener/Runtime KPI.  
**Bằng chứng diagram:**
- Architecture: `.archify/architecture-operations-center-20261025-090000/operations-center-architecture.html`
- Dataflow: `.archify/dataflow-operations-center-20261025-090000/operations-center-dataflow.html`

## 1. Phương pháp

- Trace theo route/tab: `ShellOperationsCenterPage.tsx`.
- Trace theo adapter: `packages/web/src/adapters/core/soc.js`.
- Trace theo backend: `service_ops/urls.py`, views, tasks.
- So sánh với pattern thương mại: Datadog/Grafana (observability), Airflow/Prefect (orchestration), Superset/Metabase (analytics), PagerDuty (incident triage).

## 2. Inventory tính năng theo tab

| Tab | File chính | Quy mô | Trạng thái | Ghi chú |
|---|---|---:|---|---|
| overview | `SocOverviewPanel.tsx` | 1174 | Live + stream | Dùng `useOverviewStream`, URL state; filter/sort/paging. |
| signals | `SocSignalsPanel.tsx` | 2454 | Live + stream | Dùng `useSignalStream`; triage ack/mute; rules/performance. |
| dataops | `SocDataOpsPanel.tsx` | 205 + sections | Live-ish | Inventory/operations/monitor/scheduler/config; polling chưa đồng nhất. |
| prefetch | `SocPrefetchPanel.tsx` | 330 | Config + cache | Profile, cache status, warm-now, universe groups. |
| screener | `SocScreenerPanel.tsx` | 569 | Config + results | Rules CRUD, manual scan, alert history. |
| vnbroker | `SocVnbrokerPanel.tsx` | 1410 | Config-heavy | Provider health, benchmark, circuit breaker. |
| broker | `SocBrokerPanel.tsx` | 545 | System creds | Credential vault, test connection, audit. |
| runtime-kpi | `SocRuntimeKpiPanel.tsx` | 180 | SLO sparkline | Đã có nội dung; docs cũ “coming soon” là stale. |
| dnse-backfill | `SocDnseBackfillPanel.tsx` | 261 | Backfill | Run status/progress. |

## 3. Luồng dữ liệu audit

### 3.1 Control path (config)
Operator → UI panel → `soc.js` adapter → Django `service_ops` → ownership check → DB config + audit log.  
**Điểm mạnh:** ownership check trước apply (`dataops_planner.py:276-282`).  
**Rủi ro:** một số tab gọi adapter trực tiếp (`SocRuntimeKpiPanel.tsx:49-52`), bypass SOC client normalization.

### 3.2 Ingest path (DataOps)
Operator → `DataOpsContext` → adapter → planner API → Redis queue → Celery worker → market feeds → PostgreSQL → inventory API → UI.  
**Điểm mạnh:** run log lifecycle queued/running/terminal.  
**Rủi ro:** UI không poll runs/inventory (`DataOpsContext.tsx:176-183`), operator phải F5.

### 3.3 Monitoring path
Overview/Signals dùng stream hooks (`useOverviewStream`, `useSignalStream`) → realtime tốt hơn DataOps.  
**Rủi ro:** DataOps chưa có stream/polling đồng nhất.

### 3.4 Audit path
`ops_audit` fail-closed, audit events cross-tenant cho staff.  
**Rủi ro:** cần verify integration test để không fail silently.

## 4. Bug / chưa phù hợp

### B1. Tab router dual source
- File: `ShellOperationsCenterPage.tsx:42-71`
- Vấn đề: URL + localStorage race.
- Fix: single source URL.

### B2. Hardcoded labels
- File: `ShellOperationsCenterPage.tsx:118-122`
- Fix: i18n.

### B3. DataOps polling thiếu
- File: `DataOpsContext.tsx:176-183`
- Fix: visibility-aware polling.

### B4. Adapter monolith
- File: `soc.js` (864 dòng)
- Fix: split domain modules.

### B5. Backend monolith
- Files: `service_ops/urls.py`, `tasks.py`
- Fix: split by domain.

### B6. Runtime KPI direct adapter
- File: `SocRuntimeKpiPanel.tsx:49-52`
- Fix: use SOC client.

### B7. Error state không đồng nhất
- File: `DataOpsContext` errors vs panel UI.
- Fix: standardized error banner + retry.

### B8. Docs stale
- Runtime KPI không còn “coming soon”.
- Fix: update audit/docs.

## 5. So sánh với phần mềm thương mại

| Capability | VNInvest SOC | Datadog/Grafana | Airflow/Prefect | Gap |
|---|---|---|---|---|
| Dashboard realtime | Một phần (overview/signals stream) | Mạnh, alerting | N/A | DataOps polling/stream chưa đồng nhất |
| Orchestration | Celery queue tier | N/A | DAG, retries, backfill, observability | Thiếu DAG view, retry policy UI, run detail lineage |
| Config management | Có preview/apply/audit | Config as code, versioning | Variables/secrets | Thiếu diff viewer, rollback one-click, approval workflow |
| Incident triage | Signals ack/mute | Alert lifecycle, on-call | N/A | Thiếu SLA, escalation, notification channels |
| RBAC/audit | Staff-only, audit log | Fine-grained RBAC | RBAC | Thiếu per-tenant operator scope, immutable audit export |
| Observability | SLO sparkline | Full metrics/traces/logs | Task metrics | Thiếu traces, latency percentiles, error budget burn alerts |

## 6. Hướng phát triển tiếp theo

### Ngắn hạn (1-2 sprint)
1. Fix tab router single source.
2. I18n hardcode.
3. DataOps polling + visibility.
4. Signals live feed.

### Trung hạn (2-4 sprint)
1. Code-split tabs/sections.
2. Split soc adapter + backend urls/tasks.
3. Runtime KPI qua SOC client.
4. Error state chuẩn hóa.

### Dài hạn
1. DAG/run lineage cho DataOps (Airflow-like).
2. Config diff/rollback/approval.
3. Alert escalation/notification.
4. Per-tenant operator RBAC + immutable audit export.

## 7. Test recommendations

- Deep-link/back-forward tab.
- Polling lifecycle.
- Planner ownership deny.
- Adapter contract.
- Stream reconnect.

## 8. Quy định

Audit này được ghi thành tài liệu theo quy định cứng global: mọi đánh giá/audit/plan phải lưu trong repo, không chỉ chat.