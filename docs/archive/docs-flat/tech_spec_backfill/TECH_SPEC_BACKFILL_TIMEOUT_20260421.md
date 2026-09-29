# Tech Spec: Optimized & Asynchronous Backfill Engine (2026-04-21)

This spec details the technical refactoring required to handle market-scale tick data processing (79M+ rows) without system time-outs.

## 1. Asynchronous Task Architecture

### Celery Task: `intraday_side_backfill_task`
- **Logic**: Move the heavy loop from `services_backfill.py` into a Celery task.
- **Parameters**: `symbols`, `start_date`, `end_date`, `threshold`, `mode` (preview|apply).
- **State Management**: Use Redis to store real-time progress.
    - **Key**: `backfill:status:{task_id}`
    - **Value (JSON)**:
      ```json
      {
        "status": "processing",
        "progress_pct": 12.5,
        "processed_rows": 9800000,
        "total_rows": 78918377,
        "results": null,
        "error": null
      }
      ```

## 2. Logic Optimization: "The 79M Row Sprint"

### A. Pre-fetching Reference Prices
Currently, we query `DailyPrice` for every new symbol/date. In a 10-day market window, this can be 10,000+ extra queries.
- **Refactor**: Before starting the iterator, fetch all `DailyPrice.close_price` for `symbol__in=symbols` and `date__range=(start-5, end)`.
- **Storage**: A simple dictionary `{(symbol, date): price}`.

### B. SQL-Level Pre-filtering
Instead of pulling every row into Python:
- **Optimization**: Calculate a `min_volume` hint. 
  - `min_volume = threshold / (avg_market_price * 1000)`.
  - Though price varies, we can use a safe floor (e.g., if code knows the symbol's current price).
- **Safe Filter**: Filter `IntradayTick.objects.filter(price__gt=0, volume__gt=0)`.

### C. Buffer & Batching
- **Chunk Size**: Increase `batch_size` to 5000 for efficient DB fetching.
- **Update Delay**: Only update progress in Redis every 50,000 rows to avoid Redis I/O becoming the bottleneck.

## 3. API Contract Updates

### Endpoint 1: `POST /api/admin-ops/intraday-side-backfill/preview/`
- **Request**: Same as current.
- **Response**: `{ "ok": true, "task_id": "bf_preview_58392" }`.

### Endpoint 2: `GET /api/admin-ops/intraday-side-backfill/status/<task_id>/`
- **Response**:
  ```json
  {
    "ok": true,
    "task": {
      "id": "...",
      "status": "done|processing|failed",
      "progress": 85.2,
      "payload": { "scope_rows": 78918377, "changed_rows": 1245000, ... }
    }
  }
  ```

## 4. UI State Transitions
1. **Idle**: Preview button active.
2. **Starting**: Button shows spinner, polls `/status/`.
3. **Processing**: Progress bar 0->100% shown.
4. **Done**: Display results table; "Apply" button enabled.
