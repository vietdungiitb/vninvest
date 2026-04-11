# AI Advisory Unification Plan (Stock Detail + AI Advisory)

Date: 2026-04-11
Owner: Advisory Platform Team
Status: In Progress (Phase 0-2 done)

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

### Phase 3

UI convergence:

1. AI Advisory list reads canonical data for per-symbol latest advisory.
2. Stock Detail reads same canonical core + optional enrichment.
3. Broadcast invalidation/refetch event after successful refresh.

### Phase 4

Language and prompt quality hardening:

1. Enforce language output by user preference.
2. Add output_language assertion and fallback correction.
3. Add prompt quality metrics and mismatch monitoring.

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
