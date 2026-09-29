# Heatmap Structural Hybrid Refactor & Stability Plan

## Metadata
- **Date**: 2026-04-18
- **Goal**: Resolve "innerHTML" crashes and "flashing" instabilities in the Portfolio Heatmap.
- **Strategy**: implement a hybrid data structure (Flat Treemap vs Grouped Sunburst) and force-remount on view transitions.

## Technical Requirements

### 1. Hybrid Data Processing
- **Treemap View (Stability Focused)**: Remove sector/industry grouping. Stocks compete in a single flat grid.
- **Sunburst View (Hierarchy Focused)**: Retain industry/sector grouping for rotational market breakdown.
- **Sorting**: Both views must be sorted by `Market Capitalization` (descending) to highlight dominant players.
- **Context Preservation**: Ensure the `Industry` name is always available in the tooltip, even in the flat Treemap view.

### 2. Frontend Implementation (`PortfolioHeatmap.jsx`)
- Refactor the heatmap data useMemo to return an object containing both `grouped` and `flat` datasets.
- Update `ReactECharts` configuration:
    - **Treemap**:
        - Use `flatData`.
        - Use sample-style `levels` configuration for the implicit root + flat stock leaf layer.
        - Do not depend on sector grouping or explicit `leafDepth` traversal.
        - Keep stock tiles in one continuous flat grid.
    - **Sunburst**:
        - Use `groupedData`.
        - Maintain multi-level rendering.
- **Tooltips**: Update the `formatter` to correctly extract the Industry from the leaf node data.

### 3. Stability Hardening
- **Force Remount**: Maintain the `key` prop on `ReactECharts` (`viewMode-dataID-lang`) to ensure ECharts instances are destroyed and recreated during mode switches, avoiding state corruption.
- **Defensive Rendering**: Maintain the patched ECharts core (via `patch-package`) to prevent `innerHTML` crashes if the chart is disposed while a tooltip is still active.
- **Runtime Safety**: Ensure language key is sourced from the i18n context (`locale`) to avoid undefined reference at render time.

## Verification Plan

### Manual Verification
- [x] **Treemap**: Stocks render in a single continuous flat area with no sector labels.
- [x] **Sunburst**: Stocks remain grouped into sector wedges.
- [x] **Sorting**: Flat leaves and grouped branches are sorted by Market Capitalization (descending).
- [x] **Tooltips**: Industry path is preserved in both modes; tooltip labels are i18n-driven.
- [x] **Transitions**: Rapid mode switching no longer triggers `innerHTML` crash; forced remount remains active.

### Post-audit Remediation (2026-04-18)
- Fixed heatmap runtime safety by replacing undefined `i18n.language` usage with context `locale`.
- Enforced strict Market Cap sorting order across Treemap and Sunburst while preserving size metric toggle for tile sizing.
- Corrected Treemap config to follow the official flat-data pattern with `levels`, avoiding reliance on `leafDepth` for flat stock rendering.
