# Implementation Plan: AI Advisory Enhancement & Market Discovery (2026-04-21)

This document outlines the strategy to resolve the "Watchlist Gate" and logic duplication issues identified in the April 2026 audit.

## 1. Business Objective & Scope (Nghiệp vụ)
The current AI Advisory system is limited to the user's specific watchlist, creating a "blind spot" for market-wide whale movements.
- **Goal**: Transition from a reactive watchlist-only tool to a proactive **Market Discovery Hub**.
- **Key Feature**: "Market Discovery Mode" to reveal large money flows across the entire VNStock universe.
- **Core Principle**: Unify logic into a Single Source of Truth (SSOT) to ensure consistency between alerts and advisories.

## 2. Implementation Phases

### Phase 1: Logic Consolidation (SSOT Refactor)
- Refactor threshold resolution and side-detection logic into a canonical `WhaleSignalEngine` service.
- Eliminate redundant calculations in `views_stock_order_flow.py` and `whale_feed_helpers.py`.

### Phase 2: Market Discovery Infrastructure
- Enhance `whale_advisory_symbol_stats_api` to support a `scope=market` parameter.
- Implement global "Hot Symbol" detection based on volume intensity, ignoring the `TrackedSymbol` filter in Discovery mode.

### Phase 3: Proactive AI Generation (Agentic Layer)
- Implement "Flash Advisories": Link real-time whale signals to the AI generation task queue for high-intensity symbols.
- Ensure advisories are created *before* the user requests them for market-wide top movers.

### Phase 4: Discovery UI & Visualization
- Add a "Market Discovery" toggle to the `WhaleSymbolSidebar`.
- Integrate the **Whale Bubble Chart** into the Advisory Command Panel for instant spatial verification of AI claims.

## 3. Risks & Mitigations
| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Quota Explosion** | High cost | Apply strict "Market Discovery" quotas (e.g., top 10 symbols only per day for Pro users). |
| **Logic Drift** | UX confusion | Use shared unit tests and service-layer patterns for all "Large Order" detections. |
| **Privacy/Security** | Data leakage | Ensure "Discovery" mode doesn't reveal other users' watchlist contents. |

## 4. Acceptance Criteria (DoD)
- [ ] Users can see top 5-10 "Whale" symbols in the market without adding them to a watchlist.
- [ ] Side detection (Buy/Sell) matches the Unified Alert Center 100% of the time.
- [ ] AI Advisories for market-wide symbols are generated with < 1 minute latency from the first major signal.
- [ ] Zero performance degradation in the main `IntradayTick` ingestion pipeline.
