# CORE API OpenAPI Standardization Handoff Master

Date: 2026-05-13
Status: Approved for execution
Scope: Standardize all OpenAPI function design and implementation across core services
SSOT policy: docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md

---

## 1. Muc tieu

Ban giao cho doi code mot goi thuc thi day du de:
- Sua loi contract hien huu tren Core API.
- Chuan hoa cach xay dung endpoint OpenAPI cho backend + frontend + QA.
- Dat governance bat buoc tren PR/CI de tranh tai phat sinh regression.

---

## 2. Mandatory policy

Tat ca thay doi OpenAPI tu thoi diem nay BAT BUOC tuan theo:
- docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md
- docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md

Khong dat policy -> khong merge.

---

## 3. Deliverables trong goi ban giao

1. Implementation plan:
   - docs/IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
2. Technical spec:
   - docs/TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
3. Taskboard:
   - docs/TASKBOARD_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
4. Traceability matrix:
   - docs/CORE_API_OPENAPI_STANDARDIZATION_TRACEABILITY_MATRIX_20260513.md
5. Self audit and test protocol:
   - docs/CORE_API_OPENAPI_STANDARDIZATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260513.md
6. Code review runbook:
   - docs/RUN_CODE_REVIEW_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
7. Integration test runbook:
   - docs/RUN_INTEGRATION_TESTS_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
8. Spec audit runbook:
   - docs/RUN_SPEC_AUDIT_CORE_API_OPENAPI_STANDARDIZATION_20260513.md
9. Execution evidence template:
   - docs/CORE_API_OPENAPI_STANDARDIZATION_EXECUTION_EVIDENCE_TEMPLATE_20260513.md

---

## 4. Team ownership

- Tech Lead: governance sign-off, exception approval.
- Backend Lead: contract implementation, serializer/view/service compliance.
- Frontend Lead: API client adaptation and typed contract parity.
- QA Lead: functional + integration + regression gates.
- DevOps: CI gate integration and branch protection.

---

## 5. Execution phases

1. Phase A (Week 1): Critical contract hygiene and blocker fixes.
2. Phase B (Week 2): Security semantics + tenant/rate-limit standardization.
3. Phase C (Week 3): Full OpenAPI metadata and response/error consistency.
4. Phase D (Week 4): Performance and observability normalization.
5. Phase E (Week 5): CI/PR enforcement activation.
6. Phase F (Week 6): Audit rollout + KPI acceptance.

---

## 6. Acceptance gates

- Gate G1: 0 critical OpenAPI contract violations.
- Gate G2: 100% list APIs have pagination policy.
- Gate G3: 100% auth-sensitive APIs have rate-limit policy.
- Gate G4: 100% tenant-scoped APIs have isolation tests.
- Gate G5: OpenAPI metadata aligned with implementation.
- Gate G6: CI gates enabled and branch-protected.

---

## 7. Reporting and evidence obligations

Moi slice phai cap nhat:
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md

Moi phase phai nop:
- Danh sach file doi.
- Lenh validation + ket qua.
- Snapshot payload contract neu thay doi response.
- Residual risk note.

---

## 8. No-go conditions

- Merge PR API khi chua cap nhat OpenAPI metadata.
- Merge PR API khi chua pass checklist mandatory.
- Deploy production khi chua pass integration + spec audit.

---

## 9. Operational note

`packages/core/backend/src/staticfiles/` la generated artifacts path, khong duoc theo doi trong Git de tranh nhiu audit va drift khong lien quan source of truth.
