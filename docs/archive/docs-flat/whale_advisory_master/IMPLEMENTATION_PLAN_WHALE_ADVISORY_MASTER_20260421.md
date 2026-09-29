# Implementation Plan: Whale Advisory Command Center Enhancement (Master)

This document provides a consolidated implementation plan for the full "Whale Advisory Enhancement" campaign (Phases 1-5), executed on 2026-04-21.

## Objectives
1. **SSOT Compliance**: Centralize order flow logic into a single source of truth.
2. **Proactive Discovery**: Implement a real-time Market Discovery Hub for institutional anomalies.
3. **Agentic UI**: Shift from static tables to a proactive "Command Center" with AI reasoning streams.
4. **Visual Intensity**: Integrate high-fidelity bubble charts for visual ground-truth verification.

## Phase Breakdown

### Phase 1: SSOT Refactor
- Centralized side classification and intensity scoring in `WhaleSignalEngine`.
- Refactored `tasks_whale_persist_phase.py` and `views_whale_orders.py` to use the canonical engine.

### Phase 2 & 3: Market Discovery & Agentic UI
- Extended backend discovery logic to identify "High Intensity" anomalies across the entire market.
- Developed `WhaleAdvisoryCommandPanel` with `AgenticThoughtStream` for explainable AI reasoning.

### Phase 4: Real-time Discovery Integration
- Implemented global WebSocket broadcasting for discovery events.
- Updated `useRealtimeFeedCore` and `RealtimeContext` to handle the `market_discovery` group.

### Phase 5: Whale Bubble Chart Integration
- Updated `WhaleBubbleChart.jsx` for embedded use within the Command Center.
- Layout optimization in `WhaleAdvisory.jsx` to show visual anatomy alongside AI insights.

## Verification Plan
- **Backend**: Verified unit tests for `WhaleSignalEngine` and discovery logic.
- **WebSocket**: Confirmed event delivery via `market_discovery_event`.
- **Frontend**: Manual verification of layout responsiveness and data synchronization across stats, AI text, and Bubble Chart.
