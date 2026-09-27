# ĐỀ XUẤT NÂNG CẤP HỆ THỐNG QUẢN LÝ PORTFOLIO MẠNH THƯƠNG MẠI

**Ngày:** 2026-09-27  
**Phạm vi:** Toàn bộ hệ thống portfolio management (Danh mục / Broker Hub / Ledger / Analytics / Risk)  
**Trạng thái đề xuất:** CHO PHÉP NGHIÊN CỨU — chờ quyết định triển khai  
**Baseline:** `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (Rev.2, 52 slice / 9 wave, APPROVED)  
**Audit nền:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` (36 findings, P0×10 / P1×14 / P2×8 / P3×4)  

---

## PHẦN I: THỰC TRẠNG HỆ THỐNG

### 1.1 Hệ thống hiện tại đang hoạt động

Hệ thống portfolio management trong `vninvest` hiện tại đã có **kernel cơ bản** hoạt động:

| Lĩnh vực | Trạng thái | Chi tiết |
|-----------|-----------|----------|
| **Portfolio CRUD** | ✅ Hoạt động | Tạo/đọc/cập nhật/xóa danh mục; `Portfolio` model có `user + tenant` FK |
| **Transaction** | ✅ Hoạt động | BUY/SELL/DIVIDEND, weighted-average cost, `external_id` idempotency |
| **Holdings tính toán** | ⚠️ Có nhưng sai | `_compute_holdings()` clamp oversell, bỏ dividend, không trừ phí/thuế bán |
| **Equity curve** | ✅ Có | 365 ngày NAV, `PortfolioEquityCurveView` |
| **Allocation** | ✅ Có | Symbol weight breakdown |
| **Watchlist** | ✅ Hoạt động | CRUD + tracked symbols + groups |
| **Price alerts** | ✅ Hoạt động | ABOVE/BELOW/EQUAL, cooldown |
| **Screener** | ✅ Hoạt động | Rules, schedules, public/fork, history |
| **Broker integration** | ⚠️ FAIL-OPEN | DNSE `dry_run=False` mặc định; SSI/TCBS auth incomplete |
| **i18n** | ⚠️ Partial | `portfolioManagement` namespace có 30+ keys nhưng `PortfoliosPage.tsx` hardcode VI |
| **Tenant isolation** | ❌ Broken | Analytics chỉ filter user; 2 resolver; FE/BE storage mismatch |
| **NAV** | ❌ null | `nav: null` trong response — không có opening balance |
| **Performance (TWR/MWR)** | ❌ Không có | Chỉ có i18n key, không compute |
| **Risk (VaR/drawdown)** | ❌ Không có | Không có model hay compute |
| **Benchmark (VN30)** | ❌ Không có | Chỉ có key i18n |
| **Real-time portfolio** | ❌ Polling 5s | Không có WebSocket/SSE cho positions/P&L |
| **Paper trading** | ❌ Không có | Không có engine hay order ticket |
| **Live trading** | ❌ Blocked | `vnbroker` license chưa ký; legal blocker |

### 1.2 So sánh với hệ thống thương mại

| Tính năng | Bloomberg Terminal | Refinitiv Eikon | TradingView | Datadog | **vninvest hiện tại** | **Target (plan)** |
|-----------|-------------------|-----------------|-------------|---------|----------------------|-------------------|
| Real-time data | ✅ | ✅ | ✅ | ✅ | ✅ (SSI, vnbroker) | ✅ + freshness SLA |
| Charting | ✅ Advanced | ✅ Advanced | ✅ | N/A | ✅ vninvestcharts-widget | ✅ + lazy-load widget |
| Portfolio CRUD | ✅ Full | ✅ Full | ✅ Basic | N/A | ✅ Basic (1 page) | ✅ Workspace 4 pages |
| Holdings/P&L | ✅ Real-time | ✅ Real-time | ✅ | N/A | ⚠️ Wrong algorithm | ✅ Ledger-based |
| Equity curve | ✅ | ✅ | ✅ | N/A | ✅ 365 days | ✅ + benchmark overlay |
| Allocation | ✅ Sector/asset | ✅ | ✅ | N/A | ✅ Symbol | ✅ + sector + custom |
| **Performance (TWR/MWR)** | ✅ | ✅ | ❌ | N/A | ❌ | ✅ Wave 2 |
| **Risk (VaR/Drawdown)** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ Wave 2 |
| **Benchmark (VN30/VN100)** | ✅ | ✅ | ✅ | N/A | ❌ | ✅ Wave 2 |
| Alert system | ✅ Advanced | ✅ Advanced | ✅ | ✅ | ✅ Alert Center | ✅ + portfolio-specific |
| Screener | ✅ | ✅ | ✅ Pine Script | N/A | ✅ Rules + schedules | ✅ + AI scoring |
| Broker integration | ✅ | ✅ | ❌ | N/A | ⚠️ Fail-open | ✅ Async + reconciliation |
| Paper trading | ❌ | ❌ | ✅ Paper | N/A | ❌ | ✅ Wave 3 |
| Live trading | ✅ | ✅ | ✅ | N/A | ❌ Blocked | ✅ Wave 4 (conditional) |
| **News integration** | ✅ | ✅ | ✅ | N/A | ❌ | ✅ Wave 2 |
| **Sentiment analysis** | ✅ | ✅ | ❌ | N/A | ❌ | ✅ Wave 3 |
| **Multi-tenant/RBAC** | ✅ Enterprise | ✅ Enterprise | ✅ | ✅ Teams | ⚠️ Broken | ✅ Wave 1 |
| **Audit trail** | ✅ | ✅ | ✅ | ✅ | ⚠️ Generic | ✅ Domain events |
| **Secret management** | ✅ Vault | ✅ Vault | N/A | ✅ | ❌ Leaked PATs | ✅ Wave -1 |
| **Kill-switch** | ✅ | ✅ | ❌ | ✅ | ❌ Fail-open | ✅ Wave 0 |
| **DataOps/SOC** | ❌ | ❌ | ❌ | ✅ | ✅ 5 subtabs | ✅ ~95% parity |
| **Mobile** | ✅ | ✅ | ✅ | N/A | ✅ packages/mobile | ✅ Maintain |
| **Vietnam-native** | ❌ | ❌ | ❌ | N/A | ✅ | ✅ Maintain |
| **Backfill system** | ❌ | ❌ | ❌ | N/A | ✅ SOC DataOps | ✅ Maintain |

### 1.3 Đánh giá khoảng cách

**Điểm mạnh hiện tại** (đối thủ không có):
- SOC/DataOps tab: 5 subtabs, 32+ components, backfill, scheduler board, monitor — Bloomberg/Datadog không có ở dạng này
- Alert Center realtime: SSE stream, 13 endpoints, triage, rules — vượt TradingView cơ bản
- Vietnam market native: VN30, HNX, UPCOM, SSI/TCBS/DNSE integration — đối thủ quốc tế không có
- Backfill system: Cho phép replay data lịch sử — Bloomberg không có

**Khoảng cách chính** (cần nâng cấp):
- **P0 (phải sửa trước):** 10 blocker — secret leak, order fail-open, tenant leak, migration bug, ledger wrong, legal license
- **P1 (sau P0):** Tenant SSOT, broker async sync, audit domain events, kill-switch, i18n complete
- **P2 (Wave 2):** Performance metrics, risk management, benchmark, news, paper trading
- **P3 (Wave 3-4):** Real-time streaming, conditional orders, chart trading, monetization UI

---

## PHẦN II: KIẾN TRÚC TARGET ĐỀ XUẤT

### 2.1 Nguyên tắc thiết kế (5 nguyên tắc bất di)

```
┌─────────────────────────────────────────────────────────┐
│                    NGUYÊN TẮC THIẾT KẾ                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. DENY BY DEFAULT                                      │
│     → Thiếu capability/policy/tenant/secret/OTP → từ chối│
│                                                         │
│  2. SERVER IS SOURCE OF TRUTH                            │
│     → Client không được tự quyết định live/paper mode    │
│                                                         │
│  3. EVERY WRITE IS AUDITABLE                             │
│     → Mọi write tài chính: audit + idempotency + replay  │
│                                                         │
│  4. TENANT CONTEXT IS MANDATORY                          │
│     → Middleware → Service → Query → Cache → Audit      │
│                                                         │
│  5. NO ZERO DISPLAY                                      │
│     → Thiếu dữ liệu = null + reason + source + as_of    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Kiến trúc phân lớp

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite + TS)              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PortfolioContext.js (refactored: 722→split into domain)     │    │
│  │    ├── AuthContext (login/logout/register)                   │    │
│  │    ├── TenantContext (switchTenant, SSOT tenantIdStorage)    │    │
│  │    ├── PortfolioWorkspace (overview/holdings/activity/analytics)│  │
│  │    └── BrokerHubContext (provider status, sync runs)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Pages                                                    │    │
│  │    ├── portfolio/OverviewPage.tsx     (KPIs, chart, health)  │    │
│  │    ├── portfolio/HoldingsPage.tsx     (table, cost, P&L)     │    │
│  │    ├── portfolio/ActivityPage.tsx     (timeline, import)      │    │
│  │    ├── portfolio/AnalyticsPage.tsx    (TWR/MWR, risk)        │    │
│  │    ├── broker/HubPage.tsx             (provider cards)        │    │
│  │    ├── broker/SyncCenterPage.tsx      (runs, reconciliation)  │    │
│  │    └── broker/PaperOrdersPage.tsx     (order ticket)          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Components                                                │    │
│  │    ├── portfolio/Summary.tsx, HoldingsTable.tsx            │    │
│  │    ├── portfolio/StaleBanner.tsx, AllocationPanel.tsx       │    │
│  │    ├── portfolio/PerformancePanel.tsx, RiskPanel.tsx        │    │
│  │    ├── portfolio/ImportWizard.tsx                           │    │
│  │    ├── broker/OrderTicket.tsx, SyncRunTimeline.tsx          │    │
│  │    └── shared/ChartWidget.tsx (lazy vninvestcharts-widget)  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Adapters (workspace.js → 781 methods → split by domain)    │    │
│  │    ├── portfolio.js (CRUD, holdings, analytics, ledger)     │    │
│  │    ├── broker.js (config, sync, order, reconciliation)      │    │
│  │    ├── chartAdapter.js (vninvestcharts-widget bridge)       │    │
│  │    └── transport.js (tenant SSOT, X-Tenant-ID header)       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │ REST API + SSE + WebSocket
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Django REST + Celery + PostgreSQL)     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  BOUNDARY LAYER (tenant resolution, rate limiting)            │    │
│  │    ├── middleware.py (single tenant resolver)                │    │
│  │    ├── permissions.py (TenantScopePermission)                 │    │
│  │    ├── throttles.py (PAT + session + action rate limits)      │    │
│  │    └── kill_switch.py (fail-closed, 3-tier)                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PORTFOLIO DOMAIN (user_workspace/)                           │    │
│  │    ├── models.py (Portfolio, Transaction, SubAccount, ...)     │    │
│  │    ├── views.py (CRUD, tenant-scoped)                         │    │
│  │    ├── serializers.py (RFC 9457 problem+json)                  │    │
│  │    ├── ledger/holdings.py (weighted average, pure function)   │    │
│  │    ├── ledger/services.py (DB + cache 60s TTL)                │    │
│  │    ├── ledger/valuation.py (NAV, cash flow)                   │    │
│  │    ├── ledger/performance.py (TWR/MWR/benchmark)              │    │
│  │    ├── ledger/allocation.py (symbol/sector weight)            │    │
│  │    ├── ledger/risk.py (VaR/drawdown/volatility)               │    │
│  │    └── portfolio_analytics_views.py (holdings/summary/chart)  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  BROKER DOMAIN (bounded context)                              │    │
│  │    ├── broker/ (adapters.py, dnse.py, ssi.py, tcbs.py)       │    │
│  │    ├── models.py (BrokerConnection, BrokerAccount, SyncRun)   │    │
│  │    ├── views.py (config CRUD, capability matrix)              │    │
│  │    ├── views_dnse.py (sync, OTP, order — paper default)       │    │
│  │    ├── tasks.py (Celery async: sync, order, reconcile)        │    │
│  │    └── sync_engine.py (reconciliation, DLQ)                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  ORDER DOMAIN (new)                                           │    │
│  │    ├── models.py (Order, OrderEvent, IdempotencyRecord)       │    │
│  │    ├── views.py (create, modify, cancel, status)              │    │
│  │    ├── engine.py (paper/live routing, risk check)             │    │
│  │    └── tasks.py (worker: broker call, retry, reconciliation)  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AUDIT DOMAIN (append-only)                                   │    │
│  │    ├── ops_audit/models.py (domain events, not HTTP log)      │    │
│  │    ├── ops_audit/views.py (domain-scoped query)               │    │
│  │    └── outbox.py (event sourcing → audit trail)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  INFRASTRUCTURE                                               │    │
│  │    ├── queue_policy.py (broker, enrichment, realtime queues)  │    │
│  │    ├── service_ops/broker_runtime.py (health, kill-switch)    │    │
│  │    ├── vninvest_core/settings.py (all config)                  │    │
│  │    └── encryption.py (Fernet + SecretStore abstraction)       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │ Celery tasks + broker API
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL (Brokers)                              │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   DNSE       │  │    SSI       │  │    TCBS      │              │
│  │  LightSpeed  │  │  FastConnect │  │   OpenAPI    │              │
│  │  HMAC-SHA256 │  │  OAuth2      │  │  OAuth2      │              │
│  │  Paper/Live  │  │  Read-only   │  │  Read-only   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data model target (ERD)

```
TENANT ||--o{ PORTFOLIO : owns
  USER ||--o{ PORTFOLIO : creates
  PORTFOLIO ||--o{ LEDGER_ENTRY : records
  PORTFOLIO ||--o{ POSITION_SNAPSHOT : daily values
  PORTFOLIO ||--o{ VALUATION_SNAPSHOT : NAV/cash/debt
  PORTFOLIO ||--o{ PERFORMANCE_SNAPSHOT : returns
  PORTFOLIO ||--o{ SYNC_RUN : broker syncs
  PORTFOLIO ||--o{ ORDER : trades
  TENANT ||--o{ BROKER_CONNECTION : credentials
  BROKER_CONNECTION ||--o{ BROKER_ACCOUNT : exposed accounts
  BROKER_CONNECTION ||--o{ SYNC_RUN : runs
  ORDER ||--o{ ORDER_EVENT : lifecycle
  LEDGER_ENTRY ||--o{ CASH_FLOW : dividends/fees/taxes
  TENANT ||--o{ AUDIT_EVENT : domain events
  ORDER ||--o{ IDEMPOTENCY_RECORD : anti-double
```

**Target models so với hiện trạng:**

| Hiện trạng | Target | Lý do |
|-----------|--------|-------|
| `Transaction` (flat) | `LedgerEntry` + `CashFlow` | Double-entry, audit trail, append-only |
| NAV = null | `ValuationSnapshot` daily | Opening balance from broker |
| Holdings from Transactions every request | `PositionSnapshot` cached 60s | Performance + consistency |
| No performance model | `PerformanceSnapshot` TWR/MWR | Benchmark comparison |
| No risk model | `RiskLimit` + risk.compute | Live order gates |
| `SyncRun` missing | `SyncRun` + `ReconciliationItem` | Async reconciliation |
| `Order` missing | `Order` + `OrderEvent` | Full lifecycle, idempotency |
| `BrokerConfig` no tenant | `BrokerConnection` tenant-scoped | Cross-tenant isolation |

### 2.4 Data flow — READ path

```
┌──────┐    ┌──────────────┐    ┌─────────────────────┐    ┌──────────┐
│ User │───▶│  FE Page     │───▶│ coreApiAdapter      │───▶│ REST API │
│ click│    │  (usePortfolio│    │ .getPortfolioSummary│    │ GET /ws/ │
│      │    │   hook)      │    │ .getPerformance()   │    │ portfolios│
└──────┘    └──────────────┘    └─────────┬───────────┘    └────┬─────┘
                                           │                     │
                                           │  X-Tenant-ID header │
                                           │  (from tenantIdStorage│
                                           │   sessionStorage)   │
                                           ▼                     ▼
                                    ┌──────────────┐    ┌─────────────────┐
                                    │  Backend View │    │  Cache Layer     │
                                    │  (double filter│    │  (60s TTL,       │
                                    │   user+tenant) │    │   fingerprint key)│
                                    └──────┬───────┘    └────────┬────────┘
                                           │                    │
                                           │    ┌───────────────┘
                                           │    │
                                           ▼    ▼
                                    ┌──────────────────────┐
                                    │  Ledger/Analytics    │
                                    │  ┌─────────────────┐ │
                                    │  │ ledger/holdings │ │
                                    │  │ .compute()      │ │
                                    │  ├─────────────────┤ │
                                    │  │ ledger/valuation│ │
                                    │  │ .nav()          │ │
                                    │  ├─────────────────┤ │
                                    │  │ ledger/perf.    │ │
                                    │  │ .twr()          │ │
                                    │  ├─────────────────┤ │
                                    │  │ ledger/risk.py  │ │
                                    │  │ .var95()        │ │
                                    │  └─────────────────┘ │
                                    └──────────────────────┘
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │  Response        │
                                    │  {data, meta,    │
                                    │   stale, source,  │
                                    │   calculation_    │
                                    │   version}        │
                                    └──────────────────┘
```

**Response shape (RFC 9457):**
```json
{
  "data": {
    "portfolio_id": 1,
    "portfolio_name": "Dài hạn VN30",
    "total_market_value": "1,234,567,890",
    "total_cost": "1,100,000,000",
    "total_unrealized_pnl": "134,567,890",
    "total_unrealized_pnl_pct": 12.23,
    "num_holdings": 15,
    "cash": "50,000,000",
    "cash_complete": true,
    "realized_pnl": "23,456,789",
    "dividend_income": "5,678,901",
    "nav": "1,284,567,890",
    "as_of": "2026-09-27",
    "holdings": [
      {
        "symbol": "VNM", "name": "Vinamilk",
        "quantity": 1000, "avg_cost": "60000",
        "current_price": "65000", "market_value": "65,000,000",
        "unrealized_pnl": "5,000,000", "unrealized_pnl_pct": 8.33,
        "weight": 0.052, "sector": "Consumer Staples"
      }
    ]
  },
  "meta": {
    "calculation_version": "holdings-wa-v1",
    "calculation_method": "TWR",
    "benchmark": "VN30",
    "as_of": "2026-09-27T14:30:00+07:00",
    "stale": false,
    "stale_reason": null,
    "cache_hit": true,
    "source": "ledger",
    "pagination": {"count": 15, "next": null, "previous": null}
  }
}
```

### 2.5 Data flow — WRITE path (Order)

```
┌──────┐    ┌──────────────┐    ┌──────────────────────┐
│ User │───▶│  FE Order    │───▶│  POST /core/v1/      │
│ click│    │  Ticket      │    │  workspace/orders/   │
└──────┘    └──────────────┘    └──────────┬───────────┘
                                           │
                                    ┌────────▼────────┐
                                    │  Policy Gate     │
                                    │  ├── Kill-switch │── DENY if error
                                    │  ├── Risk limit  │── DENY if exceeds
                                    │  ├── Idempotency │── dedup check
                                    │  └── Capability  │── DENY if no right
                                    └────────┬────────┘
                                           │
                                    ┌────────▼────────┐
                                    │  Durable Job     │
                                    │  (OrderJob)      │
                                    │  Celery broker   │
                                    └────────┬────────┘
                                           │
                                    ┌────────▼────────┐
                                    │  Worker          │
                                    │  ├── Paper mode  │── simulate
                                    │  ├── Live mode   │── broker API
                                    │  └── Reconcile   │── verify
                                    └────────┬────────┘
                                           │
                                    ┌────────▼────────┐
                                    │  Audit Event     │
                                    │  (append-only)   │
                                    │  + Outbox        │
                                    └─────────────────┘
```

**Key invariant:** Write path NEVER calls broker directly from HTTP request. Always through durable job.

### 2.6 Data flow — Sync/Reconciliation

```
┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ Broker API   │───▶│ SyncJob (Celery) │───▶│ SyncRun record    │
│ (DNSE/SSI/   │    │ queue: broker    │    │ status: running   │
│  TCBS)       │    │ retry + DLQ      │    │ progress: 0→100%  │
└──────────────┘    └────────┬─────────┘    └───────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Reconciliation│
                    │ Engine       │
                    │              │
                    │ Local vs     │
                    │ Broker diff  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Reconcil-    │
                    │ ationItem    │
                    │ matched/no_match│
                    │ ├── auto-fix │ (price difference)
                    │ └── manual   │ (quantity mismatch)
                    └─────────────┘
```

---

## PHẦN III: TÍNH NĂNG ĐỀ XUẤT THEO TỪNG MỨC ĐỘ

### 3.1 Wave -1: Security Hotfix (NGAY LẬP TỨC)

| Slice | Tính năng | Chi tiết | File chạm |
|-------|-----------|----------|-----------|
| SEC-01 | Rotate secrets | Revoke ALL PATs, rotate Fernet keys, CI secret scanning | `compose.dev.env`, `docker-compose.*`, `.github/workflows/*` |
| SEC-02 | Secret store abstraction | `SecretStore` class, `BROKER_SECRET_KEY`, versioned secrets | `encryption.py`, `settings.py` |
| SEC-03 | CI security gate | `security-audit` hook, secret scanning in pipeline | `.github/workflows/web-ci.yml` |

### 3.2 Wave 0: Safety Stop

| Slice | Tính năng | Chi tiết | AC |
|-------|-----------|----------|----|
| SAFE-01 | Order fail-closed | `dry_run=True` mặc định, server-side mode decision | `POST /orders` always paper unless server approves live |
| SAFE-02 | Idempotency key | `Idempotency-Key` mandatory, TTL 7 days, unique `(tenant, actor, scope, key)` | Duplicate order = HTTP 409 |
| SAFE-03 | Kill-switch fail-closed | `check_kill_switch()` in ALL write paths, error = deny | DB error = HTTP 503, NOT broker call |
| SAFE-04 | RBAC/capability | `workspace.portfolios.manage` enforced on ALL endpoints | 403 if no capability |
| SAFE-05 | Audit domain events | Append-only `AuditEvent` with domain taxonomy | Every order/sync/config change has audit trail |
| SAFE-06 | Durable jobs | `broker` queue + worker, `task_always_eager=False` | Celery inspect shows `broker` queue |
| SAFE-07 | CI gates | `manage.py check` 0, `makemigrations --check` clean, coverage threshold | Gate script exit 0 |

### 3.3 Wave 1: Tenant Isolation

| Slice | Tính năng | Chi tiết | File chạm |
|-------|-----------|----------|-----------|
| TEN-01 | Single tenant resolver | `resolve_active_tenant()` in middleware, X-Tenant-ID only | `middleware.py`, `permissions.py` |
| TEN-02 | FE tenant SSOT | `tenantIdStorage` single source, `sessionStorage` everywhere | `PortfolioContext.js`, `transport.js` |
| TEN-03 | Broker config tenant | `UserBrokerConfig` + `tenant_id`, unique constraint | `models.py:452-540`, migration `0017` fix |
| TEN-04 | Analytics tenant scope | ALL analytics endpoints `TenantScopePermission`, double filter | `portfolio_analytics_views.py:25-27` |
| TEN-05 | Migration repair | `0008` fixed: no `TenantMember.is_active`, backfill correct | `0008_backfill...`, `0019` |
| TEN-06 | Cache tenant isolation | Cache key includes `tenant_id`, no cross-tenant cache leak | `ledger/services.py` |

### 3.4 Wave 2: Ledger & Financial Correctness

| Slice | Tính năng | Chi tiết | AC |
|-------|-----------|----------|----|
| LED-01 | `LedgerEntry` model | Append-only, double-entry, source of truth | Migration clean, test 4/4 |
| LED-02 | `CashFlow` model | Dividends, fees, taxes separate from quantity | Dividend = cash flow, not cost reduction |
| LED-03 | `PositionSnapshot` | Daily position snapshot, source + as_of | `snapshot` endpoint returns history |
| LED-04 | Valuation engine | NAV = cash + stock_value - debt, weighted average | `_compute_nav()` returns correct value |
| LED-05 | Financial validators | Price/quantity/fee/tax >= 0, oversell warning (not clamp) | Invalid transaction = HTTP 422 |
| LED-06 | Idempotency | `IdempotencyRecord` model, TTL 7 days | Duplicate POST = 409 within TTL |
| ANA-01 | Performance metrics | TWR (default), MWR (≥2 external flows), VN30 benchmark | `performance` endpoint returns TWR/MWR |
| ANA-02 | Allocation | By symbol, by sector, by market cap | `allocation` endpoint returns breakdown |
| ANA-03 | Risk metrics | Volatility (annualized), VaR 95%, max drawdown, concentration | `risk` endpoint returns all metrics |
| ANA-04 | Freshness SLA | DNSE ≤15min, SSI/TCBS ≤30min, stale flag | `stale: true` when exceeded |
| ANA-05 | Benchmark integration | VN30 primary, VN100 secondary, alpha/beta | `benchmark` endpoint returns comparison |
| LED-07 | Migration to ledger | `Transaction` → `LedgerEntry`, backfill, verify, cutover | Data integrity verified |

### 3.5 Wave 3: Broker Hub Read-Only

| Slice | Tính năng | Chi tiết | AC |
|-------|-----------|----------|----|
| BRK-01 | Credential cutover | DNSE legacy store → `BrokerConnection`, deprecation header 410 | Old route returns 410 |
| BRK-02 | Secret store | `BROKER_SECRET_KEY`, not derived from `SECRET_KEY` | Secret rotation doesn't break broker |
| BRK-03 | Capability matrix | Versioned data, not `FULLY_SUPPORTED` constant | `capability_matrix` endpoint returns real status |
| BRK-04 | Async sync | `SyncRun` durable, `broker` queue, poll + DLQ | `GET /sync-runs` returns status |
| BRK-05 | SSRF protection | Host/IP validation, throttle, allowlist | `POST /test-connection` validates host |
| BRK-06 | SOC Broker Ops | Operator view: all connections, sync status, alerts | SOC panel shows broker health |

### 3.6 Wave 4: Paper Trading

| Slice | Tính năng | Chi tiết | AC |
|-------|-----------|----------|----|
| PAP-01 | Paper engine | Order simulation, fill logic, slippage model | `POST /orders` paper mode works |
| PAP-02 | Order ticket UI | Symbol, side, qty, price, confirmation, Idempotency-Key | FE form with validation |
| PAP-03 | Plan gating | `BROKER_INTEGRATION_ENABLED=false` default, feature flag | Live orders blocked without flag |
| PAP-04 | Canary | Paper trades first, monitor, approve → live | Zero financial risk |

### 3.7 Wave 5: Live Trading (CONDITIONAL)

| Slice | Tính năng | Điều kiện | AC |
|-------|-----------|-----------|----|
| LIV-01 | Live gate | ALL Exit-5 gates green + `vnbroker` license signed | Legal document + gate script |
| LIV-02 | Order modify/cancel | Full lifecycle, risk limits, Idempotency-Key | `PATCH /orders/{id}` works |
| LIV-03 | Risk limits | Per-order, daily, exposure, max tokens | `RiskLimit` model enforced |
| LIV-04 | Canary release | Manual approval, 1 user → 10% → 100% | Monitoring dashboard |
| LIV-05 | DR drill | Backup, restore, failover tested | `DR_RUNBOOK` executed |

### 3.8 Wave 6: Hardening & Operations

| Slice | Tính năng | Chi tiết |
|-------|-----------|----------|
| OPS-01 | Observability | SLO dashboard, error budget burn rate, alerting |
| OPS-02 | Load test | 1000 concurrent users, p95 ≤ 500ms |
| OPS-03 | DR drill | Backup/restore, point-in-time recovery |
| OPS-04 | ASVS 5.0 L2 | OWASP ASVS checklist, penetration test |
| OPS-05 | Retention | Ledger ≥7 years, cache 90 days, jobs 30 days |
| OPS-06 | SBOM | CycloneDX ≥1.6, dependency scan |
| OPS-07 | ISO 27001 | ISMS implementation |

### 3.9 Wave 7: Advanced Features (Post-live)

| Slice | Tính năng | Chi tiết |
|-------|-----------|----------|
| ADV-01 | News integration | Vietnam financial news API |
| ADV-02 | Sentiment analysis | NLP on news + social |
| ADV-03 | Forecast/BSC | ML models for price prediction |
| ADV-04 | Custom dashboard | Widget workspace, drag-and-drop |
| ADV-05 | WebSocket streaming | Real-time positions/P&L |
| ADV-06 | Conditional orders | FCO, stop-limit, OCO |
| ADV-07 | Chart trading | Drag-to-modify, drag-to-sell |
| ADV-08 | Multi-currency/FX | USD/VND conversion |
| ADV-09 | Social features | Share portfolio, comments |
| ADV-10 | Terminal mode | Keyboard shortcuts, full-screen |

---

## PHẦN IV: QUY TRÌNH TRIỂN KHAI ĐỀ XUẤT

### 4.1 Quy trình quyết định (5 bước)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Bước 1   │    │ Bước 2   │    │ Bước 3   │    │ Bước 4   │    │ Bước 5   │
│ Thống nhất│    │ Phê duyệt│    │ Triển    │    │ Verify   │    │ Ship     │
│ về scope │───▶│ safety   │───▶│ khai Wave│───▶│ gate     │───▶│ release  │
│          │    │ blockers │    │ -1, 0    │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   User/PO         Tech Lead      Team            QA              Production
                  + Security
```

**Bước 1 — Thống nhất scope (1-2 ngày):**
- User đọc proposal này
- Chọn mức nâng cấp mong muốn (Wave -1→0 hiển nhiên, Wave 2+ tùy theo nguồn lực)
- Đồng ý về `vnbroker` license status (R3 không tồn tại nếu chưa ký)
- Quyết định timeline

**Bước 2 — Phê duyệt (1-2 ngày):**
- Tech Lead review `IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (đã APPROVED)
- Security review P0 blockers
- Sign off on D-01 through D-30 decisions

**Bước 3 — Triển khai (theo Wave):**
- Mỗi Wave là 1 PR
- Gate bắt buộc cho mỗi Wave trước khi merge
- `npm run test:components` 3x liên tiếp (D-19)

**Bước 4 — Verify:**
- `manage.py check` 0
- `npx tsc --noEmit` 0
- `npm run build` PASS
- BE test 100%
- Cross-tenant probe = 404 (đã fix)
- Secret scan = sạch
- Migration `0008` = OK

**Bước 5 — Ship:**
- PR merge `dev`
- Rebuild Docker image
- Deploy staging → verify → production

### 4.2 Gate cho mỗi Wave

| Gate | Lệnh | Trước khi merge |
|------|------|-----------------|
| Type check | `npx tsc --noEmit` | 0 errors |
| Build | `npm run build` | PASS |
| Lint | `npm run lint` | 0 errors |
| FE test | `npm run test:components` (3x) | 3x PASS |
| BE check | `manage.py check` | 0 issues |
| Migration | `makemigrations --check --dry-run` | clean |
| Secret scan | `git grep -Il 'github_pat_'` | 0 hit |
| Cross-tenant | Probe API with wrong tenant header | 404 |
| i18n | `npm run i18n:scan` | 0 missing |
| Hardcode | `npm run hardcode:scan` | 0 hit |

### 4.3 Timeline ước tính

| Wave | Slices | Engineer-days | Thời gian | Điều kiện tiên quyết |
|------|--------|--------------|-----------|---------------------|
| **-1 Security** | 3 | 4-6 | **1 tuần** | KHÔNG — bắt đầu ngay |
| **0 Safety** | 7 | 24-30 | **2-3 tuần** | Sau Wave -1 |
| **1 Tenant** | 6 | 21-28 | **2-3 tuần** | Sau Wave 0 |
| **2 Ledger** | 12 | 30-38 | **3-4 tuần** | Sau Wave 1 |
| **3 Broker** | 6 | 24-31 | **3-4 tuần** | Sau Wave 2 |
| **4 Paper** | 4 | 16-22 | **2-3 tuần** | Sau Wave 3 |
| **5 Live** | 5 | 21-28 | **3-4 tuần** | LICENSE + ALL gates |
| **6 Hardening** | 5 | 19-26 | **2-3 tuần** | Sau Wave 5 |
| **7 Advanced** | 10 | 50-70 | **5-7 tuần** | Sau Wave 6 |
| **TỔNG** | **52** | **~192-251** | **~5-6 tháng** | |

---

## PHẦN V: LỢI ÍCH & ROI

### 5.1 Lợi ích kinh doanh

| Lợi ích | Mô tả | Đo lường |
|---------|--------|----------|
| **An toàn tài chính** | Không đặt lệnh live ngoài ý muốn | Kill-switch = 0 live orders ngoài authorization |
| **Tuân thủ pháp lý** | `vnbroker` license signed, ASVS 5.0 L2 | Legal clearance |
| **Tín dụng khách hàng** | NAV chính xác, P&L đáng tin | Ledger audit trail, 7 năm retention |
| **Khả năng mở rộng** | Multi-tenant, microservice-ready | 1000 concurrent users, p95 ≤ 500ms |
| **Revenue** | Monetization tiers (FREE/PRO/ENTERPRISE/LIVE) | Tier upgrade conversion |
| **Competitive** | Vượt TradingView/VNĐỰC | Feature parity + Vietnam-native |
| **Trust** | SOC/DataOps monitoring, SLA | Uptime 99.9%, freshness SLA |

### 5.2 So sánh chi phí: Nâng cấp vs Xây mới

| Tiêu chí | Nâng cấp (đề xuất) | Xây mới |
|-----------|-------------------|---------|
| Timeline | 5-6 tháng | 12-18 tháng |
| Risk | Thấp (kernel hoạt động) | Cao (blank slate) |
| Cost | ~192-251 ed | ~400-600 ed |
| Migration | Increment, backward compatible | Full rewrite |
| User adoption | Seamless (same UX, better) | Re-learning required |
| Legal | License existing, fix P0 | New contract |
| **Recommendation** | ✅ **ĐỀ XUẤT NÀY** | ❌ Not recommended |

---

## PHẦN VI: RISK & MITIGATION

| Risk | Mức | Mitigation |
|------|-----|------------|
| `vnbroker` license không ký → R3 dead | CỨU | D-21: Feature flag, R0-R4 vẫn có giá trị |
| Migration `0008` fail trên production | CỨU | D-24: Repair migration, expand→backfill→verify→cutover |
| Secret leak trên production | CỨC | Wave -1: Revoke/rotate ngay trước mọi thứ |
| Tenant leak trên analytics | CỰC | Wave 1: TenantScopePermission, single resolver |
| Live order ngoài ý muốn | CỰC | Wave 0: dry_run=True mặc định, server-side mode |
| Team không đủ resources | CAO | Prioritize Wave -1→2 trước, Wave 3+ sau |
| Performance regression | CAO | Load test trong Wave 6, p95 ≤ 500ms |
| FE/BE contract mismatch | TRUNG BÌNH | Contract smoke test, `coreApiAdapter.d.ts` |

---

## PHẦN VII: KẾT LUẬN & KHUYẾN NGHỊ

### 7.1 Tóm tắt

Hệ thống portfolio management hiện tại đã có **kernel hoạt động** (CRUD, holdings, chart, watchlist, screener) và **SOC/DataOps parity ~95%** với legacy. Tuy nhiên, **10 P0 blocker** đang chặn mọi nâng cấp thương mại:

1. **Secret leak** — PAT thật trong tracked files
2. **Order fail-open** — live orders không cần authorization
3. **Tenant leak** — analytics trả dữ liệu cross-tenant HTTP 200
4. **Tenant SSOT broken** — FE `localStorage` vs BE `sessionStorage`
5. **Migration `0008` fail** — query field không tồn tại
6. **Ledger wrong** — holdings algorithm sai (clamp oversell, bỏ dividend)
7. **NAV null** — không có opening balance
8. **No financial validation** — giá/cước/phí/thuế không validate
9. **Legal blocker** — `vnbroker` license chưa ký
10. **Kill-switch fail-open** — lỗi DB = cho phép write

### 7.2 Đề xuất hành động

**GIAI ĐOẠN 1 (Ngay lập tức, 1 tuần):**
- Revoke/rotate ALL secrets (Wave -1)
- Fix `dry_run=True` mặc định (Wave 0 SAFE-01)
- Fix migration `0008` (Wave 1 TEN-05)

**GIAI ĐOẠN 2 (2-3 tháng):**
- Tenant isolation hoàn chỉnh (Wave 0-1)
- Ledger reconstruction (Wave 2)
- Broker Hub async (Wave 3)
- Paper trading (Wave 4)

**GIAI ĐOẠN 3 (3-4 tháng):**
- Live trading (Wave 5 — conditional on license)
- Performance/Risk (Wave 2, if not done)
- Advanced features (Wave 7)

### 7.3 Yêu cầu quyết định từ người dùng

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| 1 | `vnbroker` license đã ký chưa? | R3 tồn tại hay không |
| 2 | Priority: Security fix hay Feature development? | Wave -1 trước hay Wave 2 trước |
| 3 | Team size cho project này? | Timeline và scope |
| 4 | Accept paper-only hoặc phải live trading? | Wave 4-5 cần hay không |
| 5 | Budget cho commercial certification (ASVS, ISO 27001)? | Wave 6 scope |
| 6 | Có đồng ý với 30 D-decisions trong plan không? | Triển khai không cần hỏi lại |

### 7.4 Lời kêu gọi

**Đề xuất này không phải "nên hay không nên nâng cấp" — mà là "nâng cấp như thế nào để an toàn."** Kernel đã hoạt động, plan đã APPROVED, audit đã hoàn tất với 36 findings. Vấn đề duy nhất là **quyết định bắt đầu**.

Mọi trì hoãn không làm giảm risk — P0 blockers sẽ tồn tại và tích lũy. Secret leak, tenant leak, và order fail-open là **rủi ro pháp lý và tài chính**, không phải "nice to have."

**Khuyến nghị:** Bắt đầu Wave -1 (Security Hotfix) **ngay lập tức**. Đây là 1 tuần work, không cần feature design, không cần discussion — chỉ cần execute. Sau đó, đánh giá lại và quyết định các Wave tiếp theo.

---

*Tài liệu tham khảo:*
- `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (Rev.2, APPROVED)
- `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md`
- `docs/COMMERCIAL_COMPARISON_ROADMAP_20260726.md`
- `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md`
- `docs/OPEN_WORK_20260927.md`
- `docs/CLAIMS.md`
- `docs/PORTFOLIO_COMMERCIAL_REDESIGN_AUDIT_VERIFICATION_20260925.md`
