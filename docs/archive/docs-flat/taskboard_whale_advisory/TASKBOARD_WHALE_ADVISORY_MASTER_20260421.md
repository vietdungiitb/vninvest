# Taskboard: Whale Advisory Command Center Enhancement (Master)

Final state as of 2026-04-21. All tasks completed.

## Phase 1: SSOT Refactor
- [x] **BE-01**: Architecture review & Research (Logic mapping)
- [x] **BE-02**: Core Logic Refactor (Threshold Resolution)
- [x] **BE-03**: Side & Size Classification Service
- [x] **BE-04**: WhaleSignalEngine Interface Implementation
- [x] **BE-05**: Service Unit Tests
- [x] **BE-06**: OrderFlowSignal Schema Optimization Review
- [x] **BE-08**: Refactor `whale_advisory_symbol_stats_api`
- [x] **BE-09**: Refactor `stock_order_flow_api`
- [x] **BE-10**: Integration Testing (Alerts vs Advisory parity)
- [x] **DOC-01**: Internal API Contract Documentation

## Phase 2 & 3: Market Discovery & Agentic UI
- [x] **BE-12**: Extend WhaleSignalEngine (Intensity & Discovery logic)
- [x] **BE-13**: Populate Discovery fields in Persistence Task
- [x] **BE-14**: Implement Market Discovery Hub API
- [x] **BE-15**: Integration Tests (Discovery Engine)

## Phase 4: Real-time Discovery Integration
- [x] **BE-17**: Update Broadcast Logic (Include Discovery Fields)
- [x] **BE-18**: Trigger Discovery Broadcast in Persistence Phase
- [x] **BE-19**: WebSocket Consumer (Group support)
- [x] **FE-06**: Frontend WS Subscription (WhaleAdvisory)
- [x] **FE-07**: Handle Discovery WS Event

## Phase 5: Whale Bubble Chart Integration
- [x] **FE-08**: Update WhaleBubbleChart.jsx (Controlled Mode)
- [x] **FE-09**: Optimized Dashboard Layout
- [x] **FE-10**: Final Board Layout Polish & Verification

## Phase 6: Audit Alignment & Hardening
- [x] **AU-01**: Align `views_whale_orders.py` with dynamic threshold resolution from `WhaleSignalEngine.resolve_threshold_vnd`
- [x] **AU-02**: Remove stale fixed-threshold fallback semantics from bubble classification path
- [x] **AU-03**: Correct master Tech Spec WebSocket contract to match actual discovery payload
- [x] **AU-04**: Add latency probe script and automated latency unit test for discovery broadcast path
- [x] **AU-05**: Run `manage.py test portfolio.tests.test_latency -v 2` and archive performance evidence for final audit
- [x] **AU-06**: Restore missing `WhaleAdvisory` discovery fields used by persistence, serializers, and discovery hub views
- [x] **AU-07**: Register `/api/portfolio/market-discovery-hub/` route so frontend discovery mode hits a live endpoint
