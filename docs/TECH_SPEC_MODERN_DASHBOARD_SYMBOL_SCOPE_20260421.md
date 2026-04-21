# Technical Spec: Modern Dashboard Symbol Scope Selector

**Ngày**: 2026-04-21  
**Status**: Draft for implementation review

---

## 1. Mục tiêu kỹ thuật

Thiết lập một contract chung để Modern Dashboard xử lý symbol universe theo 4 nguồn:
- holdings
- tracked
- watchlist
- all

Contract này phải được dùng thống nhất cho 4 tab trong `ModularPositionDeck`.

---

## 2. Data sources

## 2.1 Holdings
Source:
- `getHoldings(activePortfolioId)`

Primary fields:
- `symbol`
- `quantity`
- `avg_cost`
- `market_value`
- `unrealized_pl_pct`
- `industry`

## 2.2 Tracked symbols
Source:
- `getTrackedSymbols()`

Primary fields:
- `symbol`
- `source_group_id`
- `source_group_name`
- `industry`
- `company_name`
- `market_cap_bn`

## 2.3 Watchlist items
Source:
- `getWatchlistGroups()` hoặc existing watchlist groups API

Flattened fields:
- `group_id`
- `group_name`
- `symbol`

---

## 3. Normalization contract

## 3.1 Symbol normalize

Rule:
- trim
- uppercase
- remove empty values

## 3.2 Unified symbol entity

```javascript
{
  symbol: string,
  in_holdings: boolean,
  in_tracked: boolean,
  in_watchlist: boolean,
  source_tags: Array<'holdings' | 'tracked' | 'watchlist'>,
  watchlist_group_ids: number[],
  watchlist_group_names: string[],
  source_group_id: number | null,
  source_group_name: string | null,
  quantity: number | null,
  avg_cost: number | null,
  market_value: number | null,
  current_price: number | null,
  change_pct: number | null,
  industry: string | null,
  company_name: string | null,
}
```

## 3.3 Scope derivation

```javascript
scope=holdings  -> entities.filter(x => x.in_holdings)
scope=tracked   -> entities.filter(x => x.in_tracked)
scope=watchlist -> entities.filter(x => x.in_watchlist)
scope=all       -> all entities
```

---

## 4. UI contract

## 4.1 Toolbar state

```javascript
symbolScope: 'holdings' | 'tracked' | 'watchlist' | 'all'
selectedSymbol: 'all' | string
```

## 4.2 Behavior

- default scope: `holdings`
- default symbol: `all`
- if current `selectedSymbol` not in scope -> reset to `all`
- if scope has zero symbols -> show empty state per tab

## 4.3 Display labels

`symbolScope` labels in Vietnamese:
- Holdings: `Đang nắm giữ`
- Tracked: `Theo dõi riêng`
- Watchlist: `Watchlist`
- All: `Tất cả`

---

## 5. Tab-specific contract

## 5.1 Overview

Input:
- `overviewRows: UnifiedSymbolEntity[]`

If `selectedSymbol !== 'all'`:
- filter by exact symbol

If item is non-holding:
- position-specific cells must not fabricate values
- show `—` or use neutral placeholder

## 5.2 Technical

Input:
- symbol list derived from current scope/symbol selection

Backend endpoint required:
- `POST /api/stock-management/technicals/bulk/`

## 5.3 Whale

Input:
- symbol options from current scope

Constraint:
- bubble chart renders one symbol only

If `selectedSymbol === 'all'`:
- auto-pick first valid symbol in scope
- or block chart and ask user to choose one symbol

Recommended behavior:
- auto-pick first valid symbol but show a subtle hint that Whale chart is single-symbol mode

## 5.4 AI Bot

Mode A: `holdings`
- show current health score + analytics + digest

Mode B: `tracked/watchlist/all`
- hide or downgrade portfolio-only metrics
- show universe-oriented summary only

---

## 6. Backend API proposal

## 6.1 Technicals bulk endpoint

Route:
- `POST /api/stock-management/technicals/bulk/`

Request:

```json
{
  "symbols": ["FPT", "HPG", "VCB"]
}
```

Validation rules:
- request authenticated
- symbols required
- max symbols per request: 100
- normalized uppercase unique list

Response:

```json
{
  "technicals": [
    {
      "symbol": "FPT",
      "date": "2026-04-21",
      "rsi_14": 55.1,
      "sma20": 91300,
      "sma50": 88750,
      "momentum_20d_pct": 3.8
    }
  ]
}
```

Error cases:
- empty list -> 400
- over limit -> 400
- no market data found -> empty `technicals`

---

## 7. Affected files

Frontend likely changes:
- `frontend/src/pages/modern/ModernDashboard.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/HoldingsTable.jsx` or replacement component
- `frontend/src/api/client.js`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

Backend likely changes:
- `backend/portfolio/urls_stock.py` or suitable stock-management route file
- `backend/portfolio/views_analytics_extended.py`
- `backend/portfolio/urls.py` or stock-management urls
- tests for technicals bulk endpoint

---

## 8. Non-goals

- Không thay đổi semantics của summary/analytics portfolio-level trong phase đầu.
- Không render whale bubble chart đa mã.
- Không hợp nhất tracked/watchlist thành pseudo-holdings.

---

## 9. Verification strategy

### Manual
- Scope switch updates symbol options correctly.
- Overview rows change by scope.
- Whale tab can select symbol from tracked/watchlist.
- Technical tab returns data for non-holdings after bulk endpoint lands.

### Automated
- Unit test normalize + dedupe universe.
- Component test selector reset behavior.
- API test for technicals bulk endpoint.
