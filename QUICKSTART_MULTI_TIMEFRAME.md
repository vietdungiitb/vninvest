# Quick Start: Multi-Timeframe OHLCV API

**Status**: ✅ Live in dev stack  
**API Endpoint**: `GET /api/stock-management/stocks/{symbol}/dark-money-history/`

---

## Supported Timeframes

```
1m   - 1-minute candles     (Lookback: 1 day)
5m   - 5-minute candles    (Lookback: 3 days)
15m  - 15-minute candles   (Lookback: 7 days)
30m  - 30-minute candles   (Lookback: 7 days)
1h   - Hourly candles      (Lookback: 14 days)
4h   - 4-hourly candles    (Lookback: 30 days)
1D   - Daily (DEFAULT)     (Lookback: 1 year+)
1W   - Weekly              (Lookback: 1 year+)
```

---

## API Examples

### 1. Get 1-minute candles
```bash
curl "http://localhost:8001/api/stock-management/stocks/VNM/dark-money-history/?interval=1m&period=1M"
```
Response: ~1 day of 1-min OHLCV data

### 2. Get 5-minute candles
```bash
curl "http://localhost:8001/api/stock-management/stocks/ACB/dark-money-history/?interval=5m&period=3M"
```
Response: up to 3 days of 5-min candles

### 3. Get 4-hour candles
```bash
curl "http://localhost:8001/api/stock-management/stocks/FPT/dark-money-history/?interval=4h&period=3M"
```
Response: up to 30 days of 4-hour candles (period clamped to max)

### 4. Get 1-week candles (default period is 3 months)
```bash
curl "http://localhost:8001/api/stock-management/stocks/BID/dark-money-history/?interval=1W&period=1Y"
```
Response: 1 year of weekly data

---

## JavaScript Usage (Frontend)

```javascript
// Fetch multi-timeframe data
const fetchOHLCV = async (symbol, interval = '1D', period = '3M') => {
  const response = await fetch(
    `/api/stock-management/stocks/${symbol}/dark-money-history/?interval=${interval}&period=${period}`
  );
  return response.json();
};

// Examples
const min1Data = await fetchOHLCV('VNM', '1m');       // 1-minute
const min5Data = await fetchOHLCV('VNM', '5m', '3M'); // 5-minute, 3 days max
const hour4Data = await fetchOHLCV('VNM', '4h');       // 4-hour, 3 months (clamped to 30d)
const weekData = await fetchOHLCV('VNM', '1W', '1Y');  // Weekly, 1 year
```

---

## Important Notes

1. **Intraday Clamping**: Requests for intraday intervals (1m-4h) with period > max_days are automatically clamped
   - `interval=1m&period=1Y` → returns only 1 day (max for 1m)
   - `interval=5m&period=1Y` → returns only 3 days (max for 5m)

2. **Timestamp Format**:
   - **Intraday (1m-4h)**: Unix timestamp in seconds (e.g., `1716244800`)
   - **Daily+ (1D, 1W)**: Date string (e.g., `"2024-05-20"`)

3. **Data Availability**:
   - All intraday data is fetched on-demand from vnbroker provider
   - No persistent storage yet (background scraping can be added later)
   - Data subject to provider rate limits and availability

---

## Provider Format Mapping (Internal)

The system maps user-friendly interval names to vnbroker DNSE bar_type:

```python
{
    '1m': '1',      # 1-minute bars
    '5m': '5',      # 5-minute bars
    '15m': '15',    # 15-minute bars
    '30m': '30',    # 30-minute bars
    '1h': '60',     # 60-minute bars
    '4h': '240',    # 240-minute bars
    '1D': '1D',     # Daily bars
    '1W': '1W',     # Weekly bars
}
```

---

## Troubleshooting

### Empty Data
- **Cause**: Period exceeds max lookback for that interval
- **Solution**: Reduce period or use longer interval (e.g., use 4h instead of 1m)

### 400 Bad Request
- **Cause**: Invalid interval name
- **Solution**: Use only: 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W

### Slow Response (>5s)
- **Cause**: Large data volume or provider rate limit
- **Solution**: Reduce date range or use larger interval

---

## Architecture

```
Frontend Request
    ↓
API Endpoint: dark_money_history_api()
    ↓
[Interval Validation & Period Clamping]
    ↓
vnbroker_adapter.fetch_history_dataframe()
    ↓
vnbroker Stock.quote.history(interval=provider_format)
    ↓
Provider (DNSE/VCI/KBS/TCBS)
    ↓
Response [OHLCV Candles + Whale Signals + Dark Money]
```

---

## Testing Commands

```bash
# Test 1m interval
curl "http://localhost:8001/api/stock-management/stocks/VNM/dark-money-history/?interval=1m" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 4h interval
curl "http://localhost:8001/api/stock-management/stocks/ACB/dark-money-history/?interval=4h" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test period clamping (1m clamped to 1 day)
curl "http://localhost:8001/api/stock-management/stocks/FPT/dark-money-history/?interval=1m&period=1Y" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Next Steps

1. **For Chart Visualization**: Use ECharts with appropriate timeframe settings
2. **For Technical Analysis**: Leverage multi-timeframe data for confluence signals
3. **For Background Storage**: Create `offpeak_vnbroker_intraday_ingest` task if persistent storage needed

**Implementation Date**: May 21, 2026  
**Status**: Production Ready ✅
