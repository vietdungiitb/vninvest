# PLAN — Operations Center Phase C (Backend cleanup, P1/P2)

**Master:** `docs/PLAN_OPERATIONS_CENTER_MASTER_20261025.md`

## C1. Split service_ops urls
- File: `packages/core/backend/src/service_ops/urls.py`
- Tách includes: overview, dataops, signals, prefetch, screener, vnbroker, broker, matrix, symbol-groups.

## C2. Split tasks
- File: `packages/core/backend/src/service_ops/tasks.py`
- Tách: dataops tasks, signals tasks, matrix tasks, health tasks.

## C3. Contract/integration tests
- Ownership deny.
- Planner run when can_apply false.
- Audit append non-silent failure.

## Gates
- BE `manage.py check`, migrate, tests on VPS staging.
- Local: `check-multi-agent`, `pre-push-gate`.