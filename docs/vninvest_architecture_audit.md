# 🏗️ VNInvest — Báo Cáo Kiến Trúc & Kiểm Toán Toàn Diện

> **Ngày thực hiện:** 2026-05-28 | **Phạm vi:** Toàn bộ monorepo `vninvest` | **Phiên bản:** SaaS Native (packages/core + packages/web)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

### 1.1 Mô Hình Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VNINVEST PLATFORM                                     │
│                     (SaaS Multi-Tenant B2B/B2C)                                │
│                     (SaaS Multi-Tenant B2B/B2C)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT LAYER                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │   │
│  │  │  packages/web    │  │  mobile-app       │  │  opencore-site       │   │   │
│  │  │  React 18 SPA    │  │  React Native     │  │  Landing / Public    │   │   │
│  │  │  (SaaS shell)    │  │  (iOS + Android)  │  │  (packages/opencore) │   │   │
│  │  └────────┬─────────┘  └────────┬──────────┘  └──────────┬───────────┘   │   │
│  └───────────┼──────────────────────┼────────────────────────┼───────────────┘   │
│              │ HTTP + WebSocket      │ HTTP + WS              │ HTTP              │
│  ┌───────────▼──────────────────────▼────────────────────────▼───────────────┐   │
│  │                         NGINX REVERSE PROXY / Load Balancer                │   │
│  │                    (nginx-proxy + Let's Encrypt TLS)                       │   │
│  └──────────────┬──────────────────────────────────────────────────────────┘   │
│                 │                                                                 │
│     ┌───────────▼─────────────────────────────────────────────────────────┐     │
│     │                    API GATEWAY LAYER                                  │     │
│     │  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │     │
│     │  │    core-api (Port 8100)      │  │    backend (Port 8000)       │  │     │
│     │  │    Django 5.2 / DRF          │  │    Django (LEGACY - deprecated│  │     │
│     │  │    Daphne ASGI               │  │    Daphne ASGI + Channels)   │  │     │
│     │  │    /core/v1/* endpoints      │  │    /api/* endpoints           │  │     │
│     │  └──────────────┬───────────────┘  └──────────────┬───────────────┘  │     │
│     └─────────────────┼─────────────────────────────────┼──────────────────┘     │
│                       │                                   │                       │
│  ┌────────────────────▼───────────────────────────────────▼────────────────┐     │
│  │                    ASYNC WORKER LAYER (Celery)                           │     │
│  │  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │     │
│  │  │ core-worker-       │  │ core-worker-       │  │ core-worker-     │  │     │
│  │  │ realtime-prefetch  │  │ realtime-stream    │  │ enrichment       │  │     │
│  │  │ (Queue: 4 threads) │  │ (Queue: 4 threads) │  │ (Queue: 6/offhrs)│  │     │
│  │  ├────────────────────┤  ├────────────────────┤  ├──────────────────┤  │     │
│  │  │ core-worker-       │  │ core-worker-       │  │ core-beat        │  │     │
│  │  │ analytics          │  │ manual             │  │ (Scheduler)      │  │     │
│  │  │ (Queue: 4 threads) │  │ (Queue: 3 threads) │  │                  │  │     │
│  │  └────────────────────┘  └────────────────────┘  └──────────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                    DATA STORAGE LAYER                                   │     │
│  │  ┌─────────────────────┐  ┌──────────────────────────────────────────┐ │     │
│  │  │ PostgreSQL 16       │  │ Redis 7 (core-redis)                     │ │     │
│  │  │ (core-db)           │  │ DB/0: Celery broker                      │ │     │
│  │  │ DB: vninvest_core   │  │ DB/1: Stream events                      │ │     │
│  │  │ (SaaS canonical)    │  │ DB/2: HTTP cache layer                   │ │     │
│  │  ├─────────────────────┤  │ DB/3: Realtime prefetch + Channels       │ │     │
│  │  │ PostgreSQL 15       │  └──────────────────────────────────────────┘ │     │
│  │  │ (db)                │  ┌──────────────────────────────────────────┐ │     │
│  │  │ DB: vninvest        │  │ PgBouncer (connection pooling)           │ │     │
│  │  │ (LEGACY - deprecated│  │ Max: 500 clients / Pool: 20 connections  │ │     │
│  │  └─────────────────────┘  └──────────────────────────────────────────┘ │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                 MONITORING & OBSERVABILITY                               │     │
│  │  Prometheus (metrics) → Grafana (dashboards) | Redis Exporter          │     │
│  │  Sentry (error tracking) | Queue drain monitor                         │     │
│  │  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │              EXTERNAL DATA PROVIDERS                                    │     │
│  │  vnbroker (VCI/KBS/TCBS/SSI/MSI) → HOSE/HNX/UPCOM market data         │     │
│  │  DNSE LightSpeed API → Real-time ticks + Portfolio sync                 │     │
│  │  OpenAI / Anthropic / Custom LLM → AI Advisory                         │     │
│  │  Google OAuth 2.0 + Gmail API → Auth + Transactional email             │     │
│  │  └────────────────────────────────────────────────────────────────────────┘     │
│└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Phân Tầng Deployment

| Layer | Service | Container | Port | RAM Limit |
|-------|---------|-----------|------|-----------|
| Reverse Proxy | nginx-proxy + nginx-acme | External | 80/443 | — |
| Frontend | React SPA (packages/web) | vninvest-frontend | 80 | 750MB |
| Core API | Django 5.2 ASGI (SaaS native) | vninvest-core-api | 8100 | 256MB |
| Legacy API | Django (deprecated) | vninvest-backend | 8000 | 1500MB |
| Worker Realtime | Celery prefetch queue | core-worker-realtime-prefetch | — | 128MB |
| Worker Stream | Celery stream queue | core-worker-realtime-stream | — | 128MB |
| Worker Analytics | Celery analytics queue | core-worker-analytics | — | 128MB |
| Worker Enrichment | Celery enrichment queue | core-worker-enrichment | — | 128MB |
| Worker Manual | Celery manual queue | core-worker-manual | — | 128MB |
| Scheduler | Celery Beat | core-beat | — | 128MB |
| Cache/Broker | Redis 7 | vninvest-core-redis | 6379 | 512MB |
| Database SaaS | PostgreSQL 16 | vninvest-core-db | 5432 | 1GB |
| Database Legacy | PostgreSQL 15 | vninvest-db | 5432 | 2GB |
| Connection Pool | PgBouncer | vninvest-pgbouncer | 6432 | 64MB |
| Metrics | Prometheus | vninvest-prometheus | 9090 | 512MB |
| Dashboard | Grafana | vninvest-grafana | 3000 | 256MB |
| Queue Monitor | Redis Sidecar | queue-drain-monitor | — | 64MB |
| Redis Exporter | Prometheus adapter | redis-exporter | — | 64MB |
| Mail (dev) | Mailpit | vninvest-mailpit | — | — |

---

## 2. PHÂN RÃ CHỨC NĂNG CHI TIẾT (FUNCTIONAL DECOMPOSITION)

### 2.1 Sơ Đồ Domain Apps (packages/core/backend/src)

```
vninvest-core (SaaS Native Backend)
│
├── identity_access/          — IDENTITY & ACCESS DOMAIN
│   ├── CoreTenant            → Quản lý tenant (Free/Starter/Pro/Enterprise)
│   ├── CoreServiceAccount    → Service account cho B2B API
│   ├── CorePATCredential     → Personal Access Token (HMAC-SHA256)
│   ├── UserProfile           → Extended user settings (language/theme/threshold)
│   ├── TenantMember          → Multi-user tenant membership + roles
│   ├── TenantInvite          → Email invitation flow
│   ├── PasswordResetToken    → Secure password reset (DB-persisted)
│   ├── UserDNSECredential    → Fernet-encrypted DNSE credentials
│   └── SystemMailConfig      → Dynamic mail config (SMTP/Gmail API)
│   Views: auth, operator, onboarding, tenant-member, commercial-partner
│
├── commercial/               — COMMERCIAL & BILLING DOMAIN
│   ├── SubscriptionPlan      → Plan definitions + feature entitlements
│   ├── TenantSubscription    → Active subscription per tenant
│   └── UsageRecord           → API usage tracking
│   Views: plan management, subscription lifecycle
│
├── market_data/              — MARKET DATA DOMAIN
│   ├── StockProfile          → Static stock metadata (symbol, exchange, industry)
│   ├── DailyPrice            → OHLCV daily candles (canonical)
│   ├── IntradayBar           → Multi-timeframe intraday candles (1m-1M)
│   ├── IntradayTick          → Individual tick trades (short-lived staging)
│   ├── GlobalSymbolRegistry  → SSOT for all tracked symbols (tier: hot/warm/cold)
│   ├── GlobalSymbolDemandSource → Demand edges (watchlist/portfolio/alert/admin)
│   └── GlobalSymbolCoverage  → Freshness/coverage inventory per dataset
│   Services: vnbroker_adapter, global_symbol_coverage, global_symbol_planner
│
├── signal_intelligence/      — SIGNAL & ALERT DOMAIN
│   ├── UnifiedAlert          → Canonical alert (whale/dark_flow/signal/ai_alert)
│   ├── WhaleAlertCanonical   → Whale alert details (1-to-1 with UnifiedAlert)
│   ├── OrderFlowEvent        → Order flow signal events (CVD/imbalance)
│   ├── MarketAnomalyEvent    → Price shock / stale quote events
│   ├── AdvisorySignalEvent   → AI alert/suggest events
│   ├── UserAlertDelivery     → Per-user alert delivery state (seen/ack/muted)
│   └── UserAlertPreference   → Mute/cooldown preferences
│   Services: order_flow_engine, materializers, delivery_service
│
├── advisory/                 — AI ADVISORY DOMAIN
│   ├── WhaleAdvisory         → AI-generated advisory for symbols
│   └── Views: generate, refresh, history
│
├── user_workspace/           — USER WORKSPACE DOMAIN
│   ├── Portfolio             → Investment portfolio (tenant-isolated)
│   ├── Transaction           → Buy/Sell/Dividend transactions
│   ├── Watchlist             → Symbol watchlists (tenant-isolated)
│   ├── WatchlistItem         → Individual symbols in watchlist
│   ├── TrackedSymbol         → Actively tracked symbols + per-symbol thresholds
│   ├── PriceAlert            → Price threshold alerts (above/below/equal)
│   ├── SubAccount            → Broker sub-accounts (DNSE integration)
│   ├── DNSECredential        → Fernet-encrypted DNSE LightSpeed credentials
│   └── AccountSnapshot       → Daily account NAV snapshots
│   └── AccountSnapshot       → Daily account NAV snapshots
│
├── market_serving/           — MARKET SERVING DOMAIN
│   └── Stock management views, OHLCV serving, screener
│
├── data_ingest/              — DATA INGESTION DOMAIN
│   ├── Tasks: 105K LOC → realtime ingestion pipeline
│   ├── Models: scheduler configs, ingest tracking
│   └── Views: SOC Data Ops, backfill control
│
├── service_ops/              — SERVICE OPERATIONS (SOC)
│   └── /api/soc/* → replaces deprecated admin-ops
│
├── ops_audit/                — AUDIT & COMPLIANCE DOMAIN
│   └── Operator audit logs
│
├── tenant_lifecycle/         — TENANT LIFECYCLE DOMAIN
│   └── Trial expiry, plan transitions, billing events
│
└── vninvest_core/            — CONFIG & INFRASTRUCTURE
    ├── settings.py           → 27KB settings file
    ├── urls.py               → Master URL routing
    ├── celery.py             → Celery configuration
    ├── queue_policy.py       → Queue routing policy
    ├── pagination.py         → Standardized pagination
    ├── exceptions.py         → Typed error catalog
    └── monitoring/           → Health + metrics endpoints
```

### 2.2 Phân Rã Chức Năng Frontend (packages/web/src)

```
packages/web (SaaS Shell - React 18)
│
├── adapters/
│   ├── coreApiAdapter.js     → Unified adapter for core-api calls
│   ├── core/                 → Core-API specific adapters
│   └── vip-app/              → VIP app specific adapters
│
├── app/
│   ├── routeCatalog.js       → Route definitions (SPA routing)
│   └── navigationCatalog.js  → Navigation structure
│
├── config/
│   └── buildTarget.js        → Build target (community/vip/enterprise)
│
└── context/
    ├── bootstrapClient.js    → Client bootstrap + config
    ├── authRuntime.js        → Auth state runtime
    └── authReact.js          → React auth context
```

### 2.3 Legacy Frontend (frontend/ - DEPRECATED)

```
frontend/ (React CRA - sẽ bị xóa)
├── Dashboard           → Portfolio overview, heatmap, alert center
├── StockDetail         → KLineChart + CVD + whale bubbles
├── Watchlist           → Multi-group watchlist + realtime feed
├── WhaleAlerts         → Global whale alert feed + filtering
├── WhaleAdvisory       → AI advisory per symbol
├── Portfolio           → Transaction management
├── Analytics           → Sharpe/Sortino/Drawdown/TWR
├── AdminOps            → Deprecated → 410 GONE
└── SOC (Signal Ops Center) → Screener admin, data ops, config
```

### 2.4 Celery Queue Architecture

```
5 Dedicated Queues (Priority-Segregated):
┌────────────────────────────────────────────────────────────────┐
│ Queue: realtime_prefetch  (Priority: HIGHEST)                   │
│ → Ticker cache warm, intraday snapshot, 5s polling cycle        │
├────────────────────────────────────────────────────────────────┤
│ Queue: realtime_stream    (Priority: HIGH)                       │
│ → WebSocket event publishing, tick stream processing            │
├────────────────────────────────────────────────────────────────┤
│ Queue: manual_on_demand   (Priority: MEDIUM)                    │
│ → User-triggered backfill, AI advisory refresh, export          │
├────────────────────────────────────────────────────────────────┤
│ Queue: analytics_heavy    (Priority: LOW)                       │
│ → Portfolio analytics, CVD computation, historical analysis     │
├────────────────────────────────────────────────────────────────┤
│ Queue: enrichment_offhours (Priority: LOWEST)                   │
│ → Off-peak daily price backfill, stock profile sync             │
└────────────────────────────────────────────────────────────────┘

Celery Beat Schedules:
• Every 5s  → Realtime tick collector (vnbroker)
• Every 1m  → Prefetch cache refresh (hot tier)
• Every 5m  → Warm tier data sync
• Every 1h  → Coverage gap planner run
• Daily     → Full market data backfill + stock profile sync
• Weekly    → Tier promotion/demotion + cleanup
```

---

## 3. SƠ ĐỒ QUAN HỆ DỮ LIỆU (ERD)

### 3.1 Core Identity & Tenant Domain

```
Django.User (auth)
│   ├── 1:1 → UserProfile (language, theme, whale_threshold)
│   ├── 1:1 → CoreTenant (owner_user) [tenant của user này sở hữu]
│   ├── 1:1 → UserDNSECredential (api_key_encrypted, api_secret_encrypted)
│   ├── 1:1 → DNSECredential [user_workspace] (client_id_cipher)
│   ├── M:M → CoreTenant (through TenantMember)
│   ├── 1:N → TenantInvite (inviter/invited_user)
│   ├── 1:N → UserAlertDelivery
│   ├── 1:N → UserAlertPreference
│   ├── 1:N → PasswordResetToken (expires 1h)
│   └── 1:N → Portfolio, Watchlist, TrackedSymbol, PriceAlert
 
CoreTenant (plan: free/starter/pro/enterprise)
│   ├── status: active/trial/suspended/deprovisioned/pending
│   ├── features: JSONField (feature flags)
│   ├── 1:N → CoreServiceAccount
│   ├── 1:N → TenantMember (role: owner/admin/editor/viewer)
│   ├── 1:N → TenantInvite
│   ├── 1:N → UserProfile
│   ├── 1:N → Portfolio, Watchlist, TrackedSymbol, PriceAlert
│   ├── 1:N → GlobalSymbolDemandSource
│   └── 1:1 → TenantSubscription [commercial]
 
CoreServiceAccount
│   ├── tenant → CoreTenant
│   ├── scopes: JSONField
│   └── 1:N → CorePATCredential (token_prefix + HMAC-SHA256 hash)
```

### 3.2 Market Data Domain

```
StockProfile (symbol UNIQUE)
│   ├── exchange: HOSE/HNX/UPCOM/UNLISTED
│   ├── industry, status, outstanding_shares
│   └── Tham chiếu bởi: DailyPrice, IntradayBar, IntradayTick, GlobalSymbolRegistry

DailyPrice (symbol + date UNIQUE)
│   ├── OHLCV + value + change_pct
│   ├── source: vnbroker
│   └── is_adjusted: bool

IntradayBar (symbol + datetime + timeframe UNIQUE)
│   ├── timeframe: 1m/5m/15m/1H/2H/4H/D/W/M
│   └── OHLCV data

IntradayTick (high-volume, short-lived)
│   ├── timestamp, price, volume, side: BUY/SELL
│   └── source, match_type

GlobalSymbolRegistry (symbol UNIQUE - SSOT)
│   ├── is_active: bool
│   ├── current_priority_tier: hot/warm/cold/recovery
│   ├── priority_score, demand_source_count
│   ├── freshness_state_summary, coverage_state_summary
│   ├── 1:N → GlobalSymbolDemandSource
│   └── 1:N → GlobalSymbolCoverage (per dataset)

GlobalSymbolDemandSource
│   ├── registry → GlobalSymbolRegistry
│   ├── source_type: system_default/admin_group/holding/watchlist/tracked/alert
│   ├── tenant → CoreTenant (nullable)
│   ├── user → Django.User (nullable)
│   └── weight: float (demand pressure score)

GlobalSymbolCoverage (registry + dataset UNIQUE)
│   ├── dataset: daily_prices/price_board_snapshot/intraday_bars/ticks/session_facts
│   ├── freshness_state: fresh/warm/stale/missing/error/unknown
│   ├── gap_score, gap_days, missing_ranges: JSONField
│   └── priority_reason, demand_source
```

### 3.3 Signal Intelligence Domain

```
UnifiedAlert (alert_id UUID)
│   ├── alert_type: whale/dark_flow/signal/system/ai_alert/ai_suggest
│   ├── symbol, session_date, triggered_at
│   ├── severity: critical/high/medium/low
│   ├── confidence: float
│   ├── freshness_state: fresh/warm/stale
│   ├── evidence: JSONField
│   ├── 1:1 → WhaleAlertCanonical (whale details)
│   ├── 1:N → OrderFlowEvent
│   ├── 1:N → MarketAnomalyEvent (price_shock/stale_quote)
│   ├── 1:N → AdvisorySignalEvent (ai_alert/ai_suggest)
│   └── 1:N → UserAlertDelivery

WhaleAlertCanonical (PK = alert.pk)
│   ├── side: BUY/SELL
│   ├── price, volume, matched_value (triệu VNĐ)
│   ├── is_dark_flow: bool
│   └── executed_at

OrderFlowEvent
│   ├── signal_type: whale_buy/whale_sell/dark_flow/order_imbalance/cvd_divergence
│   ├── strength, whale_intensity, cvd_at_signal
│   └── unified_alert → UnifiedAlert (nullable FK)

UserAlertDelivery (user + alert UNIQUE)
│   ├── delivery_state: new/seen/acknowledged/muted/suppressed
│   └── suppression_reason, metadata

UserAlertPreference (user + symbol + alert_family UNIQUE)
│   ├── mute_until: datetime
│   ├── cooldown_seconds: int
│   └── channel_policy: JSONField
```

### 3.4 User Workspace Domain

```
Portfolio (user + tenant)
│   ├── name, description, is_default
│   ├── 1:N → Transaction (BUY/SELL/DIVIDEND)
│   └── 1:N → SubAccount (broker sub-accounts)

Transaction
│   ├── portfolio → Portfolio
│   ├── tenant → CoreTenant
│   ├── symbol, transaction_type, date, price, quantity
│   └── fee, tax, external_id (broker ref)

Watchlist (user + tenant)
│   ├── name, is_default
│   ├── 1:N → WatchlistItem (symbol + note)
│   └── 1:N → TrackedSymbol (via source_watchlist)

TrackedSymbol (user UNIQUE symbol)
│   ├── tenant → CoreTenant
│   ├── source_watchlist → Watchlist (nullable)
│   ├── whale_alert_threshold_million (per-symbol override)
│   └── is_active, is_stale

PriceAlert (user + tenant)
│   ├── symbol, alert_type: ABOVE/BELOW/EQUAL
│   ├── price_threshold, status: ACTIVE/TRIGGERED/EXPIRED/DISABLED
│   └── notify_email/sms/push

SubAccount (user + tenant)
│   ├── portfolio → Portfolio
│   ├── broker, account_number, type: CASH/MARGIN/SPECIAL
│   ├── external_id (DNSE account ID)
│   └── 1:N → AccountSnapshot (daily NAV)

DNSECredential (user 1:1)
│   ├── client_id_cipher, client_secret_cipher (Fernet-encrypted)
│   └── is_active, last_sync_at
```

---

## 4. API ROUTING & CONTRACT

### 4.1 Core API Endpoints (packages/core - /core/v1/*)

| Namespace | Path Prefix | Chức Năng |
|-----------|-------------|-----------|
| identity_access | /core/v1/ | Auth, user, tenant management |
| identity_access_partner | /core/v1/ (partner) | B2B partner API |
| market_serving | /core/v1/ | Stock data serving, screener |
| signal_intelligence | /core/v1/ | Alert feed, order flow |
| commercial | /core/v1/ | Plans, subscriptions |
| ops_audit | /core/v1/ | Operator audit logs |
| operator | /core/v1/operator/ | Internal operator panel |
| advisory | /core/v1/ | AI advisory generation |
| user_workspace | /core/v1/ | Portfolio, watchlist |
| market_data | /core/v1/ (+ /api/) | OHLCV data, global matrix |
| data_ingest | /core/v1/ | Ingest control |
| service_ops | /api/soc/ | SOC Config UI (replaces admin-ops) |
| ~~admin-ops~~ | /api/admin-ops/\* | **410 GONE (decommissioned)** |

### 4.2 Realtime Pipeline

```
vnbroker API (5 providers: VCI/KBS/TCBS/SSI/MSI)
    ↓ Celery Worker (realtime_prefetch queue, 5s cycle)
    ↓ Pandas vectorized compute
    ↓ VWAP computation + Whale detection + CVD calculation
    ↓ Redis DB/1 (Stream events pub/sub)
    ↓ Django Channels consumer
    ↓ WebSocket → Frontend (useRealtimeFeed hook)
         ├── Dashboard (alert strip, market breadth)
         ├── Watchlist (live prices)
         └── StockDetail (realtime quote, live chart)

HTTP Fallback path:
    GET /api/realtime/ticker/{symbol}/ → Redis DB/3 (prefetch cache)
    Expected p95 < 50-60ms
```

---

## 5. PHÁT HIỆN GAP VÀ BẤT CẬP

### 5.1 🔴 CRITICAL GAPS (Blockers cho thương mại hóa)

#### GAP-01: Dual Database Architecture - Chưa hoàn thành Migration

* **Vấn đề**: Hệ thống đang chạy song song 2 PostgreSQL instance:
  - `vninvest` (PostgreSQL 15, legacy) — vẫn đang active production
  - `vninvest_core` (PostgreSQL 16, SaaS native) — đang migration
* **Tác động**:
  - Memory overhead: 2 DB + 2 Django backends = ~3.5GB RAM trên production
  - Inconsistency risk: Dữ liệu có thể lệch nhau giữa 2 DB
  - PgBouncer chỉ pool cho legacy DB, core-db chưa có pooler riêng
  - `tenant` FK trong Portfolio/Watchlist/TrackedSymbol là `null=True, blank=True` — vi phạm tenant isolation rule
* **Giải pháp**:
  1. Hoàn thành data migration legacy → core canonical tables
  2. Thêm PgBouncer riêng cho core-db
  3. Set `tenant` FK = NOT NULL sau khi migration hoàn tất
  4. Shutdown backend container sau cutover

---

#### GAP-02: Không Có Payment Gateway / Billing Engine

* **Vấn đề**: `commercial/` app chỉ có plan definitions + subscription records. Không có:
  - Payment processing (VNPay/Stripe/MoMo)
  - Invoice generation
  - Revenue recognition
  - Automatic plan upgrade/downgrade
  - Grace period handling
  - Dunning management
* **Tác động**: Không thể thu tiền từ khách hàng. Mọi plan hiện tại là manual assignment.
* **Giải pháp**:
  1. Tích hợp VNPay (nội địa) + Stripe (global)
  2. Triển khai billing webhook processor
  3. Celery task: auto-downgrade khi thanh toán thất bại
  4. Tạo Invoice PDF bằng WeasyPrint/ReportLab

---

#### GAP-03: Không Có Notification Center / Push Notification

* **Vấn đề**: `UserAlertDelivery` và `UserAlertPreference` model đã có, nhưng:
  - Không có email notification pipeline cho price alerts
  - Không có push notification (mobile/browser)
  - Không có in-app notification center UI
  - SMS notification field có nhưng không có implementation
* **Tác động**: Alert chỉ hiển thị khi user đang online (WebSocket). Không có outbound delivery.
* **Giải pháp**:
  1. Email pipeline: Celery task → SystemMailConfig → SMTP/Gmail API
  2. Push: Firebase Cloud Messaging cho mobile app
  3. WebPush API cho browser
  4. In-app notification bell với unread count

---

#### GAP-04: Thiếu Rate Limiting & Abuse Protection ở API Layer

* **Vấn đề**: `django-ratelimit` đã installed nhưng:
  - Không thấy `@ratelimit` decorators trên sensitive endpoints
  - Không có DDoS protection tầng Nginx
  - Không có account lockout sau nhiều login fail
  - AI Advisory endpoint có thể bị lạm dụng → chi phí LLM API không kiểm soát
* **Tác động**: API có thể bị abuse → unexpected cost spike, service degradation.

---

#### GAP-05: Test Coverage Quá Thấp

* **Vấn đề**:
  - Codebase có 100+ nghìn LOC nhưng test rất sparse
  - `data_ingest/tasks.py` = 105,911 bytes (critical pipeline) — coverage không rõ
  - `market_data/stock_mgmt_native_views.py` = 180,027 bytes — largest single file, vi phạm anti-fat-file rule (>1000 lines)
  - Không có integration test suite tự động chạy trên CI
  - Không có load testing baseline cho 10K concurrent users
* **Tác động**: Regression risk rất cao khi thay đổi core pipeline.

---

### 5.2 🟠 MAJOR GAPS (Ảnh hưởng đến chất lượng thương mại)

#### GAP-06: AI Advisory - Thiếu Cost Control & Provider Abstraction

* **Vấn đề**:
  - Không có spending cap / budget alert per tenant
  - Provider API key lưu trong UserConfig (legacy) chưa được migrate sang core model
  - Không có LLM response caching (identical prompts gọi API nhiều lần)
  - Không có fallback khi LLM provider down
* **Giải pháp**:
  1. Per-tenant token budget với hard cap
  2. Semantic caching với Redis (hash prompt → cache response 24h)
  3. Provider failover chain: Primary → Fallback → Static template
  4. Cost dashboard trong SOC Config UI

---

#### GAP-07: Thiếu Full-Text Search & Screener Engine

* **Vấn đề**:
  - Screener hiện tại là rule-based SQL filtering
  - Không có full-text search trên stock profiles, advisories
  - Không có saved screener templates per user
  - Screener chưa có backtesting integration
* **Giải pháp**:
  1. PostgreSQL full-text search (tsvector + gin index) cho stock profiles
  2. Saved screener templates với version history
  3. Backtesting API tích hợp historical price data

---

#### GAP-08: Data Ingest - Single Provider Dependency & No Failover

* **Vấn đề**:
  - `vnbroker` là external private package từ GitHub → single point of failure
  - Nếu vnbroker API down: realtime pipeline đứng hoàn toàn
  - Không có circuit breaker pattern
  - 5 provider sources (VCI/KBS/TCBS/SSI/MSI) nhưng chưa có automatic failover
* **Giải pháp**:
  1. Circuit breaker với `tenacity` library
  2. Provider health monitoring + automatic failover
  3. Offline mode: serve từ cache khi all providers down
  4. Cache-first strategy với TTL validation

---

#### GAP-09: Mobile App - Chưa Production Ready

* **Vấn đề**:
  - `mobile-app/` tồn tại nhưng không có trong Docker production stack
  - Không có CI/CD pipeline cho mobile (App Store / Google Play)
  - Không có code signing setup
  - OTA update mechanism chưa có (Expo/CodePush)

---

#### GAP-10: Không Có Audit Log UI / Compliance Dashboard

* **Vấn đề**:
  - `ops_audit/` app có model nhưng:
  - Không có searchable audit log UI cho operator
  - Không có GDPR-compliant data export (right to data portability)
  - Không có data retention policy implementation
  - Không có PII anonymization pipeline

---

### 5.3 🟡 MINOR GAPS (Ảnh hưởng UX/DX)

#### GAP-11: i18n Chưa Hoàn Chỉnh

* **Vấn đề**: Nhiều component vẫn hardcode tiếng Việt/tiếng Anh, date/number formatting chưa nhất quán.

#### GAP-12: Không Có API Versioning Strategy

* **Vấn đề**: `/core/v1/` là version prefix nhưng không có deprecation notice mechanism hoặc breaking change detection.

#### GAP-13: Thiếu WebSocket Authentication Refresh

* **Vấn đề**: JWT token expire → WebSocket connection drop → user cần reload page.

#### GAP-14: Performance: N+1 Query Risk

* **Vấn đề**: Portfolio analytics views query price từng symbol một mà không sử dụng `select_related` hoặc `prefetch_related` thích hợp.

#### GAP-15: Secret Management

* **Vấn đề**: Nhiều secrets trong environment variables thay vì HashiCorp Vault hoặc AWS Secrets Manager.

---

## 6. ĐỀ XUẤT GIẢI PHÁP NÂNG CẤP

### 6.1 🚀 PHASE A: Production Hardening (4-6 tuần)

#### A1: Hoàn Thành Database Migration Cutover
1. Set tenant FK = NOT NULL trên tất cả user-scoped models.
2. Deploy PgBouncer riêng cho core-db.
3. Chạy script xác thực data migration.
4. Cutover legacy backend → 410 GONE.
5. Decommission vninvest-db container.

#### A2: API Rate Limiting & Security Hardening
Áp dụng `@ratelimit` decorators theo user plan tier và thiết lập rate limit tầng Nginx.

#### A3: Critical Path Test Coverage
Tăng coverage lên 70-85% trên các path quan trọng như `data_ingest/tasks.py`, `market_data` views, và `signal_intelligence` materializers.

#### A4: Refactor Fat Files
Phân tách các file lớn như `market_data/stock_mgmt_native_views.py` và `data_ingest/tasks.py` thành các module nhỏ hơn < 700 dòng.

---

### 6.2 💳 PHASE B: Revenue Engine (6-8 tuần)

#### B1: Payment Gateway Integration
Tích hợp VNPay (trong nước) và Stripe (quốc tế) cùng với các thực thể `PaymentIntent`, `Invoice`, và `PaymentMethod`.

#### B2: Subscription Lifecycle Automation
Sử dụng Celery Beat để tự động kiểm tra hết hạn dùng thử, gia hạn định kỳ và dunning sequence.

---

### 6.3 🔔 PHASE C: Notification & Engagement (4-6 tuần)

#### C1: Notification Pipeline
Xây dựng pipeline gửi tin đa kênh (Email SMTP/Gmail API, WebPush, và Firebase FCM cho mobile).

#### C2: In-App Notification Center
Xây dựng chuông thông báo hiển thị số lượng chưa đọc, bộ lọc và cấu hình tùy chọn kênh gửi của người dùng.

---

### 6.4 📊 PHASE D: Analytics & Intelligence Upgrade (8-10 tuần)

#### D1: Portfolio Analytics V2
Thêm các chỉ số tài chính nâng cao: Value at Risk (VaR), Expected Shortfall (CVaR), Beta vs VN-Index, Information Ratio, và chỉ số tập trung ngành HHI.

#### D2: AI Advisory Upgrade
Triển khai Semantic Cache Layer bằng Redis, Structured JSON Output, và mô hình RAG tích hợp tin tức từ `opennews-main`.

#### D3: Smart Screener Engine
Cho phép lưu template screener, chạy quét định kỳ và gửi cảnh báo khi có cổ phiếu khớp điều kiện lọc.

---

### 6.5 🏢 PHASE E: Enterprise Features (10-12 tuần)

#### E1: Multi-User Tenant Features
Chia sẻ danh mục đầu tư và watchlist ở cấp độ Tenant cùng với phân quyền role-based.

#### E2: Data Export & Reporting
Hỗ trợ xuất báo cáo PDF (WeasyPrint) và Excel (openpyxl), đảm bảo tuân thủ quyền xuất/xóa dữ liệu cá nhân theo GDPR.

#### E3: B2B Partner API
Triển khai OAuth 2.0 Client Credentials flow phục vụ kết nối machine-to-machine, phân quyền API keys và partner dashboard.

---

## 7. KIẾN TRÚC MỤC TIÊU (TARGET ARCHITECTURE)

### 7.1 Hệ Thống Sau Nâng Cấp

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VNINVEST PLATFORM v2.0 (TARGET)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLIENT LAYER                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────────────┐ │
│  │  Web SPA     │ │  Mobile App  │ │  Partner   │ │   OpenCore           │ │
│  │  React 18    │ │  RN + Expo   │ │  API SDK   │ │  (community)         │ │
│  └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ └──────────────────────┘ │
│         │                │                │                                  │
│  API GATEWAY (Nginx + WAF + Rate Limiting)                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Core API v1 → v2 (breaking changes deprecation 6 months notice)      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  DOMAIN SERVICES (Single DB, single Redis, 6 queues)                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Identity   │ │ Market     │ │ Signal     │ │ Advisory   │               │
│  │ + Billing  │ │ Data       │ │ Intelligence│ │ + LLM      │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Workspace  │ │ Data       │ │ Notification│ │ Analytics  │               │
│  │ Portfolio  │ │ Ingest     │ │ + Delivery │ │ + Reports  │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│                                                                              │
│  DATA LAYER                                                                  │
│  ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐                 │
│  │ PostgreSQL 16   │ │ Redis Cluster │ │ Object Storage  │                 │
│  │ + PgBouncer     │ │ (3 nodes HA)  │ │ (PDF/Export)    │                 │
│  │ + Read Replica  │ │               │ │                 │                 │
│  └─────────────────┘ └───────────────┘ └─────────────────┘                 │
│                                                                              │
│  OBSERVABILITY                                                               │
│  Prometheus + Grafana + Sentry + Structured Logging (JSON)                  │
│  + OpenTelemetry traces + Synthetic monitoring                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Roadmap Ưu Tiên

| Priority | Phase | Timeline | Business Impact | Effort |
|----------|-------|----------|-----------------|--------|
| P0 | DB Migration Cutover | 2 tuần | Tiết kiệm chi phí, ổn định | Medium |
| P0 | API Security Hardening | 2 tuần | Bảo mật hệ thống | Low |
| P0 | Test Coverage Sprint | 4 tuần | Đảm bảo an toàn regression | High |
| P0 | Fat File Refactor | 2 tuần | Dễ dàng bảo trì | Medium |
| P1 | Payment Gateway | 6 tuần | Mở khóa dòng doanh thu | High |
| P1 | Notification Pipeline | 4 tuần | Tăng tương tác người dùng | Medium |
| P1 | AI Advisory Cost Control | 2 tuần | Quản lý chi phí vận hành | Low |
| P2 | Mobile App Production | 6 tuần | Mở rộng thị trường di động | High |
| P2 | Smart Screener | 6 tuần | Tạo lợi thế cạnh tranh | High |
| P2 | Enterprise SSO | 4 tuần | Phục vụ khách hàng B2B | Medium |
| P3 | Portfolio Analytics V2 | 8 tuần | Tính năng cao cấp | High |
| P3 | B2B Partner API | 6 tuần | Xây dựng hệ sinh thái | Medium |

---

## 8. ĐIỂM MẠNH ĐANG CÓ CẦN GIỮ VÀ PHÁT HUY

1. **Thiết kế hướng Domain (DDD) tốt**: Phân chia 9 bounded contexts rõ ràng.
2. **Hệ thống Celery đa queue**: Segregate luồng xử lý theo độ ưu tiên.
3. **Global Symbol Registry SSOT**: Quản lý nhu cầu dữ liệu theo tier (hot/warm/cold).
4. **PAT Authentication bảo mật**: Cơ chế hashing HMAC-SHA256 chuẩn chỉ.
5. **Mã hóa Fernet**: Bảo vệ dữ liệu nhạy cảm của người dùng (DNSE credentials).
6. **Spectacular OpenAPI**: Tự động sinh tài liệu API chính xác.
7. **PgBouncer**: Tối ưu kết nối database khi scale-up.
8. **Observability Stack**: Tích hợp Prometheus + Grafana sẵn sàng cho vận hành.
9. **CI Anti-Fat-File rule**: Đảm bảo duy trì chất lượng code.
10. **Multi-provider**: Thiết kế vnbroker linh hoạt với failover.

---

## 9. ĐIỂM BENCHMARK VỚI PHẦN MỀM CHỨNG KHOÁN ĐẲNG CẤP

| Tiêu chí | VNInvest Hiện tại | Bloomberg/Refinitiv | FireAnt/SSI iPlus | Đánh giá Gap |
|----------|-------------------|---------------------|-------------------|--------------|
| Realtime data | Polling 5s | Streaming < 500ms | Streaming < 1s | Cần nâng cấp WebSocket |
| Whale alerts | Rule-based | N/A | Cơ bản | Tốt, cần AI-enhanced |
| AI Advisory | Multi-LLM | Cơ bản | N/A | Điểm cộng lớn |
| Portfolio analytics| Cơ bản | Nâng cao | Trung bình | Cần bổ sung VaR/Beta |
| Payment | Chưa có | Enterprise billing | VNPay | Yêu cầu tích hợp gấp |
| Mobile | Đang phát triển | Đầy đủ | Đầy đủ | Cần đưa vào vận hành |
| Notification | Chưa có | Đầy đủ | Chỉ Email | Cần bổ sung đa kênh |
| B2B API | Khung xương | Nâng cao | N/A | Cơ hội doanh nghiệp |
| Screener | Cơ bản | 100+ chỉ số | 20+ chỉ số | Cần nâng cấp bộ lọc |
| Compliance/Audit | Một phần | Đầy đủ | Một phần | Cần compliance log |
| Test coverage | Thấp | Cao | Không rõ | Rủi ro kỹ thuật cao |

---

## 10. KẾT LUẬN & ĐỀ XUẤT EXECUTIVE

Hệ thống VNInvest hiện sở hữu nền tảng kiến trúc **đúng hướng** và vững chắc cho mô hình SaaS Multi-tenant. Tuy nhiên, để chính thức thương mại hóa thành công sản phẩm đẳng cấp, đề xuất ưu tiên xử lý các cấu phần theo lộ trình:

1. **Hành động ngay (0-4 tuần)**: Hoàn thành DB migration cutover để giải phóng tài nguyên, bật rate limiting, tăng test coverage cho các luồng xử lý core, và tiến hành refactor các file cồng kềnh.
2. **Ngắn hạn (1-3 tháng)**: Tích hợp cổng thanh toán (VNPay), xây dựng pipeline thông báo đa kênh và tối ưu hóa chi phí AI.
3. **Trung hạn (3-6 tháng)**: Vận hành app di động, nâng cấp bộ lọc Screener v2, hoàn thiện phân tích danh mục V2 và cung cấp cổng Partner API cho B2B.
