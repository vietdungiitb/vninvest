export function shouldUseWidgetOwnedHistory({ activeSource, dataAdapterName, }) {
    return ((activeSource === "binance" && dataAdapterName === "binance")
        || (activeSource === "vninvest" && dataAdapterName === "vninvest"));
}
export function resolvePendingChartRangeSync({ useWidgetOwnedHistory, rangeSatisfied, }) {
    if (!useWidgetOwnedHistory) {
        return !rangeSatisfied;
    }
    return false;
}
export function shouldRetainDemoVisibleDomainControl({ useWidgetOwnedHistory, }) {
    return !useWidgetOwnedHistory;
}
export function shouldReleaseDemoVisibleDomainControl({ useWidgetOwnedHistory, }) {
    return useWidgetOwnedHistory;
}
