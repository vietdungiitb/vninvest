# Research and Implementation Plan: Alert Center Color-Coding

## Overview
Currently, the **Unified Alert Center** on the modern dashboard uses a single-dimensional color coding system based strictly on **Severity** (Critical, High, Medium, Low). This makes it difficult for users to quickly distinguish the nature of the alert (e.g., whether it is a Buy signal, a Sell signal, or a Money Flow signal) without reading the headline.

This document outlines the research findings and the plan to implement a multi-dimensional color-coding system that incorporates both **Type** and **Severity**.

## Research Findings

### 1. Current Implementation
- **Component**: `UnifiedAlertCenter.jsx` uses `severityTone(severity)` to assign CSS classes (colors).
- **Hook**: `useUnifiedAlerts.js` aggregates data from Whale Alerts, Dark Flow, and Price Shocks, but does not explicitly categorize them by "Type" in the final output object.
- **Current Color Mapping**:
    - `critical`: Rose (Red)
    - `high`: Amber (Orange/Yellow)
    - `medium`: Cyan (Blue)
    - `low`: Slate (Gray)

### 2. Available Data Points
- **Whale Alerts**: Have a `side` property (`buy` or `sell`).
- **Price Shock**: Calculated in the frontend based on `change_pct`. If `pct >= 0`, it's a Jump (Buy); if `pct < 0`, it's a Drop (Sell).
- **Dark Flow**: Represents unusual money flow.
- **Backend Alerts**: Can be categorized by parsing keywords in the `headline` (e.g., "mua", "bán", "buy", "sell", "flow").

## Implementation Plan

### Phase 1: Data Categorization
Modify `useUnifiedAlerts.js` to add a `type` property to every alert object:
- `buy`: Whale Buy, Price Jump.
- `sell`: Whale Sell, Price Drop.
- `flow`: Dark Flow, Unusual Money Flow.
- `neutral`: Stale quotes or generic system warnings.

### Phase 2: Enhanced UI Styling
Update `UnifiedAlertCenter.jsx` to use a new `alertTone(type, severity)` function.

#### Color Palette (Neon Aesthetics)
| Type | Critical (Bright) | High | Medium | Low (Muted) |
| :--- | :--- | :--- | :--- | :--- |
| **Buy** | Emerald-400 (Glow) | Emerald-600 | Emerald-800 | Slate-800 (Faint Green) |
| **Sell** | Red-500 (Glow) | Red-700 | Red-900 | Slate-800 (Faint Red) |
| **Flow** | Violet-400 (Glow) | Violet-600 | Violet-800 | Slate-800 (Faint Purple) |
| **Neutral** | Slate-400 | Slate-600 | Slate-800 | Slate-900 |

### Phase 3: Visual Polish
- Implement subtle glow effects for `Critical` and `High` alerts using CSS box-shadow.
- Ensure high contrast for text readability on colored backgrounds.

## Verification
- Manual verification of each alert source (Whale, Price, Dark Flow).
- Cross-language keyword detection audit (VI/EN).
- Visual UI audit for consistency with the "Modern Dashboard" dark theme.
