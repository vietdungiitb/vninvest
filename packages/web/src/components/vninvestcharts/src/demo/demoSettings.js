export const MAX_VISIBLE_BARS_OPTIONS = [
    1_000,
    2_000,
    5_000,
    10_000,
    15_000,
    20_000,
    30_000,
    40_000,
];
export const DEMO_SETTINGS_STORAGE_KEY = "rsc-demo-settings-v3";
const PREVIOUS_DEMO_SETTINGS_STORAGE_KEY = "rsc-demo-settings-v2";
const LEGACY_DEMO_SETTINGS_STORAGE_KEY = "rsc-demo-settings-v1";
const DEFAULT_MAX_VISIBLE_PANES = 5;
const DEFAULT_MAX_VISIBLE_BARS = 20_000;
const VALID_WIDGET_TIMEZONES = ["Asia/Ho_Chi_Minh", "UTC", "America/New_York", "Europe/London"];
function normalizeMaxVisibleBars(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_MAX_VISIBLE_BARS;
    }
    const floored = Math.floor(value);
    if (MAX_VISIBLE_BARS_OPTIONS.includes(floored)) {
        return floored;
    }
    return DEFAULT_MAX_VISIBLE_BARS;
}
function isValidWidgetTimezone(value) {
    return typeof value === "string" && VALID_WIDGET_TIMEZONES.includes(value);
}
function isDemoRuntimeLane(value) {
    return value === "legacy" || value === "auto" || value === "fork";
}
export const DEFAULT_DEMO_SETTINGS = {
    maxVisiblePanes: DEFAULT_MAX_VISIBLE_PANES,
    maxVisibleBars: DEFAULT_MAX_VISIBLE_BARS,
    showNonTradingDays: false,
    showDrawingPriceMarkers: true,
    enableWhale: true,
    whaleThreshold: 1_000_000,
    enableCVD: false,
    cvdMode: "oscillator",
    timezone: "Asia/Ho_Chi_Minh",
    alertAudioEnabled: false,
    runtimeLane: "fork",
};
function migrateRuntimeLaneToFork(settings) {
    if (settings.runtimeLane === "auto") {
        return {
            ...settings,
            runtimeLane: "fork",
        };
    }
    return settings;
}
function normalizeDemoSettings(parsed) {
    return {
        maxVisiblePanes: typeof parsed.maxVisiblePanes === "number" && Number.isFinite(parsed.maxVisiblePanes)
            ? Math.max(1, Math.floor(parsed.maxVisiblePanes))
            : DEFAULT_MAX_VISIBLE_PANES,
        maxVisibleBars: normalizeMaxVisibleBars(parsed.maxVisibleBars),
        showNonTradingDays: typeof parsed.showNonTradingDays === "boolean"
            ? parsed.showNonTradingDays
            : DEFAULT_DEMO_SETTINGS.showNonTradingDays,
        showDrawingPriceMarkers: typeof parsed.showDrawingPriceMarkers === "boolean"
            ? parsed.showDrawingPriceMarkers
            : DEFAULT_DEMO_SETTINGS.showDrawingPriceMarkers,
        enableWhale: typeof parsed.enableWhale === "boolean" ? parsed.enableWhale : DEFAULT_DEMO_SETTINGS.enableWhale,
        whaleThreshold: typeof parsed.whaleThreshold === "number" && Number.isFinite(parsed.whaleThreshold)
            ? parsed.whaleThreshold
            : DEFAULT_DEMO_SETTINGS.whaleThreshold,
        enableCVD: typeof parsed.enableCVD === "boolean" ? parsed.enableCVD : DEFAULT_DEMO_SETTINGS.enableCVD,
        cvdMode: parsed.cvdMode === "oscillator" || parsed.cvdMode === "histogram"
            ? parsed.cvdMode
            : DEFAULT_DEMO_SETTINGS.cvdMode,
        timezone: isValidWidgetTimezone(parsed.timezone) ? parsed.timezone : DEFAULT_DEMO_SETTINGS.timezone,
        alertAudioEnabled: typeof parsed.alertAudioEnabled === "boolean"
            ? parsed.alertAudioEnabled
            : DEFAULT_DEMO_SETTINGS.alertAudioEnabled,
        runtimeLane: isDemoRuntimeLane(parsed.runtimeLane) ? parsed.runtimeLane : DEFAULT_DEMO_SETTINGS.runtimeLane,
    };
}
export function loadDemoSettings() {
    if (typeof localStorage === "undefined") {
        return DEFAULT_DEMO_SETTINGS;
    }
    try {
        const raw = localStorage.getItem(DEMO_SETTINGS_STORAGE_KEY);
        if (raw) {
            return normalizeDemoSettings(JSON.parse(raw));
        }
        const previousRaw = localStorage.getItem(PREVIOUS_DEMO_SETTINGS_STORAGE_KEY);
        if (previousRaw) {
            const migratedSettings = migrateRuntimeLaneToFork(normalizeDemoSettings(JSON.parse(previousRaw)));
            return migratedSettings;
        }
        const legacyRaw = localStorage.getItem(LEGACY_DEMO_SETTINGS_STORAGE_KEY);
        if (!legacyRaw) {
            return DEFAULT_DEMO_SETTINGS;
        }
        const migratedSettings = normalizeDemoSettings(JSON.parse(legacyRaw));
        return {
            ...migrateRuntimeLaneToFork(migratedSettings),
            enableCVD: DEFAULT_DEMO_SETTINGS.enableCVD,
        };
    }
    catch {
        return DEFAULT_DEMO_SETTINGS;
    }
}
export function saveDemoSettings(settings) {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(DEMO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        localStorage.removeItem(PREVIOUS_DEMO_SETTINGS_STORAGE_KEY);
        localStorage.removeItem(LEGACY_DEMO_SETTINGS_STORAGE_KEY);
    }
    catch {
        // ignore storage errors
    }
}
