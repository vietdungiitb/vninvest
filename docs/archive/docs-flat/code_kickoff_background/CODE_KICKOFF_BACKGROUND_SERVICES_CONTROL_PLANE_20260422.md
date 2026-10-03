# CODE_KICKOFF_BACKGROUND_SERVICES_CONTROL_PLANE_20260422

## Purpose
Create a single source‑of‑truth file that records **all decisions, tasks, and checkpoints** for the Background Services Control Plane (Crawling Control Center) before any code is written. This file will be referenced during the audit phase.

## Contents
1. **Reading order** – see `BACKGROUND_SERVICES_CONTROL_PLANE_INDEX_20260422.md`.
2. **High‑level architecture** – Django + Celery + Redis + PostgreSQL, re‑using `vnbroker_adapter.py`.
3. **Pilot jobs (Phase 0)** – stock‑profile sync, market‑snapshot, whale‑advisory.
4. **Full job set (Phase 1)** – intraday tick, historical price, financial ratios, etc.
5. **Key decisions to lock** – model schema, idempotency key format, soft‑stop flag, permission classes.
6. **Gotchas / traps** – overlap protection, rate‑limit back‑off, audit‑log completeness.
7. **Checklist before first merge** – migrations, API contracts, unit‑test coverage, manual UI verification.
8. **Verification plan** – end‑to‑end run, Prometheus metrics, audit‑log entry, SLO soak.

The file will be kept up‑to‑date as the implementation proceeds and will serve as the audit reference.
