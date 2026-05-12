# FRONTEND RUNTIME — SaaS API CONTRACTS REQUIRED

**Ngày**: 2026-05-12  
**Workstream**: FRONTEND-SaaS-RUNTIME-MIGRATION  
**Phiên bản**: 1.0  
**Ref**: `AGENTS.md` Section 8 — Hard constraints for SaaS Migration

---

## 1. OVERVIEW

Frontend đã migrate sang dùng `coreApiAdapter.js` cho market data. Tuy nhiên, **2 API contracts còn thiếu** khiến frontend phải fallback sang legacy `/api/*` endpoints:

| API Contract | Frontend dùng legacy | Lý do fallback |
|---|---|---|
| Intraday OHLCV | `/api/stock-management/stocks/{symbol}/chart/` | Backend chưa có `/core/v1/market-data/intraday-prices/` |
| Intraday Tape | `/api/realtime/intraday/{symbol}/` | Backend chưa có `/core/v1/market-data/intraday-tape/` |

**Task này yêu cầu Backend bổ sung 2 contracts để frontend có thể remove hoàn toàn legacy dependency.**

---

## 2. REFERENCE FRAMEWORK

Tuân thủ các tài liệu đã có:

1. **`AGENTS.md`** — Hard constraints for SaaS Migration (Section 8)
2. **`quality/QUALITY.md`** — Coverage targets và fitness scenarios
3. **`docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`** — Phase overview
4. **`docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`** — Technical specifications

---

## 3. FRONTEND CLIENT — coreApiAdapter.js

### File: `packages/web/src/adapters/coreApiAdapter.js`

Đây là **single source of truth** cho frontend API calls. Theo `AGENTS.md` Section 8.8:

> **Tất cả API calls từ packages/web phải qua `coreApiAdapter.js` — không direct fetch.**

#### Methods đã có

```javascript
export const coreApiAdapter = {
  // Market Data — /core/v1/market-data/*
  getSymbolList(params = {}) { /* ... */ },
  getDailyPrices(symbol, params = {}) { /* ... */ },
  getIntradayPrices // THIẾU
  getIntradayTape  // THIẾU

  // Snapshot — /core/v1/symbol-snapshot/*
  getSymbolSnapshot(symbol) { /* ... */ },

  // Signals — /core/v1/signals/*
  getWhaleFeedAggregate(symbol, params = {}) { /* ... */ },
};
```

#### Methods cần Backend cung cấp

```javascript
// 1. INTRADAY OHLCV — thay thế /api/stock-management/stocks/{symbol}/chart/
getIntradayPrices(symbol, params = {}) {
  /**
   * GET /core/v1/market-data/intraday-prices/{symbol}/
   *
   * @param {string} symbol - Stock ticker (e.g. 'VCB')
   * @param {object} params - { timeframe: '1H', date_from, date_to, limit, cursor }
   * @returns {Promise<IntradayPricesResponse>}
   */
  if (!symbol) throw new Error("symbol is required for getIntradayPrices");
  const query = buildQuery(params);
  return coreGet(`/market-data/intraday-prices/${symbol.toUpperCase()}/${query}`);
}

// 2. INTRADAY TAPE — thay thế /api/realtime/intraday/{symbol}/
getIntradayTape(symbol, params = {}) {
  /**
   * GET /core/v1/market-data/intraday-tape/{symbol}/
   *
   * @param {string} symbol - Stock ticker
   * @param {object} params - { limit, cursor }
   * @returns {Promise<IntradayTapeResponse>}
   */
  if (!symbol) throw new Error("symbol is required for getIntradayTape");
  const query = buildQuery(params);
  return coreGet(`/market-data/intraday-tape/${symbol.toUpperCase()}/${query}`);
}
```

---

## 4. BACKEND CONTRACT — /core/v1/* ENDPOINTS

### File: `backend/config/urls.py`

Thêm routes sau vào `urlpatterns`:

```python
# ============================================================
# /core/v1/market-data/* — Market Data API (SaaS)
# ============================================================

# Intraday OHLCV (THIẾU — cần tạo)
path(
    'core/v1/market-data/intraday-prices/<str:symbol>/',
    views.MarketDataIntradayPriceView.as_view(),
    name='core-market-data-intraday-prices'
),

# Intraday tape (THIẾU — cần tạo)
path(
    'core/v1/market-data/intraday-tape/<str:symbol>/',
    views.MarketDataIntradayTapeView.as_view(),
    name='core-market-data-intraday-tape'
),
```

### View Pattern

```python
class MarketDataIntradayPriceView(APIView):
    """
    GET /core/v1/market-data/intraday-prices/{symbol}/

    Query params:
    - timeframe: 1m, 5m, 15m, 30m, 1H, 2H, 4H (default: 1H)
    - date_from: YYYY-MM-DD
    - date_to: YYYY-MM-DD
    - limit: int (default: 100)
    - cursor: string (pagination)

    Response schema:
    {
      "symbol": "VCB",
      "timeframe": "1H",
      "results": [
        {
          "ts": "2026-05-12T09:00:00Z",
          "open": 100.0,
          "high": 102.0,
          "low": 99.0,
          "close": 101.0,
          "volume": 1000
        },
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
        # Implementation: lấy từ Redis Stream → IntradayTick table → vnbroker
```

```python
class MarketDataIntradayTapeView(APIView):
    """
    GET /core/v1/market-data/intraday-tape/{symbol}/

    Query params:
    - limit: int (default: 50)
    - cursor: string (pagination)

    Response schema:
    {
      "symbol": "VCB",
      "results": [
        {
          "ts": "2026-05-12T09:15:00Z",
          "price": 100.5,
          "volume": 100,
          "side": "buy"
        },
        ...
      ],
      "next_cursor": "..."
    }
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'market_data'

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Implementation: lấy từ Redis Stream → IntradayTick table
```

---

## 5. DATA SOURCE ARCHITECTURE

### Theo `AGENTS.md` principles

> **Shadow run bắt buộc** trước mọi Celery task cutover — tối thiểu 3 ngày trade thật.

### Pipeline Priority

```
[Data Sources]           [Ingestion]              [API Layer]
─────────────────   ──────────────────    ─────────────────
vnbroker API     ──► Celery tasks ──► Redis Stream ──► /core/v1/market-data/*
                    │                         │
           IntradayTick Table (storage)
```

1. **Redis Stream** — real-time ticks đang stream (ưu tiên)
2. **PostgreSQL** — IntradayTick table (historical)
3. **vnbroker** — external API (fallback cuối)

---

## 6. SCHEMA CONTRACTS

### 6.1 IntradayPricesResponse

```typescript
interface IntradayPricesResponse {
  symbol: string;
  timeframe: string;
  results: IntradayBar[];
  next_cursor: string | null;
}

interface IntradayBar {
  ts: string;        // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### 6.2 IntradayTapeResponse

```typescript
interface IntradayTapeResponse {
  symbol: string;
  results: Trade[];
  next_cursor: string | null;
}

interface Trade {
  ts: string;       // ISO 8601
  price: number;
  volume: number;
  side: 'buy' | 'sell';
}
```

### 6.3 Compatibility với frontend

Front-end map các fields:

| Frontend field | Backend response field | Required |
|---|---|---|
| `symbol` | `symbol` | ✅ |
| `timeframe` | `timeframe` | ✅ |
| `results[].date` | `results[].ts` | ✅ |
| `results[].open` | `results[].open` | ✅ |
| `results[].high` | `results[].high` | ✅ |
| `results[].low` | `results[].low` | ✅ |
| `results[].close` | `results[].close` | ✅ |
| `results[].volume` | `results[].volume` | ✅ |
| `next_cursor` | `next_cursor` | ✅ |

---

## 7. CHECKLIST — BACKEND TEAM

| Task | Priority | Dependencies | Status |
|---|---|---|---|
| Tạo `MarketDataIntradayPriceView` | P0 | IntradayTick table hoặc Redis | ❌ |
| Tạo `MarketDataIntradayTapeView` | P0 | IntradayTick table hoặc Redis | ❌ |
| Thêm routes vào `urls.py` | P0 | Views created | ❌ |
| Seed VCB, TPB vào IntradayTick | P0 | Views created | ❌ |
| Test E2E: `GET /core/v1/market-data/intraday-prices/VCB/` | P0 | Views + routes | ❌ |
| Test E2E: `GET /core/v1/market-data/intraday-tape/VCB/` | P0 | Views + routes | ❌ |

---

## 8. CHECKLIST — FRONTEND TEAM

| Task | Priority | Dependencies | Status |
|---|---|---|---|
| Thêm `getIntradayPrices()` vào `coreApiAdapter.js` | P0 | Backend endpoint ready | ❌ |
| Thêm `getIntradayTape()` vào `coreApiAdapter.js` | P0 | Backend endpoint ready | ❌ |
| Update callers để dùng `coreApiAdapter` | P1 | Methods added | ❌ |
| Remove legacy `/api/*` calls cho market data | P1 | Callers updated | ❌ |

---

## 9. VALIDATION GATES

| Gate | Command | Pass Condition |
|---|---|---|
| V1 | `curl /core/v1/market-data/intraday-prices/VCB/` | 200 + valid JSON |
| V2 | `curl /core/v1/market-data/intraday-tape/VCB/` | 200 + valid JSON |
| V3 | Frontend chart hiển thị intraday data | Visual verification |
| V4 | Frontend không gọi legacy `/api/*` cho market data | Network audit |

---

## 10. RISKS VÀ MITIGATION

| Risk | Mitigation |
|---|---|
| Backend chưa có IntradayTick data | Seed từ vnbroker; warm-up Redis stream |
| Frontend schema mismatch | Backend giữ backward compatible field names |
| Parity < 99% | Compare vs legacy response trước khi cutover |

---

## 11. DEPLOYMENT SEQUENCE

```
Phase 1: Backend endpoints (Day 1-2)
         ├─ Tạo MarketDataIntradayPriceView
         ├─ Tạo MarketDataIntradayTapeView
         └─ Thêm routes /core/v1/*

Phase 2: Data seed (Day 2-3)
         ├─ Seed VCB, TPB vào IntradayTick
         └─ Verify data populated

Phase 3: Frontend migration (Day 3-4)
         ├─ Add methods to coreApiAdapter
         └─ Update callers

Phase 4: Cutover (Day 4-5)
         ├─ Remove legacy calls
         └─ Verify no legacy /api/* calls
```

---

## 12. REFERENCE

| File | Purpose |
|---|---|
| `packages/web/src/adapters/coreApiAdapter.js` | Frontend SaaS client |
| `backend/config/urls.py` | Backend routes |
| `backend/portfolio/market_views.py` | Market data views |
| `backend/portfolio/market_data_service.py` | Data service logic |

---

## 13. COMPLIANCE

| Requirement | Reference |
|---|---|
| Single API client | `AGENTS.md` 8.8 |
| No legacy `/api/*` after migration | `SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` Section 5.5 |
| Schema backward compatibility | `quality/QUALITY.md` Section 4 |
| Evidence bắt buộc | `AGENTS.md` Section 7 |
