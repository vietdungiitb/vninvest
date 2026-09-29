# Whale Service Execution Pack

Ngay cap nhat: 2026-04-23  
Muc tieu: Bo tai lieu day du de team code implement khong can hoi lai  
Pham vi: Whale threshold hardening, anti-spam refresh, recompute/backfill, API, UI, test, rollout

## 1. Danh sach tai lieu bat buoc

1. IMPLEMENTATION_PLAN_WHALE_SERVICE_EXECUTION_20260423.md
2. TECH_SPEC_WHALE_SERVICE_EXECUTION_20260423.md
3. API_CONTRACT_WHALE_SERVICE_20260423.md
4. TASKBOARD_WHALE_SERVICE_EXECUTION_20260423.md
5. WALKTHROUGH_WHALE_SERVICE_EXECUTION_20260423.md
6. RUNBOOK_WHALE_SERVICE_OPERATIONS_20260423.md
7. QA_TEST_MATRIX_WHALE_SERVICE_20260423.md
8. DECISION_LOG_WHALE_SERVICE_20260423.md
9. CHECKLIST_WHALE_SERVICE_EXECUTION_20260423.md

## 2. Thu tu doc va thuc thi

1. Doc DECISION_LOG de khoa nghiep vu.
2. Doc IMPLEMENTATION_PLAN de nam pha va gate.
3. Doc TECH_SPEC + API_CONTRACT de coding theo contract.
4. Lam theo TASKBOARD va WALKTHROUGH.
5. Thuc thi theo CHECKLIST.
6. Xac nhan bang QA_TEST_MATRIX.
7. Van hanh theo RUNBOOK.

## 3. Definition of Ready

1. Team da chot lock strategy + anti-spam policy.
2. Team da chot rule threshold mismatch (tooltip vs realtime).
3. Team da xac nhan migration null threshold -> default threshold.
4. Team da xac nhan permission matrix admin/user.

## 4. Definition of Done

1. TrackedSymbol khong con threshold null.
2. USER_REFRESH khong bi spam tao nhieu job cung scope.
3. Tooltip tra ve raw count theo threshold user.
4. Global service chi admin trigger.
5. Backfill co checkpoint, status, log, va resume.
6. Test matrix pass va co evidence.
