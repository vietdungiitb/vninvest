# Audit: AI Advisory Design & SSOT Compliance (2026-04-21)

## 1. Executive Summary
The April 2026 audit of the `WhaleAdvisory` component and backend logic revealed critical "logic drift" between real-time alerts and advisory statistics. This drift stems from duplicated thresholding and side-detection logic across multiple files.

## 2. Identified Discrepancies
- **Threshold Resolution**: Different logic branches for resolving thresholds in `whale_feed_helpers.py` vs `views_stock_order_flow.py`.
- **Latency**: Advisory stats calculation from `IntradayTick` DB is computationally expensive for large offsets.
- **UI Consistency**: Data in the "Whale Alert" stream occasionally contradicts "Advisory Stats" for the same symbol/timeframe.

## 3. Recommended Design Transition
**From**: Monolithic views and fragmented helpers.
**To**: Agentic Command Center + WhaleSignalEngine (SSOT).

### Core Principles
1. **Single Signal Engine**: All "Large Order" detections must pass through `WhaleSignalEngine`.
2. **Proactive Discovery**: The system must support market-wide discovery without hard watchlist dependencies.
3. **Glassmorphism Aesthetics**: Implementation of modern neon/glass UI as verified in `mockup.html`.

## 4. Phase 1 Roadmap (Refactor)
Initial focus is on Backend SSOT. This ensures that the foundation for the visual upgrade is mathematically correct across all features.
