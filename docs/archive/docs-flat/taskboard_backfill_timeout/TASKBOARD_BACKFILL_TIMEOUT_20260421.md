# Taskboard: Optimized Backfill Implementation (2026-04-21)

This taskboard tracks the refactoring of the Backfill Engine to support extreme data scale (79M+ ticks).

## Slice 1: Core Engine Optimization (Efficiency)
*Goal: Reduce the time per 1M rows by minimizing I/O.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **BF-BE-01** | Refactor `_get_previous_close` to use bulk pre-fetch cache | [ ] | BE |
| **BF-BE-02** | Add `volume > 0` and `price > 0` DB-level filters to QuerySet | [ ] | BE |
| **BF-BE-03** | Increase iterator `batch_size` to 5000 for chunk processing | [ ] | BE |
| **BF-BE-04** | Unit test: Verify backfill logic consistency after refactor | [ ] | BE |

---

## Slice 2: Asynchronous Infrastructure (Stability)
*Goal: Decouple processing from the HTTP request life cycle.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **BF-BE-05** | Implement `intraday_side_backfill_task` in Celery | [ ] | BE |
| **BF-BE-06** | Implement Redis-based progress reporting (every 50k rows) | [ ] | BE |
| **BF-BE-07** | Create `/status/<task_id>/` endpoint for progress polling | [ ] | BE |
| **BF-BE-08** | Update preview/apply APIs to return `task_id` | [ ] | BE |

---

## Slice 3: UX & Interface (Control)
*Goal: Provide feedback to the admin during long-running tasks.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **BF-FE-01** | Update `BackfillPanel.jsx` to support polling flow | [ ] | FE |
| **BF-FE-02** | Implement progress bar and "time elapsed" indicator | [ ] | FE |
| **BF-FE-03** | Add "Cancel Task" capability to stop runaway backfills | [ ] | FE |

---

## Definition of Done (DoD)
- [ ] Processing 10M+ rows completes successfully without HTTP timeouts.
- [ ] Progress is updated and visible in the UI in near real-time.
- [ ] Memory usage remains stable (< 2GB) during 79M row iteration.
- [ ] No regression in Side detection accuracy.
