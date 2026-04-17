# Realtime System Audit: Timeout & 504 Gateway Errors (2026-04-17)

## 1. Incident Overview
On **2026-04-17**, the system experienced widespread **504 Gateway Timeout** errors reaching the frontend dashboard. The errors affected both REST API endpoints and WebSocket handshakes.

### Affected Endpoints
- `GET /api/realtime/whale-feed/aggregate/`
- `GET /api/realtime/unified-alerts/`
- `GET /api/realtime/tickers/`
- `WSS /ws/realtime/`

## 2. Root Cause Analysis

### Layer 1: Redis Stream Lag (Staleness)
Server logs show frequent occurrences of:
`StreamReader._from_stream(SYMBOL): ignore stale stream payload (age=...s > 120s)`

This indicates that the **Tick Collector** (responsible for fetching data from vnstock and pushing to Redis) is lagging or stalled. When the stream is older than 120 seconds, the application ignores it to avoid showing "fake" realtime data.

### Layer 2: Slow Database Fallback
When the Redis tier fails (due to staleness), the system falls back to querying the `IntradayTick` table. 
The current implementation of `MarketDataService.get_whale_feed_aggregate` performs filtering in a **synchronous Python loop** using `queryset.iterator()`.

- **Problem**: The query result set can be large if the `min_threshold_vnd` is low but symbol-specific thresholds are high.
- **Daphne Timeout**: Daphne (the ASGI server) attempts to close connections gracefully. Because the loop is synchronous and blocking, the worker thread cannot yield to the event loop, causing Daphne to "kill" the instance after it exceeds the shutdown timeout.
- **504 Error**: If the query takes longer than the Nginx/Daphne response timeout, the client receives a 504 Gateway Timeout.

## 3. Evidence
- **Logs**: `Application instance <...> took too long to shut down and was killed.`
- **Frontend**: Multiple 504 responses for aggregate and alert endpoints.
- **WebSocket**: Handshake failure with response code 504.

## 4. Remediation Plan (Phase 1)
1. **Optimize SQL Filtering**: Replace the Python iterator loop with a complex `Q` object filter in Django to ensure the database only returns rows that meet the specific thresholds for each symbol.
2. **Increase Freshness Tolerance**: Adjust `STREAM_STALE_AFTER_SECONDS` to allow more flexibility for minor collector jitter.
3. **Index Verification**: Ensure `IntradayTick` has optimal indexes for `(symbol, trade_date, trade_time)`.

---
**Audit performed by**: Antigravity AI
**Status**: Critical / Immediate Action Required
