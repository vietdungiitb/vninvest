# Tổng Kết Trạng Thái Hệ Thống — SaaS vs Hybrid (2026-05-13)

**Tác vụ**: C1-C7 SaaS Full Independence Cutover HOÀN THÀNH  
**Trạng thái hiện tại**: ✅ Frontend 100% SaaS | ⚠️ Backend vẫn HYBRID (legacy workers still active)

---

## 1. Trạng Thái Frontend (100% SaaS)

### ✅ FULL SAAS
- **Frontend App**: React (packages/web) → nginx:80
- **Single API Gateway**: core-api:8100 (localhost:8001 in dev)
- **Routes**: 46 native routes (9 realtime + 11 stock-mgmt + 16 portfolio)
- **Auth**: JWT bearer tokens
- **Dependency**: frontend depends ONLY on `core-api` (not backend:8000)

```yaml
# docker-compose.dev.yml
frontend:
  depends_on:
    core-api:
      condition: service_healthy
  ports:
    - "80:80"
```

**Không còn phụ thuộc backend:8000** ✅

---

## 2. Trạng Thái Backend API (100% SaaS)

### ✅ FULL SAAS
- **backend:8000 DECOMMISSIONED** — commented in compose.dev.yml
- **core-api:8100** — single source of truth for all API routes
- **Routes wired natively**:
  - Market Serving (realtime): 9 routes → ✅ native
  - Market Data (stock-mgmt): 11 routes → ✅ native
  - User Workspace (portfolio): 16 routes → ✅ native
  - Advisory (AI): delegated to advisory domain ✅
  - Identity (auth): native ✅

**Backend REST API 100% SaaS** ✅

---

## 3. Trạng Thái Celery Task Queue (⚠️ HYBRID)

### ❌ HYBRID — Legacy Workers STILL RUNNING

**Python 3.13 (Core) Workers** ✅ — All new
| Service | Queue | Purpose | Status |
|---------|-------|---------|--------|
| core-worker | celery, realtime_prefetch, analytics_heavy, manual_on_demand | General worker | ✅ Running |
| core-worker-realtime-prefetch | realtime_prefetch | Market data ingest (60s schedule) | ✅ Running |
| core-worker-analytics | analytics_heavy | Heavy analytics tasks | ✅ Running |
| core-worker-realtime-stream | realtime_stream | Real-time feed streaming | ✅ Running |
| core-worker-enrichment | enrichment_offhours | Data enrichment off-hours | ✅ Running |
| core-worker-manual | manual_on_demand | Manual ad-hoc tasks | ✅ Running |
| core-beat | — | Celery Beat scheduler (C1) | ✅ Running |

**Python 3.11 (Legacy) Workers** ⚠️ — Still active, NOT removed
| Service | Queue | Purpose | Status |
|---------|-------|---------|--------|
| backend-worker-manual | manual_on_demand | Manual legacy tasks | ⚠️ ACTIVE |
| backend-prefetch-worker | realtime_prefetch | Legacy prefetch tasks | ⚠️ ACTIVE |
| backend-beat | — | Legacy Celery Beat scheduler | ⚠️ ACTIVE |

**Redis Configuration (Hybrid)**:
- **Redis Slot 1**: Legacy tasks (backend workers use)
- **Redis Slot 3**: Core tasks (core-api + core workers use)

**Problem**: BOTH core + legacy workers running in parallel
- Core workers process: realtime_prefetch, manual_on_demand, etc.
- Legacy workers ALSO process: realtime_prefetch, manual_on_demand, etc.
- Tasks executed by BOTH — redundancy, potential conflicts

---

## 4. Trạng Thái Schedulers (⚠️ HYBRID)

### ❌ HYBRID — Legacy Beat STILL RUNNING

**Core-Beat** (Python 3.13) ✅
- Scheduler: Database Scheduler
- Tasks: ingest-price-board-60s (C1 upgrade)
- Status: **ACTIVE**
- Config: vninvest_core/settings.py

**Backend-Beat** (Python 3.11) ⚠️
- Scheduler: Legacy Database Scheduler  
- Tasks: schedule_realtime_prefetch_shards, offpeak_vnbroker_ingest
- Status: **STILL ACTIVE**
- Config: backend/config/settings.py

**Problem**: BOTH schedulers running simultaneously
- Potential duplicate task scheduling (same task queued twice)
- Race conditions on database scheduler state

---

## 5. Trạng Thái Database (⚠️ HYBRID)

### ⚠️ HYBRID — Shared Database

**Database**: PostgreSQL vninvest (single database)

**Current State**:
- **core-api** writes to: vninvest DB (native models)
- **legacy backend** (if running) would write to: vninvest DB (legacy models)
- **both app servers OFF** but workers still active

**Data Models**:
- ✅ Native (core-api tables):
  - SymbolSnapshot, DailyPrice, UnifiedAlert, Portfolio, Transaction, etc.
  - Models in `packages/core/backend/src/`
- ⚠️ Legacy (backend tables, may still exist):
  - Various Django app models from ./backend
  - Not actively used (backend:8000 commented) but tables may still exist

**Migration Status**:
- **Data migrated to native schemas**: ✅
- **Legacy models data**: May still exist in DB (not cleaned up)
- **Constraint**: Single PostgreSQL instance (no separation)

---

## 6. Trạng Thái Cache/Broker (⚠️ HYBRID)

### ⚠️ HYBRID — Redis Slots Separated

**Redis Instance**: Single redis:6379

**Slot Configuration**:
| Slot | Owner | Purpose | Status |
|------|-------|---------|--------|
| 0 | — | Unused | |
| 1 | **Legacy Backend** | Cache + broker for backend workers | ⚠️ ACTIVE |
| 2 | **Legacy Backend** | Cache for legacy app | ⚠️ ACTIVE |
| 3 | **core-api** | Broker + cache for core workers | ✅ ACTIVE |

**Current Issue**:
- Both legacy (slots 1-2) and core (slot 3) consuming Redis simultaneously
- If legacy workers decommissioned, slots 1-2 can be freed

---

## 7. Chi Tiết Dữ Liệu Chưa Migrate (Graceful Stubs)

### ❌ NOT YET NATIVE — Features Returning Stubs

**Endpoints returning HTTP 200 + empty data (intentional)**:

| Feature | Endpoint | Status | Model | Plan |
|---------|----------|--------|-------|------|
| Intraday Bars | GET /realtime/intraday/<symbol>/ | ⏳ Stub | IntradayBar | Week 2 |
| Order Book Depth | GET /realtime/depth-chart/<symbol>/ | ⏳ Stub | OrderBookDepth | Week 3 |
| News Feed | GET /stock-management/stocks/<symbol>/news/ | ⏳ Stub | News | Week 4 |
| Financial Data | GET /stock-management/stocks/<symbol>/financials/ | ⏳ Stub | Financials | TBD |
| Backtest Stats | GET /portfolio/<id>/backtest-stats/ | ⏳ Stub | BacktestResult | TBD |
| Group Management | GET /stock-management/groups/ | ⏳ Stub | Group | TBD |

**Graceful Degradation**: Frontend shows placeholder UI; not blocking

---

## 8. WebSocket Status (❓ TBD)

### ❓ NOT MIGRATED YET

**Status**: Symbol ticker streaming via WebSocket
- **Current**: Unknown if legacy or native
- **Constraint** (AGENTS.md): "WebSocket symbol parameter phải được sanitize" (B9 requirement)
- **Action Required**: 
  1. Verify if WebSocket handling exists in core-api
  2. If not, migrate ticker stream endpoint
  3. Ensure symbol sanitization (B9 rule)

---

## 9. Tóm Tắt HYBRID Components

### ✅ FULL SAAS (Complete)
1. **Frontend** → core-api:8100 only
2. **REST API** — 46 routes native
3. **Auth System** — JWT tokens native
4. **Core Workers** — Python 3.13, processing all queues

### ⚠️ HYBRID (Still Running Legacy)
1. **Legacy Workers** — Python 3.11 (backend-worker-manual, backend-prefetch-worker)
2. **Legacy Beat Scheduler** — backend-beat (Python 3.11)
3. **Redis Slots 1-2** — Legacy cache/broker still active
4. **Legacy Database Models** — May still exist in PostgreSQL

### ❌ DECOMMISSIONED (Already Removed)
1. **backend:8000** — API server (commented in compose)
2. **backend:8000 Routes** — All migrated to core-api
3. **legacy_http_bridge.py** — Module deleted from codebase

---

## 10. Công Việc Còn Lại (Roadmap)

### Phase 1: Decommission Legacy Workers (THIS WEEK)
**Action**: Remove legacy workers from compose.dev.yml
```yaml
# DELETE these services:
# - backend-worker-manual (Python 3.11)
# - backend-prefetch-worker (Python 3.11)
# - backend-beat (Python 3.11)
```

**Impact**:
- Redis slots 1-2 freed
- No more duplicate task processing
- Single source of task scheduling (core-beat)

**Validation**:
- core-worker-manual handles all manual tasks ✅
- core-worker-realtime-prefetch handles price-board ingest ✅
- core-beat handles all schedules ✅

### Phase 2: Migrate Remaining Data Models (2-4 WEEKS)
| Model | Endpoint | Timeline | Owner |
|-------|----------|----------|-------|
| IntradayBar | /realtime/intraday/<symbol>/ | Week 2 | Data Eng |
| OrderBookDepth | /realtime/depth-chart/<symbol>/ | Week 3 | Data Eng |
| News | /stock-management/stocks/<symbol>/news/ | Week 4 | Data Eng |
| Financials | /stock-management/stocks/<symbol>/financials/ | TBD | TBD |

### Phase 3: Clean Up Database (OPTIONAL)
- Drop legacy Django app tables (if safe)
- Verify no data references

### Phase 4: WebSocket Migration (TBD)
- Verify ticker stream in core-api
- Implement symbol sanitization (B9 constraint)

---

## 11. Current Docker Compose Running Services

```yaml
✅ db                            (PostgreSQL 15)
✅ redis                         (Redis 7)
✅ mailpit                       (Email service)
✅ core-api                      (Python 3.13, Daphne)
✅ core-worker                   (Python 3.13, Celery)
✅ core-worker-realtime-prefetch (Python 3.13, Celery)
✅ core-worker-analytics         (Python 3.13, Celery)
✅ core-worker-realtime-stream   (Python 3.13, Celery)
✅ core-worker-enrichment        (Python 3.13, Celery)
✅ core-worker-manual            (Python 3.13, Celery)
✅ core-beat                     (Python 3.13, Beat)
⚠️  backend-worker-manual         (Python 3.11, Celery) — LEGACY
⚠️  backend-prefetch-worker       (Python 3.11, Celery) — LEGACY
⚠️  backend-beat                  (Python 3.11, Beat) — LEGACY
✅ frontend                      (React, nginx)

Total: 16 services (13 core + 3 legacy)
```

---

## 12. Frontend Developer Impact

### NOW (2026-05-13)
- ✅ Can code against core-api:8100
- ✅ 46 routes available (9+11+16)
- ✅ No waiting for backend API stability
- ⚠️ Some features stubbed (intraday, depth, news)

### NEXT (After Legacy Worker Decommission)
- ✅ Cleaner architecture (only core workers)
- ✅ No task duplication
- ✅ Single scheduler (core-beat)
- ✅ Reduced memory footprint (3 fewer containers)

---

## 13. Recommended Next Actions

### TODAY (2026-05-13)
✅ Gate G approved — SaaS frontend/API ready
✅ Frontend developers start coding
✅ Document known limitations (stubs)

### THIS WEEK (2026-05-13 to 2026-05-17)
1. **Verify** core workers handling all tasks correctly
2. **Monitor** for duplicate task execution (legacy overlap)
3. **Plan** legacy worker decommission
4. **Communicate** to ops team about upcoming removal

### NEXT WEEK (2026-05-20)
1. **Remove** backend-worker-manual from compose
2. **Remove** backend-prefetch-worker from compose
3. **Remove** backend-beat from compose
4. **Validate** core-beat still scheduling correctly
5. **Commit** cleanup to dev/main

---

## 14. Risk Assessment

| Risk | Severity | Cause | Mitigation |
|------|----------|-------|-----------|
| Duplicate task execution | Medium | Legacy + core workers both processing same queue | Monitor logs; remove legacy workers ASAP |
| Scheduler conflicts | Medium | Both backends scheduling same task | Watch for duplicate invocations in logs |
| Redis slot corruption | Low | Concurrent writes to same slot possible | Separate slots (already done: 1 vs 3) |
| Legacy data pollution | Low | Old tables may still exist in DB | Optional cleanup; not blocking |
| WebSocket not migrated | Medium | Unknown if stream endpoint native | Verify and migrate if needed |

---

## 15. Glossary

| Term | Meaning |
|------|---------|
| **Full SaaS** | 100% of functionality served from core-api; no legacy dependencies |
| **Hybrid** | Mix of new (core) and old (legacy) systems running simultaneously |
| **Graceful Stub** | Endpoint returns HTTP 200 + empty data (intentional placeholder) |
| **Native Route** | Route implemented in core-api (not calling legacy backend) |
| **Bridge** | Legacy proxy module calling backend:8000 (DELETED) |
| **legacy_http_bridge.py** | Module that made HTTP calls to legacy backend (now deleted) |

---

**Prepared**: 2026-05-13  
**Status**: ✅ Frontend 100% SaaS | ⚠️ Backend workers still hybrid  
**Next Review**: 2026-05-20 (post-decommission)
