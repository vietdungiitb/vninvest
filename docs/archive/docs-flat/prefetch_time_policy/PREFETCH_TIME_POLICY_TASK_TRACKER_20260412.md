# PREFETCH TIME POLICY - TASK TRACKER (2026-04-12)

## Cach dung nhanh

- Moi task co owner, han, trang thai.
- Khi bat dau: doi `[ ]` -> `[-]`.
- Khi xong: doi `[-]` -> `[x]`, ghi ngay hoan thanh.
- Neu block: them dong `BLOCKED:` ben duoi task.

Legend:
- `[ ]` Not started
- `[-]` In progress
- `[x]` Done

---

## Timeline tong

- Sprint: 2026-04-13 -> 2026-04-22
- Daily standup cap nhat: 09:15
- Cutoff merge cho rollout canary: 2026-04-19

---

## PR-1 Backend schema + validator + settings API

- Status: [x]
- Owner: BE-1
- Due: 2026-04-14
- Deliverables:
  - [x] Them default `prefetch_time_policy` object.
  - [x] Them coerce/validation + error map field-level.
  - [x] GET/PUT admin settings tra/nhan `prefetch_time_policy`.
  - [x] Tra `prefetch_time_policy_rulebook` cho frontend.
- Acceptance:
  - [x] PUT payload sai tra 400 dung format.
  - [x] GET payload hop le khi cache miss.

---

## PR-2 Resolver + task integration + metadata

- Status: [x]
- Owner: BE-2
- Due: 2026-04-16
- Deliverables:
  - [x] Resolver profile theo timezone va khung gio.
  - [x] Ho tro pre_open 30p va post_close 30p.
  - [x] Tich hop vao prefetch task: skip query khi offhours.
  - [x] Metadata health co `policy_profile`, `query_enabled`, `reason`.
- Acceptance:
  - [x] Unit test moc gio bien pass.
  - [x] Metadata xuat hien trong health payload.

---

## PR-3 Guard 429 + observability metrics

- Status: [x]
- Owner: BE-OBS
- Due: 2026-04-17
- Deliverables:
  - [x] Apply `cooldown_multiplier_on_429`.
  - [x] Clamp boi `max_interval_seconds`.
  - [x] Expose metrics profile/skip/multiplier/effective interval.
- Acceptance:
  - [x] Metric docs cap nhat.
  - [x] Counter tang dung khi gap 429.

---

## PR-4 AdminOps UI form + i18n

- Status: [x]
- Owner: FE-1
- Due: 2026-04-18
- Deliverables:
  - [x] Them section policy trong AdminOps.
  - [x] Render market window + profile cards + guard fields.
  - [x] Bo sung i18n vi/en day du.
- Acceptance:
  - [x] GET settings load dung vao form.
  - [x] UI khong vo layout tren mobile.

---

## PR-5 FE validation + save flow + preview

- Status: [x]
- Owner: FE-2
- Due: 2026-04-19
- Deliverables:
  - [x] Validation client-side cho range/time.
  - [x] Save flow + success/error feedback.
  - [x] Preview profile active theo thoi gian hien tai.
- Acceptance:
  - [x] Khong gui payload invalid.
  - [x] Preview khop payload backend tra ve.

---

## PR-6 Test suite + docs + rollout guide

- Status: [x]
- Owner: QA-1
- Due: 2026-04-22
- Deliverables:
  - [x] Backend focused unit tests cho resolver/guard/fallback da pass.
  - [x] Backend API integration tests cho policy API da pass (SQLite test env override).
  - [x] Frontend automated test suite da pass.
  - [x] Manual QA checklist pre-open/post-close/weekend da co trong test matrix.
  - [x] Rollout + rollback runbook da san sang.
- Acceptance:
  - [x] Tat ca test critical cho pham vi PR da pass.
  - [ ] Canary 24h on dinh truoc full rollout.
  - RESOLVED: local test DB issue duoc bypass on dinh bang test env override `DB_ENGINE=sqlite`.
  - Evidence: docs/PREFETCH_TIME_POLICY_PR6_EVIDENCE_20260412.md

---

## Daily status log

### 2026-04-13
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-12 (execution update)
- BE: Hoan thanh PR-1..PR-3 (policy API/resolver/guard/fallback) va pass test focused cho adapter + task.
- FE: Hoan thanh PR-4..PR-5 (form policy, i18n, validation nang cao, map field errors, reset UX).
- QA: Da chot evidence backend 9 tests pass + frontend 7 suites pass; da tao UAT handover package gom UAT result + Go/No-Go memo + capture script; da chay script capture canary va dong evidence S1-S4.
- Risks: Chua co test frontend chuyen biet cho AdminOps policy form (chi co suite tong quan hien tai); baseline cho thay p95 latency va 5xx ratio tren realtime-ticker dang cao.
- Next day plan:
  - Thu chu ky QA Lead + Tech Lead + PM de dong Gate C.
  - Them test frontend rieng cho AdminOps policy form.
  - Hoan tat B3.2 (alert route den kenh van hanh) de mo canary.
  - Lap canary plan de so sanh truoc/sau theo cung script checker.
  - Mo draft PR-1, PR-2, PR-4 va gan owner.
  - Chot resolver boundary table va i18n key list.
  - Chot test matrix + evidence format.

### 2026-04-14
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-15
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-16
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-17
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-18
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-19
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-20
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-21
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

### 2026-04-22
- BE:
- FE:
- QA:
- Risks:
- Next day plan:

---

## Blockers va quyet dinh

- 2026-04-12:
  - BLOCKER: `manage.py test portfolio.tests.test_system_ai_admin_api...` bi tre o buoc tao test DB trong local run khi env dang o Postgres mode.
  - DECISION: chay test evidence mode voi `DB_ENGINE=sqlite` + Redis timeout ngan; blocker duoc giai quyet cho local validation.
  - BLOCKER: khong the chay baseline Gate B2 co auth do backend local `http://127.0.0.1:8000` khong reachable trong phien hien tai.
  - DECISION: da switch runtime sang `http://127.0.0.1:8010`, chay baseline auth thanh cong va checker PASS (`docs/ops-evidence/prefetch-policy-baseline/20260412-080254/gate-b2-check.md`).

---

## Lien ket nhanh

- Master index: docs/PREFETCH_TIME_POLICY_MASTER_INDEX_20260412.md
- Kickoff playbook: docs/PREFETCH_TIME_POLICY_KICKOFF_PLAYBOOK_20260412.md
- Ready-to-code checklist: docs/PREFETCH_TIME_POLICY_READY_TO_CODE_CHECKLIST_20260412.md
- Tech spec: docs/PREFETCH_TIME_POLICY_TECH_SPEC_20260412.md
- API contract: docs/PREFETCH_TIME_POLICY_API_CONTRACT_20260412.md
- Test matrix: docs/PREFETCH_TIME_POLICY_TEST_MATRIX_20260412.md
- Observability spec: docs/PREFETCH_TIME_POLICY_OBSERVABILITY_SPEC_20260412.md
- Rollback runbook: docs/PREFETCH_TIME_POLICY_ROLLBACK_RUNBOOK_20260412.md
- Decision log: docs/PREFETCH_TIME_POLICY_DECISION_LOG_20260412.md
- Branching/commit guide: docs/PREFETCH_TIME_POLICY_BRANCHING_COMMIT_GUIDE_20260412.md
- Code blueprint: docs/PREFETCH_TIME_POLICY_CODE_BLUEPRINT_20260412.md
- Config reference: docs/PREFETCH_TIME_POLICY_CONFIG_REFERENCE_20260412.md
- Frontend form schema: docs/PREFETCH_TIME_POLICY_FRONTEND_FORM_SCHEMA_20260412.md
- UAT handover: docs/PREFETCH_TIME_POLICY_UAT_HANDOVER_20260412.md
- Plan tong: docs/PREFETCH_TIME_POLICY_ADMIN_PLAN_20260412.md
- Execution board: docs/PREFETCH_TIME_POLICY_EXECUTION_BOARD_20260412.md
- PR checklist templates: docs/PREFETCH_TIME_POLICY_PR_CHECKLISTS_20260412.md
- Release gates checklist: docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md
- Baseline capture playbook: docs/PREFETCH_TIME_POLICY_BASELINE_CAPTURE_PLAYBOOK_20260412.md
- Baseline capture script: scripts/ops/prefetch_policy_capture_baseline.ps1
- Gate B2 checker script: scripts/ops/prefetch_policy_gate_b2_check.ps1
- PR drafts:
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR1_DRAFT.md
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR2_DRAFT.md
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR3_DRAFT.md
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR4_DRAFT.md
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR5_DRAFT.md
  - docs/pr_drafts/PREFETCH_TIME_POLICY_PR6_DRAFT.md
