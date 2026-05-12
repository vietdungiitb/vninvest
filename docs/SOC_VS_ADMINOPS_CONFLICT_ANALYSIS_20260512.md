# Service Operations Center (SOC) vs Existing Admin-Ops — Conflict Analysis & Integration Strategy
**Ngày**: 2026-05-12  
**Mục tiêu**: Phân tích xung đột giữa SOC proposal và Admin-Ops hiện tại, xác định ranh giới, tránh duplicate functionality.

---

## I. EXISTING ADMIN-OPS INFRASTRUCTURE — Current State

### A. Frontend Pages
| Component | Location | Purpose | Scope |
|---|---|---|---|
| **AdminOps.jsx** | `frontend/src/pages/AdminOps.jsx` | Main dashboard | System stats, realtime status, last sync times, shortcuts |
| **AdminOpsShellHost.jsx** | `frontend/src/pages/AdminOpsShellHost.jsx` | Shell wrapper | Bootstrap dari core runtime |
| **GlobalScreenerAdminPanel** | `frontend/src/components/adminops/` | Screener rules | Define global screening rules (whale intensity, dark flow thresholds) |
| **SignalControlCenter** | `frontend/src/components/adminops/` | Signal detection | Whale alerts, order flow, advisory config, job management |
| **VnbrokerBenchmarkPanel** | `frontend/src/components/adminops/` | Performance testing | Benchmark VNBroker/KBS/VCI providers |

### B. Current Admin-Ops Responsibilities

#### 1. System Observability & Metrics
- User/portfolio/symbol/watchlist counts
- Realtime status (Redis, Channel layer health)
- Audit event logs
- Runtime KPI (Celery worker status, queue depths, task latency)
- Advisory generation metrics (tokens used, budget remaining)
- Whale pipeline metrics (detection rate, broadcast status)

#### 2. Data Ingestion & Refresh Management
```
├─ Warm Ticker Prefetch (manual trigger)
├─ Off-peak VNBroker Ingest (scheduler + history)
├─ Market Groups Sync (fetch listings from API)
├─ Stock Profile Sync (create/update StockProfile records)
├─ Watchlist Sync (update cached prices for user watchlists)
├─ DNSE Sync (pull account balances from LightSpeed API)
├─ Intraday Side Backfill (historical tick recovery)
└─ Intraday Universe Warm (cache pre-open snapshot)
```

#### 3. Configuration Management
```
├─ VNBroker Adapter Config (concurrency, timeouts, rate-limit settings)
│  └─ Current + Changelog + Benchmark recommendation
├─ Prefetch Runtime Settings (hot/warm/cold tier limits, intervals, batch sizes)
├─ Prefetch Time Policy (timezone, market hours, profiles for pre-open/lunch/close)
├─ System AI Settings (whale threshold, dark flow confidence, advisory budget)
└─ Global Screener Config (cron expression, user screener enabled/disabled)
```

#### 4. Signal Detection Governance
```
├─ Whale Alert Detection Config (threshold, cooldown, confidence)
├─ Order Flow Detection Config (cooldown, max symbols)
├─ Advisory Generation Config (batch size, interval, model selection)
├─ Signal Retention Policy (keep days for whale events, dark flow, intraday ticks)
├─ Universe Policy (which symbols to monitor — tracked, watchlist, alert rules, portfolio, groups)
├─ Job Management (manual trigger, retry, view history)
└─ Money Flow Materialization (forensic window creation, retention preview)
```

#### 5. Operator Surface Gating
```
├─ Admin routes visibility (/admin-ops, /ai-command-center)
├─ Operator identity snapshot (username, is_staff, is_superuser)
├─ Core runtime status
├─ Surface flags (show_admin_ops, show_ai_command_center, show_vip_shell)
└─ Operator abilities (list of permissions)
```

### C. Admin-Ops API Endpoints (19+ routes)

```
/api/admin-ops/stats/                                    — System statistics
/api/admin-ops/runtime-kpi/                              — Worker/queue metrics
/api/admin-ops/runtime-kpi/advisory-merge/              — Advisory merge state
/api/admin-ops/runtime-kpi/whale-pipeline/              — Whale detection metrics
/api/admin-ops/system-ai-settings/                       — AI thresholds + audit
/api/admin-ops/vnbroker-config/current/                 — Current VNBroker config
/api/admin-ops/vnbroker-config/update-config/           — Save new config
/api/admin-ops/vnbroker-config/changelog/               — Config history
/api/admin-ops/vnbroker-config/benchmark-price-board/   — Benchmark & recommendation
/api/admin-ops/prefetch/warm/                            — Manual warm cache
/api/admin-ops/prefetch/offpeak-ingest/                 — Manual off-peak fetch
/api/admin-ops/prefetch/offpeak-ingest/history/         — Ingest run history
/api/admin-ops/market-groups/sync/                       — Fetch listings
/api/admin-ops/intraday-side-backfill/preview/          — Preview backfill scope
/api/admin-ops/intraday-side-backfill/apply/            — Execute backfill
/api/admin-ops/intraday-side-backfill/status/{task_id}/ — Poll backfill progress
/api/admin-ops/intraday-universe/warm-now/              — Cache pre-open snapshot
/api/admin-ops/signals/summary/                          — Whale/dark flow state
/api/admin-ops/signals/config/                           — Whale governance + retention
/api/admin-ops/signals/universe/preview/ + apply/        — Universe policy (symbols)
/api/admin-ops/signals/money-flow/materialization/      — Forensic window creation
/api/admin-ops/signals/jobs/                             — Job registry + run history
/api/admin-ops/signals/jobs/run/ + retry/               — Manual job trigger & retry
/api/admin-ops/signals/events/recent/                    — Recent whale/dark events
/api/admin-ops/signals/retention/preview/               — Retention preview
```

---

## II. PROPOSED SOC ARCHITECTURE — What It Would Add

### A. New Responsibilities (Service-Level)

```
SOC = Unified registry for ALL background services running on Celery Beat + Workers

├─ ServiceDefinition           (metadata + governance for each service)
├─ ServiceConfig               (centralized + versioned configuration)
├─ ServiceHealthCheck          (periodic health probes + alerting)
├─ ServiceRun                  (execution records + logs + audit trail)
├─ ServiceDependency           (DAG: parent → child coordination)
├─ ServiceAlert                (failure threshold + stale detection)
└─ Service Queue Management    (prioritization: realtime_prefetch > default > offhours)
```

### B. Services SOC Would Manage

The 23+ services we cataloged:
1. Realtime Ticker Prefetch (3 services)
2. Whale Alert Detection (2 services)
3. Order Flow Detection (1 service)
4. Advisory Generation (3 services)
5. Data Enrichment & Ingest (3 services)
6. Stream Consumers (3 services)
7. Portfolio Sync/DNSE (3 services)
8. Config Management (2 services)
9. Maintenance & Cleanup (3 services)

---

## III. OVERLAP & CONFLICT ANALYSIS

### A. Direct Overlaps — Existing Admin-Ops ↔ Proposed SOC

| Feature | Currently in Admin-Ops | SOC Would Add | Conflict? |
|---------|---|---|---|
| **Manual Trigger** | ✅ Warm prefetch, off-peak ingest, screener, jobs | ✅ SOC would add UI for ALL 23 services | 🟡 YES — two trigger UIs |
| **Configuration** | ✅ VNBroker, prefetch, AI settings, screener config | ✅ SOC would centralize ALL configs | 🟡 YES — config split across 2 places |
| **Health Monitoring** | ✅ Runtime KPI shows worker alive/dead status | ✅ SOC would add periodic health probes + alerting | 🟡 YES — duplicate health checks |
| **Run History** | ✅ Vnbroker changelog, ingest history, job history | ✅ SOC would track ALL service runs in one place | 🟡 YES — history split across 2 systems |
| **Error Recovery** | ❌ No circuit breaker/retry logic | ✅ SOC would add retry policy + circuit breaker | ✅ NO CONFLICT — new feature |
| **Queue Prioritization** | ❌ No queue management | ✅ SOC would implement dedicated queues | ✅ NO CONFLICT — new feature |
| **Dependency DAG** | ❌ Services run independently | ✅ SOC would add task coordination | ✅ NO CONFLICT — new feature |

### B. Functional Overlap Examples

#### Example 1: Manual Trigger
```
Admin-Ops TODAY:
├─ User clicks "Warm Now" button
├─ Calls warmTickerPrefetch_api
├─ Executes portfolio.tasks.warmup_realtime_ticker_cache
└─ Shows result

SOC WOULD ADD (Conflict):
├─ User clicks Service Registry → find "prefetch_realtime_ticker_shard" → click "Trigger"
├─ Modal pops up with parameters
├─ Calls /api/soc/services/{id}/trigger/
├─ SOC executes same task via ServiceRun wrapper
└─ Shows result + full audit trail
```

**Problem**: Two UIs, two ways to trigger the same service. User confusion.

#### Example 2: Configuration
```
Admin-Ops TODAY:
├─ Prefetch Runtime Settings stored in multiple places:
│  ├─ Hardcoded in settings.py (TICKER_PREFETCH_HOT_LIMIT)
│  ├─ Cached in Redis (VNBROKER_RUNTIME_SETTINGS_CACHE_KEY)
│  └─ Database (VnbrokerRuntimeConfig)
└─ UI form scattered across multiple tabs

SOC WOULD ADD (Conflict):
├─ ServiceConfig table (versioned, centralized)
├─ Config editor with rollback
└─ Version history
```

**Problem**: Configs still split between Admin-Ops db models + SOC ServiceConfig. No unified SSOT.

#### Example 3: Health Checks
```
Admin-Ops TODAY:
├─ /api/admin-ops/runtime-kpi/ polls worker.ping()
├─ Checks Redis health
├─ Checks queue depths
└─ Shows in RuntimeKPIPanel

SOC WOULD ADD (Conflict):
├─ ServiceHealthCheck table
├─ Periodic probes every 5 minutes
├─ Alert after 3 consecutive failures
└─ Shows in SOC health heatmap
```

**Problem**: Duplicate health checking. Which one is source of truth?

---

## IV. INTEGRATION STRATEGY — Recommended Approach

### Option 1: Full SOC Replacement (Recommended)
```
DEPRECATE Admin-Ops panels one by one, MIGRATE functionality to SOC

Timeline: Phase out existing Admin-Ops over 3-4 weeks

Phase 1 (Week 1):  Deploy SOC + register 10 "data enrichment" services
                   └─ Warm ticker, off-peak ingest, market groups, DNSE sync
                   └─ Keep existing Admin-Ops UI for backward compat

Phase 2 (Week 2):  Register 5 "signal detection" services
                   ├─ Whale detection, order flow, advisory generation
                   ├─ Migrate Signal Control Center → SOC signal panel
                   └─ Mark SignalControlCenter.jsx as deprecated

Phase 3 (Week 3):  Register 8 "maintenance" services
                   ├─ Stream consumers, cleanup, trial processing
                   ├─ Migrate VnbrokerBenchmarkPanel → SOC benchmarking
                   └─ Mark VnbrokerBenchmarkPanel.jsx as deprecated

Phase 4 (Week 4):  Full migration complete
                   ├─ Delete AdminOps.jsx tabs that are now in SOC
                   ├─ Keep AdminOpsShellHost as read-only status view
                   └─ Clean up 50+ API endpoints consolidated into 15 SOC API routes
```

**Advantages**:
- ✅ Single SSOT for all service governance
- ✅ Unified health monitoring (no duplicate checks)
- ✅ Config truly centralized + versioned
- ✅ One UI, one way to do things
- ✅ Reduced backend API surface (consolidate 50+ endpoints → 15 SOC endpoints)

**Disadvantages**:
- ⚠️ Requires migration effort (5-8 weeks instead of 6-8)
- ⚠️ Brief period where two UIs coexist (potential confusion)
- ⚠️ Need to migrate existing config values from Admin-Ops models → ServiceConfig

---

### Option 2: Parallel Systems (Not Recommended)
```
Keep Admin-Ops as-is, add SOC as new system

Admin-Ops handles:
├─ System observability (stats, realtime status, audit logs)
├─ Data ingestion management (prefetch, ingest, sync)
├─ Configuration (vnbroker, prefetch, AI settings)
└─ Adhoc manual operations (screener, backfill)

SOC handles:
├─ Service registry (metadata)
├─ Periodic health checks
├─ Service dependency DAG
├─ Queue prioritization
└─ Advanced features (circuit breaker, retry policies)
```

**Problem**: 
- ❌ Duplicate health checks (Admin-Ops runtime KPI + SOC health check = two sources of truth)
- ❌ Config split: some in Admin-Ops db models, some in SOC ServiceConfig
- ❌ Manual trigger split: "Warm Now" in Admin-Ops, "trigger" in SOC for same service
- ❌ Run history split: Admin-Ops has vnbroker changelog + job history, SOC has ServiceRun history
- ❌ User confusion (which UI to use?)
- ❌ Maintenance nightmare (two systems to update)

**Not recommended** ❌

---

### Option 3: SOC as "Audit Layer" (Hybrid)
```
Keep Admin-Ops UI mostly as-is, but SOC becomes the backend registry + audit

Admin-Ops UI still shows:
├─ Runtime KPI (but reads from SOC ServiceHealthCheck, not separate polling)
├─ Config forms (but saves to ServiceConfig, not separate tables)
├─ Manual triggers (but queues via SOC, not direct Celery)
└─ Run history (but reads from ServiceRun, not scattered models)

SOC provides:
├─ Unified ServiceDefinition registry
├─ Centralized ServiceConfig with versioning
├─ ServiceHealthCheck snapshot (source of truth for health)
├─ ServiceRun + ServiceRunLog (audit trail)
├─ Service dependencies + prioritization
└─ Advanced features (circuit breaker, retry policies)
```

**Advantages**:
- ✅ Minimal frontend disruption (Admin-Ops UI looks similar)
- ✅ Single SSOT backend (all data in service_ops app)
- ✅ Cleaner API surface (Admin-Ops routes → SOC routes internally)
- ✅ Gradual migration (can update backend while keeping UI stable)

**Disadvantages**:
- ⚠️ Admin-Ops forms + SOC duplicate some logic (health check triggering, etc.)
- ⚠️ Two naming systems (existing Admin-Ops panels + SOC terminology)
- ⚠️ Still needs careful coordination

**Moderately recommended** 🟡

---

## V. RECOMMENDED DECISION: Hybrid Approach (Option 3) + Roadmap to Full Migration (Option 1)

### Phase 1: Create SOC Backend (Weeks 1-2) — Minimal Frontend Impact
```
├─ Create service_ops Django app with 6 models
├─ Create 15 REST API endpoints
├─ Register 23 existing services in ServiceDefinition
├─ Migrate existing configs from scattered locations → ServiceConfig table
├─ Create health check scheduler
├─ Admin-Ops UI still works, but now reads from SOC backend
└─ Zero breaking changes to frontend
```

**New URLs** (backend only):
```
/api/soc/services/           # (read-only, or admin only)
/api/soc/services/{id}/      # (read-only)
/api/soc/health/             # (replaces multiple admin-ops KPI calls)
/api/soc/runs/               # (replaces scattered run history endpoints)
/api/soc/alerts/             # (new feature)
```

**No changes to existing**:
```
/api/admin-ops/stats/
/api/admin-ops/runtime-kpi/  (still works, but now reads SOC health check)
/api/admin-ops/signals/*     (still works, now reads SOC config + runs)
/api/admin-ops/vnbroker-config/*
/etc.
```

### Phase 2: Migrate Admin-Ops to SOC Backend (Weeks 3-4)
```
├─ Admin-Ops.jsx starts calling /api/soc/ instead of multiple /api/admin-ops/ routes
├─ New "SOC Registry Grid" tab in AdminOps.jsx shows all 23 services
├─ New "Health Heatmap" replaces RuntimeKPIPanel
├─ "Manual Trigger" unified UI (replaces Warm Now, Job Run, etc.)
├─ "Config Editor" unified UI (replaces 4+ separate config forms)
├─ Old Admin-Ops panels gradually marked as "legacy" or removed
└─ Deprecation warnings added for old endpoints
```

### Phase 3: New SOC Features (Weeks 5-6)
```
├─ Circuit breaker + fallback policies
├─ Queue prioritization (realtime_prefetch > default > offhours)
├─ Task dependency DAG (whale alert → distribution coordination)
├─ Slack/PagerDuty integration
├─ Performance metrics + trend analysis
└─ SLA tracking
```

### Phase 4: Legacy Cleanup (Week 7+)
```
├─ Delete deprecated Admin-Ops API endpoints
├─ Remove scattered config models (keep only ServiceConfig)
├─ Delete AdminOpsStatsView, AdminOpsRuntimeKPIView (kept for reference only)
├─ Consolidate 50+ endpoints down to 15 SOC endpoints
└─ Final audit: Zero duplicate functionality
```

---

## VI. CONFLICT RESOLUTION DETAILS

### Conflict 1: Manual Trigger UI
```
CURRENT:
├─ AdminOps.jsx has 8+ different "Manual Trigger" buttons
│  ├─ "Warm Now" (prefetch)
│  ├─ "Sync Market Groups" (listing fetch)
│  ├─ "Sync Stock Profile" (profile creation)
│  ├─ "Run Manual Screener" (global screener)
│  ├─ "Sync DNSE Balances" (portfolio)
│  ├─ "Run Job" (signal detection)
│  └─ etc.
└─ Each has different UI, parameters, result format

AFTER SOC:
├─ Unified "Manual Trigger" modal
│  ├─ Service dropdown (all 23 services)
│  ├─ Parameters section (auto-populate schema from ServiceDefinition)
│  ├─ Priority selector (low/normal/high → queue routing)
│  └─ Live log stream
└─ One way to trigger any service
```

### Conflict 2: Configuration
```
CURRENT (Scattered):
├─ VNBroker config in VnbrokerRuntimeConfig model
├─ Prefetch topology in cache + hardcoded settings.py
├─ AI thresholds in SystemAISettings model
├─ Screener cron in AdminGlobalScreenerConfig model
└─ Signal retention in global_signal_policy_helpers.py

AFTER SOC:
├─ ServiceDefinition.config_json stores all config
├─ ServiceConfig table with version history
├─ Config editor shows current + all previous versions
├─ Rollback in 30 seconds
└─ Full audit trail (who changed what, when)
```

### Conflict 3: Health Checks
```
CURRENT:
├─ /api/admin-ops/runtime-kpi/ polls Celery workers
│  └─ Returns: worker alive status, queue depths, task latency
├─ No proactive alerting (user discovers failure when checking dashboard)
└─ No threshold tracking

AFTER SOC:
├─ ServiceHealthCheck model stores last 5 checks
├─ HealthCheckScheduler task runs every 5 minutes
├─ Alerts triggered after 3 consecutive failures
├─ Stale detection (alert if no run in 30 min)
└─ Slack/PagerDuty notifications
```

---

## VII. IMPLEMENTATION CHECKLIST

### Before Coding Phase 1 (SOC Backend)
- [ ] Agree on integration strategy (recommend Option 3 + roadmap to Option 1)
- [ ] Finalize ServiceDefinition schema (discuss config_json structure)
- [ ] Determine health check interval (recommend 5 minutes)
- [ ] Define alert thresholds (recommend 3 consecutive failures)
- [ ] Plan config migration (which existing configs → which ServiceConfig entries)

### Phase 1 Deliverables
- [ ] service_ops Django app with models
- [ ] Database migrations
- [ ] 15 REST API endpoints
- [ ] 23 service definitions registered
- [ ] Health check scheduler
- [ ] Admin interface for ServiceDefinition + ServiceConfig

### Backward Compatibility Checklist
- [ ] Existing /api/admin-ops/* routes still work during Phase 1
- [ ] Admin-Ops.jsx still renders without breaking during transition
- [ ] No data loss (all existing configs migrated to ServiceConfig)
- [ ] Gradual rollout (can enable SOC per-service instead of big bang)

---

## VIII. RECOMMENDATION FOR USER

**PROCEED WITH SOC USING HYBRID APPROACH (Option 3)**

1. **Week 1-2**: Create SOC backend infrastructure (service_ops app)
2. **Week 2-3**: Migrate existing configs + register 23 services
3. **Week 3-4**: Build SOC React dashboard components
4. **Week 4-5**: Integrate SOC UI into AdminOps.jsx (in parallel tabs)
5. **Week 5-6**: Add advanced SOC features (circuit breaker, DAG, etc.)
6. **Week 6+**: Gradually deprecate old Admin-Ops panels + cleanup

**No conflict if done correctly** ✅

The key is:
- Keep Admin-Ops UI for user familiarity
- Make SOC the backend SSOT for all data
- Gradually migrate Admin-Ops → SOC over 3-4 weeks
- Delete old duplicate endpoints once migration is done

---

**Do you want to proceed with this strategy, or prefer Option 1 (full deprecation of Admin-Ops)?**
