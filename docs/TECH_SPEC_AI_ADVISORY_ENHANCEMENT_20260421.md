# Tech Spec: AI Advisory Enhancement & Market Discovery (2025-04-21)

This technical specification details the backend architecture and API updates required to support Market Discovery and logic unification for AI Advisory.

## 1. Unified Signal Engine (`WhaleSignalEngine`)
To resolve the SSOT issue, we will centralize all "Large Flow" detection into a single service class located at `backend/portfolio/services/whale_engine.py`.

### Core Responsibilities:
- **Threshold Resolution**: Consolidate `_resolve_user_whale_threshold_vnd` logic.
- **Side Detection**: Implement a canonical side-guessing algorithm (Tick-by-tick side vs Aggregated flow side).
- **Signal Aggregation**: Streamline high-frequency `IntradayTick` data into `OrderFlowSignal` records.

### Interface:
```python
class WhaleSignalEngine:
    def get_large_flows(self, symbol=None, scope="watchlist", user=None):
        """Returns filtered flows based on user config or global market thresholds."""
        pass
    
    def detect_side(self, tick_data):
        """Canonical side detection algorithm."""
        pass
```

## 2. API Updates

### Modifying `whale_advisory_symbol_stats_api`
- **New Query Param**: `scope` (default: `watchlist`).
- **Behavior**: 
    - `scope=watchlist`: (Existing) filters by user's `TrackedSymbol`.
    - `scope=market`: Filters the top N symbols by `matched_value` (value > global_min_threshold) across the entire session.

### AI Generation Triggers
- **Endpoint**: `POST /api/portfolio/whale-advisory/{symbol}/refresh/`
- **Update**: Auto-detect if a "Discovery" advisory should be created if the symbol is not in the watchlist but exhibits extreme volume.

## 3. Background Task Architecture

### New Task: `sync_market_whale_discovery`
- **Frequency**: Every 10–15 minutes during trading hours.
- **Logic**: 
    1. Scan `IntradayTick` for top 5 symbols with highest `net_buy_value`.
    2. Identify if they lack an active AI Advisory in the last 2 hours.
    3. Queue `generate_whale_advisory_task` with `source=MARKET_DISCOVERY`.

## 4. Database Schema Adjustments
- **WhaleAdvisory**: Update `SourceChoices` to include `MARKET_DISCOVERY`.
- **TrackedSymbol**: (Optional) Add a `is_discovery_auto_tracked` flag if we want to temporarily track high-flyers.

## 5. Frontend - Advisory Session V2
- Update `WhaleAdvisory.jsx` to handle states where `activeItem` is a Discovery item (read-only mode if the user hasn't added it to their watchlist).
- Implement the "Market Selector" dropdown bridge.
