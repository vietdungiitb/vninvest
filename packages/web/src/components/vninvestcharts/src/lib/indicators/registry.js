const indicatorRegistry = new Map();
function normalizeIndicatorName(name) {
    return name.trim().toUpperCase();
}
export function registerIndicator(indicator) {
    indicatorRegistry.set(normalizeIndicatorName(indicator.name), indicator);
    return indicator;
}
export function getIndicator(name) {
    return indicatorRegistry.get(normalizeIndicatorName(name));
}
export function listIndicators() {
    return [...indicatorRegistry.values()];
}
