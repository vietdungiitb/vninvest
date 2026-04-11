# AI Advisory Unification Plan (Stock Detail + AI Advisory)

Date: 2026-04-11
Owner: Advisory Platform Team
Status: CLOSED - IMPLEMENTED (Phase 0-4 done)

## 1) Goal

Unify the two AI advisory experiences so users see one consistent advisory truth per (user, symbol):

- Stock Detail (Thong tin tong hop)
- AI Advisory list page

Target outcomes:

1. Same advisory core content for the same symbol at the same time.
2. Same refresh pipeline regardless of where user clicks refresh.
3. Better prompt input quality and deterministic language output (vi/en).

## 2) Current Problem Summary

Current implementation has separate interaction contracts:

- Stock Detail uses session endpoint with richer payload (aggregate/components/summaries).
- AI Advisory list uses list endpoint and a different refresh endpoint.

This can create perceived inconsistency due to:

1. Different refresh lifecycle (queue/sync fallback timing differs).
2. Different response shape and enrichment layers.
3. Different UI filtering/sorting windows.

## 3) Canonical Architecture (Target)

### 3.1 Canonical read model

Define one canonical advisory payload (core fields):

- advisory_id, symbol, created_at, source
- ai_provider, ai_model
- summary_text, detail_text (plan-dependent)
- confidence, risk_level, recommendation
- freshness metadata

Enrichment fields are optional extensions:

- components
- executive_summary
- observability/benchmarks

### 3.2 Unified refresh command

All refresh triggers must execute one backend command path:

- refresh from Stock Detail
- refresh from AI Advisory list
- future auto refresh jobs

### 3.3 Language policy

AI output language is controlled by user setting:

- vi: Vietnamese with diacritics
- en: English

Add output_language in advisory payload for runtime verification.

## 4) Prompt Input Upgrade (Accuracy)

To improve output precision, prompt context must include normalized fields:

1. Price action: latest price, change %, volatility estimate.
2. Volume/orderflow: buy-sell imbalance, tick rate, abnormal volume ratio.
3. Whale/dark-flow signal strengths and recency.
4. Timeframe and data freshness timestamps.
5. Market regime tags (trend/sideway/volatile).
6. Explicit constraints when data is insufficient.

Guardrail:

- If required data is missing, model must return a constrained "insufficient_data" style response, not speculation.

## 5) Execution Phases

### Phase 0 (Completed in this patch)

- AI Advisory page refresh now calls the same session endpoint used by Stock Detail.
- This removes the split refresh endpoint at frontend call-site level.

Code change:

- frontend/src/api/client.js
  - refreshWhaleAdvisory(symbol) now points to:
    /stock-management/stocks/<symbol>/ai-advisory-session/ (POST)

### Phase 1 (Completed)

Backend extracted shared service for refresh queue/sync fallback:

Implemented internal shared helper used by both:

- stock_ai_advisory_session_api (POST)
- legacy refresh_whale_advisory_api

Delivered:

1. Common queue/sync fallback submit path.
2. Common force-sync first-create behavior support.
3. Common queue-error handling contract (`queue_error`).

Implementation note:

- backend/portfolio/views.py now contains shared helper `_submit_advisory_generation_with_fallback(...)` and both refresh entrypoints call through it.

### Phase 2 (Completed)

Canonical read endpoint and adapter layer implemented:

1. Added canonical advisory read endpoint by symbol:
  - `/api/portfolio/ai-advisory/<symbol>/canonical/`
  - `/api/portfolio/whale-advisory/<symbol>/canonical/` (alias)
2. Added adapter mode on list endpoint via query `contract=canonical`.
3. Kept legacy list contract intact for backward compatibility.

### Phase 3 (Completed)

UI convergence implemented:

1. AI Advisory list now reads canonical contract (`contract=canonical`).
2. Canonical items are normalized for existing UI renderer compatibility.
3. Added cross-screen invalidation event (`vninvest:advisory_updated`) and refetch listener.

### Phase 4 (Completed)

Language and prompt quality hardening implemented:

1. Enforced output language instruction (vi/en) in advisory prompts across providers.
2. Added output-language metadata in advisory task telemetry payload.
3. Added language mismatch detection counters and admin KPI metric (`language_quality`).

## 6) Acceptance Criteria

1. For same user + symbol, both screens show same advisory_id and created_at.
2. Refresh from either screen updates both views consistently.
3. Language output always follows selected ui language (vi/en).
4. Advisory mismatch incidents drop to near-zero.

## 7) Risks and Mitigation

Risk:

- Existing integrations depend on legacy response shape.

Mitigation:

1. Keep compatibility adapters in transition.
2. Rollout via feature flags.
3. Add regression tests for Pro/Premium masking and quotas.

## 8) Testing Checklist

1. Unit tests for unified refresh helper.
2. Integration tests for same advisory_id cross-screen.
3. E2E tests for vi/en language switching.
4. Load test for refresh bursts and lock behavior.

## 9) Rollout Strategy

1. Internal users only.
2. 25% production cohort.
3. 100% after mismatch KPI stable for 48h.

## 10) Execution Log (2026-04-11)

1. Phase 0 - frontend refresh call-site unified to session endpoint.
  - Commit: `f1c16bd4`
2. Phase 1 - backend refresh submit path unified via shared helper.
  - Commit: `bdc720ea`
3. Phase 2 - canonical read contract + adapter endpoints delivered.
  - Commit: `55ae0263`
4. Phase 3 - UI convergence + cross-screen invalidation event delivered.
  - Commit: `2e4812ab`
5. Phase 4 - language hardening (vi/en) + language quality metrics delivered.
  - Commit: `76bdef07`

## 11) Closure Decision

- Gate decision: CLOSED - Implementation complete for unification phases 0-4.
- Remaining operation mode: monitor `language_quality` and failover/provider KPIs in runtime dashboard for stabilization window.
- Backward compatibility: legacy contracts remain available during transition.

## 12) Conversation Log Addendum (VN) - 2026-04-11

This addendum records the full follow-up discussion and implementation after Phase 0-4 closure.

### 12.1 User-reported symptom

User reported: AI advisory content for `FPT` on AI Advisory page did not match Stock Detail advisory.

### 12.2 Root cause identified

In `WhaleAdvisoryListView.get_queryset()` (backend/portfolio/views.py), list flow previously used global slicing:

- `qs.order_by('-created_at')[:100]`

Then canonical conversion deduplicated symbols after slicing.

Impact:

1. If latest advisory of a symbol was outside top 100 global records, AI Advisory page could show an older advisory.
2. Stock Detail queried by symbol/session and still showed latest advisory.

### 12.3 Fix applied

Adjusted list selection logic to collect latest advisory per symbol first (up to 100 symbols), instead of first 100 records globally.

Result:

1. AI Advisory page and Stock Detail now align on latest advisory per symbol.
2. Canonical contract consistency improved.

Commit recorded:

- `f7b0eebd` - fix(advisory): ensure latest advisory per symbol in WhaleAdvisoryListView

### 12.4 Clarified endpoint/source mapping (important)

Two user actions are NOT the same source path:

1. AI Advisory page `Refresh AI`
  - Calls session endpoint (`POST /stock-management/stocks/<symbol>/ai-advisory-session/`)
  - Generates/refreshes advisory root context (WhaleAdvisory path)

2. Stock Detail `Tong hop lai` (Regenerate Summary)
  - Calls summary regenerate endpoint (`POST /stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/`)
  - Regenerates executive summary from active components

Therefore outputs can differ if contexts are not synced.

### 12.5 Prompt-input trace (recorded during investigation)

Refresh AI prompt inputs include:

1. Symbol + side + matched value
2. Market context block from `build_symbol_ai_context`:
  - profile, price deltas (1D/5D/20D), volume/volatility
  - intraday buy/sell value
  - order-flow recent signals
  - recent advisories
  - optional portfolio position for user

Regenerate Summary prompt inputs include:

1. Symbol
2. Summary control fields (`strategy_action`, `risk_level`, `overall_confidence`, synthesis preference)
3. Active component lines (indicator/type/status/confidence/action/rationale)

### 12.6 2-layer architecture decision (design)

Agreed direction for consistency:

1. Layer 1: canonical advisory source (latest advisory context per symbol/user)
2. Layer 2: executive synthesis over active components anchored to layer 1 context

Target behavior:

1. Stock Detail regenerate should auto-sync/create advisory source when missing.
2. Summary versions remain v1, v2, v3... (version history preserved).

### 12.7 UX behavior requested by user

User requested:

1. If user presses `Tong hop lai` while no advisory exists, auto-create first then regenerate.
2. Preserve summary version history (v1, v2...).

### 12.8 Implementation applied for auto-create before regenerate

Frontend `StockDetail` regenerate flow updated:

1. On `Tong hop lai`, if no session advisory -> call session refresh endpoint first.
2. If advisory is queued (no immediate advisory in response) -> show wait message and exit safely.
3. If no active components -> auto-generate components before regenerate summary.
4. If still no active components -> show explicit message and stop.

File updated:

- `frontend/src/pages/StockDetail.jsx`

Status:

1. Syntax check passed for updated file.
2. Full frontend regression suite not executed in this patch window.

### 12.9 Decision/status matrix (implemented vs pending)

Implemented:

1. Cross-screen latest-per-symbol consistency fix in list canonical source.
2. Stock Detail auto-create advisory before regenerate summary.
3. Stock Detail auto-generate components before regenerate summary when missing.

Not yet implemented (requires separate backend migration/feature work):

1. Hard guarantee to physically delete all older advisory records per symbol and keep exactly one row in DB.
2. Strict advisory-id anchoring contract for regenerate endpoint (409 on stale advisory_id mismatch).
3. Persisted summary-to-advisory linkage fields (`source_advisory_id`, version anchor) as mandatory schema.

### 12.10 Operational note

For now, product behavior is:

1. User experience is aligned toward latest advisory context.
2. Summary history versions continue to accumulate.
3. Data-retention policy for old advisory rows remains as current backend policy unless further migration is approved.
