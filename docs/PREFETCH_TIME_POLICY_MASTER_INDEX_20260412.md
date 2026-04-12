# PREFETCH TIME POLICY - MASTER INDEX (2026-04-12)

## Muc dich

Day la trang dieu huong trung tam cho toan bo ke hoach, thuc thi, review, rollout va theo doi sau phat hanh.

Su dung thu tu tu tren xuong duoi de trien khai nhanh va giam sai sot.

---

## 0) Bat dau tu day

1. Doc plan tong de hieu muc tieu va thiet ke.
2. Di vao execution board de chia viec theo PR/workstream.
3. Theo doi tien do hang ngay tren task tracker.
4. Dung PR checklists + PR drafts de mo PR chuan.
5. Khi sap release, bat buoc qua release gates.

---

## 1) Plan tong

- docs/PREFETCH_TIME_POLICY_ADMIN_PLAN_20260412.md

Noi dung:
- Muc tieu, schema policy, backend/frontend implementation plan, KPI, rui ro, DoD.

---

## 2) Execution board

- docs/PREFETCH_TIME_POLICY_EXECUTION_BOARD_20260412.md

Noi dung:
- Workstream A/B/C/D, PR slices, dependency map, rollout checklist.

---

## 3) Task tracker hang ngay

- docs/PREFETCH_TIME_POLICY_TASK_TRACKER_20260412.md

Noi dung:
- Status theo PR, owner, due date, daily log, blockers va decisions.

---

## 4) PR checklists

- docs/PREFETCH_TIME_POLICY_PR_CHECKLISTS_20260412.md

Noi dung:
- Checklist review rieng cho PR-1..PR-6 va muc bat buoc chung.

---

## 5) PR drafts

- docs/pr_drafts/PREFETCH_TIME_POLICY_PR1_DRAFT.md
- docs/pr_drafts/PREFETCH_TIME_POLICY_PR2_DRAFT.md
- docs/pr_drafts/PREFETCH_TIME_POLICY_PR3_DRAFT.md
- docs/pr_drafts/PREFETCH_TIME_POLICY_PR4_DRAFT.md
- docs/pr_drafts/PREFETCH_TIME_POLICY_PR5_DRAFT.md
- docs/pr_drafts/PREFETCH_TIME_POLICY_PR6_DRAFT.md

Noi dung:
- Mau mo ta PR san cho tung slice, gom scope, test plan, risk, rollback, evidence.

---

## 6) Release gates

- docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md

Noi dung:
- Gate A->E, KPI guardrails, rollback trigger matrix, sign-off blocks.

---

## 6.1) Kickoff playbook

- docs/PREFETCH_TIME_POLICY_KICKOFF_PLAYBOOK_20260412.md

Noi dung:
- Agenda khoi dong sprint, Day-1 deliverables, DoR, standup format, escalation rule.

---

## 6.2) Baseline capture playbook

- docs/PREFETCH_TIME_POLICY_BASELINE_CAPTURE_PLAYBOOK_20260412.md

Noi dung:
- Script chuan de chup baseline KPI Gate B2 (429/cooldown/freshness/p95 latency) va mapping artifact.

---

## 7) Thu tu trien khai de xuat

1. PR-1 -> PR-2 -> PR-3
2. Song song: PR-4 (sau PR-1)
3. PR-5 (sau PR-4 va data tu PR-2)
4. PR-6 tong hop test + docs + rollout

---

## 8) RACI nhanh

- BE-1: PR-1
- BE-2: PR-2
- BE-OBS: PR-3
- FE-1: PR-4
- FE-2: PR-5
- QA-1: PR-6
- Tech Lead/PM: duyet release gates

---

## 9) Quy uoc cap nhat

- Moi ngay cap nhat task tracker truoc 09:15.
- Moi PR bat buoc dan link den checklist va draft tuong ung.
- Truoc canary/full rollout: cap nhat release gates va xin duyet.

---

## 10) Muc chot

Hoan thanh khi:
- Tat ca PR merge.
- Release gates dat.
- KPI sau rollout dat nguong chap nhan.
- Docs va changelog da dong bo.

---

## 11) Ready-to-code docs pack

- docs/PREFETCH_TIME_POLICY_READY_TO_CODE_CHECKLIST_20260412.md
- docs/PREFETCH_TIME_POLICY_TECH_SPEC_20260412.md
- docs/PREFETCH_TIME_POLICY_API_CONTRACT_20260412.md
- docs/PREFETCH_TIME_POLICY_TEST_MATRIX_20260412.md
- docs/PREFETCH_TIME_POLICY_OBSERVABILITY_SPEC_20260412.md
- docs/PREFETCH_TIME_POLICY_ROLLBACK_RUNBOOK_20260412.md
- docs/PREFETCH_TIME_POLICY_DECISION_LOG_20260412.md
- docs/PREFETCH_TIME_POLICY_BRANCHING_COMMIT_GUIDE_20260412.md
- docs/PREFETCH_TIME_POLICY_CODE_BLUEPRINT_20260412.md
- docs/PREFETCH_TIME_POLICY_CONFIG_REFERENCE_20260412.md
- docs/PREFETCH_TIME_POLICY_FRONTEND_FORM_SCHEMA_20260412.md
- docs/PREFETCH_TIME_POLICY_UAT_HANDOVER_20260412.md
- docs/PREFETCH_TIME_POLICY_UAT_RESULT_20260412.md
- docs/PREFETCH_TIME_POLICY_GO_NO_GO_RECOMMENDATION_20260412.md
- docs/PREFETCH_TIME_POLICY_BASELINE_CAPTURE_PLAYBOOK_20260412.md
- docs/PREFETCH_TIME_POLICY_GUARDRAIL_THRESHOLDS_20260412.md
- scripts/ops/prefetch_policy_uat_capture.ps1
