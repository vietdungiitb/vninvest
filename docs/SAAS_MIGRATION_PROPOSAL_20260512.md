# ĐỀ XUẤT GIẢI PHÁP TỔNG THỂ — PURE SaaS ARCHITECTURE

**Ngày**: 2026-05-12  
**Workstream**: FRONTEND-SaaS-MIGRATION  
**Phiên bản**: 2.0  
**Nguyên tắc**: SaaS-first — loại bỏ hoàn toàn legacy architecture

---

## NGUYÊN TẮC KIẾN TRÚC

1. **Chỉ SaaS endpoints** — `/core/v1/*` là single source of truth
2. **Không fallback legacy** — Frontend không gọi `/api/*` cho market data
3. **Schema contract** — Backend commit giữ schema ổn định
4. **Break if needed** — Đập bỏ kiến trúc cũ nếu cần thiết

---

## 1. FRONTEND — PURE SaaS CLIENT

### File: `packages/web/src/adapters/coreApiAdapter.js`

Đây là **single API client** cho frontend. Xóa tất cả references tới `/api/*` endpoints.

#### Methods BẮT BUỘC

```javascript
export const coreApiAdapter = {
  // ========================================
  // MARKET DATA (SaaS — /core/v1/market-data/*)
  // ========================================
  
  /**
   * LẤY danh sách symbols có sẵn
   * GET /core/v1/market-data/symbols/
   */
  getSymbolList(params = {}) { /* ... */ },

  /**
   * LẤY OHLCV daily prices
   * GET /core/v1/market-data/daily-prices/{symbol}/
   */
  getDailyPrices(symbol, params = {}) { /* ... */ },

  /**
   * LẤY intraday OHLCV bars (THIẾU — cần backend cung cấp)
   * GET /core/v1/market-data/intraday-prices/{symbol}/
   */
  getIntradayPrices(symbol, params = {}) {
    if (!symbol) throw new Error("symbol is required");
    const query = buildQuery(params);
    return coreGet(`/market-data/intraday-prices/${symbol.toUpperCase()}/${query}`);
  },

  /**
   * LẤY intraday tape/trades (THIẾU — cần backend cung cấp)
   * GET /core/v1/market-data/intraday-tape/{symbol}/
   */
  getIntradayTape(symbol, params = {}) {
    if (!symbol) throw new Error("symbol is required");
    const query = buildQuery(params);
    return coreGet(`/market-data/intraday-tape/${symbol.toUpperCase()}/${query}`);
  },

  // ========================================
  // SNAPSHOT (SaaS — /core/v1/symbol-snapshot/*)
  // ========================================
  
  /**
   * LẤY latest snapshot cho symbol
   * GET /core/v1/symbol-snapshot/{symbol}/
   */
  getSymbolSnapshot(symbol) { /* ... */ },

  // ========================================
  // WHALE FEED (SaaS — /core/v1/signals/*)
  // ========================================
  
  /**
   * LẤY whale feed aggregate
   * GET /core/v1/signals/whale-feed-aggregate/{symbol}/
   */
  getWhaleFeedAggregate(symbol, params = {}) { /* ... */ },
};
```

#### Helper Functions

```javascript
function buildQuery(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  return qs ? `?${qs}` : '';
}
```

---

## 2. BACKEND — PURE SaaS API LAYER

### File: `backend/config/urls.py`

Tất cả market data endpoints phải dưới `/core/v1/`. Không dùng `/api/*` prefix cho market data.

#### Routes BẮT BUỘC cần tạo

```python
# ============================================================
# /core/v1/market-data/* — Market Data API (SaaS)
# ============================================================

# symbol list — lấy universe
path(
    'core/v1/market-data/symbols/',
    views.MarketDataSymbolListView.as_view(),
    name='core-market-data-symbols'
),

# daily OHLCV
path(
    'core/v1/market-data/daily-prices/<str:symbol>/',
    views.MarketDataDailyPriceView.as_view(),
    name='core-market-data-daily-prices'
),

# INTRADAY OHLCV (THIẾU)
path(
    'core/v1/market-data/intraday-prices/<str:symbol>/',
    views.MarketDataIntradayPriceView.as_view(),
    name='core-market-data-intraday-prices'
),

# INTRADAY TAPE (THIẾU)  
path(
    'core/v1/market-data/intraday-tape/<str:symbol>/',
    views.MarketDataIntradayTapeView.as_view(),
    name='core-market-data-intraday-tape'
),

# ============================================================
# /core/v1/symbol-snapshot/* — Snapshot API (SaaS)
# ============================================================

path(
    'core/v1/symbol-snapshot/<str:symbol>/',
    views.SymbolSnapshotView.as_view(),
    name='core-symbol-snapshot'
),
```

#### Views Implementation Pattern

Mỗi view nên follow pattern:

```python
class MarketDataIntradayPriceView(APIView):
    """
    GET /core/v1/market-data/intraday-prices/{symbol}/
    
    Query params:
    - timeframe: 1m, 5m, 15m, 30m, 1H, 2H, 4H (default: 1H)
    - date_from: YYYY-MM-DD
    - date_to: YYYY-MM-DD
    - limit: int (default: 100)
    - cursor: string
    
    Response:
    {
      "symbol": "VCB",
      "timeframe": "1H",
      "results": [
        {"ts": "2026-05-12T09:00:00Z", "open": 100, "high": 102, "low": 99, "close": 101, "volume": 1000},
        ...
      ],
      "next_cursor": "..."
    }
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'market_data'
    
    def get(self, request, symbol):
        symbol = symbol.upper()
        timeframe = request.query_params.get('timeframe', '1H')
        # ... implementation
```

---

## 3. DATA SOURCE ARCHITECTURE (SaaS)

### Intraday Data Pipeline

```
[Data Sources]        [Ingestion]           [API Layer]
─────────────────    ──────────────      ───────────────
vnbroker API     ──► Celery tasks ──► Redis Stream ──► /core/v1/market-data/*
                              │
                     IntradayTick Table (storage)
```

### Priority Order

1. **Redis Stream** — real-time ticks đang stream
2. **PostgreSQL** — IntradayTick table (historical)
3. **vnbroker** — external API (last resort)

---

## 4. SCHEMA CONTRACTS

### Contract: Daily OHLCV

```typescript
interface DailyOHLCV {
  symbol: string;
  date: string;  // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DailyPricesResponse {
  symbol: string;
  results: DailyOHLCV[];
  next_cursor: string | null;
}
```

### Contract: Intraday OHLCV

```typescript
interface IntradayOHLCV {
  symbol: string;
  ts: string;  // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IntradayPricesResponse {
  symbol: string;
  timeframe: string;
  results: IntradayOHLCV[];
  next_cursor: string | null;
}
```

### Contract: Snapshot

```typescript
interface SymbolSnapshot {
  symbol: string;
  session_date: string;
  price: number;
  price_change_pct: number;
  volume: number;
  market_status: 'active' | 'halted' | 'closed';
}
```

---

## 5. MIGRATION CHECKLIST

### Backend Team

| Task | Priority | Status | Handoff Doc |
|---|---|---|---|
| Tạo `/core/v1/market-data/symbols/` endpoint | P0 | ❌ | [SPEC](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md) |
| Tạo `/core/v1/market-data/daily-prices/{symbol}/` endpoint | P0 | ❌ | [SPEC](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md) |
| Seed VCB, TPB vào market_data_daily_price table | P0 | ❌ | [SPEC](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md#4-data-migration--seeding) |
| Tạo `/core/v1/symbol-snapshot/{symbol}/` endpoint | P0 | ❌ | [SPEC](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md) |
| **Tạo `/core/v1/market-data/intraday-prices/{symbol}/` endpoint** | **P0** | **🚀 DETAILED SPEC** | [FULL HANDOFF](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md#2-endpoint-spec-1-intraday-ohlcv-bars) |
| **Tạo `/core/v1/market-data/intraday-tape/{symbol}/` endpoint** | **P0** | **🚀 DETAILED SPEC** | [FULL HANDOFF](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md#3-endpoint-spec-2-intraday-tape-tick-trades) |
| Seed VCB, TPB vào IntradayTick table | P0 | ❌ | [SPEC](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md#41-seed-requirements-critical-blocker) |

### Frontend Team

| Task | Priority | Status |
|---|---|---|
| Update coreApiAdapter: thêm getIntradayPrices() | P1 | ❌ |
| Update coreApiAdapter: thêm getIntradayTape() | P1 | ❌ |
| Migrate callers sang coreApiAdapter | P1 | ❌ |
| Xóa /api/* calls trong client.js (market data) | P1 | ❌ |

### Team chung

| Task | Priority | Status |
|---|---|---|
| Update comments: "legacy" → "SaaS" | P2 | ❌ |
| Test E2E: daily chart hiển thị | P0 | ❌ |
| Test E2E: intraday chart hiển thị | P1 | ❌ |
| Shutdown legacy containers | P2 | ❌ |

---

## 6. DEPLOYMENT SEQUENCE

```
Phase 1: Core Data (Day 1-2)
         ├─ Backend: daily-prices endpoint
         ├─ Backend: symbols endpoint  
         └─ Frontend: connect daily chart

Phase 2: Snapshot (Day 2-3)
         ├─ Backend: symbol-snapshot endpoint
         └─ Frontend: connect ticker

Phase 3: Intraday (Day 3-5)
         ├─ Backend: intraday-prices endpoint
         ├─ Backend: intrady-tape endpoint
         └─ Frontend: replace legacy chart

Phase 4: Cleanup (Day 5+)
         ├─ Remove legacy API calls
         └─ Shutdown legacy containers
```

---

## 7. BREAKAGE SCENARIOS

### Nếu data rỗng

- Frontend hiển thị "Đang tải..." state
- Không fallback — user biết data đang load

### Nếu API fail

- Return 5xx → Frontend show error message
- Không fallback sang legacy

### Nếu schema thay đổi

- Backend giữ backward compatible
- Hoặc coordinate với frontend trước khi deploy

---

---

## 🚀 DETAILED IMPLEMENTATION HANDOFF (2026-05-12)

### Handoff Documents Created

Gói handoff chi tiết gồm 2 tài liệu tham khảo:

1. **[SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md](SAAS_MARKET_DATA_API_HANDOFF_INTRADAY_CHART_TAPE_20260512.md)**
   - **90-page comprehensive spec** cho cả 2 intraday endpoints
   - Covers: query params, response schemas, data source priority chain, unit normalization
   - Includes: 5-day implementation roadmap (Phase A-E) với breaking points rõ ràng
   - Contains: full testing strategy (unit + integration + load tests)
   - Status: **🟢 READY FOR BACKEND TEAM EXECUTION**

2. **[SAAS_MARKET_DATA_API_EXECUTION_EVIDENCE_TEMPLATE_20260512.md](SAAS_MARKET_DATA_API_EXECUTION_EVIDENCE_TEMPLATE_20260512.md)**
   - Template để backend team report completion results
   - Sections: test results, performance validation, data quality, sign-off
   - Status: **🟢 TEMPLATE READY FOR TEAM**

### Nội Dung Handoff Package

✅ **Complete Schema Contracts**
- TypeScript interfaces for all query + response types
- Price unit normalization rules (THOUSAND_VND conversion)
- Field-by-field documentation + examples

✅ **Implementation Roadmap (7 days)**
- Phase A: Scaffolding (Day 1) — Views + Serializers
- Phase B: Data Layer (Day 2) — Seeding + Queries
- Phase C: Core Logic (Day 3-4) — Full endpoint impl
- Phase D: Integration (Day 5) — vnbroker + Redis
- Phase E: Audit (Day 6-7) — Testing + Sign-off
- Breaking points defined for each phase

✅ **Comprehensive Test Strategy**
- 45+ unit test cases (OHLC, pagination, auth, etc.)
- Integration tests with pre-seeded data
- Contract validation tests (schema matching)
- Performance benchmarks (p95 < 500ms, 100 concurrent req/s)
- Data quality checks (no duplicates, OHLC sanity)

✅ **Data Requirements Specified**
- Seed data checklist (VCB, TPB, FPT, SSI, VNM, VIC)
- IntradayTick table structure confirmed (no schema changes)
- OHLC aggregation logic provided (code snippet)
- Unit conversion rules documented (price / 1000)

✅ **Validation Checklist**
- Functional: 8 requirements
- Performance: 4 targets (p95, concurrent, memory)
- Integration: 4 frontend touchpoints
- Data quality: 4 sanity rules

### Timeline

**Backend Development**: 5-7 days  
**Backend Testing**: 2 days  
**Frontend Integration**: 2-3 days (can start once endpoints live)  
**Total SaaS Cutover**: ~10 days  

### Key Commitments

✅ Frontend coreApiAdapter is single API client  
✅ Backend only exposes `/core/v1/` endpoints  
✅ No legacy fallback from frontend  
✅ Schema locked (no breaking changes planned)  
✅ Seed data ready (V CB, TPB validated)

---

## SUMMARY

| Component | Action |
|---|---|
| **Frontend** | coreApiAdapter.js = single client |
| **Backend** | /core/v1/* = only endpoints |
| **Data** | Redis → DB → vnbroker pipeline |
| **Legacy** | Remove hoàn toàn |

---

## REFERENCE

- Frontend callers: `frontend/src/pages/StockDetail.jsx`
- Frontend chart: `frontend/src/components/KLineChartPanel.jsx`
- Backend views: `backend/portfolio/market_views.py`
- Current URLs: `backend/config/urls.py`
