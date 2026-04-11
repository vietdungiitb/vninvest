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
- H2-step-2 hoan tat: bo sung command replay trace theo `advisory_id`/`snapshot_id`:
  - `python backend/manage.py replay_advisory_trace --advisory-id <id> --max-logs 30`
  - Smoke artifact: `docs/HOLISTIC_ADVISORY_H2_REPLAY_SMOKE_20260411.json`
- H2-step-3 hoan tat: bo sung read-only API replay trace cho stock workspace:
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-trace/?advisory_id=<id>&max_logs=<n>`
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_trace_returns_snapshot_and_matched_audit_logs`
- H2-step-4 hoan tat: bo sung API history replay theo symbol (cursor pagination):
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-traces/?limit=<n>&cursor=<advisory_id>`
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_trace_list_supports_cursor_pagination`
- H2-step-5 hoan tat: bo sung bo loc replay history theo audit metadata/time range:
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-traces/?reason=<reason>&actor=<actor>&start_at=<iso>&end_at=<iso>`
  - list endpoint chi tra ve advisory co matched audit logs khi co filter.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_trace_list_supports_reason_actor_time_filters`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_trace_list_returns_400_for_invalid_reason_filter`
- H2-step-6 hoan tat: bo sung khung Session API v2 sau feature flag `STOCK_AI_ADVISORY_SESSION_V2_ENABLED`.
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-session/` giu backward compatibility va them `contract_version=v2` + `aggregate` provenance fields khi bat flag.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_session_get_returns_v2_contract_when_enabled`
- H2-step-7 hoan tat: bo sung request-level contract selector cho Session API.
  - Ho tro query: `GET /api/stock-management/stocks/<symbol>/ai-advisory-session/?contract=v1|v2`
  - `contract=v2` cho phep bat payload v2 theo client rollout ma khong can bat global flag.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_session_get_accepts_contract_v2_query_override`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_session_get_returns_400_for_invalid_contract_query`
- H2-step-8 hoan tat: bo sung `aggregate.decision` digest (score/action/risk) cho Session API v2.
  - `aggregate.decision` gom: `score`, `score_band`, `action`, `risk` de FE/replay su dung nhat quan.
  - uu tien lay `score` tu `snapshot.state_json.quality.actionability`; fallback theo ratio `matched_value/threshold`.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_session_get_returns_v2_contract_when_enabled`
- H2-step-9 hoan tat: bo sung API export artifact cho QA/audit.
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-trace-export/?advisory_id=<id>&contract=v1|v2&history_limit=<n>`
  - payload export gom `session` + `trace` + `history` + `filters` + `exported_at`.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_trace_export_returns_audit_artifact_bundle`

### H2 completion status (2026-04-11)

- H2 backend replay/audit milestone da hoan tat qua cac slice H2-step-1..H2-step-9.
- Da co du flow: snapshot linkage, replay command, trace APIs, filterable history, session v2 contract (flag + query override), decision digest va export artifact cho QA/audit.

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

### H3 progress update (2026-04-11)

- H3-step-1 hoan tat (backend benchmark enrichment cho Session API v2):
  - them `aggregate.benchmarks` trong `GET /api/stock-management/stocks/<symbol>/ai-advisory-session/?contract=v2`
  - bo benchmark gom: `vwap_deviation_pct`, `rvol`, `rvol_regime`, `relative_strength_20d_pct`, `mtf_confirmation_score`, `mtf_confirmation_label`, `freshness`.
  - rollout qua flag `STOCK_AI_ADVISORY_BENCHMARKS_ENABLED` (co the override bang query `include_benchmarks=1`).
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_session_v2_includes_benchmark_enrichment`
- H3-step-2 hoan tat (narrative policy hardening cho executive summary):
  - enforce bat buoc 2 section trong `synthesis_text`: `Evidence bullets:` va `Invalidating conditions:`.
  - ap dung cho ca fallback summary va AI-generated summary de tranh output thieu policy.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_summary_regenerate_prefers_ai_detailed_synthesis`
- H3-step-3 hoan tat (observability payload cho session/export v2):
  - them `aggregate.observability` gom `severity_drift_24h` va `aggregate_quality`.
  - `severity_drift_24h`: so sanh severity hien tai voi baseline 24h theo score map (info/warning/urgent).
  - `aggregate_quality`: score tong hop tu `actionability`, `noise_ratio`, `consistency` de feed dashboard.
  - ap dung cho ca Session API v2 va trace export API contract v2.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_session_get_returns_v2_contract_when_enabled`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_trace_export_returns_audit_artifact_bundle`
- H3-step-4 hoan tat (mini dashboard observability API cho FE H3):
  - them endpoint: `GET /api/stock-management/stocks/<symbol>/ai-advisory-observability/?window_hours=<n>&limit=<n>`
  - response gom `summary` (severity drift + avg aggregate quality) va `timeline` theo advisory.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_observability_returns_summary_and_timeline`
- H3-step-5 hoan tat (frontend tich hop observability panel trong Stock Workspace):
  - FE doi sang goi session v2 (`contract=v2`) va render `aggregate` block (decision/benchmarks/observability).
  - FE goi endpoint `ai-advisory-observability` va hien thi timeline mini trong panel AI Advisory.
  - Files: `frontend/src/api/client.js`, `frontend/src/pages/StockDetail.jsx`.
- H3-step-6 hoan tat (frontend hardening de dam bao build production xanh):
  - fix JSX parse error trong `SymbolInvestigationPanel` do nhanh render tra ve 2 sibling cung cap.
  - bo sung fragment bao quanh khoi `grid` va `co-observation timeline` trong `frontend/src/pages/WhaleAlertsHub.jsx`.
  - Build evidence: `npm run build` trong `frontend/` da `Compiled successfully`.
- H3-step-7 hoan tat (frontend smoke test cho symbol investigation + co-observation timeline):
  - bo sung testcase cho tab `Symbol Investigation` de xac nhan flow chon symbol va goi API `getSymbolInvestigation`.
  - verify render `co-observation timeline` badge va bucket marker de tranh regression sau H3-step-6.
  - Test evidence: `npm test -- --watchAll=false --runInBand src/pages/WhaleAlertsHub.test.jsx` (4 tests passed).
  - File: `frontend/src/pages/WhaleAlertsHub.test.jsx`.
- H3-step-8 hoan tat (release hardening: rollout + rollback + smoke command set):
  - chot checklist rollout theo cohort cho observability layer (Session v2 + benchmark + observability panel).
  - bo sung rollback checklist theo thu tu thao tac de quay ve mode an toan trong <15 phut.
  - bo sung smoke command set (backend API + frontend build/test + docker stack health) de QA/ops verify nhanh.
- H3-step-9 hoan tat (smoke artifact execution cho release gate):
  - da run lai bo smoke command set va luu artifact tai `docs/HOLISTIC_ADVISORY_H3_RELEASE_SMOKE_20260411.md`.
  - ket qua: docker stack healthy, frontend build pass, frontend investigation smoke tests pass (4/4), API protected endpoints tra 401 khi chua auth (expected behavior).
- H3-step-10 hoan tat (authenticated smoke cho protected advisory endpoints):
  - da run authenticated smoke bang test user seeded (`testuser`) va luu artifact tai `docs/HOLISTIC_ADVISORY_H3_AUTHENTICATED_SMOKE_20260411.md`.
  - ket qua: auth endpoint 200 (JWT issued), observability endpoint 200; session v2 endpoint dang tra 409 conflict tren nhom symbol seeded (HPG/FPT/VCB/VNM).
  - follow-up cho step tiep theo: triage root-cause 409 va bo sung fallback/retry policy cho UI.
- H3-step-11 hoan tat (triage + fix conflict 409 cho seeded-symbol session v2):
  - cap nhat `seed_demo_data` de bootstrap `SystemAISettings` active mac dinh cho local smoke flow.
  - cap nhat advisory seed de gan `WhaleAdvisory.user=testuser`, dam bao session endpoint lay duoc advisory theo user context.
  - Test evidence:
    - `python manage.py test portfolio.tests.test_seed_demo_data_whale_frontend -v 2` (sqlite): pass.
    - Sau khi rebuild backend images + reseed, probe `GET /api/stock-management/stocks/HPG/ai-advisory-session/?contract=v2&include_benchmarks=1` tra `200` (truoc do `409`).
- H3-step-12 hoan tat (frontend conflict state handling cho session v2):
  - FE bo sung conflict-safe fallback cho `GET ai-advisory-session` khi gap `409` (`ai_not_configured`, `missing_system_ai_settings`).
  - hien thi message mem + nut retry thu cong, tranh crash/blank panel.
  - Files: `frontend/src/pages/StockDetail.jsx`, `frontend/src/pages/stockDetailAdvisoryUtils.js`.
- H3-step-13 hoan tat (auto-retry backoff cho conflict tam thoi):
  - bo sung auto-retry toi da 3 lan voi backoff 2s/4s/8s cho conflict khong thuoc nhom `ai_not_configured`.
  - co cleanup timeout khi doi symbol/unmount.
- H3-step-14 hoan tat (frontend telemetry in-memory cho retry):
  - bo sung telemetry counters: `scheduled`, `recovered`, `failed`, `last_reason`, `last_outcome`, `last_event_at`.
  - hien thi telemetry card trong panel H3 observability.
- H3-step-15 hoan tat (persist telemetry xuong backend):
  - mo rong endpoint `ai-advisory-observability` ho tro `POST` de luu retry telemetry vao `AdvisoryAggregateAuditLog`.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_observability_post_retry_telemetry_creates_audit_log`.
- H3-step-16 hoan tat (GET observability tra retry events persisted):
  - bo sung `retry_events` va tong `retry_*_total` trong `summary` cua observability response.
  - Test evidence: `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_retry_events_from_audit_logs`.
- H3-step-17 hoan tat (retry events UX hardening):
  - FE bo sung filter `outcome`, filter `reason`, time window selector (`24h/48h/72h/7d`) va sort (`newest/oldest/most_failed`).
  - bo sung badge mau theo outcome + legend de debug nhanh.
- H3-step-18 hoan tat (server-side retry filter/sort):
  - GET observability nhan query params: `retry_outcome`, `retry_reason`, `retry_sort`.
  - response tra them `retry_filters` de FE theo doi context query.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_applies_retry_filters_and_sort`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_retry_events_from_audit_logs`

### H3 completion status update (2026-04-11, end-of-phase)

- H3 da duoc mo rong tu milestone benchmark/observability co ban sang conflict-resilience + telemetry governance + persisted observability UX.
- Da hoan tat full flow: detect 409 -> conflict-safe UX -> auto-retry backoff -> telemetry capture -> telemetry persistence -> server-side filtered observability timeline.
- Release readiness cho H3 dat muc:
  - backend tests focused pass,
  - frontend build pass,
  - observability panel da co du bo loc/sap xep/mau sac/legend de thao tac audit nhanh.

### H3-step-8 release/rollback checklist (operational)

Rollout checklist (pre-deploy):

1. Xac nhan flag runtime:
  - `STOCK_AI_ADVISORY_SESSION_V2_ENABLED`
  - `STOCK_AI_ADVISORY_BENCHMARKS_ENABLED`
2. Chay smoke backend API:
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-session/?contract=v2&include_benchmarks=1`
  - `GET /api/stock-management/stocks/<symbol>/ai-advisory-observability/?window_hours=24&limit=10`
3. Chay smoke frontend:
  - `npm run build` trong `frontend/`
  - `npm test -- --watchAll=false --runInBand src/pages/WhaleAlertsHub.test.jsx`
4. Chay smoke docker stack:
  - `./start_dev.ps1 -SkipBuild`
  - `docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml ps`

Rollback checklist (incident mode):

1. Tat `STOCK_AI_ADVISORY_BENCHMARKS_ENABLED` va `STOCK_AI_ADVISORY_SESSION_V2_ENABLED`.
2. Xac nhan endpoint session tra contract v1 mac dinh (khong benchmark/observability block).
3. Xac nhan UI van hien advisory panel theo luong cu (khong crash, khong blank panel).
4. Thu thap artifact dieu tra:
  - trace export (`ai-advisory-trace-export` contract v2 neu can)
  - backend log + celery log + frontend console snapshot.
5. Mo postmortem item va gan owner truoc khi rollout lai.

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

## Sprint H4 (Rollout governance + cohort controls)

Muc tieu: Chuyen Holistic Advisory V1 rollout tu mode bat/tat toan cuc sang governance theo cohort de giam rui ro release.

### H4 progress update (2026-04-11)

- H4-step-1 hoan tat (global rollout gate cho Holistic V1):
  - bo sung gate runtime cho Session API v2 va Observability endpoint.
  - khi gate tat, API tra `403` + reason `holistic_disabled` de FE xu ly nhat quan.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_session_v2_contract_returns_403_when_holistic_gate_disabled`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_returns_403_when_holistic_gate_disabled`
- H4-step-2 hoan tat (cohort-aware gate: `all`/`staff`/`allowlist`):
  - them settings:
    - `HOLISTIC_ADVISORY_V1_COHORT_MODE`
    - `HOLISTIC_ADVISORY_V1_COHORT_USERNAMES`
  - them helper gate theo user va ap dung cho ca session + observability APIs.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_session_v2_contract_returns_403_when_user_not_in_holistic_allowlist`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_returns_403_when_user_not_in_holistic_allowlist`
- H4-step-3 hoan tat (governance observability cho rollout deny trend):
  - moi request bi deny boi rollout gate duoc persist vao `AdvisoryAggregateAuditLog` voi event `rollout_gate_deny` (co `endpoint`, `deny_reason`, `cohort_mode`).
  - `GET ai-advisory-observability` bo sung block `governance` va summary field `rollout_gate_deny_total`.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_returns_403_when_holistic_gate_disabled`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_rollout_governance_trend`
- H4-step-4 hoan tat (governance analytics theo time bucket/cohort segment):
  - `GET ai-advisory-observability` ho tro query `governance_bucket=hour|day` (mac dinh `hour`).
  - bo sung `governance.rollout_gate_deny_trend[]` gom: `bucket`, `deny_total`, `deny_by_reason`, `deny_by_cohort_mode`.
  - bo sung validate query sai: tra `400` khi `governance_bucket` khong hop le.
  - Test evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_supports_governance_day_bucket`
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_returns_400_for_invalid_governance_bucket`
- H4-step-5 hoan tat (frontend mini chart cho governance trend):
  - panel H3 observability bo sung selector `governance bucket` (`hour/day`) de dong bo query voi backend.
  - render mini trend bar cho `rollout_gate_deny_trend` (toi da 8 buckets gan nhat), hien deny count + top reason + top cohort mode.
  - bo sung i18n keys cho vi/en.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-6 hoan tat (governance filter theo endpoint/reason, BE + FE):
  - backend `GET ai-advisory-observability` ho tro query:
    - `governance_endpoint=<endpoint_name>`
    - `governance_reason=<deny_reason>`
  - governance response bo sung `filters` de FE tracking context query.
  - frontend bo sung 2 selector filter endpoint/reason trong governance block va dong bo query params.
  - Test/build evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_applies_governance_endpoint_reason_filters`
    - `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-7 hoan tat (UX nhan de doc nhanh cho governance filters):
  - map endpoint raw -> nhan de hien thi (`Session API`, `Observability API`) trong dropdown filter.
  - map deny reason raw -> nhan de doc nhanh theo ngon ngu (vi/en) cho dropdown + trend rows.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-8 hoan tat (governance breakdown chips de filter 1 cham):
  - bo sung chips breakdown theo endpoint va reason ngay trong governance block.
  - cho phep click chip de ap filter tuong ung; click lai chip dang chon de reset ve `all`.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-9 hoan tat (hover tooltip cho trend bucket + top endpoint):
  - backend trend payload bo sung `deny_by_endpoint` theo tung bucket.
  - frontend hien `top endpoint` tren moi row va them tooltip hover tong hop (`deny`, `top endpoint`, `top reason`, `top cohort`).
  - Test/build evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_supports_governance_day_bucket`
    - `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-10 hoan tat (compact sparkline cho deny drift):
  - frontend bo sung sparkline mini cho 8 bucket gan nhat theo filter hien tai.
  - hien thong tin `latest` + `range min/max` de QA/Ops danh gia drift nhanh.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-11 hoan tat (highlight peak bucket cho sparkline):
  - danh dau bucket co deny cao nhat bang marker mau noi bat tren sparkline.
  - bo sung nhan peak bucket (`bucket + value`) va tooltip marker de triage incident nhanh.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-12 hoan tat (baseline overlay cho sparkline):
  - them duong baseline trung binh 8 buckets (dashed) tren sparkline governance.
  - hien chi so `baseline` va `delta vs baseline` de nhan dien bat thuong nhanh.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-13 hoan tat (incident colorization theo nguong delta):
  - bo sung severity badge cho `delta vs baseline` voi nguong:
    - `>= +4`: critical
    - `>= +2`: warning
    - `<= -2`: cooldown
    - con lai: normal
  - su dung mau canh bao tuong ung de QA/Ops phat hien incident ngay trong panel.
  - Build evidence: `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-14 hoan tat (runtime-configurable delta thresholds):
  - backend bo sung env/settings:
    - `HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD`
    - `HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD`
    - `HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD`
  - observability API tra `governance.delta_thresholds` de frontend dung nguong runtime thay vi hardcode.
  - frontend severity badge doc nguong tu payload runtime va hien nguong ap dung tren UI.
  - Test/build evidence:
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_governance_delta_thresholds`
    - `npm run build` trong `frontend/` => `Compiled successfully`.
- H4-step-15 hoan tat (admin-operable thresholds + rulebook):
  - backend mo rong `GET/PUT /api/admin-ops/system-ai-settings/` de cho phep doc/ghi `governance_delta_thresholds` voi rulebook validation:
    - warning/critical/cooldown phai >= 0
    - critical phai >= warning
  - bo sung runtime override helper de observability API doc nguong runtime tu cache key chung (`admin_ops:holistic_governance_delta_thresholds`).
  - frontend bo sung section trong `AdminOps` de admin cap nhat 3 nguong va xem rulebook ngay tren UI, khong can sua env thu cong.
  - Test/build evidence:
    - `SystemAIAdminApiTests.test_put_updates_governance_delta_thresholds` => `OK` (sqlite override local)
    - `ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_governance_delta_thresholds` => `OK` (sqlite override local)
    - Postgres profile parity: `OK` cho ca 2 tests khi chay voi `DB_ENGINE=postgres`, `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432`.
    - `npm run build` trong `frontend/` => `Compiled successfully`.

Work items:

1. Gate matrix rollout: all/staff/allowlist + fallback mode khi cau hinh khong hop le.
2. Cap nhat release runbook voi env template cho cohort rollout theo tung nhom user.
3. Mo rong regression matrix tu 2 test muc tieu len full nhom `test_system_ai_admin_api` + governance subset trong `test_api_routes` tren profile postgres.

Deliverables:

- Cohort-aware gate da active cho Holistic v1 APIs.
- Regression tests cho deny-path theo cohort.
- Masterplan + runbook duoc cap nhat theo governance model moi.

Acceptance:

- Gate check thong nhat giua session va observability APIs.
- Deny-path tra contract loi on dinh (`403`, `reason=holistic_disabled`) cho FE.
- Co the rollout theo allowlist ma khong anh huong user ngoai cohort.

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
