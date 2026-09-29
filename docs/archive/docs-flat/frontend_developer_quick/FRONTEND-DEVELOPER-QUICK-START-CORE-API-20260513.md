# Frontend Developer Quick Start — Core-API Integration

**SaaS Model Effective**: 2026-05-13  
**Single API Gateway**: core-api:8100 (localhost:8001 in dev)  
**Status**: ✅ Production approved — backend:8000 decommissioned

---

## 1. API Base URL

### Development
```
http://localhost:8001/api
```

### Staging/Production
```
https://<domain>/api
```

All calls are authenticated via JWT bearer tokens.

---

## 2. Authentication

### Login Endpoint
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Response**:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": { "id": 1, "username": "..." }
}
```

### Using Token in Requests
```http
GET /api/realtime/ticker/VCB/
Authorization: Bearer <access_token>
```

---

## 3. Realtime Market Data (9 Routes)

### Get Latest Stock Snapshot
```http
GET /api/realtime/ticker/VCB/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "price": "89500.00",
  "price_change": "500.00",
  "price_change_pct": "0.56",
  "volume": 12345678,
  "market_status": "open",
  "stale": false,
  "source": "native",
  "fetched_at": "2026-05-13T10:30:45.123456Z"
}
```

### Get Multiple Tickers
```http
GET /api/realtime/tickers/?symbols=VCB,HPG,BID
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
[
  {
    "symbol": "VCB",
    "price": "89500.00",
    "price_change": "500.00",
    "volume": 12345678,
    "market_status": "open"
  },
  ...
]
```

### Get Whale Feed (Large Orders)
```http
GET /api/realtime/whale-feed/VCB/?limit=50
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "alerts": [
    {
      "id": "uuid-here",
      "alert_type": "whale",
      "severity": "high",
      "title": "Whale buy 5M shares",
      "value": "500000000.00",
      "direction": "buy",
      "triggered_at": "2026-05-13T10:15:30Z"
    }
  ]
}
```

### Other Realtime Routes
- `GET /api/realtime/price-board/<symbol>/` — Price/volume/status
- `GET /api/realtime/breadth/<symbol>/` — Advancing/declining count
- `GET /api/realtime/symbol-investigation/<symbol>/` — Profile + snapshot
- `GET /api/realtime/rvol/<symbol>/` — Relative volume (today vs 20d avg)
- `GET /api/realtime/intraday/<symbol>/` — Daily bars *(stub; returns empty)*
- `GET /api/realtime/depth-chart/<symbol>/` — Order book depth *(stub; returns empty)*

---

## 4. Stock Management (11 Routes)

### Get Stock Profile
```http
GET /api/stock-management/stocks/VCB/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "company_name": "Ngân hàng Thương mại cổ phần Việt Nam",
  "exchange": "HOSE",
  "industry": "Ngân hàng",
  "outstanding_shares": 2880000000
}
```

### Get Stock Overview (Profile + Realtime)
```http
GET /api/stock-management/stocks/VCB/overview/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "company_name": "Ngân hàng Thương mại cổ phần Việt Nam",
  "exchange": "HOSE",
  "industry": "Ngân hàng",
  "outstanding_shares": 2880000000,
  "price": "89500.00",
  "price_change": "500.00",
  "price_change_pct": "0.56",
  "volume": 12345678,
  "stale": false
}
```

### Get Daily Chart (OHLCV)
```http
GET /api/stock-management/stocks/VCB/chart/?date_from=2026-05-01&date_to=2026-05-13&page=1
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "results": [
    {
      "date": "2026-05-13",
      "open": "89000.00",
      "high": "90000.00",
      "low": "88500.00",
      "close": "89500.00",
      "volume": 12345678
    }
  ],
  "page": 1
}
```

### Get Batch Technicals
```http
GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG,BID
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "results": [
    {
      "symbol": "VCB",
      "price": "89500.00",
      "price_change": "500.00",
      "price_change_pct": "0.56",
      "volume": 12345678,
      "stale": false
    }
  ]
}
```

### AI Advisory Session
```http
GET /api/stock-management/stocks/VCB/ai-advisory-session/
Authorization: Bearer <token>
```

**Response** (HTTP 200) — delegates to advisory domain:
```json
{
  "advisory_id": "uuid-here",
  "symbol": "VCB",
  "session_date": "2026-05-13",
  "status": "completed",
  "ai_model": "gpt-4",
  "advisory_text": "Technical analysis shows...",
  "tokens_used": 2048,
  "generated_at": "2026-05-13T10:30:00Z"
}
```

### Other Stock-Mgmt Routes
- `GET /api/stock-management/stocks/<symbol>/order-flow/` — Whale order alerts
- `GET /api/stock-management/stocks/<symbol>/news/` — *(stub; returns empty)*
- `POST /api/stock-management/stocks/<symbol>/ai-advisory-components/generate/` — Regenerate AI insights
- `GET /api/stock-management/stocks/<symbol>/financials/` — *(stub; returns null)*
- [... 5 more routes for advisory management ...]

---

## 5. Portfolio Analytics (16 Routes)

### Get Portfolio Summary
```http
GET /api/portfolio/portfolios/1/summary/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "portfolio_id": 1,
  "portfolio_name": "My Portfolio",
  "total_market_value": "50000000.00",
  "total_cost": "48000000.00",
  "total_unrealized_pnl": "2000000.00",
  "total_unrealized_pnl_pct": 4.17,
  "num_holdings": 8,
  "as_of": "2026-05-13"
}
```

### Get Holdings (Current Positions)
```http
GET /api/portfolio/portfolios/1/holdings/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
[
  {
    "symbol": "VCB",
    "quantity": 10000,
    "avg_cost": "87000.00",
    "current_price": "89500.00",
    "market_value": "895000000.00",
    "unrealized_pnl": "25000000.00",
    "unrealized_pnl_pct": 2.85,
    "stale": false
  }
]
```

### Get Equity Curve (Daily NAV)
```http
GET /api/portfolio/portfolios/1/equity-curve/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "portfolio_id": 1,
  "curve": [
    { "date": "2025-05-13", "nav": "48000000.00" },
    { "date": "2025-05-14", "nav": "48500000.00" },
    { "date": "2025-05-15", "nav": "49100000.00" },
    ...
  ]
}
```

### Get Allocation (Symbol Weights)
```http
GET /api/portfolio/portfolios/1/allocation/
Authorization: Bearer <token>
```

**Response** (HTTP 200):
```json
{
  "portfolio_id": 1,
  "total_value": "50000000.00",
  "allocation": [
    { "symbol": "VCB", "value": "15000000.00", "weight_pct": 30.0 },
    { "symbol": "HPG", "value": "10000000.00", "weight_pct": 20.0 },
    { "symbol": "BID", "value": "8000000.00", "weight_pct": 16.0 },
    ...
  ]
}
```

### Other Portfolio Routes
- `GET /api/portfolio/portfolios/<id>/chart/` — Alias to equity-curve
- `GET /api/portfolio/portfolios/<id>/technicals/` — Holdings technicals
- `GET /api/portfolio/portfolios/<id>/analytics/` — Combined overview
- `POST /api/portfolio/portfolios/<id>/sync/` — Manual sync (returns queued status)
- `GET /api/portfolio/ai-advisory/<symbol>/canonical/` — AI advisory for symbol
- [... 10 more portfolio routes ...]

---

## 6. Error Handling

All errors return JSON with descriptive messages:

### 401 Unauthorized
```json
{ "detail": "Authentication credentials were not provided." }
```

### 403 Forbidden
```json
{ "detail": "You do not have permission to perform this action." }
```

### 404 Not Found
```json
{ "detail": "Stock not found: INVALID_SYMBOL" }
```

### 500 Internal Server Error
```json
{ "detail": "A server error occurred. Contact support." }
```

---

## 7. Graceful Stubs (Expected Empty Responses)

Some endpoints return graceful stubs (HTTP 200) for features not yet fully migrated:

### Intraday Bars (Coming Soon)
```http
GET /api/realtime/intraday/VCB/
```
**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "bars": [],
  "stale": true,
  "note": "intraday_not_available_in_native"
}
```

### Order Book Depth (Coming Soon)
```http
GET /api/realtime/depth-chart/VCB/
```
**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "bids": [],
  "asks": [],
  "note": "depth_not_available_in_native"
}
```

### News Feed (Coming Soon)
```http
GET /api/stock-management/stocks/VCB/news/
```
**Response** (HTTP 200):
```json
{
  "symbol": "VCB",
  "news": [],
  "note": "news_not_available_in_native"
}
```

**Frontend Strategy**: Show placeholder UI or hide button when note field is present.

---

## 8. Rate Limits & Best Practices

- **No explicit rate limits** in dev (local deployment)
- **Batch endpoints** for efficiency:
  - Use `GET /api/realtime/tickers/?symbols=X,Y,Z` instead of N separate `/api/realtime/ticker/<symbol>/` calls
  - Use `GET /api/stock-management/technicals/bulk/?symbols=X,Y,Z` for batch technicals
- **Pagination**: `?page=1` supported on chart endpoint; default page size 250
- **Caching**: Frontend should cache snapshot data (prices update on market session basis, not tick-by-tick)

---

## 9. Common API Flow Examples

### Display Stock Quote Card
```javascript
// 1. Authenticate
const auth = await fetch('/api/auth/login/', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});
const { access } = await auth.json();

// 2. Get latest snapshot
const ticker = await fetch('/api/realtime/ticker/VCB/', {
  headers: { 'Authorization': `Bearer ${access}` }
});
const snap = await ticker.json();

// 3. Render
console.log(`${snap.symbol}: ${snap.price} (${snap.price_change_pct}%)`);
```

### Display Portfolio Dashboard
```javascript
// 1. Get summary (NAV, total P&L)
const summary = await fetch('/api/portfolio/portfolios/1/summary/', {
  headers: { 'Authorization': `Bearer ${access}` }
});
const { total_market_value, total_unrealized_pnl_pct } = await summary.json();

// 2. Get holdings (individual positions)
const holdings = await fetch('/api/portfolio/portfolios/1/holdings/', {
  headers: { 'Authorization': `Bearer ${access}` }
});
const positions = await holdings.json();

// 3. Get allocation (chart data)
const alloc = await fetch('/api/portfolio/portfolios/1/allocation/', {
  headers: { 'Authorization': `Bearer ${access}` }
});
const { allocation } = await alloc.json();

// 4. Render summary + positions table + allocation pie chart
```

### Display AI Advisory
```javascript
// Get AI advisory for a symbol (delegates to advisory domain)
const advisory = await fetch('/api/stock-management/stocks/VCB/ai-advisory-session/', {
  headers: { 'Authorization': `Bearer ${access}` }
});
const { advisory_text, ai_model, generated_at } = await advisory.json();

// Render advisory panel with generated insight
```

---

## 10. Support & Issues

### Debug Endpoints
- Check backend logs: `docker logs vninvest-dev-core-api`
- Verify token: JWT claims accessible at jwt.io
- Test offline: Use Postman/Insomnia with saved Authorization header

### Known Limitations (In Progress)
- **Intraday bars**: Model not yet available; stub returns empty list
- **Order book depth**: Real-time feed not available; stub returns empty bids/asks
- **News feed**: News model not migrated; stub returns empty list

### Next Updates (Roadmap)
- Week 2: IntradayBar model + native intraday chart endpoint
- Week 3: News model + news feed endpoint
- Week 4: Real-time WebSocket for ticker streaming

---

## 11. Contact

- **Backend Tech Lead**: See GATE-G-PRODUCTION-APPROVAL-SAAS-CUTOVER-20260513.md for approval details
- **Architecture Docs**: See docs/HANDOFF_MASTER_FULL_INDEPENDENCE_CUTOVER_20260513.md
- **Test Examples**: `backend/portfolio/tests/` (test suite available for reference)

---

**Last Updated**: 2026-05-13  
**Core-API Status**: ✅ **PRODUCTION LIVE**  
**Happy Coding!** 🚀
