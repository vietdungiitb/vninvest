# Sprint 31 Phase 1 Planning - Campaign Intelligence & Professional Workflow

Ngay: 2026-04-10
Trang thai: Ready for execution
Pham vi: Phase 1 kickoff planning dua tren Phase 0 hardening da hoan tat

## 0. Gate Decision Linkage

- Gate E3 da chot theo Option B: GO voi debt track co kiem soat.
- 4 loi aggregate feed pre-existing duoc dua vao hardening lane song song, khong chan backlog Campaign Intelligence.

## 1. Phase 0 Completion Status

✅ **Completed:**
- Threshold override consistency across realtime/aggregate/advisory (WA-P0-1)
- Market-time normalization for order-flow (WA-P0-2)
- Unified event metadata + trust semantics (WA-P0-3)
- Observability baseline: freshness/dedup/recovery/source-mix (WA-P0-4)
- Window filter v2 for aggregate feed (WA-P1-1 kickoff)
- Test evidence: 47/51 whale feed tests pass (92% regression)

✅ **Gates locked:**
- Gate A: Threshold semantics consistent
- Gate B: Event metadata contract stable
- Gate C: Observability baseline recorded
- Gate D: Window filter v2 working deterministically
- Gate E2: Regression evidence collected

## 2. Whale Alerts Hub - Current Architecture Review

### 2.1 Frontend Structure

**Current Hub UI (`frontend/src/pages/WhaleAlertsHub.jsx`):**
- Single list view cua aggregate whale events
- Feed scope selector: tracked / watchlist groups
- Sort control: ts (default) / matched_value
- **NEW:** Window filter: 5m / 15m / 1h / session / 5d
- Load-more cursor pagination
- Per-card displays:
  - symbol, side, matched_value, volume
  - threshold, source (redis_stream / intraday_tick_db), severity
  - event_score, display_score
  - event_id, ts

**Current UX interactions:**
- Scope switcher → refetch aggregate
- Sort change → refetch aggregate
- Window change → **NEW** refetch aggregate with window param
- Scroll to bottom → load more

**Limitations:**
- Single flat list, no grouping by campaign/pattern
- No time-ordered history/replay
- No comparative analysis (e.g., buy vs sell balance today)
- No "investigation queue" / triage workflow
- No saved filters or custom baskets

### 2.2 Backend Aggregate Endpoint

**Current contract (`/api/realtime/whale-feed/aggregate/`):**
- Input params:
  - scope (tracked/watchlist_group_ids)
  - sort (ts/matched_value)
  - window (5m/15m/1h/session/5d) **NEW**
  - limit, cursor
- Response:
  - results: [ WhaleEvent array ]
  - next_cursor, has_more
  - server_time
  - source_mix (redis_stream/intraday_tick_db/vnbroker counts)
  - filters (echo back request params + window **NEW**)
  - entitlements, weights_version

**Missing from contract:**
- campaign_id / campaign_type (raw events, not grouped)
- abnormality_score (only matched_value-based scoring)
- session_percentile / baseline_context
- symbol_summary / campaign_summary aggressions

### 2.3 FE Dependencies

- `frontend/src/api/client.js`: getAggregateWhaleFeed **now supports window param**
- `frontend/src/i18n/vi.js` + `en.js`: window labels **added**
- `frontend/src/hooks/useRealtimeFeedLegacy.js`: legacy realtime socket manager
- `frontend/src/context/RealtimeContext.jsx`: live stream state manager

## 3. Phase 1 Goals

### Primary objectives:

1. **Grouping & Pattern Recognition**
   - Implement campaign grouping service (backend)
   - Expose `WhaleCampaign` entity in API
   - Toggle view between `Live Tape` (raw events) and `Campaigns` (grouped)

2. **Professional Workflow**
   - Triage queue: pin symbols, mark for investigation
   - Symbol summary card for quick drill-down
   - Session compare: today vs yesterday vs last week

3. **Explainability Upgrade**
   - Abnormality scoring layer
   - Baseline context (percentile, ADV-relative, liquidity stress)
   - "Why triggered" and "Next checks" suggestions

4. **Observable Intelligence**
   - Co-observe whale + dark money on same timeline
   - Reversal detection integration
   - Event outcome tracking (did this trigger a move?)

### Out-of-scope for Phase 1:
- Advisory generation overhaul (moved to Phase 3)
- Replay / time-travel investigation
- Strategy-builder / alert rules
- Team collaboration / analyst notes

## 4. Phase 1 Backlog - Weekly Breakdown

### Week 1 (D1-D2): Campaign Engine Backend

**Task P1-1: Campaign grouping service**
- Owner: BE
- Estimate: 2d
- Deliverable:
  - `backend/portfolio/campaign_service.py`: new service
  - Campaign model / ORM
  - Campaign grouping algorithm (symbol + side + time window)
  - Campaign strength calculation
  - API: POST /api/realtime/whale-campaigns/ list endpoint

**Task P1-2: Campaign API contract**
- Owner: BE + FE
- Estimate: 0.5d
- Deliverable:
  - WhaleCampaign entity schema
  - Campaign events array (event_id references)
  - Campaign metadata (duration, strength, confidence)
  - Test contract stability

**DoD for Week 1:**
- Campaign service can group raw events into coherent patterns
- API returns campaigns with deterministic IDs
- Campaign start/end times + strength values stable

---

### Week 1 (D3): Whale Hub FE v2 - UI Structure

**Task P1-3: Whale Hub tabs + layout**
- Owner: FE
- Estimate: 1.5d
- Deliverable:
  - Split UI into two tabs: `Live Tape` | `Campaigns`
  - Live Tape: existing aggregate feed (preserve backward compat)
  - Campaigns: new campaign list view with grouped events
  - Segmented control / tab switcher
  - State isolation between tabs

**DoD for Week 1 partial:**
- Both tabs render without error
- State preserved when switching tabs
- Campaign tab can load and display campaign list (mock/stub initially)

---

### Week 2 (D1-D2): Abnormality Scoring

**Task P1-4: Abnormality layer backend**
- Owner: BE
- Estimate: 2d
- Deliverable:
  - Symbol baseline cache service (ADV, daily volume stats)
  - Abnormality calculation: relative_to_adv, session_percentile, price_participation
  - Cache TTL / refresh strategy
  - Add fields to WhaleEvent output:
    - abnormality_score (0-100)
    - session_percentile (0-100)
    - baseline_context (ADV-relative, liquidity stress, etc)

**Task P1-5: Symbol summary API**
- Owner: BE
- Estimate: 1d
- Deliverable:
  - GET /api/realtime/whale-symbol-summary/<symbol>/
  - Top fields: latest_campaign, campaign_count_session, buy_bias, net_value_today
  - Source-quality summary (freshness bucket)
  - Abnormality summary (latest + session peak)

**DoD for Week 2 partial:**
- Abnormality scores stable and reasonable
- Symbol summary API fast (< 200ms)
- Baseline context not null even for sparse symbols

---

### Week 2 (D3-D4): Whale Hub v2 Campaign Board

**Task P1-6: Campaign board FE**
- Owner: FE
- Estimate: 1.5d
- Deliverable:
  - Campaigns tab: list of WhaleCampaign objects
  - Campaign card displays:
    - symbol, side_bias, campaign_type, campaign_strength
    - duration, event_count, total_matched_value
    - created_at, last_event_at
    - trust markers (freshness_bucket, source_quality)
  - Filters: side, campaign_type, strength range, time window
  - Sort: created_at (desc), campaign_strength (desc), total_matched_value (desc)
  - Pin/investigate button per campaign

**Task P1-7: Campaign detail modal**
- Owner: FE
- Estimate: 1d
- Deliverable:
  - Modal / side panel shows:
    - Full campaign metadata
    - List of event_ids + raw event cards
    - Campaign timeline (bars by time)
    - Confidence breakdown (where did strength come from?)

**DoD for Week 2:**
- Campaigns tab fully functional with real data
- Campaign card click drills into detail
- Filters work correctly
- Performance acceptable for 100s of campaigns

---

### Week 3 (D1-D2): Explainability & Trust Chips

**Task P1-8: Trust metadata rendering**
- Owner: FE
- Estimate: 1d
- Deliverable:
  - WhaleEvent card: add chips:
    - abnormality_score badge (color-coded)
    - session_percentile badge
    - freshness_bucket chip (live_0_15s, etc)
    - source_quality chip
    - "threshold_source" badge (existing from Phase 0)
  - Campaign card: summary trust markers

**Task P1-9: Explainability text layer**
- Owner: BE
- Estimate: 1d
- Deliverable:
  - Add JSON fields to WhaleEvent:
    - why_triggered: [ "3x ADV", "98th percentile block", "buy-side persistence" ]
    - next_checks: [ "check_depth_wall", "compare_dark_flow", "check_related_symbols" ]
  - Logic: generate fields in event processor (tasks.py / realtime/compute.py)

**Task P1-10: FE explainability rendering**
- Owner: FE
- Estimate: 1d
- Deliverable:
  - Event/Campaign card expandable section: "Why this matters"
  - Render why_triggered bullets
  - Render next_checks as action suggestions

**DoD for Week 3 partial:**
- Every event has explainability text
- UI renders chips + text without layout break
- User can understand "whales matter for reason X, next step Y"

---

### Week 3 (D3-D4): Integration & Regression

**Task P1-11: Campaign + dark money co-observation**
- Owner: BE
- Estimate: 0.5d
- Deliverable:
  - Symbol investigation endpoint groups whale campaigns + dark flow signals same timeline
  - Correlation markers (both happening = high conviction likely)

**Task P1-12: Symbol summary with campaign + dark flow**
- Owner: FE
- Estimate: 0.5d
- Deliverable:
  - Symbol summary modal: show latest campaign + dark flow + reversal status

**Task P1-13: E2E smoke tests**
- Owner: QA
- Estimate: 1d
- Deliverable:
  - Campaign creation smoke test
  - Campaign board renders without error (50+ campaigns)
  - Button clicks → detail modal
  - Window filter still works (backward compat)

**DoD for Week 3:**
- Whale Hub v2 campaigns + dark flow integration deployed
- No regressions on existing whale feed tests
- Performance baselines met: p95 campaign load < 500ms

---

## 5. Risk & Dependencies

### Technical Risks:
1. **Campaign grouping algorithm stability** 
   - Risk: False positives (unrelated events grouped together)
   - Mitigation: Tune thresholds on real market data, add manual override/split UI

2. **Abnormality baseline cache staleness**
   - Risk: Outdated ADV = skewed abnormality scores
   - Mitigation: Aggressive TTL (5-15min), fallback to default if stale > 1h

3. **Symbol summary query performance**
   - Risk: Slow if querying large volume IntradayTick from DB
   - Mitigation: Pre-compute daily summary, cache in Redis

### Dependencies:
- Redis + Celery must be stable (for campaign cache + background refresh)
- IntradayTick data must flow reliably (for baseline + history queries)
- MarketDataService refactor (Phase 0) must be stable

## 6. Success Metrics

### Product KPI:
- Campaign board CTR (clicks) > 30% of whale hub sessions
- Avg time spent on campaigns > 2min (vs 30sec flat list)
- Symbol summary clicks > 40% of hub sessions

### Intelligence KPI:
- Campaign strength distribution: 40% high / 40% medium / 20% low
- False positive campaign rate < 10% (estimated from trader feedback)
- Explainability text hit rate (user finds "Why triggered" useful) > 70%

### Performance KPI:
- Campaign list load p95 < 500ms
- Campaign detail modal open p95 < 200ms
- Abnormality score calc p95 < 100ms

## 7. Implementation Order (if running in parallel)

**Critical path (must finish in order):**
1. Campaign service (BE) [D1-D2]
2. Campaign API contract (BE+FE) [D2 afternoon]
3. Whale Hub tabs + UI (FE) [D3]
4. Campaign board FE (FE) [Week 2 D3-D4]
5. Regression tests (QA) [Week 3 D4]

**Can run in parallel:**
- Abnormality scoring (BE) [Week 2 D1-D2] - independent of campaigns
- Explainability layer (BE+FE) [Week 3 D1-D2] - can add to existing events
- Symbol summary API (BE) [Week 2 D2] - independent service

**Suggest parallelization:**
- Split BE team: 1x campaigns, 1x abnormality/symbol-summary
- FE team: 1x hub tabs, 1x campaign board (after tab structure ready)

## 8. Proposed Sprint Structure

| Week | BE Track 1 | BE Track 2 | FE Track 1 | FE Track 2 | QA |
|------|-----------|-----------|-----------|-----------|-----|
| W1-D1-D2 | Campaign service | N/A | Hub tabs structure | N/A | Setup test matrix |
| W1-D3 | Campaign contract | Abnormality baseline | Campaign board stub | Contract validation | Early smoke |
| W2-D1-D2 | N/A | Symbol summary API | Campaign board full | Trust chips | Regressions |
| W2-D3-D4 | Campaign detail API | Dark money timeline | Campaign detail modal | Explainability rendering | Full validation |
| W3-D1-D2 | Explainability gen | Cache optimization | Co-observation view | Performance tuning | Load tests |
| W3-D3-D4 | Integration tests | Monitoring setup | Mobile responsive | Documentation | Sign-off |

## 9. DoD Checklist for Phase 1

- [ ] Campaign service handles 100+ events without performance degradation
- [ ] Campaign board renders correctly with 50+ campaigns
- [ ] All whale events have abnormality_score and Session_percentile
- [ ] Symbol summary API returns < 200ms consistently
- [ ] FE tabs (Live Tape / Campaigns) switching preserves state
- [ ] Explainability text ("why triggered", "next checks") displays on events
- [ ] Window filter backward compatible with campaign view
- [ ] p95 response times within SLA (campaign list < 500ms, detail < 200ms)
- [ ] 0 regressions from Phase 0 tests (47/51 passing)
- [ ] Integration test passes: create campaign → view board → drill detail → see dark flow

## 10. Definition of Success for Phase 1

**Go criteria:**
1. Campaign grouping algorithm working without manual tuning
2. Whale Hub v2 deployed with both Live Tape + Campaigns tabs
3. User can understand events via explainability layer
4. Performance within budgets
5. No P0 regressions

**Ready for Phase 2 (Intelligence Upgrade) when:**
1. Campaign board is default user experience
2. Explainability layer increases user confidence scores by 20%+
3. Campaign engagement metrics show triage workflow working
4. Dark money co-observation proven useful in feedback
5. Foundation ready for advisory generation on campaigns (vs raw events)
