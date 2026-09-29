# Implementation Plan: Resolving Backfill-Preview Timeout (2026-04-21)

This document outlines the strategy to resolve the `backfill-preview timeout` issue when processing large volumes of standard intraday tick data.

## 1. Business Logic & Scope (Nghiệp vụ)
The "Backfill IntradayTick Side" tool is designed to re-infer Buy/Sell sides from tick rules. 
- **Problem**: For a 10-day window across the market, the search space is **78.9 million records**. Attempting to process this in a synchronous HTTP request leads to a 100% failure rate (timeout).
- **Solution**: Move the backfill logic to a Background Task (Celery) with progress tracking and optimize the data access layer.

## 2. Implementation Phases

### Phase 1: Asynchronous Handshake
- Create the background task `intraday_side_backfill_task`.
- Update the admin API to return a `task_id` instead of the full result.
- Create a status polling API.

### Phase 2: Logic Optimization (Performance)
- **Pre-fetch**: Load all required `DailyPrice` (Reference Price) data into a local cache before starting the loop.
- **SQL Shifting**: Attempt to filter by `volume` at the DB level to reduce the Python iteration count.
- **Micro-batching**: Report progress to Redis every 50,000 records.

### Phase 3: Frontend Task Tracking
- Update the UI to show a progress bar once the Task ID is received.
- Disable the "Apply" button until a "Preview" is successfully completed for the chosen scope.

## 3. Risks & Mitigations
| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Worker Overload** | High | Shard the task by symbol or restrict concurrent backfill items to 1. |
| **Redis Bloat** | Medium | Use short TTL for task result summaries. |
| **Data Integrity** | Critical | Verify that the ref-price pre-fetch correctly handles "Monday" cases (fetching Friday's close). |

## 4. Acceptance Criteria (DoD)
- [ ] Large backfill previews (10M+ rows) do not time out.
- [ ] UI shows a real-time progress percentage.
- [ ] Final results match the previous synchronous results (verified on small datasets).
- [ ] Code follows the "Mandatory Documentation Bundle" regulation.
