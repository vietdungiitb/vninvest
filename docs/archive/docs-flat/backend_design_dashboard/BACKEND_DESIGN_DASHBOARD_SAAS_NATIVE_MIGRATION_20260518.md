# BACKEND DESIGN — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Quan trọng**: Backend không cần thay đổi trong migration này. Tất cả endpoints đã tồn tại và đang hoạt động.

---

## 1. Tóm tắt

Dashboard SaaS migration là **frontend-only migration**. Toàn bộ backend endpoints đã sẵn sàng:
- Portfolio analytics endpoints đã tồn tại tại `packages/core/backend/src/user_workspace/urls.py`
- Bulk technicals endpoint tồn tại tại `packages/core/backend/src/market_data/public_urls.py`
- B1 nginx routing đã hoàn thành: `/api/*` → `core-api:8100`
- B4 portfolio cutover đã hoàn thành: native views active

Tài liệu này chỉ phục vụ mục đích **documentation và reference** cho team frontend.

---

## 2. Endpoint Inventory

### 2.1 Portfolio Analytics Endpoints (user_workspace)

| Endpoint | Method | Path (core/v1) | Path (/api) | View |
|----------|--------|----------------|-------------|------|
| Holdings | GET | `/core/v1/portfolio/portfolios/{id}/holdings/` | `/api/portfolio/portfolios/{id}/holdings/` | `PortfolioHoldingsView` |
| Summary | GET | `/core/v1/portfolio/portfolios/{id}/summary/` | `/api/portfolio/portfolios/{id}/summary/` | `PortfolioSummaryView` |
| Analytics | GET | `/core/v1/portfolio/portfolios/{id}/analytics/` | `/api/portfolio/portfolios/{id}/analytics/` | `PortfolioAnalyticsView` |
| Technicals | GET | `/core/v1/portfolio/portfolios/{id}/technicals/` | `/api/portfolio/portfolios/{id}/technicals/` | `PortfolioTechnicalsView` |
| Tracked Symbols | GET | `/core/v1/stock-management/tracked-symbols/` | `/api/stock-management/tracked-symbols/` | `TrackedSymbolListCreateView` |
| Watchlist Groups | GET | `/core/v1/portfolio/watchlist/groups/` | `/api/portfolio/watchlist/groups/` | `LegacyWatchlistGroupListView` |

### 2.2 Market Data Endpoints

| Endpoint | Method | Path | Note |
|----------|--------|------|------|
| Bulk Technicals | GET | `/api/stock-management/technicals/bulk/` | **CHỈ tại `/api/`**, KHÔNG có `/core/v1/` |

> **Lý do Bulk Technicals chỉ ở `/api/`**: Endpoint này được mount từ `market_data.public_urls` tại `vninvest_core/urls.py` line `path('api/', include('market_data.public_urls'))`. `user_workspace.urls` không re-export endpoint này.

---

## 3. Response Shapes

### 3.1 Portfolio Holdings

```json
// GET /core/v1/portfolio/portfolios/1/holdings/
[
  {
    "symbol": "VCB",
    "shares": 1000,
    "avg_cost": 88500.0,
    "current_price": 92000.0,
    "market_value": 92000000.0,
    "unrealized_pl": 3500000.0,
    "unrealized_pl_pct": 3.95,
    "sector": "Ngân hàng"
  }
]
```

### 3.2 Portfolio Summary

```json
// GET /core/v1/portfolio/portfolios/1/summary/
{
  "portfolio_id": 1,
  "total_invested": 450000000.0,
  "market_value": 487500000.0,
  "unrealized_pl": 37500000.0,
  "unrealized_pl_pct": 8.33,
  "holdings_count": 7,
  "as_of_date": "2026-05-18"
}
```

### 3.3 Portfolio Analytics

```json
// GET /core/v1/portfolio/portfolios/1/analytics/?days=30
{
  "equity_curve": [
    { "date": "2026-04-18", "value": 470000000.0 },
    { "date": "2026-04-19", "value": 472500000.0 }
  ],
  "max_drawdown": -0.054,
  "volatility": 0.021,
  "sector_weights": {
    "Ngân hàng": 0.42,
    "Bất động sản": 0.28,
    "Công nghệ": 0.30
  },
  "period_days": 30
}
```

### 3.4 Portfolio Technicals

```json
// GET /core/v1/portfolio/portfolios/1/technicals/
{
  "rsi_avg": 55.2,
  "trend_distribution": {
    "uptrend": 4,
    "downtrend": 1,
    "sideways": 2
  },
  "momentum_score": 0.61,
  "last_updated": "2026-05-18T09:30:00Z"
}
```

### 3.5 Bulk Technicals

```json
// GET /api/stock-management/technicals/bulk/?symbols=VCB&symbols=HPG
[
  {
    "symbol": "VCB",
    "rsi": 58.3,
    "macd": 0.012,
    "signal": 0.008,
    "trend": "uptrend",
    "last_updated": "2026-05-18T09:30:00Z"
  },
  {
    "symbol": "HPG",
    "rsi": 44.1,
    "macd": -0.003,
    "signal": -0.001,
    "trend": "sideways",
    "last_updated": "2026-05-18T09:30:00Z"
  }
]
```

### 3.6 Tracked Symbols

```json
// GET /core/v1/stock-management/tracked-symbols/
[
  {
    "symbol": "VNM",
    "name": "Vinamilk",
    "tracked_since": "2026-01-15T10:00:00Z"
  }
]
```

### 3.7 Watchlist Groups

```json
// GET /core/v1/portfolio/watchlist/groups/
[
  {
    "id": 1,
    "name": "Cổ phiếu ngân hàng",
    "items": [
      { "symbol": "VCB" },
      { "symbol": "BID" },
      { "symbol": "CTG" }
    ]
  }
]
```

### 3.8 Alert Center Feed

```json
// GET /core/v1/alerts/feed/?page_size=20
{
  "count": 45,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "a1b2c3",
      "type": "whale",
      "symbol": "VCB",
      "message": "Whale buy 2.5M shares at 92,000",
      "severity": "high",
      "created_at": "2026-05-18T09:15:00Z",
      "audience": ["holdings", "watchlist"]
    }
  ],
  "summary": {
    "total_today": 12,
    "by_type": { "whale": 3, "price_shock": 2, "dark_flow": 7 }
  }
}
```

---

## 4. Authentication Model

Tất cả portfolio endpoints yêu cầu JWT authentication:

```
Authorization: Bearer <jwt_token>
```

- Token lấy từ `packageShellHostEnv.getAuthToken()`
- Backend tự động filter by tenant (user ownership)
- Cross-tenant access bị block tại query layer (không cần frontend enforce)

---

## 5. URL Routing Architecture

```
nginx (port 80/443)
├── /api/*  ──────────────────────────────> core-api:8100 (Django)
│   ├── /api/portfolio/portfolios/*/...   ─ user_workspace.urls
│   ├── /api/stock-management/tracked/   ─ user_workspace.urls
│   ├── /api/stock-management/technicals/bulk/ ─ market_data.public_urls ← ONLY HERE
│   ├── /api/portfolio/watchlist/groups/ ─ user_workspace.urls
│   └── /api/alerts/*                    ─ signal_intelligence.urls
│
└── /core/v1/*  ──────────────────────────> core-api:8100 (Django)
    ├── /core/v1/portfolio/portfolios/*/... ─ user_workspace.urls (re-mounted)
    ├── /core/v1/stock-management/tracked/ ─ user_workspace.urls (re-mounted)
    ├── /core/v1/portfolio/watchlist/...   ─ user_workspace.urls (re-mounted)
    └── /core/v1/alerts/*                 ─ signal_intelligence.urls (re-mounted)
    ─── NOTE: /core/v1/stock-management/technicals/bulk/ KHÔNG tồn tại
```

---

## 6. Query Parameters

| Endpoint | Param | Type | Default | Note |
|----------|-------|------|---------|------|
| Analytics | `days` | int | 30 | Lookback window, max 365 |
| Alert Feed | `page_size` | int | 20 | Max 100 |
| Alert Feed | `page` | int | 1 | Cursor pagination |
| Alert Feed | `alert_type` | string | (all) | `whale`, `dark_flow`, `price_shock`, `stale_quote`, `system` |
| Alert Feed | `audience` | string | (all) | `holdings_only`, `watchlist_only` |
| Alert Feed | `session_date` | date | (today) | ISO8601 date string |
| Bulk Technicals | `symbols` | string (multi) | required | Repeatable query param |

---

## 7. Error Response Format (chuẩn OpenAPI)

```json
// 400 / 403 / 404 / 500
{
  "detail": "Không tìm thấy portfolio.",
  "code": "not_found",
  "timestamp": "2026-05-18T09:15:00Z",
  "request_id": "abc123"
}
```

Frontend phải handle:
- **401**: Redirect to login
- **403**: Show "Không có quyền truy cập"
- **404**: Show "Portfolio không tồn tại"
- **500**: Show "Lỗi máy chủ, vui lòng thử lại"
- **Network error**: Show "Không thể kết nối"

---

## 8. Performance Notes

| Endpoint | Typical latency | Cache | Note |
|----------|----------------|-------|------|
| Holdings | 50–200ms | No | Live prices fetched |
| Summary | 20–50ms | No | Computed from holdings |
| Analytics | 100–500ms | Redis 5min | Heavy compute |
| Technicals | 50–150ms | Redis 10min | Pre-computed |
| Bulk Technicals | 200–800ms | Redis 10min | Scales with symbol count |
| Tracked Symbols | 10–30ms | None | Simple DB query |
| Watchlist Groups | 10–30ms | None | Simple DB query |
| Alert Feed | 20–100ms | None | Real-time |

**Recommendation**: Gọi parallel fetch (Phase 1) cho 6 endpoints không phụ thuộc nhau. Chỉ bulk technicals cần chờ holdings (Phase 2) để có danh sách symbols.
