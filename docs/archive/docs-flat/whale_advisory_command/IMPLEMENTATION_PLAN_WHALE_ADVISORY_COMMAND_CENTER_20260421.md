# IMPLEMENTATION PLAN: Whale Advisory Command Center Upgrade (2026)

## 1. Business Objective
- **Problem**: Current `WhaleAdvisory` is a monolithic (1039 lines), static report. Lacks "Agentic" interactivity.
- **KPI**: 
  - Refactor `WhaleAdvisory.jsx` to < 200 lines (Target: 150 lines).
  - 100% compliance with `PaginationBar.jsx`.
  - **Perceived Latency**: Time-to-first-character display for "Thought Stream" <= 150ms.
  - **Measurement**: Performance API (`performance.mark`), average of 10 samples on a standard workstation (8-core CPU, 16GB RAM).

## 2. Scope and Non-scope
- **In-scope**: Bento Grid layout, Refactoring to ~10 components, Agentic UI (simulated streaming), Full i18n (VI default).
- **Out-of-scope**: Backend SSE streaming (v2), altering core AI algorithms.

## 3. Current-state Assessment
- **Status**: Monolithic file handles everything. Styling is standard Tailwind without modern glassmorphism/neon specifics.
- **Constraints**: No modularity. Pagination is missing for symbol navigation in the current implementation.

## 4. Target Design
- **Architecture**: Orchestrator Pattern. Layout: 3-column Bento Grid for LG+.
- **Data Flow**: Context -> Orchestrator (Page) -> components.

## 5. Execution Phases
- **Phase 0: Preparation**: CSS tokens, i18n keys.
- **Phase 1: Extraction**: Extract `WhaleSymbolSidebar` (w/ `PaginationBar`) and `WhaleAdvisoryCommandPanel`.
- **CHECKPOINT**: Mini-audit after Phase 1 to prevent core regression.
- **Phase 2: Layout**: Apply Bento Grid layout orchestrator.
- **Phase 3: Agentic UI**: Implementation of `AgenticThoughtStream` and micro-animations.

## 6. API and Data Contract Changes
- **V1**: Uses existing JSON payload. Frontend chunks `summary_text` to simulate streaming.
- **Compatibility**: Preserve all existing URL parameters and search queries for deep-linking.

## 7. Scheduling and Operations
- **Circuit-breaker**: UI-side debounce (5s) for manual refresh triggers.
- **Monitoring**: Component mount/unmount telemetry and error logging for sub-components via `TrustTelemetryPanel`.

## 8. Testing and Verification
- **Unit**: Verify character chunking logic in `AgenticThoughtStream`.
- **Integration**: Verify symbol selection correctly updates all Bento cells.
- **Exit Criteria**: 
  - 0 console errors. 
  - 100% i18n coverage (Vietnamese default). 
  - Responsive breakpoints (LG, XL) verified.

## 9. Observability and Alerting
- Track "Manual Refresh" and "View Deep Re-analysis" interactions.
- Error boundary triggers for each Bento cell.

## 10. Security and Governance
- Maintain existing `Can` permission checks. No credentials or secrets exposed in docs.

## 11. Release Plan
- **Git Flow**: Implementation on a feature branch `feat/whale-command-center-v2`.
- **Feature Flag (V1)**: Controlled solely via `ENABLE_ADVISORY_COMMAND_CENTER_V2` environment variable. (UserConfig persistence postponed to V2).
- **Rollback Strategy**: 
  - Immediate `git revert` of the merge commit.
  - Runtime toggle-off of the feature flag if error rate > 5% (Denominator: Total unique sessions with the flag enabled in the last 1 hour).

## 12. Ownership and Timeline
- **Owner**: Viet Dung (Human Lead).
- **Implementation Partner**: Antigravity (AI).
- **Reviewer**: Viet Dung.
- **Total Duration**: ~10 hours across 4 phases.
