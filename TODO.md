# Sprint 14 Phase 1 - Mission Control Foundation TODO

- [x] 1. Add Mission Control data models in `backend/portfolio/models.py`
  - [x] 1.1 WhaleConfigVersion
  - [x] 1.2 WhaleConfigDraft
  - [x] 1.3 WhaleConfigApproval
  - [x] 1.4 WhaleConfigRollout
  - [x] 1.5 WhaleConfigWorkerAck
  - [x] 1.6 WhaleConfigAuditLog

- [x] 2. Register and enforce admin workflow in `backend/portfolio/admin.py`
  - [x] 2.1 Register all Mission Control models
  - [x] 2.2 Add role split (Analyst/Supervisor)
  - [x] 2.3 Enforce maker-checker (creator cannot approve)
  - [x] 2.4 Add audit-first admin hooks/actions

- [ ] 3. Mission Control migration status
  - [x] 3.1 Existing migration detected (`0010_whaleconfigdraft_whaleconfigapproval_and_more.py`)
  - [x] 3.2 Verify no additional migration needed after admin/test updates

- [x] 4. Add tests for Mission Control phase 1
  - [x] 4.1 Create `backend/portfolio/tests/test_admin_whale_mission_control.py`
  - [x] 4.2 Cover create draft/version
  - [x] 4.3 Cover maker-checker block
  - [x] 4.4 Cover analyst/supervisor admin permission workflow
  - [x] 4.5 Cover admin audit trail workflow

- [ ] 5. Run verification tests
  - [x] 5.1 Run new Mission Control tests
  - [x] 5.2 Run admin-related smoke tests

- [x] 6. Sprint 14 Phase 2 - Warm-up & Integrity Check + Safety Guardrails
  - [x] 6.1 Add config diff preview + guardrail validator in `backend/portfolio/services.py`
  - [x] 6.2 Add dependency checks before apply/rollout in `backend/portfolio/services.py`
  - [x] 6.3 Enforce preview/blocking flow in `backend/portfolio/admin.py`
  - [x] 6.4 Add admin tests for diff preview, guardrails, dependency gate
  - [x] 6.5 Verify tests pass and no new migration is required

- [x] 7. Sprint 14 Phase 3 - Worker ACK va Propagation Visibility
  - [x] 7.1 Add rollout initialization + worker discovery helpers in `backend/portfolio/services.py`
  - [x] 7.2 Add worker ACK recording + propagation snapshot/status helpers in `backend/portfolio/services.py`
  - [x] 7.3 Add Celery tasks for rollout refresh/ack in `backend/portfolio/tasks.py`
  - [x] 7.4 Wire apply/save rollout flow to create rollout + ACK tracking in `backend/portfolio/admin.py`
  - [x] 7.5 Add propagation visibility badges/progress in admin Mission Control
  - [x] 7.6 Expose propagation summary in admin-ops stats response
  - [x] 7.7 Verify Mission Control + admin-ops tests pass and no new migration is required

- [x] 8. Sprint 14 Phase 4 - Scheduled Activation va Canary Rollout
  - [x] 8.1 Add runtime config resolver for active/canary rollout in `backend/portfolio/services.py`
  - [x] 8.2 Add canary scope matching for symbol/exchange/group/percentage in `backend/portfolio/services.py`
  - [x] 8.3 Add scheduled rollout activation service + Celery task/beat schedule
  - [x] 8.4 Make runtime workers auto-ACK when loading rollout config in realtime paths
  - [x] 8.5 Pass real `config_version` and scoring config into whale realtime payloads
  - [x] 8.6 Add tests for canary scope, scheduled activation, and runtime ACK auto-load
  - [x] 8.7 Verify Mission Control + realtime compute tests pass and no new migration is required

- [x] 9. Sprint 14 Phase 5 - Auto-revert va Anomaly Detection
  - [x] 9.1 Add anomaly snapshot detector on IntradayTick + WhaleAdvisory in `backend/portfolio/services.py`
  - [x] 9.2 Add auto-revert helper to fallback to previous stable version and send notification
  - [x] 9.3 Add Celery task/beat monitor for anomaly scan + auto-revert
  - [x] 9.4 Expose anomaly visibility in admin Mission Control and admin-ops stats
  - [x] 9.5 Add tests for anomaly detection and auto-revert flow
