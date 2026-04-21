# IMPLEMENTATION PLAN: Whale Advisory Command Center Upgrade (2026)

## 1. Business Objective
- **Problem**: The current `WhaleAdvisory` page is a static, non-interactive "Snapshot Report" that lacks the "Agentic" feel required for 2026 standards. The codebase is monolithic (>1000 lines), making it hard to maintain.
- **KPI**: 
  - Reduce `WhaleAdvisory.jsx` line count to < 200 lines (orphaning logic to components).
  - 100% compliance with `PaginationBar.jsx` for symbol navigation.
  - Implement "Agentic Thought Stream" UI with 0ms perceived latency for the start of text display.

## 2. Scope and Non-scope
- **In-scope**:
  - Refactoring `WhaleAdvisory.jsx` into ~10 modular components in `frontend/src/components/advisory/`.
  - Implementing Bento Grid layout using Tailwind CSS.
  - Adding "Thought Stream" simulated animation (V1) and background re-analysis trigger logic.
  - Full i18n support for Vietnamese (default) and English.
- **Out-of-scope**:
  - Real-time Server-Sent Events (SSE) for streaming (Postponed to V2).
  - Modification of the core AI recommendation algorithm (Backend logic remains the same).

## 3. Current-state Assessment
- **Current File**: `frontend/src/pages/WhaleAdvisory.jsx` is 1039 lines. It handles state, fetching, individual cell rendering, and sidebar logic in one place.
- **Constraints**: Uses older `SymbolCell` and `AdvisoryCell` inline patterns. Pagination is currently implicit or missing for long tracked symbol lists.

## 4. Target Design
- **Architecture**: Orchestrator Pattern. `WhaleAdvisory.jsx` manages global state (active symbol, refresh status) and delegates UI to specialized components.
- **Layout**: 3-column Bento Grid for LG+ screens.
  - Column 1: `WhaleSymbolSidebar` (Scrollable list with search).
  - Column 2/3 Top: `CommandPanel` (Main Analysis).
  - Column 2/3 Bottom: `ImpactAnalysis` & `GuardrailManager`.
- **Data Flow**: `PortfolioContext` -> `WhaleAdvisory` (Page) -> Props -> Child Components.

## 5. Execution Phases
- **Phase 0: Preparation (DoR)**
  - Define Design Tokens in `index.css`.
  - Create i18n keys in `vi.js` and `en.js`.
- **Phase 1: Component Extraction (Vertical Slice)**
  - Extract `SymbolSidebar` and `CommandPanel`.
  - Gate: `SymbolSidebar` must correctly use `PaginationBar.jsx`.
- **Phase 2: Bento Layout Implementation**
  - Apply the new grid layout to `WhaleAdvisory.jsx`.
  - Integrate extracted components.
- **Phase 3: Agentic Features (UI layer)**
  - Implement `AgenticThoughtStream` with simulated "typing" effect.
  - Add "Pulse" and "Wave" micro-animations.
- **Rollback Strategy**: 
  - Keep the original `WhaleAdvisory.jsx` as `WhaleAdvisory.jsx.bak` during implementation.
  - Rollback involves reverting the `pages/WhaleAdvisory.jsx` file and deleting new component files.

## 6. API and Data Contract Changes
- **Compatibility**: No changes to existing `getWhaleAdvisories` or `refreshWhaleAdvisory` endpoints.
- **V1 Contract**: Use existing JSON response. The frontend will simulate "streaming" by chunking the static `summary_text`.
- **Future Ready**: Plan for `GET /api/advisory/stream/{symbol}` for V2.

## 7. Scheduling and Operations
- **Interval**: No change to existing periodic jobs.
- **Guardrails**: UI-level checks to prevent "Refresh spam" (debounce 5s).

## 8. Testing and Verification
- **Unit Tests**: Test `AgenticThoughtStream` for correct character-by-character rendering.
- **Integration Tests**: Verify active symbol change correctly triggers data fetch for the details panel.
- **Responsive Points**: Verify Bento Grid collapse at `< 1024px` (LG breakpoint).
- **Exit Criteria**: 
  - 0 console errors.
  - Pagination works for > 20 symbols.
  - All text is Vietnamese by default.

## 9. Observability and Alerting
- **Metrics**: Track "Manual Refresh" button clicks in `TrustTelemetryPanel`.
- **Logs**: Structured logs for AI component mounting/unmounting.

## 10. Security and Governance
- **Permissions**: Preserve existing `Can I="read" a="WhaleAdvisoryDetail"` checks.
- **Secrets**: No secrets modified.

## 11. Release Plan
- **Phased Rollout**: Deploy to `dev` first. 
- **Canary**: Enable for 10% of users via `ADVISORY_V2_ENABLED` flag (if available) or manual deploy check.

## 12. Ownership and Timeline
- **Owner**: AI Assistant (Antigravity).
- **Reviewer**: User (Viet Dung).
- **Timeline**: 
  - Phase 0-1: 4 hours.
  - Phase 2: 4 hours.
  - Phase 3: 2 hours.

---
*Last Updated: 2026-04-21*
