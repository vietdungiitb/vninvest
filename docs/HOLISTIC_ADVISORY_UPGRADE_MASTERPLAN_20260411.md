# HOLISTIC ADVISORY UPGRADE MASTER PLAN (2026-04-11)

## 1) Muc tieu va pham vi

Tai lieu nay dong vai tro master plan de nang cap AI Advisory tu mo hinh alert-driven hien tai sang Holistic Advisory.
Muc tieu la:

- Giam noise cua advisory don le.
- Tang tinh actionability va nhat quan giua whale alerts, dark money flow, order-flow va lich su advisory.
- Ke thua nhung phan da lam tot (threshold semantics, window semantics, dedup policy, observability co ban, token governance).
- Co kha nang audit/replay quyet dinh advisory o cap aggregate state.

Pham vi in-scope:

- Backend data model + aggregate pipeline + prompt orchestration + API session/workflow moi.
- Audit trail cho aggregate state va advisory decision.
- Frontend workflow redesign cho trang AI advisory session.
- Test matrix + release gates + KPI danh gia chat luong.

Out-of-scope (phase sau):

- Full multimodal vision advisory.
- RL/fine-tuning model.
- Tu dong dat lenh (execution).

---

## 2) Tom tat hien trang (da doi chieu code + test)

### 2.1 Nhung gi da lam tot va can ke thua

1. Time semantics local market cho order-flow da dung (localdate/localtime).
2. Per-symbol threshold override da di qua realtime + advisory accumulation path.
3. Whale duplicate policy da chot: 1 trade -> 1 signal o highest matched threshold.
4. Co merge event whale + dark_flow trong cua so ngan va luu metadata merged_sources/primary_source.
5. Co token governance theo user (daily budget, auto refresh limit, source-based logs).
6. Co chart-context path cho component generation (optional, fallback-safe).

### 2.2 Khoang trong con lai de dat Holistic Advisory

1. Chua co AdvisoryAggregateState 24h dung nghia (stateful, versioned, replayable).
2. Merge hien tai van shallow (score_sum + source list), chua co qualitative aggregation day du.
3. Chua co benchmark layer theo thong le quoc te ngay trong decision core:
   - VWAP deviation vs sector/index
   - RVOL persistence
   - Order imbalance persistence
   - Multi-timeframe confirmation (M5/M15/M30/H1)
4. Chua co aggregate-state audit trail (before/after + reason + actor/system).
5. Chua co governance score cho quality cua advisory context.

### 2.3 Gap correctness quan trong can uu tien sua ngay

1. Dark-flow severity branch co nguy co khong duoc kich hoat dung trong merge flush flow do source semantics.
2. Component prompt co mismatch tick-rate field map (du lieu detector va truong prompt chua can dong bo tuyet doi).
3. Timeframe consistency trong component generate/refresh chua phan bo dong bo 100% o moi path.
4. Session first-create advisory can tiep tuc hardening de ton trong symbol override semantics o moi mode.

### 2.4 KPI baseline can do ngay truoc khi rollout

Can chup baseline tu he thong hien tai de do delta sau nang cap. Toi thieu gom:

1. Actionability baseline (% advisory co action ro rang va duoc user tuong tac).
2. Advisory noise baseline (% advisory bi bo qua trong 24h, % advisory bi danh gia khong huu ich).
3. Severity consistency baseline (ti le thong nhat giua dark-flow strength va advisory severity).
4. Session latency baseline (p50/p95 GET/POST advisory session).
5. Error baseline (ti le skip theo reason: budget, config, cooldown, queue error).

---

## 3) Dich chuyen kien truc: Alert-driven -> Holistic Advisory

### 3.1 Kien truc hien tai (rut gon)

Event (whale/dark/reversal)
-> Merge cache ngan han
-> Tao WhaleAdvisory
-> Component + Executive Summary

### 3.2 Kien truc muc tieu (Holistic)

Event streams (whale, dark-flow, order-flow, market context, user context)
-> AdvisoryAggregateState (rolling 24h, user+symbol)
-> Aggregate scoring + benchmark normalization
-> Advisory Decision Engine (rule + AI reasoning)
-> HolisticAdvisoryRecord (advisory chinh)
-> Component Records (sinh tu aggregate facts)
-> Executive Summary + Risk blocks + Audit trail

### 3.3 Nguyen tac thiet ke

1. Evidence-first: AI dien giai tren facts co cau truc, khong de AI tu suy doan boi canh chinh.
2. Deterministic core + probabilistic narrative:
   - Core signal + risk band deterministic.
   - Narrative text do AI sinh ra, bi rang buoc boi policy + guardrails.
3. Replayable decisions: moi advisory co snapshot_id de trace nguon du lieu va quy tac.
4. Backward-compatible rollout: co feature flag theo user cohort.

---

## 4) Data contract de xay AdvisoryAggregateState v1

### 4.1 Redis key

advisory:aggregate:v1:{user_id}:{symbol}

### 4.2 Schema toi thieu (v1)

{
  "version": 1,
  "symbol": "FPT",
  "user_id": 123,
  "window": {
    "type": "rolling",
    "minutes": 1440,
    "from": "...",
    "to": "..."
  },
  "whale": {
    "count": 0,
    "buy_count": 0,
    "sell_count": 0,
    "net_score": 0.0,
    "max_event_score": 0.0,
    "largest_trade_value_vnd": 0.0,
    "threshold_source": "user_default"
  },
  "dark_flow": {
    "signal_count": 0,
    "type_mix": {},
    "strength_max": 0.0,
    "strength_avg": 0.0,
    "confidence_mode": "low",
    "cvd_change_sum": 0.0,
    "persistence_score": 0.0
  },
  "order_flow": {
    "imbalance": 0.0,
    "tick_rate_regime": "normal",
    "small_order_ratio_avg": 0.0
  },
  "market": {
    "rvol": 0.0,
    "rvol_regime": "normal",
    "vwap_deviation_pct": 0.0,
    "sector_relative_strength": 0.0,
    "index_relative_strength": 0.0
  },
  "history": {
    "recent_advisories": [],
    "recent_actions_distribution": {},
    "confidence_avg": 0.0
  },
  "quality": {
    "completeness_score": 0.0,
    "freshness_score": 0.0,
    "consistency_score": 0.0,
    "aggregate_quality_score": 0.0
  },
  "updated_at": "...",
  "snapshot_seq": 0
}

### 4.3 Snapshot persistence

- Moi lan tao advisory phai persist 1 ban snapshot vao DB:
  AdvisoryAggregateSnapshot
- WhaleAdvisory (hoac HolisticAdvisoryRecord moi) luu foreign key snapshot_id.

### 4.4 Retention policy (Redis + DB)

De tranh bloat va giu kha nang audit:

1. Redis aggregate state TTL mac dinh: 48h (co auto-refresh khi event moi den).
2. AdvisoryAggregateSnapshot compaction:
  - Giu full snapshot trong 30 ngay.
  - Sau 30 ngay chi giu daily checkpoints + snapshots gan release incident.
3. AdvisoryAggregateAuditLog retention:
  - Online 90 ngay.
  - Archive object storage sau 90 ngay.
4. Co command prune dinh ky + bao cao so luong record duoc compact.

---

## 5) Workflow moi cho trang AI Advisory Session

### 5.1 Workflow hien tai (co ban)

- GET session: lay advisory moi nhat; neu chua co thi queue/sync tao advisory.
- POST session: refresh thu cong.
- Component generate/refresh dang tach rieng.

### 5.2 Workflow muc tieu (de xay lai, ke thua phan tot)

Trang se co 3 lop thong tin:

1. Aggregate Panel (new)
- Hien aggregate window 24h: whale net, dark-flow persistence, order imbalance, benchmark state.
- Hien data quality va freshness badge.

2. Decision Panel (new)
- Hien recommendation chinh (BUY/SELL/HOLD/STAND_ASIDE).
- Hien confidence band + risk band + trigger vo hieu.
- Hien ly do machine-readable (top evidence factors).

3. Component Panel (refactor)
- Components khong sinh tu single alert, ma sinh tu aggregate facts.
- Moi component co provenance: factor nao dong gop, trong so bao nhieu.

4. Evidence Drill-down (new)
- Tu Decision Panel co the click vao tung evidence factor de xem raw events lien quan.
- Cho phep user xem timeline whale/dark/order-flow da dong gop vao quyet dinh.
- Hien ly do bo qua evidence (neu quality score thap hoac stale).

Action buttons:

- Recompute aggregate (manual)
- Regenerate narrative (khong doi deterministic core)
- Force full refresh (recompute + regenerate)

---

## 6) Ke hoach trien khai chi tiet (de xuat 3 sprint)

## Sprint H1 (P0 correctness + foundation hardening)

Muc tieu: Dong correctness gap va chuan bi aggregate contract.

Work items:

1. Sua source/severity semantics cho dark-flow merge advisory path.
2. Chuan hoa tick-rate mapping trong component AI prompt.
3. Chuan hoa timeframe propagation cho moi component generate/refresh path.
4. Hardening first-create threshold semantics theo symbol override.
5. Dong bo test regression cho 4 nhom tren.
6. Tao AdvisoryAggregateState contract v1 (doc + serializer schema + validator).

Deliverables:

- Patch correctness da pass tests.
- Doc contract v1 + validation rules.
- Feature flag skeleton: HOLISTIC_ADVISORY_V1_ENABLED.

Acceptance:

- Khong co regression whale/order-flow gates.
- Advisory severity mapping dung cho case dark-flow merged.
- Timeframe semantics thong nhat across APIs.

## Sprint H2 (Aggregate engine + audit trail)

Muc tieu: Build AdvisoryAggregateState pipeline va auditability.

### H2 progress update (2026-04-11)

- H2-step-1 hoan tat: moi `WhaleAdvisory` moi da duoc gan `aggregate_snapshot` (FK den `AdvisoryAggregateSnapshot`).
- Snapshot duoc persist theo sequence tang dan theo `(user, symbol)` trong advisory generation task.
- Audit metadata va websocket payload da bo sung `snapshot_id` de trace/replay.
- Test evidence:
  - `test_task_persists_metrics_into_aggregate_audit_log`
  - `test_task_persists_snapshot_with_monotonic_sequence`

Work items:

1. Redis aggregate updater tasks:
   - consume whale event
   - consume dark-flow event
   - consume periodic market context
2. Snapshot persistence model:
   - AdvisoryAggregateSnapshot
   - AdvisoryAggregateAuditLog
3. Decision engine v1:
   - deterministic score bands
   - action/risk mapping
4. Advisory generation flow moi:
   - tao advisory tu aggregate snapshot
   - luu provenance fields
5. API session v2 (co backward compatibility response fields).

Deliverables:

- Aggregate updater + snapshot DB + audit logs.
- Session API v2 behind feature flag.
- Migration scripts cho du lieu can thiet.

Acceptance:

- 100% advisory moi co snapshot_id.
- Co the replay lai decision tu snapshot.
- p95 latency session API tang khong qua nguong cho phep.

## Sprint H3 (Holistic UI + benchmark international)

Muc tieu: Hoan tat workflow trang moi + benchmark layer.

Work items:

1. Frontend AI advisory session redesign (3-panel model).
2. Benchmark enrichment:
   - VWAP deviation
   - RVOL regime
   - sector/index relative strength
   - MTF confirmation score
3. Narrative policy hardening:
   - Evidence bullets bat buoc
   - Invalidating conditions bat buoc
4. Observability dashboard:
   - severity drift
   - aggregate quality score
   - actionability KPI

Deliverables:

- Holistic Advisory UI live behind cohort flag.
- KPI dashboard + alerts.
- Release playbook + rollback playbook.

Acceptance:

- Actionability metric tang ro net theo KPI da dat.
- User feedback negative rate giam theo muc tieu.

## Sprint H0.5 (48h kickoff execution)

Muc tieu: Chot thiet ke + dong correctness high-risk truoc khi vao implementation lon.

Work items 48h:

1. Chot schema AdvisoryAggregateState v1 voi team BE/FE/QA.
2. Patch 4 correctness gaps (source-severity, tick-rate map, timeframe propagation, first-create threshold semantics).
3. Chay regression block whale/order-flow/advisory va luu evidence artifact.
4. Tao migration skeleton cho AdvisoryAggregateSnapshot + AdvisoryAggregateAuditLog.
5. Bat metric baseline collection jobs va dashboard tam thoi.

Deliverables 48h:

- Design sign-off notes (schema + naming + ownership).
- 1 PR hotfix correctness + tests.
- 1 PR migration skeleton + model stubs.
- Baseline KPI report de so sanh truoc/sau.

---

## 7) Testing strategy (bat buoc)

### 7.1 Unit tests

- Aggregate reducers cho whale/dark/order-flow/market.
- Decision mapping BUY/SELL/HOLD/STAND_ASIDE.
- Severity mapping theo source va merge case.

### 7.2 Integration tests

- Event stream -> aggregate -> advisory snapshot -> advisory record.
- Symbol override semantics trong toan pipeline.
- Timeframe consistency tai APIs va helper generation.

### 7.3 E2E tests

- Session first-create, refresh, recompute aggregate.
- UI panel states khi du lieu thieu/du/khong dong nhat.
- Cohort flag on/off.

### 7.4 Non-functional

- Performance (p95/p99)
- Resilience khi cache miss/stale
- Audit completeness

---

## 8) KPI chap nhan va success criteria

1. Data correctness
- >= 99% advisory co threshold_source lineage dung.
- >= 99% dark-flow merged advisories map severity dung policy.

2. Holistic quality
- >= 85% advisory co it nhat 4 nhom evidence (whale/dark/order-flow/market).
- Giam >= 25% advisory bi danh gia "thieu boi canh".

3. Operational governance
- 100% advisory moi co snapshot_id + audit trace.
- Co replay tool cho 100% case audit trong 24h gan nhat.

---

## 9) Rollout va migration strategy

1. Flag strategy
- HOLISTIC_ADVISORY_V1_ENABLED
- HOLISTIC_ADVISORY_UI_V1_ENABLED
- HOLISTIC_ADVISORY_BENCHMARKS_ENABLED

2. Cohort rollout
- Internal staff -> 10% pro users -> 50% -> 100%

3. Backward compatibility
- Giu endpoint cu trong giai doan transition.
- Them response fields moi theo huong additive.

4. Rollback
- Tat flags ve pipeline cu.
- Van giu snapshot logs de postmortem.

### 9.1 Risk matrix va mitigation

| Rui ro | Probability | Impact | Mitigation |
|---|---|---|---|
| Latency tang do aggregate compute | Medium | High | Async updater + cache warming + latency budget p95 |
| Benchmark data stale (VWAP/sector/index) | High | High | Market context feeder rieng + freshness guardrails |
| User confusion trong giai doan transition UI | Medium | Low | In-app onboarding + cohort A/B + fallback to legacy |
| Quality score bi "gaming" do thieu quy tac | Low | Medium | Rule-based scoring constraints + audit sampling |

---

## 10) Danh sach viec uu tien thuc thi ngay (next actions)

1. Chot contract AdvisoryAggregateState v1 + naming conventions.
2. Implement P0 correctness fixes (source/severity, tick-rate map, timeframe propagation, first-create threshold).
3. Mo PR slice dau tien cho aggregate snapshot model + audit log model.
4. Tao QA matrix rieng cho Holistic Advisory V1.
5. Chuan bi feature flag va cohort config.

---

## 11) Tai lieu lien quan (execution pack)

1. HOLISTIC_ADVISORY_48H_EXECUTION_BOARD_20260411.md
2. HOLISTIC_ADVISORY_PR_SLICING_PLAN_20260411.md
3. HOLISTIC_ADVISORY_48H_COMMAND_CHECKLIST_20260411.md
4. HOLISTIC_ADVISORY_48H_GO_NO_GO_GATE_20260411.md

## 12) Ket luan

Huong nang cap "lam lai workflow trang AI advisory" la hop ly va can thiet.
Nen lam theo chien luoc "refactor co ke thua":

- Ke thua: threshold/window semantics, dedup, token governance, chart context.
- Lam moi: aggregate state 24h, decision engine, audit trail, holistic UI workflow.

Tai lieu nay la baseline de team tiep tuc thao luan va chot WBS/PR slicing cho sprint tiep theo.
