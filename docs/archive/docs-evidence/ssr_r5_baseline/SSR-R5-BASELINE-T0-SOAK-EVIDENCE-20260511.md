# Evidence — SSR-R5: Soak & Hardening (T=0 Baseline)

**Ngày bắt đầu**: 2026-05-11 09:41:27 UTC  
**Owner**: DevOps Lead + QA Lead  
**Phase**: R5 (Soak window T=0 to T+24h minimum)

---

## 1. T=0 Baseline Metrics

### Health Status

| Endpoint | Status | Notes |
|---|---|---|
| `/core/v1/health` | **200** ✅ | Core runtime healthy |
| `/api/health/` | **200** ✅ | Legacy compat bridge healthy |

### Queue Status

| Metric | Value | Notes |
|---|---|---|
| Redis queue depth (db3/celery) | **0** ✅ | Clean baseline, no backlog |

### Services Status

| Service | State | Status |
|---|---|---|
| vninvest-dev-db | running | ✅ Primary data plane |
| vninvest-dev-redis | running | ✅ Message broker |
| vninvest-dev-core-api | running | ✅ SaaS runtime entry point |
| vninvest-dev-core-worker | running | ✅ Task consumer |
| vninvest-dev-core-beat | running | ✅ Scheduler dispatcher |
| vninvest-dev-frontend | running | ✅ User interface |
| vninvest-dev-backend-legacy | running | ⚠️ Readonly bridge (phase-out target) |
| vninvest-dev-mailpit | running | ✅ Dev mail capture |
| vninvest-dev-opencore-site | running | ✅ Landing page |

---

## 2. SLO Baseline Thresholds

From TECH_SPEC, soak window must maintain:

| SLO | Threshold | Method |
|---|---|---|
| **API Availability** | >= 99.5% | Health endpoint 200 |
| **API Latency (p95)** | <= 200ms | Response time |
| **Queue Depth** | < 100 messages | `LLEN celery` |
| **Task Failure Rate** | < 1% | Celery metrics |
| **Worker Uptime** | >= 99% | Restart count |
| **Restart Count** | <= 2 per 24h | Container inspect |

**Soak Gate Criteria (R5.1):**
- ✅ No P1 incidents during 24h
- ✅ All SLOs maintained at >= thresholds
- ✅ No sustained queue backlog
- ✅ Container restart count <= 2 per service

---

## 3. Monitoring Plan

### T+0 to T+6h: Intensive checks (every 1 hour)
- Quick health endpoint polling
- Queue depth tracking
- Error log scanning

### T+6h to T+24h: Regular checks (every 4 hours)
- Full health snapshot
- Resource utilization
- Worker/beat status

### T+24h: Daily summary + Gate review
- SLO validation matrix
- Incident log review
- Decision: PASS (proceed R5.2 or R6) / FAIL (investigate, repeat)

**See `docs/R5_MONITORING_PROTOCOL_20260511.md` for detailed check functions.**

---

## 4. Soak Window Timeline

```
T=0     T+6h    T+12h   T+18h   T+24h   T+48h   T+72h
|-------|-------|-------|-------|-------|-------|
 Baseline                                   
 Capture     Intensive checks                  Regular checks
                                        [Gate R5.1 review]
                                         PASS → proceed R6
                                         (or continue R5.2)
```

---

## 5. Next Steps for User

### Option A: Proceed to R6 immediately (manual gate review)
1. Run final `Invoke-R5DailySummary -HoursSinceStart 24` after 24h real time
2. Verify all SLO checkboxes pass
3. Sign-off, proceed to R5.3/R6

### Option B: Automated 24h wait + gate closure
1. Set reminder for 24h from now (2026-05-12 09:41 UTC)
2. At that time, run monitoring summary
3. If all pass, signal completion

### Option C: Extended soak (72h hardening)
1. Continue monitoring every 6h
2. At T+72h, review extended trend data
3. Validate SLO stability across 3-day window

---

## 6. Residual Risk & Guardrails

1. **Real traffic not simulated**: Soak window assumes development load. Prod migration will need production traffic verification.
2. **Manual monitoring**: Baseline is snapshot at T=0. Periodic checks are point-in-time. Continuous monitoring (Prometheus/Grafana) recommended for production.
3. **Legacy backend still present**: Readonly bridge running. Full decommission in R6 Phase.

---

## 7. Checklist: R5.1 GATE READY

- [x] Baseline metrics captured (T=0)
- [x] Monitoring protocol documented
- [x] SLO thresholds defined
- [x] Check functions provided
- [x] Timeline communicated
- [ ] 24h soak completed
- [ ] Daily summary generated
- [ ] All SLOs validated PASS
- [ ] Sign-off obtained

**Status**: ✅ **R5.1 STARTED** (T=0 baseline at 2026-05-11 09:41:27 UTC)
