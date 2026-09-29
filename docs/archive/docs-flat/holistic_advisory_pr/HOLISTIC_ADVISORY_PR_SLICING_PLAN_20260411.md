# HOLISTIC ADVISORY PR SLICING PLAN (2026-04-11)

## 1) Muc tieu

Tach implementation thanh cac PR nho, review duoc, rollback duoc, va an toan voi production traffic.

Nguyen tac slicing:

1. Mot PR chi giai quyet mot nhom rui ro chinh.
2. PR correctness truoc, architecture sau, UI cuoi.
3. Moi PR co test evidence + rollback note.
4. Khong gop nhieu migration logic lon trong mot PR.

## 2) Branching va naming

- Branch goc: feat/holistic-advisory
- Branch con:
  - feat/holistic-h0-pr1-correctness-severity
  - feat/holistic-h0-pr2-timeframe-tickrate
  - feat/holistic-h0-pr3-threshold-first-create
  - feat/holistic-h0-pr4-snapshot-model-skeleton
  - feat/holistic-h0-pr5-baseline-metrics-instrumentation

Commit style:

- fix(holistic-h0): ...
- feat(holistic-h0): ...
- test(holistic-h0): ...
- docs(holistic-h0): ...

## 3) PR plan chi tiet

### PR-1: Correctness - dark-flow source/severity semantics

Scope:

- Chuan hoa source mapping trong merge -> flush -> generate advisory.
- Dam bao nhanh severity cho dark-flow merged case duoc kich hoat dung policy.

Files du kien:

- backend/portfolio/tasks.py
- backend/portfolio/tests/test_whale_advisory_task.py

Acceptance:

- Tests moi pass.
- Khong lam do regression whale advisory suite.

Rollback:

- Revert PR-1, source mapping quay ve hanh vi cu.

### PR-2: Correctness - tick-rate field mapping + timeframe propagation

Scope:

- Dong bo field tick-rate giua detector output va AI prompt payload.
- Dong bo timeframe/window propagation o component generate/refresh paths.

Files du kien:

- backend/portfolio/ai_advisory_helpers.py
- backend/portfolio/views.py
- backend/portfolio/tests/test_order_flow.py
- backend/portfolio/tests/test_api_routes.py

Acceptance:

- Tick-rate context khong bi zero sai field.
- API assertion xac nhan detector nhan dung window_minutes.

Rollback:

- Revert PR-2, giu nguyen behavior truoc do.

### PR-3: Correctness - first-create threshold semantics

Scope:

- Hardening luong session first-create de ton trong symbol override semantics.

Files du kien:

- backend/portfolio/views.py
- backend/portfolio/tasks.py (neu can helper reuse)
- backend/portfolio/tests/test_api_routes.py

Acceptance:

- Case co override va khong co override deu dung threshold_source.

Rollback:

- Revert PR-3, quay ve user default threshold cho first-create.

### PR-4: Foundation - snapshot + audit log model skeleton

Scope:

- Tao model skeleton:
  - AdvisoryAggregateSnapshot
  - AdvisoryAggregateAuditLog
- Tao migration + index co ban + admin registration toi thieu.

Files du kien:

- backend/portfolio/models.py
- backend/portfolio/admin.py
- backend/portfolio/migrations/*

Acceptance:

- migrate up/down pass tren local sqlite.
- Khong anh huong endpoint cu.

Rollback:

- Revert migration PR-4 (neu chua len prod) hoac migration rollback script.

### PR-5: Baseline metrics instrumentation + docs evidence

Scope:

- Them instrumentation can thiet de chup baseline KPI.
- Tao report baseline trong docs.

Files du kien:

- backend/portfolio/observability.py (hoac service lien quan)
- backend/portfolio/views.py (neu can emit metric)
- docs/HOLISTIC_ADVISORY_BASELINE_METRICS_20260411.md

Acceptance:

- Co file baseline report.
- Co script/query mo ta cach tai tao baseline.

Rollback:

- Revert metric instrumentation (khong anh huong business logic).

## 4) Merge order va gate

Merge thu tu bat buoc:

1. PR-1
2. PR-2
3. PR-3
4. PR-4
5. PR-5

Gate sau moi PR:

1. portfolio.tests.test_whale_advisory_task
2. portfolio.tests.test_order_flow
3. portfolio.tests.test_realtime_compute
4. ApiRouteSmokeTests -k whale

Gate bo sung truoc khi dong H0:

- Full regression block da pass va co artifact.
- Docs update day du (master plan + execution board + baseline report).

## 5) Review checklist cho moi PR

1. Scope co dung nhu PR title khong.
2. Co sua logic khong lien quan khong.
3. Co test moi + test cu pass khong.
4. Co note rollback ro rang khong.
5. Co cap nhat docs evidence khong.

## 6) Ownership de xuat

- BE lead: PR-1, PR-2, PR-3
- BE infra/data: PR-4, PR-5
- QA: gate execution + artifact capture
- PM/PO: GO/NO-GO ky thuat + impact acceptance
