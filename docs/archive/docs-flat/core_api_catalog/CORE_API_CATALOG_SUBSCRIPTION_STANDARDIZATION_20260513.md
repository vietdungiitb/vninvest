# Core API Catalog & Subscription Standardization
**Document**: CORE_API_CATALOG_SUBSCRIPTION_STANDARDIZATION_20260513.md  
**Generated**: 2026-05-13  
**Status**: Reference (Enumerated API surface for SaaS subscription models)

---

## 1. API Catalog Overview

### Global Configuration
- **Base URL**: `https://core-api.vninvest.com` (production) | `http://localhost:8000` (dev)
- **Default Namespace**: `/core/v1` (v1 endpoints) | `/api` (public/legacy compat)
- **Authentication**: PAT (Personal Access Token) via `Authorization: Bearer <raw_pat>`
- **Response Format**: JSON (application/json)
- **Pagination**: Cursor-based (cursor, page_size=50 default)
- **Rate Limit Strategy**: Per-plan quota (see [§ 4](#4-subscription-tier-matrix))
- **Tenant Scoping**: All operations filtered by authenticated tenant

---

## 2. API Endpoints by Feature Area

### 2.1 Identity & Access (PAT, Tenant, Service Account Management)

#### 2.1.1 Authentication
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/auth/login/` | POST | None | Exchange username+password for PAT | `username`, `password` | `{token, token_prefix, tenant, user, abilities, entitlements}` |
| `/api/auth/token/` | POST | None | Same as login | `username`, `password` | Same as login |
| `/api/auth/token/refresh/` | POST | None | Refresh expired PAT | `refresh` | `{token, token_prefix, tenant, user}` |
| `/api/auth/register/` | POST | None | Create new tenant account | `username`, `email`, `password`, `display_name` | `{token, tenant, user}` |
| `/api/auth/verify-email/` | POST | None | Verify email for registration | `token` | `{status}` |
| `/api/auth/password-reset/` | POST | None | Request password reset | `email` | `{detail}` |
| `/api/auth/password-reset/confirm/` | POST | None | Confirm reset with token | `token`, `new_password` | `{detail}` |
| `/api/auth/me/` | GET | PAT | Get current user profile | None | `{id, username, email, first_name, last_name, is_staff, is_superuser}` |
| `/api/auth/profile/` | GET | PAT | Get full tenant+user+capabilities | None | `{user, tenant, plan, abilities, entitlements, capabilities}` |
| `/api/auth/logout/` | POST | PAT | Revoke PAT immediately | None | `{detail}` |
| `/api/portfolio/userconfig/` | GET/PUT | PAT | User display preferences | See response | `{language, theme, whale_alert_threshold, advisory_whale_signal_enabled}` |

#### 2.1.2 Tenant Self-Admin (Partner Routes)
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/partner/tenant/` | GET/PUT | PAT | Tenant profile, status, plan | None | `{tenant_id, tenant_code, display_name, plan, status, features, trial_ends_at, created_at}` |
| `/core/v1/partner/service-accounts/` | GET/POST | PAT | List/create service accounts | `name`, `scopes` | `{results: [{service_account_id, name, status, scopes, created_at}], cursor}` |
| `/core/v1/partner/pats/` | GET | PAT | List issued PATs | `cursor`, `page_size` | `{results: [{pat_id, label, token_prefix, status, created_at, expires_at}], cursor}` |
| `/core/v1/partner/pats/issue/` | POST | PAT | Issue new PAT for service account | `scopes`, `expires_at`, `label` | `{pat_id, token, token_prefix, scopes, expires_at}` (token shown once) |
| `/core/v1/partner/pats/<pat_id>/rotate/` | POST | PAT | Rotate existing PAT | `scopes`, `expires_at` | `{token, token_prefix}` (one-time display) |
| `/core/v1/partner/pats/<pat_id>/revoke/` | POST | PAT | Revoke a PAT immediately | `reason` | `{detail}` |
| `/core/v1/partner/usage/meters/` | GET | PAT | Real-time usage counters | `period` (day/month) | `{results: [{metric, value, limit, percent_used}], period}` |
| `/core/v1/partner/usage/quotas/` | GET | PAT | Quota records | `period`, `cursor` | `{results: [{quota_id, metric, limit, used, period_start, period_end}], cursor}` |
| `/core/v1/partner/billing/subscription/` | GET | PAT | Current subscription | None | `{plan, status, billing_period_start, billing_period_end, renewal_date}` |
| `/core/v1/partner/billing/invoices/` | GET | PAT | Invoice history | `cursor`, `page_size` | `{results: [{invoice_id, amount, status, issued_date, due_date}], cursor}` |

#### 2.1.3 Capability Bootstrap
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/access/capabilities/` | GET | Optional | RBAC abilities, entitlements, features | None | `{principal, abilities, entitlements, build, navigation, surfaces, features}` |
| `/core/v1/capability-bootstrap` | GET | Optional | Same as above | None | Same as above |

---

### 2.2 Market Serving (Realtime Data - 9 Native Endpoints)

#### 2.2.1 Ticker Data
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/ticker/<symbol>/` | GET | PAT | Single symbol latest snapshot | `symbol` | `{symbol, price, price_change, price_change_pct, volume, market_status, stale, source, fetched_at}` |
| `/api/realtime/tickers/` | GET | PAT | Batch ticker lookup | `symbols` (comma-sep, max 100) | `{<symbol>: {price, change_pct, volume, market_status, stale}}` |

#### 2.2.2 Intraday Data
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/intraday/<symbol>/` | GET | PAT | Intraday matched trades tape | `page_size` (50 default) | `{symbol, trades: [{timestamp, time, price, volume, side, match_type}], total, source, stale, fetched_at}` |

#### 2.2.3 Market Breadth
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/breadth/<symbol>/` | GET | PAT | Market-wide breadth aggregate | `symbol` (accepted, market-wide result) | `{symbol, total, advancing, declining, unchanged}` |

#### 2.2.4 Price Board
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/price-board/<symbol>/` | GET | PAT | Snapshot price board | `symbol` | `{symbol, price, price_change, price_change_pct, volume, market_status, stale, fetched_at}` |

#### 2.2.5 Whale Feed & Symbols
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/whale-feed/<symbol>/` | GET | PAT | Whale alerts for symbol | `symbol`, `cursor`, `page_size` | `{results: [{alert_id, symbol, price, volume, alert_type, severity, triggered_at}], cursor}` |
| `/api/realtime/symbol-investigation/<symbol>/` | GET | PAT | Symbol technical summary | `symbol` | `{symbol, price, technicals: {rsi, macd, bb_upper, bb_lower}, sentiment, strength}` |

#### 2.2.6 Order Flow & Depth
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/realtime/depth-chart/<symbol>/` | GET | PAT | Order book depth snapshot | `symbol`, `depth_level` (10,20,50) | `{symbol, bid: [{price, volume}], ask: [{price, volume}], timestamp}` |
| `/api/realtime/rvol/<symbol>/` | GET | PAT | Relative volume analysis | `symbol` | `{symbol, current_volume, avg_volume_20d, ratio, interpretation}` |

#### 2.2.7 Symbol Snapshots (Market Serving Domain)
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/symbol-snapshot` | GET | PAT | List daily snapshots | `symbol`, `cursor`, `page_size` | `{results: [{symbol, session_date, price, volume, change_pct}], cursor}` |
| `/core/v1/symbol-snapshot/<symbol>` | GET | PAT | Latest snapshot for symbol | `symbol` | `{symbol, session_date, price, volume, change_pct, source, stale}` |

#### 2.2.8 Session Facts
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/session-facts` | GET | PAT | List session facts | `symbol`, `cursor`, `session_date` | `{results: [{symbol, session_date, opening_price, closing_price, high, low, volume}], cursor}` |
| `/core/v1/session-facts/<symbol>` | GET | PAT | Latest session facts for symbol | `symbol` | `{symbol, session_date, opening_price, closing_price, high, low, volume}` |

---

### 2.3 Market Data (Historical Prices, Symbols, Technicals)

#### 2.3.1 Stock Profiles
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/market-data/symbols/` | GET | PAT | List active symbols | `exchange`, `industry`, `page`, `page_size` | `{results: [{symbol, company_name, exchange, industry, market_cap}], page, page_size}` |
| `/core/v1/market-data/symbols/<symbol>/` | GET | PAT | Symbol profile details | `symbol` | `{symbol, company_name, exchange, sector, industry, market_cap, ipo_date, website}` |
| `/api/stock-management/groups/` | GET | PAT | Securities groups (legacy compat) | None | `{results: [{group_id, name, symbols}]}` |
| `/api/stock-management/tracked-symbols/` | GET/POST | PAT | Tracked symbol watchlist | `symbol` to add | `{results: [{symbol, name}]}` |

#### 2.3.2 Prices & Technicals
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/market-data/daily-prices/<symbol>/` | GET | PAT | Daily OHLCV history | `symbol`, `days` (30 default), `cursor` | `{results: [{date, open, high, low, close, volume}], cursor}` |
| `/core/v1/market-data/intraday-prices/<symbol>/` | GET | PAT | Intraday bar prices | `symbol`, `interval` (1m/5m/15m), `page_size` | `{results: [{time, open, high, low, close, volume}], cursor}` |
| `/core/v1/market-data/intraday-tape/<symbol>/` | GET | PAT | Intraday matched trades | `symbol`, `page_size` (50) | `{symbol, trades: [{timestamp, price, volume, side, match_type}], total, source}` |
| `/api/stock-management/technicals/bulk/` | POST | PAT | Bulk technical analysis | `symbols: [...]` | `{results: [{symbol, rsi, macd, bb_upper, bb_lower, timestamp}]}` |

---

### 2.4 Signal Intelligence (Whale Alerts, Order Flow, Unified Alerts)

#### 2.4.1 Alerts & Events
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/unified-alert` | GET | PAT | All unified alerts (whale, dark, macro) | `symbol`, `alert_type`, `severity`, `session_date`, `cursor` | `{results: [{alert_id, alert_type, symbol, severity, triggered_at}], cursor}` |
| `/api/signals/unified-alert/` | GET | PAT | Same as above (legacy path) | Same | Same |
| `/core/v1/whale-feed` | GET | PAT | Whale alert aggregates | `symbol`, `session_date`, `cursor` | `{results: [{symbol, alert_id, price, volume, executed_at}], cursor}` |
| `/api/signals/whale-feed/` | GET | PAT | Same as above (legacy path) | Same | Same |
| `/core/v1/signals/order-flow/<symbol>/` | GET | PAT | Order flow events for symbol | `symbol`, `session_date`, `cursor` | `{results: [{timestamp, price, volume, side, flow_type}], cursor}` |
| `/api/signals/order-flow/<symbol>/` | GET | PAT | Same as above (legacy path) | Same | Same |

---

### 2.5 Advisory (AI-Powered Signal Intelligence)

#### 2.5.1 Advisory Endpoints
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/advisory/latest/<symbol>/` | GET | PAT | Latest AI advisory for symbol | `symbol`, `date` | `{advisory_id, symbol, session_date, signals: [{type, confidence, rationale}], recommendation, generated_at}` |
| `/core/v1/advisory/refresh/<symbol>/` | POST | PAT | Trigger manual advisory generation | `symbol`, `date` | `{task_id, status, queued_at}` |
| `/core/v1/advisory/history/<symbol>/` | GET | PAT | Advisory history for symbol | `symbol`, `days` (30), `cursor` | `{results: [{advisory_id, session_date, recommendation, confidence}], cursor}` |

---

### 2.6 User Workspace (Portfolio, Watchlist, Broker Integration)

#### 2.6.1 Portfolio Management
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/workspace/portfolios/` | GET/POST | PAT | List/create portfolios | Name, currency, benchmark | `{results: [{portfolio_id, name, status, created_at}], cursor}` |
| `/core/v1/workspace/portfolios/<id>/` | GET/PUT/DELETE | PAT | Portfolio CRUD | portfolio_id | `{portfolio_id, name, status, created_at, updated_at}` |
| `/core/v1/workspace/portfolios/<id>/transactions/` | GET/POST | PAT | Transactions in portfolio | portfolio_id | `{results: [{transaction_id, symbol, quantity, price, date}], cursor}` |
| `/core/v1/workspace/transactions/<id>/` | GET/PUT/DELETE | PAT | Transaction detail | transaction_id | `{transaction_id, symbol, side, quantity, price, fees, date}` |
| `/api/portfolio/portfolios/` | GET/POST | PAT | Legacy compat path (same as workspace) | Same | Same |
| `/api/portfolio/portfolios/<id>/` | GET/PUT/DELETE | PAT | Legacy detail path | Same | Same |

#### 2.6.2 Portfolio Analytics
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/portfolio/portfolios/<id>/holdings/` | GET | PAT | Current positions | `portfolio_id` | `{results: [{symbol, quantity, avg_cost, current_price, market_value, pct_gain}]}` |
| `/api/portfolio/portfolios/<id>/summary/` | GET | PAT | Portfolio summary (cash, total_value, P&L) | `portfolio_id` | `{total_value, cash, invested, pct_return, ytd_return}` |
| `/api/portfolio/portfolios/<id>/chart/` | GET | PAT | Portfolio equity curve | `portfolio_id`, `days` | `{results: [{date, value, return_pct}]}` |
| `/api/portfolio/portfolios/<id>/equity-curve/` | GET | PAT | Equity curve with benchmarks | `portfolio_id`, `benchmark` | `{results: [{date, portfolio_value, benchmark_value}]}` |
| `/api/portfolio/portfolios/<id>/allocation/` | GET | PAT | Asset allocation pie | `portfolio_id` | `{results: [{symbol, pct_allocation, market_value}], cash_pct}` |
| `/api/portfolio/portfolios/<id>/analytics/` | GET | PAT | Full analytics (all metrics) | `portfolio_id` | `{total_value, cash, holdings: [...], p_l: {...}, allocation: [...], volatility, sharpe_ratio}` |
| `/api/portfolio/portfolios/<id>/technicals/` | GET | PAT | Holdings technicals (RSI, MACD) | `portfolio_id` | `{results: [{symbol, rsi, macd, bb}]}` |
| `/api/portfolio/portfolios/<id>/sync/` | POST | PAT | Manually sync with broker | `portfolio_id` | `{task_id, status}` |

#### 2.6.3 Watchlist Management
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/workspace/watchlists/` | GET/POST | PAT | List/create watchlists | `name` | `{results: [{watchlist_id, name, symbol_count, created_at}], cursor}` |
| `/core/v1/workspace/watchlists/<id>/items/` | GET/POST | PAT | Items in watchlist | `watchlist_id`, `symbol` | `{results: [{symbol, price, change_pct, added_at}], cursor}` |
| `/core/v1/workspace/watchlists/<id>/items/<symbol>/` | DELETE | PAT | Remove symbol from watchlist | `watchlist_id`, `symbol` | `{detail}` |
| `/api/portfolio/watchlist/groups/` | GET/POST | PAT | Legacy watchlist groups | `name` | `{results: [{group_id, name}]}` |
| `/api/portfolio/watchlist/items/<id>/` | DELETE | PAT | Remove item from legacy group | `item_id` | `{detail}` |

#### 2.6.4 Broker Integration (DNSE)
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/broker/dnse/config/` | GET | PAT | DNSE broker config | None | `{broker_id, status, connected_at}` |
| `/api/broker/dnse/sync-accounts/` | POST | PAT | Sync accounts from broker | None | `{task_id, status}` |
| `/api/broker/dnse/sync-balances/` | POST | PAT | Sync balances from broker | None | `{task_id, status}` |
| `/api/broker/dnse/reconcile-transactions/` | POST | PAT | Reconcile trades with broker | None | `{task_id, status, mismatches}` |
| `/api/broker/dnse/send-email-otp/` | POST | PAT | Request OTP for broker auth | `email` | `{detail}` |
| `/api/broker/dnse/create-trading-token/` | POST | PAT | Create trading session token | `otp` | `{token, expires_at}` |
| `/api/broker/dnse/place-order/` | POST | PAT | Place order via DNSE | `symbol`, `side`, `quantity`, `price` | `{order_id, symbol, quantity, status}` |
| `/api/broker/dnse/token-status/` | GET | PAT | Check trading token status | None | `{token_status, expires_at}` |

---

### 2.7 Commercial (Billing, Subscription, Quotas)

#### 2.7.1 Billing Endpoints
| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/billing/subscription` | GET | PAT | Current subscription | None | `{plan, status, billing_period_start, billing_period_end, renewal_date}` |
| `/core/v1/billing/quota` | GET | PAT | Quota records | `period`, `cursor` | `{results: [{quota_id, metric, limit, used}], cursor}` |
| `/core/v1/billing/invoices` | GET | PAT | Invoice history | `cursor`, `page_size` | `{results: [{invoice_id, amount, status, issued_date}], cursor}` |
| `/api/public/legal-pages/` | GET | None | Public legal documents | None | `{results: [{page_id, title, url}]}` |

---

### 2.8 Admin Operations (Staff-Only, Operator Surface)

**All admin-ops endpoints require `IsAuthenticated + IsCoreOperator` (is_staff=True or is_superuser=True)**

| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/api/admin-ops/stats/` | GET | Admin | Runtime stats (cache, worker health) | None | `{cache_keys_count, worker_health, avg_task_duration}` |
| `/api/admin-ops/runtime-kpi/` | GET | Admin | KPI dashboard (latency, throughput) | None | `{api_p99_latency, worker_throughput, cache_hit_rate}` |
| `/api/admin-ops/system-ai-settings/` | GET/PUT | Admin | AI system config | `settings` dict | `{llm_model, temperature, max_tokens, enabled_features}` |
| `/api/admin-ops/vnbroker-config/current/` | GET | Admin | Current vnbroker SDK config | None | `{source_priority, timeout_ms, retry_policy}` |
| `/api/admin-ops/vnbroker-config/update-config/` | PUT | Admin | Update vnbroker config | `config` dict | `{status, updated_at}` |
| `/api/admin-ops/vnbroker-config/reset-to-defaults/` | POST | Admin | Reset to defaults | None | `{detail, status}` |
| `/api/admin-ops/vnbroker-config/changelog/` | GET | Admin | Config change history | `cursor` | `{results: [{change_id, change_type, old_value, new_value, timestamp}], cursor}` |
| `/api/admin-ops/vnbroker-config/benchmark-price-board/latest/` | GET | Admin | Latest bench result | None | `{source, response_time_ms, data_freshness_seconds, cache_hit}` |
| `/api/admin-ops/vnbroker-config/benchmark-price-board/run/` | POST | Admin | Run bench now | None | `{task_id, status}` |
| `/api/admin-ops/prefetch/warm/` | POST | Admin | Manually warm prefetch cache | `symbols: [...]` | `{task_id, warmed_count}` |
| `/api/admin-ops/market-groups/sync/` | POST | Admin | Sync market groups from data source | None | `{task_id, synced_groups}` |
| `/api/admin-ops/intraday-universe/warm-now/` | POST | Admin | Warm all intraday data | None | `{task_id, status}` |
| `/api/admin-ops/intraday-side-backfill/preview/` | GET | Admin | Preview intraday side backfill | `symbol`, `date_range` | `{preview_count, affected_symbols}` |
| `/api/admin-ops/intraday-side-backfill/apply/` | POST | Admin | Apply intraday side inference | `symbol`, `date_range` | `{task_id, status}` |
| `/api/admin-ops/intraday-side-backfill/status/<task_id>/` | GET | Admin | Status of backfill task | `task_id` | `{task_id, status, progress_pct, error}` |
| `/api/admin-ops/signals/summary/` | GET | Admin | Signals processing summary | None | `{total_events, events_per_symbol, cache_size, retention_days}` |
| `/api/admin-ops/signals/config/` | GET/PUT | Admin | Signal detection config | `config` dict | `{universe_policy, materialization_ttl, retention_policy}` |
| `/api/admin-ops/signals/config/preview/` | GET | Admin | Preview config changes | `proposed_config` | `{affected_symbols, estimated_storage}` |
| `/api/admin-ops/signals/universe/preview/` | GET | Admin | Preview detection universe | None | `{total_symbols, universes_affected}` |
| `/api/admin-ops/signals/universe/apply/` | POST | Admin | Apply detection universe | `universe_policy` dict | `{task_id, status}` |
| `/api/admin-ops/signals/jobs/` | GET | Admin | List signal processing jobs | `cursor`, `status_filter` | `{results: [{job_id, status, started_at, completed_at}], cursor}` |
| `/api/admin-ops/signals/jobs/run/` | POST | Admin | Trigger signal job manually | `job_type` | `{job_id, status}` |
| `/api/admin-ops/signals/jobs/<run_id>/retry/` | POST | Admin | Retry failed signal job | `run_id` | `{job_id, status}` |
| `/api/admin-ops/signals/events/recent/` | GET | Admin | Recent signal events (debug) | `limit`, `symbol_filter` | `{results: [{timestamp, symbol, event_type, payload}]}` |
| `/api/admin-ops/signals/retention/preview/` | GET | Admin | Preview retention policy | `days`, `storage_estimate` | `{affected_records, estimated_freed_storage}` |
| `/api/admin-ops/audit-log` | GET | Admin | Audit log events | `resource_type`, `cursor` | `{results: [{timestamp, actor, action, resource_id}], cursor}` |
| `/api/admin-ops/operator/overview/` | GET | Admin | Operator dashboard overview | None | `{api_health, worker_health, data_freshness, quota_usage}` |
| `/api/admin-ops/operator/health/` | GET | Admin | All system health checks | None | `{database, cache, broker, celery, data_sources}` |

---

### 2.9 Health & Capabilities

| Endpoint | Method | Auth | Purpose | Parameters | Response |
|----------|--------|------|---------|------------|----------|
| `/core/v1/health` | GET | None | Liveness probe | None | `{status: "OK"}` |
| `/core/v1/capability-bootstrap` | GET | Optional | Features & RBAC capability matrix | None | See [§ 2.1.3](#213-capability-bootstrap) |

---

## 3. Common Contract Patterns & Standards

### 3.1 Request/Response Patterns

#### Authentication Header
```bash
curl -H "Authorization: Bearer vni_<random_48_char_base64>" https://core-api.vninvest.com/api/...
```

#### Query Parameters (Pagination)
- `cursor`: Opaque cursor token for next page (returned in response)
- `page_size`: Items per page (default 50, max 500)
- `offset`: Legacy alternative to cursor (deprecated, use cursor)

#### Query Parameters (Filtering)
- `symbol`: Stock symbol filter (case-insensitive, auto-uppercased)
- `session_date`: Date filter (YYYY-MM-DD)
- `alert_type`: Filter by alert type (whale, dark_flow, macro, etc.)
- `status`: Filter by object status (active, inactive, etc.)

#### Response Envelope (List)
```json
{
  "results": [{...}, {...}],
  "cursor": "cD0yMDI2LTA1LTEzJmlkPTEyMzQ1",
  "page_size": 50,
  "total": 1234
}
```

#### Response Envelope (Detail)
```json
{
  "id": "123",
  "created_at": "2026-05-13T10:30:00Z",
  "updated_at": "2026-05-13T15:45:00Z",
  ...
}
```

#### Error Response
```json
{
  "detail": "Invalid or revoked PAT",
  "code": "invalid_token"
}
```

### 3.2 HTTP Status Codes
| Code | Usage |
|------|-------|
| `200` | Successful GET/PUT/DELETE |
| `201` | Resource created (POST) |
| `202` | Request accepted (async task queued) |
| `400` | Invalid request (bad parameters) |
| `401` | Unauthenticated (missing/invalid PAT) |
| `403` | Unauthorized (lacking ability/plan entitlement) |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

### 3.3 Timestamp Format
- All timestamps in ISO 8601 UTC: `2026-05-13T10:30:00Z`
- Client SDK should parse with `new Date(timestamp)` in browsers

### 3.4 Numeric Precision
- Prices: String format with 2-4 decimal places (e.g., `"112.50"`, `"0.0125"`)
- Percentages: Float 0-100 or string e.g., `3.45`
- Volumes: Integer (no decimals)
- Ratios: Float (e.g., 1.25 for Sharpe ratio)

---

## 4. Subscription Tier Matrix

### 4.1 Plan Definitions

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| **Monthly Cost** | $0 | $29 | $99 | Custom |
| **Realtime Data** | ✅ (30min delay) | ✅ (5min delay) | ✅ (live) | ✅ (live) |
| **Watchlists** | 1 group, 10 symbols | 5 groups, 50 symbols | 20 groups, 500 symbols | Unlimited |
| **Portfolios** | 1 | 3 | Unlimited | Unlimited |
| **Advisory Refreshes/month** | 3 | 10 | 25 | Unlimited |
| **Market Data Symbols** | 50 | 100 | All | All |
| **API Calls/day** | 1,000 | 10,000 | 100,000 | Custom |
| **Broker Integration** | ❌ | ✅ DNSE | ✅ DNSE | ✅ DNSE + Custom |
| **Whale Analytics** | ✅ (30min delay) | ✅ (5min delay) | ✅ (live) | ✅ (live) |
| **Support** | Community | Email | Email + Chat | Dedicated |
| **SLA Uptime** | 99.5% | 99.8% | 99.9% | 99.99% |

### 4.2 Rate Limiting Strategy

#### Per-Plan Quota (Daily Reset UTC 00:00)
```
Free:           1,000 API calls/day
Starter:       10,000 API calls/day
Pro:          100,000 API calls/day
Enterprise:   Custom (default 1,000,000)
```

#### Rate Limit Headers (Per Request)
```
X-RateLimit-Limit:       1000
X-RateLimit-Remaining:    234
X-RateLimit-Reset:   1715596800  (unix timestamp)
```

#### Quota Tracking Endpoint
```
GET /core/v1/partner/usage/meters/?period=day
→ {metric: "api_calls", value: 567, limit: 1000, percent_used: 56.7}
```

### 4.3 Feature Gate Implementation

#### In Request
```javascript
const response = await fetch('/core/v1/advisory/latest/VRE/', {
  headers: { 'Authorization': `Bearer ${pat}` }
});

if (response.status === 403) {
  // User not on plan with advisory feature
  // Propose upgrade
}
```

#### In Response Metadata
```json
{
  "data": {...},
  "meta": {
    "feature": "ai_advisory",
    "requires_plan": "starter",
    "current_plan": "free",
    "entitlement_status": "denied"
  }
}
```

---

## 5. Standardization Proposal for Subscribed Frontend Applications

### 5.1 Design Goals
1. **Uniform Contract**: All subscribed frontends consume the same core-API contract
2. **Secure Defaults**: No hardcoded credentials; all auth via PAT + tenant scoping
3. **Scalable Onboarding**: Template setup for new subscribers
4. **Clear Entitlements**: Feature gates transparent in API responses + client SDK
5. **Audit Trail**: Every API call logged per tenant for billing/compliance

### 5.2 Recommended Frontend Architecture Pattern

#### Layer 1: Core API Adapter (Standardized across all frontends)
```typescript
// packages/web/src/api/coreApiAdapter.ts
import axios from 'axios';

export class CoreApiAdapter {
  constructor(private baseURL: string, private pat: string) {
    this.client = axios.create({
      baseURL,
      headers: { 'Authorization': `Bearer ${pat}` }
    });
  }

  async login(username: string, password: string) {
    return this.client.post('/api/auth/login/', { username, password });
  }

  async fetchRealtimeTicker(symbol: string) {
    return this.client.get(`/api/realtime/ticker/${symbol}/`);
  }

  async fetchAdvisory(symbol: string, date?: string) {
    return this.client.get(`/core/v1/advisory/latest/${symbol}/`, {
      params: { date }
    });
  }

  // ... all other endpoints with strong typing
}

// Usage in any subscribed frontend:
const coreApi = new CoreApiAdapter(CORE_API_URL, userPAT);
const ticker = await coreApi.fetchRealtimeTicker('VRE');
```

#### Layer 2: Capability Guard Decorator
```typescript
// Wrapper to check plan entitlements before UI render
@RequiresCapability('ai_advisory')
@RequiresPlan(['pro', 'enterprise'])
export function AdvisoryPanel({ symbol }) {
  // Only renders if user has pro+ plan
}
```

#### Layer 3: Tenant Isolation (Automatic)
- Core API filters all responses by authenticated tenant
- No cross-tenant data leakage possible
- Client SDK inherits tenant context from PAT → no explicit tenant_id param needed

### 5.3 Integration Checklist for New Subscribed Frontend

```markdown
# Checklist: Onboarding New Frontend Subscriber to core-api

## Pre-Integration
- [ ] Register tenant in core-api admin panel
- [ ] Create service account for frontend integration
- [ ] Issue initial PAT (store securely, show once only)
- [ ] Assign plan/features (Starter, Pro, Enterprise)
- [ ] Configure rate limits and quota (if custom)

## Frontend Integration
- [ ] Import CoreApiAdapter from @vninvest/core-sdk (or implement per above)
- [ ] Replace all legacy backend calls with core-api equivalents
- [ ] Add capability guards for plan-gated features
- [ ] Wire error handlers for 401/403/429 responses
- [ ] Add loading states + retry logic for realtime data
- [ ] Test with sandbox/demo credentials first

## Deployment
- [ ] Set CORE_API_URL and CORE_API_PAT in env (`.env.production`)
- [ ] Enable HTTPS only (browsers reject http for Bearer auth)
- [ ] Verify CORS headers allow frontend domain
- [ ] Test API calls from deployed frontend
- [ ] Monitor 5xx errors in first 24 hours

## Ongoing
- [ ] Monitor PAT usage + quota/day in partner portal
- [ ] Rotate PAT every 90 days
- [ ] Subscribe to breaking change announcements
- [ ] Upgrade plan as feature usage grows
```

### 5.4 Versioning & Backwards Compatibility

#### Semantic Versioning
```
/core/v1/...        ← v1, stable for 12+ months, breaking changes announced 6mo ahead
/core/v2/...        ← v2 (future), side-by-side with v1 during transition
```

#### Deprecation Policy
1. **Announcement Phase** (Month 1-3):
   - Include `Deprecation: true` header in response
   - Log warning in client SDK
   - Publish migration guide in docs
   
2. **Support Phase** (Month 4-6):
   - Old endpoint still functional
   - New endpoint available in parallel
   - SDK defaults to new path
   
3. **Decommission Phase** (Month 7+):
   - Old endpoint returns 410 Gone
   - Full migration guide required

#### Example: Endpoint Evolution
```
2026-05 (v1.0):  GET /api/realtime/ticker/<symbol>/
                 GET /api/realtime/tickers/           ← new bulk variant

2026-08 (v1.1):  GET /core/v1/realtime/ticker/<symbol>/  ← prefer
                 GET /api/realtime/ticker/<symbol>/       ← deprecated

2026-11 (v1.2):  GET /core/v1/realtime/ticker/<symbol>/  ← only valid
                 GET /api/realtime/ticker/<symbol>/       ← 410 Gone
```

### 5.5 Client SDK Package (@vninvest/core-sdk)

#### Published NPM Package
```bash
npm install @vninvest/core-sdk@^1.0.0
```

#### Core Exports
```typescript
export { CoreApiAdapter } from './adapter';
export { CoreCapabilityGuard } from './guards';
export { CoreTenantContext } from './context';
export { CorePATManager } from './pat';
export { parseApiError, handleRateLimit } from './errors';
```

#### Usage Example
```typescript
import { CoreApiAdapter, CoreCapabilityGuard } from '@vninvest/core-sdk';

const api = new CoreApiAdapter(process.env.CORE_API_URL, pat);
const capabilities = new CoreCapabilityGuard(api);

// Check capability before rendering
if (await capabilities.has('ai_advisory')) {
  // Render advisory panel
}

// Automatic rate limit handling
try {
  await api.fetchRealtimeTicker('VRE');
} catch (err) {
  if (err.code === 'rate_limit_exceeded') {
    // Show "You've exceeded daily quota" message
    // Display retry-after countdown
  }
}
```

### 5.6 SLA & Support Model

#### Service Level Agreements (SLA)
```
Free:        99.5% uptime,   Best effort support
Starter:     99.8% uptime,   Email support (24-48h response)
Pro:         99.9% uptime,   Priority email + Slack (4-8h response)
Enterprise:  99.99% uptime,  Dedicated Slack channel + phone
```

#### Incident Response
- **P1** (API down): 30min response, 2h resolution target
- **P2** (Feature bug): 4h response, 24h resolution target
- **P3** (Minor issue): Best effort, SLA not guaranteed

#### Uptime Monitoring
```
GET /core/v1/health                      ← liveness check
GET /api/admin-ops/operator/health/      ← detailed health (admin only)
```

---

## 6. Implementation Roadmap

### Phase 1: API Catalog Finalization (May 2026)
- [x] Enumerate all endpoints by feature
- [x] Document contracts + response schemas
- [x] Define subscription tier matrix
- [ ] Publish OpenAPI 3.0 spec (`openapi.yaml`)
- [ ] Generate SDK type definitions from spec

### Phase 2: Standardization & SDK Package (June 2026)
- [ ] Create `@vninvest/core-sdk` NPM package
- [ ] Implement CoreApiAdapter + guards
- [ ] Publish to npm registry
- [ ] Write SDK documentation + examples

### Phase 3: Onboarding Automation (July 2026)
- [ ] Self-service tenant registration flow
- [ ] Auto-generate API keys per tenant
- [ ] Tenant dashboard with usage metrics
- [ ] Automated email with integration guide

### Phase 4: Ecosystem Expansion (Aug-Dec 2026)
- [ ] Partner with 3-5 frontend teams for beta
- [ ] Gather feedback + iterate
- [ ] Publish integration success stories
- [ ] Expand to adjacent use cases (mobile, CLI, webhook)

---

## 7. Quick Reference: API Discovery

### Curl Examples

#### Login & Get PAT
```bash
curl -X POST https://core-api.vninvest.com/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret"}'
# Response: {token: "vni_...", token_prefix: "vni_abc12345", tenant: {...}, user: {...}}
```

#### Fetch Realtime Ticker
```bash
curl https://core-api.vninvest.com/api/realtime/ticker/VRE/ \
  -H "Authorization: Bearer vni_abc12345def67890..."
# Response: {symbol: "VRE", price: "94.50", change_pct: 2.34, ...}
```

#### List Portfolios
```bash
curl https://core-api.vninvest.com/core/v1/workspace/portfolios/ \
  -H "Authorization: Bearer vni_..."
# Response: {results: [{portfolio_id: 1, name: "Main", ...}], cursor: "..."}
```

#### Check Capabilities
```bash
curl https://core-api.vninvest.com/core/v1/access/capabilities/ \
  -H "Authorization: Bearer vni_..."
# Response: {abilities: [{action: "read", subject: "Dashboard"}, ...], entitlements: {...}}
```

### SDK Quick Start (JavaScript/TypeScript)
```typescript
import { CoreApiAdapter } from '@vninvest/core-sdk';

const api = new CoreApiAdapter(
  'https://core-api.vninvest.com',
  'vni_abc12345def67890...'
);

// Fetch ticker
const ticker = await api.fetchRealtimeTicker('VRE');
console.log(ticker.data.price);  // "94.50"

// Fetch portfolio
const portfolios = await api.fetchPortfolios();
console.log(portfolios.data.results);  // [{portfolio_id: 1, ...}]

// Trigger advisory generation
const task = await api.refreshAdvisory('VRE');
console.log(task.data.task_id);  // "abc123..."
```

---

## 8. Next Steps for Teams

### For Core API Team
1. Generate OpenAPI 3.0 spec from Django views
2. Create SDK package structure
3. Document breaking changes policy in CHANGELOG
4. Set up automated integration testing with SDK

### For Frontend Teams
1. Evaluate CoreApiAdapter pattern
2. Plan legacy backend → core-api migration
3. Add capability guards to feature UI
4. Test with sandbox tenant credentials

### For DevOps / Platform
1. Configure CORS headers for subscribed domains
2. Set up rate limiting per plan
3. Create tenant onboarding automation
4. Monitor API call metrics per tenant + feature

### For Product/Commercial
1. Define support SLA tiers
2. Price feature add-ons (Whale Analytics, Broker Integration)
3. Create onboarding checklist for new partners
4. Plan API usage tiers (if applicable)

---

## 9. Appendix: Reference Documents

- **OpenAPI Spec**: (generated from Django schema) `docs/openapi.yaml`
- **SDK README**: `packages/core-sdk/README.md`
- **Breaking Changes Policy**: `docs/API_VERSIONING_POLICY.md`
- **Implementation Examples**: `examples/frontend-integration/`
- **Rate Limiting Guide**: `docs/RATE_LIMITING_GUIDE.md`

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-13  
**Author**: AI Engineering Team  
**Status**: Draft for Review
