# AUDIT & IMPLEMENTATION PLAN: Coordinated Parallel Scraping Architecture
**Date**: 2025-05-15
**Task**: Build scraping system for price, intraday tick, whale buy/sell, CVD/Strength data

> Superseded for execution: dùng bộ tài liệu SaaS-native ngày `2026-05-14` làm SSOT triển khai.
>
> - `docs/SCRAPING_SYSTEM_SAAS_NATIVE_HANDOFF_MASTER_20260514.md`
> - `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
> - `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
> - `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_20260514.md`
>
> File hiện tại chỉ còn giữ vai trò audit đầu vào và historical context cho phương án coordinated parallel scraping ban đầu.

---

## 1. CURRENT STATE AUDIT

### 1.1 Background Services (Celery Tasks) - Current

| Task Module | Task Name | Function | Schedule | Status |
|------------|----------|----------|----------|--------|
| **data_ingest/tasks.py** | `fetch_and_upsert_price_board` | Realtime price board → SymbolSnapshot | Every 5min (Celery Beat) | ✅ Active |
| | `warm_intraday_universe` | Warm intraday tape cache | Daily 07:00 | ✅ Active |
| | `sync_market_groups` | Sync listing symbols | Manual | ✅ Active |
| | `ingest_daily_prices` | Daily OHLCV ingestion | Daily 17:00 | ✅ Active |
| | `backfill_daily_prices` | Parallel multi-provider OHLCV (VCI, KBS) | Manual | ✅ Active |
| **signal_intelligence/tasks.py** | `run_signal_detection_job` | Whale/dark flow detection | Every 15min | ✅ Active |
| **market_serving/materializers.py** | `materialize_symbol_snapshot` | Snapshot materialization | Every 5min | ✅ Active |
| | `materialize_session_facts` | Session facts aggregation | EOD | ✅ Active |
| **service_ops/tasks.py** | `run_scrape_cycle` | Manual scraping orchestrator | Manual only | ⚠️ TODO |
| | `scrape_cell_task` | Per-symbol scraping | Manual only | ⚠️ TODO |

### 1.2 Current Data Provider Infrastructure

| Provider | Price | Intraday | History | Listing | Status |
|----------|-------|----------|----------|---------|---------|--------|
| **VCI** | ✅ | ✅ | ✅ | ✅ | Primary |
| **KBS** | ✅ | ✅ | ✅ | ✅ | Fallback |
| **DNSE** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Planned |

### 1.2b Data Types Available via vnbroker_adapter

The `vnbroker_adapter` (backend/portfolio/adapters/vnbroker_adapter.py) provides the following data scraping methods:

#### Core Market Data

| Data Type | Function | Description | Provider Support |
|----------|----------|-------------|-------------------|
| **Price Board** | `fetch_price_board_dataframe(symbols_list)` | Realtime prices for symbol list | VCI, KBS, DNSE (planned) |
| **Price Depth** | `fetch_price_depth_dataframe(symbol)` | Order book (bid/ask) | VCI ✅, KBS ⚠️, DNSE ⚠️ |
| **Intraday Ticks** | `fetch_intraday_dataframe(symbol, page_size)` | Tick-by-tick trades | VCI, KBS, DNSE (planned) |
| **Daily History** | `fetch_history_dataframe(symbol, start, end, interval)` | OHLCV daily/weekly | VCI, KBS, DNSE (planned) |
| **Heatmap Snapshot** | `fetch_heatmap_snapshot(symbols_list)` | Quick price snapshot | KBS |

#### Listing & Universe

| Data Type | Function | Description | Provider Support |
|----------|----------|-------------|-------------------|
| **Listing Symbols** | `fetch_listing_symbols_dataframe(symbol)` | All listed symbols | VCI, KBS, DNSE (planned) |
| **Symbols by Industry** | `fetch_symbols_by_industries_dataframe(anchor_symbol)` | Symbols in same industry | VCI |
| **Symbols by Group** | `fetch_symbols_by_group_series(group_code)` | VN30, VN100, etc. | VCI |
| **Symbols by Exchange** | `fetch_symbols_by_exchange_dataframe(anchor_symbol)` | HOSE/HNX/UPCOM | VCI |

#### Fundamental & Financial Data

| Data Type | Function | Description | Provider Support |
|----------|----------|-------------|-------------------|
| **Financial Ratios** | `fetch_financial_ratio_dataframe(symbol, metrics, period)` | ROE, EPS, P/E, etc. | VCI, DNSE (planned), FMP |
| **Fundamental Snapshot** | `fetch_fundamental_snapshot_dataframe(symbol, metrics, period)` | Full fundamental data | vnbroker |
| **Industry Peers** | `fetch_industry_peers_dataframe(symbol)` | Peer companies | vnbroker |
| **Industry Benchmark** | `fetch_industry_benchmark_dataframe(symbol, metrics)` | Industry median | vnbroker |
| **Industry Rank** | `fetch_industry_rank_dataframe(symbol, metric)` | Company rank in industry | vnbroker |

#### Corporate Actions

| Data Type | Function | Description | Provider Support |
|----------|----------|-------------|-------------------|
| **Insider Deals** | `fetch_insider_deals_dataframe(symbol, start_date, end_date)` | Insider buying/selling | vnbroker |
| **Dividends** | `fetch_dividends_dataframe(symbol)` | Dividend history | vnbroker (TODO) |
| **Stock Splits** | `fetch_stock_splits_dataframe(symbol)` | Split history | vnbroker (TODO) |
| **IPO Data** | `fetch_ipo_dataframe(symbol)` | IPO information | vnbroker (TODO) |

#### Signals & Analytics

| Data Type | Function | Description | Provider Support |
|----------|----------|-------------|-------------------|
| **Whale Orders** | via `fetch_intraday_dataframe` + filter | Large trades (>1B VND) | VCI, KBS, DNSE (planned) |
| **Dark Flow** | via `fetch_intraday_dataframe` + filter | Hidden large trades | VCI, KBS, DNSE (planned) |
| **Order Imbalance** | via `fetch_price_depth` | Buy/Sell pressure | VCI |
| **CVD (Cumulative Volume Delta)** | Computed from intraday | Buy Volume - Sell Volume | Computed |

#### Additional Data (Future/Roadmap)

| Data Type | Function | Description | Status |
|----------|----------|-------------|--------|
| **Mutual Fund Holdings** | `fetch_fund_holdings_dataframe(symbol)` | TODO |
| **Short Interest** | `fetch_short_interest_dataframe(symbol)` | TODO |
| **Analyst Ratings** | `fetch_analyst_ratings_dataframe(symbol)` | TODO |
| **Earnings Calendar** | `fetch_earnings_calendar_dataframe(symbols_list)` | TODO |
| **News Sentiment** | via AI Advisory | TODO |

### 1.3 Current Adapter Architecture (packages/core)

 - **vnbroker_adapter.py**: Single-source fallback chain (VCI → KBS → DNSE)
- **vnbroker_materializer.py**: Drop-in replacement reading from vnbroker
- **data_ingest/tasks.py**: ThreadPoolExecutor-based parallel fetching

### 1.4 Gaps Identified

1. **No Coordinated Parallel Scraping**: `backfill_daily_prices` uses ThreadPoolExecutor but no coordination
2. **No Multi-Provider Failover for Scraping**: One provider fails → entire batch fails
3. **No CVD/Strength Signal Ingestion**: Models exist (`OrderFlowEvent.cvd_at_signal`) but no scraping
4. **No Whale/Buy-Sell Scraping**: Models exist but no systematic scraping from providers
5. **No Intraday Tick Scraping for Large Universe**: Only warms ~60 demo symbols, not full universe
6. **No vnbroker_adapter Multi-Provider Support**: Native adapter (packages/core) not unified with legacy adapter

---

## 2. IMPLEMENTATION PLAN: COORDINATED PARALLEL SCRAPING SYSTEM

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COORDINATOR (Celery Beat)                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ scrape_coordinator_task                                   │  │
│  │  - Partition symbol matrix (N segments)                  │  │
│  │  - Dispatch N parallel scrape jobs (one per segment)      │  │
│  │  - Aggregate results & handle failures                    │  │
│  └───────────���─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Segment 1       │ │ Segment 2       │ │ Segment N      │
│ (50 symbols)    │ │ (50 symbols)    │ │ (50 symbols)  │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │ Parallel   │ │ │ │ Parallel   │ │ │ │ Parallel   │ │
│ │ Workers   │ │ │ │ Workers   │ │ │ │ Workers   │ │
│ │ (per     │ │ │ │ (per     │ │ │ │ (per     │ │
│ │ segment) │ │ │ │ segment) │ │ │ │ segment) │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              vnbroker_adapter (Multi-Provider)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                          │
│  │ VCI      │ │ KBS      │ │ DNSE     │                          │
│  │ Client   │ │ Client   │ │ Client   │                          │
│  └──────────┘ └──────────┘ └──────────┘                          │
│         │              │              │                          │
│         └──────────────┼──────────────┘                          │
│                        ▼                                            │
│            Multi-Provider Fallback                                  │
│            (Round-Robin + Failover)                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Implementation Phases

#### PHASE 1: Core Infrastructure (Week 1-2)

**T1.1: Create Coordinated Scraping Coordinator**
- `service_ops/tasks.py`: Add `scrape_coordinator_task(symbols, providers, segment_size=50)`
- Partition algorithm: Round-robin by provider capability
- Coordination mechanism: Celery chord or group

**T1.2: Create Segment Workers**
- `scrape_segment_task`: Scrapes a segment of symbols
- Per-symbol rate limiting (configurable delay)
- Error handling with retry + failover

**T1.3: Add Multi-Provider Registry**
- Registry model: `ScraperProviderConfig` (or reuse `VnbrokerRuntimeConfig`)
- Provider capabilities: which data types each can provide
- Health check + rotation logic

#### PHASE 2: Price Scraping (Week 2-3)

**T2.1: Coordinated Price Board Scraping**
- Scrape full active universe (~300+ symbols)
- Parallel by segment (6 segments × 50 symbols)
- Provider fallback: Primary (VCI), Fallback (KBS), Backup (DNSE)

**T2.2: Daily Price History Scraping**
- Integrate with existing `backfill_daily_prices`
- Add coordination layer for large backfills
- Provider round-robin for rate limit avoidance

#### PHASE 3: Intraday Tick Scraping (Week 3-4)

**T3.1: Parallel Intraday Tape Scraping**
- Fetch intraday trades for full universe
- Redis streaming publish per symbol
- Coordinated parallel fetch (no rate limit hit)

**T3.2: Intraday OHLCV Bars**
- Fetch intraday bars (1H, 15m, 5m timeframes)
- Store in `IntradayBar` model (already exists)

#### PHASE 4: Whale/Buy-Sell Scraping (Week 4-5)

**T4.1: Whale Order Scraping**
- Fetch large trades (>1B VND) from providers
- Store in `WhaleAlertCanonical` model
- Provider: VCI (primary), KBS (fallback), DNSE (backup)

**T4.2: Dark Flow Detection**
- Identify dark pool trades (large but price impact)
- Store in `OrderFlowEvent` with `signal_type='dark_flow'`

#### PHASE 5: CVD/Strength Scraping (Week 5-6)

**T5.1: Cumulative Volume Delta (CVD) Calculation**
- CVD = Buy Volume - Sell Volume (per symbol)
- Compute from intraday tick data
- Store in `OrderFlowEvent.cvd_at_signal`

**T5.2: Order Flow Strength Signal**
- Compute strength = (CVD / Total Volume) × 100
- Threshold-based signal generation
- Store in `OrderFlowEvent.strength`, `OrderFlowEvent.whale_intensity`

#### PHASE 6: Multi-Provider Unification (Week 6-7)

**T6.1: Unify vnbroker_adapter**
- Merge legacy adapter (backend/portfolio) with native adapter (packages/core)
- Single entry point: `vnbroker_adapter.fetch_*`
- Provider capability routing

**T6.2: Monitor Dashboards**
- Scrape cycle success rate
- Provider health metrics
- Per-segment latency tracking

---

## 3. SPECIFICATIONS

### 3.1 Symbol Matrix Partition

```python
def partition_symbols(symbols: list[str], num_segments: int = 6) -> list[list[str]]:
    """Partition symbol universe into N balanced segments."""
    # Round-robin distribute across segments for provider diversity
    segments = [[] for _ in range(num_segments)]
    for i, sym in enumerate(symbols):
        segments[i % num_segments].append(sym)
    return segments
```

### 3.2 Rate Limiting Configuration

| Provider | Max Requests/sec | Inter-symbol Delay (ms) | Burst Limit |
|----------|-----------------|------------------------|-------------|
| VCI | 10 | 100 | 50 |
| KBS | 20 | 50 | 100 |
| DNSE | TBD | TBD | TBD |

### 3.3 Queue Policy (Existing + New)

The system uses **6 Celery queues** defined in `queue_policy.py`. New scraping tasks will integrate into existing queues:

| Queue Name | Purpose | Existing Tasks |
|-----------|---------|-------------|
| `celery` | Default / generic | commercial, tenant_lifecycle |
| `realtime_prefetch` | Realtime data | materialize_symbol_snapshot, fetch_and_upsert_price_board |
| `realtime_stream` | Streaming | run_stream_consumer_batch |
| `analytics_heavy` | Heavy analytics | materialize_unified_alerts |
| `enrichment_offhours` | Off-hours batch | backfill_daily_prices |
| `manual_on_demand` | Manual triggers | run_signal_detection_job, run_scrape_cycle |

**Proposed New Task Routes:**

```python
# Add to QUEUE_DOMAIN_MATRIX
'scraping_coordinator': {
    'queue': 'realtime_prefetch',
    'task_routes': (
        'service_ops.tasks.scrape_coordinator_task',
        'service_ops.tasks.scrape_segment_task',
    ),
    'periodic_tasks': (
        'scrape-prices-5min',
        'scrape-intraday-1min',
    ),
},
'scraping_whale_signals': {
    'queue': 'analytics_heavy',
    'task_routes': (
        'service_ops.tasks.scrape_whale_task',
        'service_ops.tasks.scrape_cvd_task',
    ),
    'periodic_tasks': (
        'scrape-whale-15min',
        'scrape-cvd-15min',
    ),
},
'scraping_daily_history': {
    'queue': 'enrichment_offhours',
    'task_routes': (
        'service_ops.tasks.scrape_daily_history_task',
    ),
    'periodic_tasks': (
        'scrape-daily-history-1700',
    ),
},
```

### 3.4 Configuration: AUTO START, SCHEDULED, MANUAL

#### 3.4.1 AUTO START (Celery Beat - Automatic Periodic Tasks)

These tasks run automatically without manual intervention.

| Task Name | Data Type | Frequency | Queue | Time | Market Hours Only |
|----------|----------|----------|-------|------|-------------|
| `scrape-prices-5min` | Price | Every 5 min | realtime_prefetch | 08:30-15:00 | ✅ Yes |
| `scrape-intraday-1min` | Intraday Tick | Every 1 min | realtime_prefetch | 08:30-15:00 | ✅ Yes |
| `scrape-whale-15min` | Whale/Buy-Sell | Every 15 min | analytics_heavy | 08:30-15:00 | ✅ Yes |
| `scrape-cvd-15min` | CVD/Strength | Every 15 min | analytics_heavy | 08:30-15:00 | ✅ Yes |

**Market Hours Check Implementation:**

```python
from datetime import time

def is_market_hours() -> bool:
    """Check if current time is within HOSE market hours (08:30-15:00 ICT)."""
    import pytz
    from django.utils import timezone
    
    vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
    now = timezone.now().astimezone(vn_tz)
    
    market_open = now.replace(hour=8, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=0, second=0, microsecond=0)
    
    # Check weekday (Mon-Fri)
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    
    return market_open <= now <= market_close
```

#### 3.4.2 SCHEDULED (Time-based - End of Day)

These tasks run at specific times (typically end of trading day).

| Task Name | Data Type | Frequency | Queue | Scheduled Time (ICT) |
|----------|----------|----------|-------|----------------------|
| `scrape-daily-history-1700` | Daily OHLCV | Daily | enrichment_offhours | 17:00 ICT |
| `scrape-daily-history-1705` | Daily OHLCV (backup) | Daily | enrichment_offhours | 17:05 ICT |
| `materialize-pre-open-snapshots-840` | Pre-open | Daily 08:40 | realtime_prefetch | 08:40 ICT |

**Celery Beat Schedule Definitions:**

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # === SCRAPING: AUTO START (Periodic) ===
    
    # Price board: every 5 min during market hours
    'scrape-prices-5min': {
        'task': 'service_ops.tasks.scrape_coordinator_task',
        'schedule': 300.0,  # 5 minutes
        'kwargs': {'data_type': 'price', 'symbol_group': 'active'},
        'options': {'queue': 'realtime_prefetch'},
    },
    # Intraday tick: every 1 min during market hours  
    'scrape-intraday-1min': {
        'task': 'service_ops.tasks.scrape_coordinator_task',
        'schedule': 60.0,  # 1 minute
        'kwargs': {'data_type': 'intraday', 'symbol_group': 'active'},
        'options': {'queue': 'realtime_prefetch'},
    },
    # Whale signals: every 15 min
    'scrape-whale-15min': {
        'task': 'service_ops.tasks.scrape_coordinator_task',
        'schedule': 900.0,  # 15 minutes
        'kwargs': {'data_type': 'whale', 'symbol_group': 'universe'},
        'options': {'queue': 'analytics_heavy'},
    },
    # CVD/Strength: every 15 min
    'scrape-cvd-15min': {
        'task': 'service_ops.tasks.scrape_coordinator_task',
        'schedule': 900.0,  # 15 minutes
        'kwargs': {'data_type': 'cvd', 'symbol_group': 'active'},
        'options': {'queue': 'analytics_heavy'},
    },
    
    # === SCRAPING: SCHEDULED (Time-based) ===
    
    # Daily OHLCV backfill: 17:00 ICT (after HOSE close)
    'scrape-daily-history-1700': {
        'task': 'service_ops.tasks.scrape_daily_history_task',
        'schedule': crontab(hour=10, minute=0),  # 17:00 ICT = 10:00 UTC
        'kwargs': {'days': 365},
        'options': {'queue': 'enrichment_offhours'},
    },
    # Secondary daily backfill: 17:05 ICT (backup)
    'scrape-daily-history-1705': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': crontab(hour=10, minute=5),  # 17:05 ICT = 10:05 UTC
        'kwargs': {'days': 1},
        'options': {'queue': 'enrichment_offhours'},
    },
    
    # === EXISTING TASKS (Preserved) ===
    'ingest-price-board-60s': {
        'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
        'schedule': 60.0,
        'options': {'queue': 'realtime_prefetch'},
    },
    'daily-backfill-prices-1700': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': crontab(hour=10, minute=0),
        'kwargs': {'days': 365},
        'options': {'queue': 'enrichment_offhours'},
    },
}
```

#### 3.4.3 MANUAL (On-Demand - Admin API)

These tasks are triggered manually via admin API endpoints.

| Task Name | Data Type | Trigger | API Endpoint |
|----------|----------|---------|---------------|
| `run_scrape_cycle` | Full scrape | Manual | POST `/api/soc/scrape/run-cycle/` |
| `scrape_cell_task` | Per-segment | Manual | POST `/api/soc/scrape/segment/` |
| `scrape_health_check` | Provider health | Manual | GET `/api/soc/scrape/health/` |
| `manual_backfill_prices` | Historical | Manual | POST `/api/soc/scrape/backfill/` |

**Manual API Endpoints:**

```python
# service_ops/views.py

class ScrapeCycleRunView(SOCBaseView):
    """POST /api/soc/scrape/run-cycle/ - Run full scraping cycle."""
    
    def post(self, request):
        cycle_id = request.data.get('cycle_id', f'cycle_{timezone.now().isoformat()}')
        symbol_group = request.data.get('symbol_group', 'active')  # active, top100, full, custom
        providers = request.data.get('providers', ['VCI', 'KBS', 'DNSE'])  # which providers
        
        # Dispatch coordinator task
        task = run_scrape_cycle.delay(
            cycle_id=cycle_id,
            symbol_group=symbol_group,
            providers=providers
        )
        
        return Response({
            'status': 'queued',
            'task_id': task.id,
            'cycle_id': cycle_id,
        })


class ScrapeSegmentView(SOCBaseView):
    """POST /api/soc/scrape/segment/ - Run specific segment."""
    
    def post(self, request):
        segment_id = request.data.get('segment_id')
        data_type = request.data.get('data_type', 'price')
        
        task = scrape_segment_task.delay(
            segment_id=segment_id,
            data_type=data_type
        )
        
        return Response({
            'status': 'queued',
            'task_id': task.id,
        })


class ScrapeHealthCheckView(SOCBaseView):
    """GET /api/soc/scrape/health/ - Check provider health."""
    
    def get(self, request):
        from market_data.vnbroker_adapter import _fetch_realtime_price_with_quote_class, _load_quote_class
        
        results = {}
        providers = ['VCI', 'KBS', 'DNSE']
        
        for provider in providers:
            try:
                start = time.perf_counter()
                quote_cls = _load_quote_class(provider)
                result = _fetch_realtime_price_with_quote_class('FPT', provider, quote_cls)
                elapsed = time.perf_counter() - start
                
                results[provider] = {
                    'status': 'ok' if result else 'no_data',
                    'latency_ms': round(elapsed * 1000, 2),
                    'last_check': timezone.now().isoformat(),
                }
            except Exception as e:
                results[provider] = {
                    'status': 'error',
                    'error': str(e),
                    'last_check': timezone.now().isoformat(),
                }
        
        return Response(results)


class ManualBackfillView(SOCBaseView):
    """POST /api/soc/scrape/backfill/ - Manual historical backfill."""
    
    def post(self, request):
        days = request.data.get('days', 30)
        symbols = request.data.get('symbols')  # optional list
        
        result = backfill_daily_prices.delay(days=days, symbols=symbols)
        
        return Response({
            'status': 'queued',
            'task_id': result.id,
            'days': days,
        })
```

### 3.5 Provider Registry Model (Proposed)

```python
class ScraperProviderConfig(models.Model):
    name = models.CharField(max_length=16, unique=True)
    is_active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=100)
    
    # Capabilities
    price_enabled = models.BooleanField(default=True)
    intraday_enabled = models.BooleanField(default=True)
    history_enabled = models.BooleanField(default=True)
    whale_enabled = models.BooleanField(default=False)
    
    # Rate limits
    max_requests_per_second = models.PositiveIntegerField(default=10)
    inter_symbol_delay_ms = models.PositiveIntegerField(default=100)
    
    class Meta:
        ordering = ['priority']
```

---

## 4. DEPENDENCIES

### 4.1 Existing Models (Reuse)

- `market_data.DailyPrice` - Daily OHLCV storage
- `market_data.IntradayBar` - Intraday OHLCV bars
- `market_data.StockProfile` - Symbol universe
- `signal_intelligence.OrderFlowEvent` - CVD/Strength signals
- `signal_intelligence.UnifiedAlert` - Whale alerts
- `signal_intelligence.WhaleAlertCanonical` - Whale metadata
- `data_ingest.IngestJob`, `data_ingest.IngestRun` - Observability

### 4.2 Existing Tasks (Extend)

- `data_ingest.tasks.backfill_daily_prices` - Extend with coordination
- `data_ingest.tasks.warm_intraday_universe` - Extend to full universe
- `market_serving.vnbroker_materializer` - Integrate with new coordinator

### 4.3 Redis Usage (Existing)

- `vninvest:ticks:{symbol}` - Intraday stream (existing)
- Add: `vninvest:scrape:coordination:{task_id}` - Coordination state

---

## 5. IMPLEMENTATION TASKS

### Immediate (Next Sprint)

| ID | Task | Module | Estimate |
|----|------|--------|---------|
| P1 | Create `scrape_coordinator_task` | service_ops/tasks.py | 2 days |
| P2 | Create `scrape_segment_task` | service_ops/tasks.py | 2 days |
| P3 | Add Provider Registry | market_data/models.py | 1 day |
| P4 | Integrate price scraping | service_ops/tasks.py | 2 days |
| P5 | Test coordinator with 300 symbols | QA | 1 day |

### Short-term (Within Month)

| ID | Task | Module | Estimate |
|----|------|--------|---------|
| S1 | Intraday tick scraping | vnbroker_adapter.py | 3 days |
| S2 | Whale order scraping | vnbroker_adapter.py | 3 days |
| S3 | CVD/Strength calculation | signal_intelligence/materializers.py | 3 days |
| S4 | Add Celery Beat schedules | vninvest_core/settings.py | 1 day |

### Medium-term (Within Quarter)

| ID | Task | Module | Estimate |
|----|------|--------|---------|
| M1 | Unify vnbroker adapters | packages/core + backend | 5 days |
| M2 | Multi-provider failover | vnbroker_adapter.py | 3 days |
| M3 | Scrape monitoring dashboards | service_ops/views.py | 3 days |
| M4 | Performance optimization | All layers | 5 days |

---

## 6. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider rate limits | Scraping failures | Inter-symbol delays, provider rotation |
| Network timeouts | Incomplete data | Retry with exponential backoff |
| Provider API changes | Data breakage | Version pinned adapters, health checks |
| Large universe latency | Stale data | Parallel segments, reduce segment size |
| Memory pressure | OOM in workers | Batch commits, streaming Redis |

---

## 7. SUCCESS METRICS

- **Price Update Latency**: < 30 seconds for full universe (300 symbols)
- **Intraday Tick Freshness**: < 2 minutes
- **Whale Signal Detection**: Within 15 minutes of occurrence
- **CVD/Strength Updates**: Within 15 minutes
- **Scrape Success Rate**: > 95% (per segment)
- **Provider Failover**: < 10 seconds detection

---

## 8. APPROVAL REQUEST

This plan outlines the **Coordinated Parallel Scraping Architecture** for the VNInvest scraping system. The implementation will build on existing Celery infrastructure and provide multi-provider, parallel scraping for:

1. **Price** (realtime + daily history)
2. **Intraday Tick Data**
3. **Whale Buy/Sell Orders**
4. **CVD/Strength Signals**

The architecture uses a coordinator-based approach that partitions the symbol universe into segments, dispatches parallel scraping tasks, and provides resilient failover across multiple providers (VCI, KBS, DNSE).

**Request**: Please review and confirm to proceed with Phase 1 implementation.
