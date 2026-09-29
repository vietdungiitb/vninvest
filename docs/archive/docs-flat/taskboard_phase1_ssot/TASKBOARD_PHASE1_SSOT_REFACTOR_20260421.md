# Taskboard: Phase 1 - SSOT Refactor (AI Advisory Enhancement)

## Phase 1 Overview
- **Objective**: Consolidate Whale/Large Order detection logic into a central service.
- **Timeline**: 2026-04-22 to 2026-04-26 (Target)
- **Total Effort**: ~51 hours

## TODO List

### [ ] Backend Service (BE-01 to BE-05) - 25h
- `[ ]` **BE-01**: Architecture review & Research (Logic mapping)
- `[ ]` **BE-02**: Core Logic Refactor (Threshold Resolution)
- `[ ]` **BE-03**: Side & Size Classification Service
- `[ ]` **BE-04**: WhaleSignalEngine Interface Implementation
- `[ ]` **BE-05**: Service Unit Tests

### [ ] Database Schema (BE-06 to BE-07) - 5h
- `[ ]` **BE-06**: OrderFlowSignal Schema Optimization Review
- `[ ]` **BE-07**: Migration Script (Optional - if fields need update)

### [ ] View Refactoring (BE-08 to BE-09) - 9h
- `[ ]` **BE-08**: Refactor `whale_advisory_symbol_stats_api`
- `[ ]` **BE-09**: Refactor `stock_order_flow_api`

### [ ] Testing & Release (BE-10 to BE-11) - 5h
- `[ ]` **BE-10**: Integration Testing (Alerts vs Advisory parity)
- `[ ]` **BE-11**: Final Review & PR Merge

### [ ] Documentation (DOC-01 to DOC-02) - 3h
- `[ ]` **DOC-01**: Internal API Contract Documentation
- `[ ]` **DOC-02**: Runbook for Phase 1 Release
