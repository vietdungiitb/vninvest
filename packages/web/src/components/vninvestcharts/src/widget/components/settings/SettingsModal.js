import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * WE2 P2-05: SettingsModal
 *
 * Settings modal with sections: Layout, Indicators, Theme, Timezone, Reset.
 * Uses createPortal to render at document.body — avoids z-index clipping.
 * Uses .vnsc- CSS prefix.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
import { useVNInvestChartsState } from "../../context/VNInvestChartsStateContext.js";
import { getSeries, listRegistered, SERIES_SUB_COMPONENTS, useIndicatorSets } from "../../../lib/core/index.js";
import { SettingsRangeSlider } from "./SettingsRangeSlider.js";
const SECTIONS = [
    { key: "layout", labelKey: "settings.layout" },
    { key: "indicators", labelKey: "settings.indicators" },
    { key: "indicatorSets", labelKey: "settings.indicatorSets" },
    { key: "theme", labelKey: "settings.theme" },
    { key: "reset", labelKey: "settings.reset" },
];
function formatSeriesSuffix(type, params) {
    const numberParam = (p, key, fallback) => {
        const val = p?.[key];
        return typeof val === "number" && Number.isFinite(val) ? val : fallback;
    };
    switch (type) {
        case "EMA":
            return `(${numberParam(params, "period", 20)})`;
        case "RSI":
            return `(${numberParam(params, "period", 14)})`;
        case "BollingerBand":
            return `(${numberParam(params, "period", 20)},${numberParam(params, "stdDev", 2)})`;
        case "MACD":
            return `(${numberParam(params, "fast", 12)},${numberParam(params, "slow", 26)},${numberParam(params, "signal", 9)})`;
        case "KDJ":
            return `(${numberParam(params, "period", 9)},${numberParam(params, "m1", 3)},${numberParam(params, "m2", 3)})`;
        case "CCI":
            return `(${numberParam(params, "period", 20)})`;
        case "DMI":
            return `(${numberParam(params, "period", 14)})`;
        case "BIAS":
            return `(${numberParam(params, "period", 6)})`;
        case "BRAR":
            return `(${numberParam(params, "period", 26)})`;
        case "MTM":
            return `(${numberParam(params, "period", 6)})`;
        case "EMV":
            return `(${numberParam(params, "period", 14)})`;
        case "ROC":
            return `(${numberParam(params, "period", 12)})`;
        case "TRIX":
            return `(${numberParam(params, "period", 12)})`;
        case "DMA":
            return `(${numberParam(params, "fastPeriod", 10)},${numberParam(params, "slowPeriod", 50)})`;
        case "PSY":
            return `(${numberParam(params, "period", 12)})`;
        case "CR":
            return `(${numberParam(params, "period", 26)})`;
        case "Whale":
            return `(${numberParam(params, "threshold", 50_000)})`;
        default:
            return "";
    }
}
const SERIES_LABEL_KEYS = {
    Candlestick: "indicator.candlestick",
    HollowCandle: "indicator.hollowCandle",
    OHLC: "indicator.ohlc",
    HeikinAshi: "indicator.heikinAshi",
    Line: "indicator.line",
    Area: "indicator.area",
    Bar: "indicator.bar",
    EMA: "indicator.ema",
    BollingerBand: "indicator.bollingerBand",
    Volume: "indicator.volume",
    Whale: "indicator.whale",
    CVDApprox: "indicator.cvdApprox",
    CVDRealtime: "indicator.cvdRealtime",
    RSI: "indicator.rsi",
    MACD: "indicator.macd",
    StrengthElder: "indicator.strengthElder",
    StrengthRelative: "indicator.strengthRelative",
    MA: "indicator.ma",
    BBI: "indicator.bbi",
    SAR: "indicator.sar",
    OBV: "indicator.obv",
    WR: "indicator.wr",
    VR: "indicator.vr",
    KDJ: "indicator.kdj",
    CCI: "indicator.cci",
    DMI: "indicator.dmi",
    BIAS: "indicator.bias",
    BRAR: "indicator.brar",
    MTM: "indicator.mtm",
    EMV: "indicator.emv",
    AO: "indicator.ao",
    ROC: "indicator.roc",
    TRIX: "indicator.trix",
    DMA: "indicator.dma",
    PVT: "indicator.pvt",
    PSY: "indicator.psy",
    CR: "indicator.cr",
};
const SERIES_ABBREVIATIONS = {
    EMA: "EMA",
    BollingerBand: "BB",
    RSI: "RSI",
    MACD: "MACD",
    CVDApprox: "CVD Approx",
    CVDRealtime: "CVD Realtime",
    StrengthElder: "Elder Strength",
    StrengthRelative: "RS",
    Whale: "Whale Flow",
    MA: "MA",
    BBI: "BBI",
    SAR: "SAR",
    OBV: "OBV",
    WR: "WR",
    VR: "VR",
    KDJ: "KDJ",
    CCI: "CCI",
    DMI: "DMI",
    BIAS: "BIAS",
    BRAR: "BRAR",
    MTM: "MTM",
    EMV: "EMV",
    AO: "AO",
    ROC: "ROC",
    TRIX: "TRIX",
    DMA: "DMA",
    PVT: "PVT",
    PSY: "PSY",
    CR: "CR",
    Candlestick: "Candlestick",
    HollowCandle: "Hollow Candle",
    OHLC: "OHLC",
    HeikinAshi: "HA",
    Line: "Line",
    Area: "Area",
    Bar: "Bar",
    Volume: "Volume",
};
const TECHNICAL_INDICATORS = new Set([
    "EMA",
    "BollingerBand",
    "RSI",
    "MACD",
    "CVDApprox",
    "CVDRealtime",
    "StrengthElder",
    "StrengthRelative",
    "Whale",
    "MA",
    "BBI",
    "SAR",
    "OBV",
    "WR",
    "VR",
    "KDJ",
    "CCI",
    "DMI",
    "BIAS",
    "BRAR",
    "MTM",
    "EMV",
    "AO",
    "ROC",
    "TRIX",
    "DMA",
    "PVT",
    "PSY",
    "CR",
]);
function formatSeriesDisplayName(type, params, t, index) {
    const labelKey = SERIES_LABEL_KEYS[type] || `indicator.${type.toLowerCase()}`;
    const baseLabel = t(labelKey) || type;
    const suffix = formatSeriesSuffix(type, params);
    let withSuffix = suffix ? `${baseLabel} ${suffix}` : baseLabel;
    if (!params) {
        const abbreviation = SERIES_ABBREVIATIONS[type];
        if (abbreviation && baseLabel !== abbreviation) {
            withSuffix = `${baseLabel} (${abbreviation})`;
        }
    }
    return typeof index === "number" ? `${withSuffix} #${index + 1}` : withSuffix;
}
const LINE_WIDTH_SERIES_TYPES = new Set([
    "Line", "Area", "EMA", "BollingerBand", "RSI", "MACD", "CVDApprox", "CVDRealtime", "StrengthElder", "StrengthRelative", "MA", "BBI", "SAR", "OBV", "WR", "VR", "KDJ", "CCI", "DMI", "BIAS", "BRAR", "MTM", "EMV", "ROC", "TRIX", "DMA", "PVT", "PSY", "CR"
]);
function supportsSeriesLineWidth(seriesType) {
    return LINE_WIDTH_SERIES_TYPES.has(seriesType);
}
export function SettingsModal({ open, onClose, children, selectedPaneId, onSelectedPaneIdChange, maxVisiblePanes, onMaxVisiblePanesChange, maxVisibleBars, onMaxVisibleBarsChange, showNonTradingDays, onShowNonTradingDaysChange, showDrawingPriceMarkers, onShowDrawingPriceMarkersChange, enableWhale, onEnableWhaleChange, whaleThreshold, onWhaleThresholdChange, enableCVD, onEnableCVDChange, cvdMode, onCVDModeChange, onReset, isDark, toggleTheme, timezone, onTimezoneChange, alertAudioEnabled, onAlertAudioEnabledChange, dataAdapterName, onDataAdapterChange, }) {
    const { t } = useWidgetI18n();
    const [activeSection, setActiveSection] = useState("layout");
    const backdropRef = useRef(null);
    const { paneState } = useVNInvestChartsState();
    const [portalTarget, setPortalTarget] = useState(() => {
        if (typeof document !== "undefined") {
            return document.fullscreenElement || document.body;
        }
        return null;
    });
    useEffect(() => {
        const updateTarget = () => {
            setPortalTarget(document.fullscreenElement || document.body);
        };
        updateTarget();
        document.addEventListener("fullscreenchange", updateTarget);
        return () => {
            document.removeEventListener("fullscreenchange", updateTarget);
        };
    }, []);
    const [indicatorSetName, setIndicatorSetName] = useState("");
    const [indicatorSetMessage, setIndicatorSetMessage] = useState("");
    const importInputRef = useRef(null);
    const indicatorSets = useIndicatorSets({
        currentPanes: paneState.panes,
        onApplyPanes: (nextPanes) => {
            paneState.dispatch({ type: "replaceLayout", panes: nextPanes });
            const nextSelectedPaneId = nextPanes.find((p) => p.visible)?.id ?? nextPanes[0]?.id ?? "";
            if (nextSelectedPaneId) {
                onSelectedPaneIdChange?.(nextSelectedPaneId);
                setLocalSelectedPaneId(nextSelectedPaneId);
            }
        },
    });
    // ── Standalone settings state fallbacks ───────────────────────────────────
    const [localSelectedPaneId, setLocalSelectedPaneId] = useState("price");
    const activeSelectedPaneId = selectedPaneId ?? localSelectedPaneId;
    const activeOnSelectedPaneIdChange = onSelectedPaneIdChange ?? setLocalSelectedPaneId;
    const [localMaxVisiblePanes, setLocalMaxVisiblePanes] = useState(() => {
        try {
            return parseInt(localStorage.getItem("vnsc.settings.maxVisiblePanes") || "5", 10);
        }
        catch {
            return 5;
        }
    });
    const activeMaxVisiblePanes = maxVisiblePanes ?? localMaxVisiblePanes;
    const activeOnMaxVisiblePanesChange = onMaxVisiblePanesChange ?? ((next) => {
        setLocalMaxVisiblePanes(next);
        try {
            localStorage.setItem("vnsc.settings.maxVisiblePanes", String(next));
        }
        catch { }
    });
    const [localMaxVisibleBars, setLocalMaxVisibleBars] = useState(() => {
        try {
            return parseInt(localStorage.getItem("vnsc.settings.maxVisibleBars") || "800", 10);
        }
        catch {
            return 800;
        }
    });
    const activeMaxVisibleBars = maxVisibleBars ?? localMaxVisibleBars;
    const activeOnMaxVisibleBarsChange = onMaxVisibleBarsChange ?? ((next) => {
        setLocalMaxVisibleBars(next);
        try {
            localStorage.setItem("vnsc.settings.maxVisibleBars", String(next));
        }
        catch { }
    });
    const [localShowNonTradingDays, setLocalShowNonTradingDays] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.showNonTradingDays") === "true";
        }
        catch {
            return false;
        }
    });
    const activeShowNonTradingDays = showNonTradingDays ?? localShowNonTradingDays;
    const activeOnShowNonTradingDaysChange = onShowNonTradingDaysChange ?? ((next) => {
        setLocalShowNonTradingDays(next);
        try {
            localStorage.setItem("vnsc.settings.showNonTradingDays", String(next));
        }
        catch { }
    });
    const [localShowDrawingPriceMarkers, setLocalShowDrawingPriceMarkers] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.showDrawingPriceMarkers") !== "false";
        }
        catch {
            return true;
        }
    });
    const activeShowDrawingPriceMarkers = showDrawingPriceMarkers ?? localShowDrawingPriceMarkers;
    const activeOnShowDrawingPriceMarkersChange = onShowDrawingPriceMarkersChange ?? ((next) => {
        setLocalShowDrawingPriceMarkers(next);
        try {
            localStorage.setItem("vnsc.settings.showDrawingPriceMarkers", String(next));
        }
        catch { }
    });
    const [localEnableWhale, setLocalEnableWhale] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.enableWhale") !== "false";
        }
        catch {
            return true;
        }
    });
    const activeEnableWhale = enableWhale ?? localEnableWhale;
    const activeOnEnableWhaleChange = onEnableWhaleChange ?? ((next) => {
        setLocalEnableWhale(next);
        try {
            localStorage.setItem("vnsc.settings.enableWhale", String(next));
        }
        catch { }
    });
    const [localWhaleThreshold, setLocalWhaleThreshold] = useState(() => {
        try {
            return parseInt(localStorage.getItem("vnsc.settings.whaleThreshold") || "1000000", 10);
        }
        catch {
            return 1000000;
        }
    });
    const activeWhaleThreshold = whaleThreshold ?? localWhaleThreshold;
    const activeOnWhaleThresholdChange = onWhaleThresholdChange ?? ((next) => {
        setLocalWhaleThreshold(next);
        try {
            localStorage.setItem("vnsc.settings.whaleThreshold", String(next));
        }
        catch { }
    });
    const [localEnableCVD, setLocalEnableCVD] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.enableCVD") === "true";
        }
        catch {
            return false;
        }
    });
    const activeEnableCVD = enableCVD ?? localEnableCVD;
    const activeOnEnableCVDChange = onEnableCVDChange ?? ((next) => {
        setLocalEnableCVD(next);
        try {
            localStorage.setItem("vnsc.settings.enableCVD", String(next));
        }
        catch { }
    });
    const [localCvdMode, setLocalCvdMode] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.cvdMode") || "oscillator";
        }
        catch {
            return "oscillator";
        }
    });
    const activeCvdMode = cvdMode ?? localCvdMode;
    const activeOnCVDModeChange = onCVDModeChange ?? ((next) => {
        setLocalCvdMode(next);
        try {
            localStorage.setItem("vnsc.settings.cvdMode", next);
        }
        catch { }
    });
    const [localTimezone, setLocalTimezone] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.timezone") || "Asia/Ho_Chi_Minh";
        }
        catch {
            return "Asia/Ho_Chi_Minh";
        }
    });
    const activeTimezone = timezone ?? localTimezone;
    const activeOnTimezoneChange = onTimezoneChange ?? ((next) => {
        setLocalTimezone(next);
        try {
            localStorage.setItem("vnsc.settings.timezone", next);
        }
        catch { }
    });
    const [localAlertAudioEnabled, setLocalAlertAudioEnabled] = useState(() => {
        try {
            return localStorage.getItem("vnsc.settings.alertAudioEnabled") === "true";
        }
        catch {
            return false;
        }
    });
    const activeAlertAudioEnabled = alertAudioEnabled ?? localAlertAudioEnabled;
    const activeOnAlertAudioEnabledChange = onAlertAudioEnabledChange ?? ((next) => {
        setLocalAlertAudioEnabled(next);
        try {
            localStorage.setItem("vnsc.settings.alertAudioEnabled", String(next));
        }
        catch { }
    });
    const activeIsDark = isDark ?? (typeof document !== "undefined" && document.documentElement.getAttribute("data-chart-theme") === "dark");
    const activeToggleTheme = toggleTheme ?? (() => {
        if (typeof document === "undefined")
            return;
        const root = document.documentElement;
        const currentTheme = root.getAttribute("data-chart-theme") || "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        root.setAttribute("data-chart-theme", nextTheme);
    });
    const activeOnReset = onReset ?? (() => {
        paneState.dispatch({ type: "resetToDefault" });
        activeOnMaxVisiblePanesChange(5);
        activeOnMaxVisibleBarsChange(800);
        activeOnShowNonTradingDaysChange(false);
        activeOnShowDrawingPriceMarkersChange(true);
        activeOnEnableWhaleChange(true);
        activeOnWhaleThresholdChange(1000000);
        activeOnEnableCVDChange(false);
        activeOnCVDModeChange("oscillator");
        activeOnAlertAudioEnabledChange(false);
    });
    // ── Helpers ──────────────────────────────────────────────────────────────
    const selectedPane = useMemo(() => paneState.panes.find((p) => p.id === activeSelectedPaneId) ?? paneState.panes[0], [paneState.panes, activeSelectedPaneId]);
    const availableSeriesTypes = useMemo(() => {
        return listRegistered().filter((type) => TECHNICAL_INDICATORS.has(type));
    }, []);
    const [composerType, setComposerType] = useState("EMA");
    const [composerYAxis, setComposerYAxis] = useState("right");
    const composerEntry = useMemo(() => {
        if (availableSeriesTypes.length === 0)
            return null;
        try {
            return getSeries(composerType);
        }
        catch {
            return null;
        }
    }, [availableSeriesTypes, composerType]);
    useEffect(() => {
        if (composerEntry) {
            setComposerYAxis(composerEntry.defaultYAxis);
        }
    }, [composerEntry, composerType]);
    const handleAddSeries = () => {
        if (!selectedPane || !composerEntry)
            return;
        paneState.addSeries(selectedPane.id, {
            type: composerType,
            yAxis: composerYAxis,
            params: { ...composerEntry.defaultParams },
        });
    };
    // Close on Escape
    useEffect(() => {
        if (!open)
            return;
        const handler = (e) => {
            if (e.key === "Escape")
                onClose?.();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);
    if (!open)
        return null;
    const visibleCount = paneState.panes.filter((p) => p.visible).length;
    // ── Sections Rendering ───────────────────────────────────────────────────
    const renderLayoutSection = () => (_jsxs("div", { className: "vnsc-settings-panel", children: [_jsxs("div", { className: "vnsc-settings-panel__header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary, #a0a0a0)", textTransform: "uppercase" }, children: t("settings.layoutKicker") || "Layout" }), _jsx("h3", { style: { margin: "4px 0", fontSize: "18px", color: "var(--vnsc-text-primary, #e0e0e0)" }, children: t("settings.managePanes") || "Manage Panes" })] }), _jsxs("div", { className: "vnsc-settings-stat", style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: [visibleCount, "/", activeMaxVisiblePanes] })] }), _jsxs("div", { className: "vnsc-settings-row", style: { display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }, children: [_jsxs("label", { className: "vnsc-settings-field", style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "15px", color: "var(--vnsc-text-secondary)" }, children: t("settings.maxVisible") || "Max Panes" }), _jsx("input", { type: "number", className: "vnsc-settings-input", min: 1, max: 12, value: activeMaxVisiblePanes, onChange: (e) => activeOnMaxVisiblePanesChange(Math.max(1, parseInt(e.target.value, 10) || 5)), style: {
                                    padding: "8px 12px",
                                    fontSize: "14px",
                                    background: "var(--vnsc-bg-secondary, #111820)",
                                    border: "1px solid var(--vnsc-border, #2a2a2a)",
                                    borderRadius: "6px",
                                    color: "var(--vnsc-text-primary)",
                                } })] }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--accent", disabled: visibleCount >= activeMaxVisiblePanes, onClick: () => paneState.addPane({
                            label: t("library.genericPaneLabel", { index: paneState.panes.length + 1 }) || `Pane ${paneState.panes.length + 1}`,
                            pinned: false,
                            visible: true,
                            heightRatio: 0.2,
                            series: [],
                            splitScale: false,
                            tooltip: "value",
                        }), style: {
                            padding: "10px 18px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "bold",
                            marginTop: "25px",
                        }, children: t("settings.addPane") || "+ Add Pane" })] }), _jsx("div", { className: "vnsc-settings-row", style: { marginBottom: "20px" }, children: _jsxs("label", { className: "vnsc-settings-field", style: { display: "flex", gap: "10px", alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: activeShowNonTradingDays, onChange: (e) => activeOnShowNonTradingDaysChange(e.target.checked), style: { width: "16px", height: "16px", cursor: "pointer" } }), _jsxs("div", { children: [_jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)", cursor: "pointer" }, children: t("settings.showNonTradingDays") || "Show non-trading days" }), _jsx("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "2px" }, children: t("settings.showNonTradingDaysNote") || "Show weekend gaps on the X axis" })] })] }) }), _jsx("div", { className: "vnsc-settings-pane-list", style: { display: "flex", flexDirection: "column", gap: "12px" }, children: paneState.panes.map((pane, idx) => {
                    const isSelected = pane.id === activeSelectedPaneId;
                    const visiblePanes = paneState.panes.filter((p) => p.visible);
                    const visibleIndex = visiblePanes.findIndex((p) => p.id === pane.id);
                    const canMoveUp = pane.visible && visibleIndex > 0;
                    const canMoveDown = pane.visible && visibleIndex >= 0 && visibleIndex < visiblePanes.length - 1;
                    return (_jsxs("div", { onClick: () => activeOnSelectedPaneIdChange(pane.id), style: {
                            padding: "14px 16px",
                            background: isSelected ? "var(--vnsc-bg-tertiary, #1c2430)" : "var(--vnsc-bg-secondary, #111820)",
                            border: isSelected ? "2px solid var(--vnsc-accent, #2962ff)" : "1px solid var(--vnsc-border, #2a2a2a)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: [safeT(`pane.${pane.id}`, pane.label), pane.pinned && _jsx("span", { style: { fontSize: "11px", background: "var(--vnsc-accent)", color: "#fff", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px" }, children: "Pinned" })] }), _jsxs("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "4px" }, children: [pane.series.length, " indicators"] })] }), _jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "vnsc-btn", disabled: pane.pinned, onClick: (e) => {
                                                    e.stopPropagation();
                                                    if (pane.visible) {
                                                        paneState.toggleVisible(pane.id);
                                                    }
                                                    else {
                                                        paneState.restorePane(pane.id);
                                                    }
                                                }, style: {
                                                    padding: "6px 12px",
                                                    fontSize: "13px",
                                                }, children: pane.visible ? t("settings.hide") || "Hide" : t("settings.restore") || "Restore" }), !pane.pinned && !["price", "volume"].includes(pane.id) && (_jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--danger", onClick: (e) => {
                                                    e.stopPropagation();
                                                    paneState.deletePane(pane.id);
                                                    if (pane.id === activeSelectedPaneId) {
                                                        const nextSelectedPaneId = paneState.panes.find((p) => p.id !== pane.id)?.id ?? "";
                                                        if (nextSelectedPaneId) {
                                                            onSelectedPaneIdChange?.(nextSelectedPaneId);
                                                            setLocalSelectedPaneId(nextSelectedPaneId);
                                                        }
                                                    }
                                                }, style: {
                                                    padding: "6px 12px",
                                                    fontSize: "13px",
                                                }, children: t("settings.deletePane") || "Delete" }))] })] }), !pane.pinned && !["price", "volume"].includes(pane.id) && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "6px" }, onClick: (e) => e.stopPropagation(), children: [_jsx("span", { style: { fontSize: "12px", color: "var(--vnsc-text-secondary)" }, children: t("settings.paneName") || "Rename Pane" }), _jsx("input", { type: "text", value: pane.label, onChange: (e) => paneState.renamePane(pane.id, e.target.value), style: {
                                            padding: "6px 10px",
                                            fontSize: "14px",
                                            background: "var(--vnsc-bg-primary, #0a0e14)",
                                            border: "1px solid var(--vnsc-border, #2a2a2a)",
                                            borderRadius: "4px",
                                            color: "var(--vnsc-text-primary)",
                                            width: "100%",
                                            boxSizing: "border-box",
                                        } })] })), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--vnsc-border, #2a2a2a)", paddingTop: "10px" }, children: [_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" }, children: pane.series.map((s, sIdx) => (_jsx("span", { style: { fontSize: "12px", background: "var(--vnsc-bg-primary, #0a0e14)", color: "var(--vnsc-text-secondary)", padding: "3px 8px", borderRadius: "4px", border: "1px solid var(--vnsc-border)" }, children: formatSeriesDisplayName(s.type, s.params, t, sIdx) }, sIdx))) }), _jsxs("div", { style: { display: "flex", gap: "4px" }, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "vnsc-btn", disabled: !canMoveUp, onClick: (e) => {
                                                    e.stopPropagation();
                                                    paneState.reorderPanes(visibleIndex, visibleIndex - 1);
                                                }, style: {
                                                    padding: "4px 10px",
                                                    fontSize: "12px",
                                                    cursor: canMoveUp ? "pointer" : "not-allowed",
                                                    opacity: canMoveUp ? 1 : 0.4,
                                                }, children: "\u2191" }), _jsx("button", { type: "button", className: "vnsc-btn", disabled: !canMoveDown, onClick: (e) => {
                                                    e.stopPropagation();
                                                    paneState.reorderPanes(visibleIndex, visibleIndex + 1);
                                                }, style: {
                                                    padding: "4px 10px",
                                                    fontSize: "12px",
                                                    cursor: canMoveDown ? "pointer" : "not-allowed",
                                                    opacity: canMoveDown ? 1 : 0.4,
                                                }, children: "\u2193" })] })] })] }, pane.id));
                }) })] }));
    const renderIndicatorsSection = () => {
        const renderSeriesParams = (pane, series, seriesIndex) => {
            let entry;
            try {
                entry = getSeries(series.type);
            }
            catch {
                return null;
            }
            const fields = entry.settingsFields ?? [];
            const handleParamChange = (key, val) => {
                paneState.dispatch({
                    type: "updateSeriesParams",
                    paneId: pane.id,
                    seriesType: series.type,
                    params: { ...series.params, [key]: val },
                    seriesIndex,
                });
            };
            return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", padding: "8px", background: "var(--vnsc-bg-secondary)", borderRadius: "4px" }, children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }, children: [fields.map((field) => {
                                const currentVal = series.params?.[field.key] ?? field.defaultValue;
                                return (_jsxs("label", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [_jsx("span", { style: { fontSize: "14px", color: "var(--vnsc-text-secondary)" }, children: t(field.labelKey) }), _jsx("input", { type: field.type, value: currentVal, min: field.min, max: field.max, step: field.step ?? 1, onChange: (e) => handleParamChange(field.key, parseFloat(e.target.value)), style: {
                                                padding: "6px 10px",
                                                fontSize: "14px",
                                                background: "var(--vnsc-bg-primary)",
                                                border: "1px solid var(--vnsc-border)",
                                                borderRadius: "4px",
                                                color: "var(--vnsc-text-primary)",
                                            } })] }, field.key));
                            }), _jsxs("label", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [_jsx("span", { style: { fontSize: "14px", color: "var(--vnsc-text-secondary)" }, children: t("settings.seriesColor") || "Color" }), _jsx("input", { type: "color", value: series.color ?? "#2962ff", onChange: (e) => paneState.dispatch({ type: "updateSeriesColor", paneId: pane.id, seriesType: series.type, color: e.target.value, seriesIndex }), style: { width: "100%", height: "32px", border: "none", background: "none", cursor: "pointer" } })] })] }), supportsSeriesLineWidth(series.type) && (_jsxs("label", { style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "14px", color: "var(--vnsc-text-secondary)" }, children: safeT("settings.lineWidth", "Thickness") }), _jsx(SettingsRangeSlider, { value: series.lineWidth ?? 2, min: 0.5, max: 8, step: 0.25, formatValue: (v) => `${v.toFixed(2)}px`, marks: [
                                    { value: 0.5, label: "0.50px" },
                                    { value: 1, label: "1.00px" },
                                    { value: 2, label: "2.00px" },
                                    { value: 4, label: "4.00px" },
                                    { value: 8, label: "8.00px" },
                                ], inputAriaLabel: safeT("settings.lineWidth", "Thickness"), onChange: (next) => paneState.dispatch({ type: "updateSeriesLineWidth", paneId: pane.id, seriesType: series.type, lineWidth: next, seriesIndex }) })] })), SERIES_SUB_COMPONENTS[series.type]?.map((comp) => {
                        const currentVal = series.subColors?.[comp.key] ?? comp.defaultColor;
                        return (_jsxs("label", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "4px" }, children: [_jsx("span", { children: t(comp.labelKey) }), _jsx("input", { type: "color", value: currentVal, onChange: (e) => paneState.dispatch({ type: "updateSeriesSubColor", paneId: pane.id, seriesType: series.type, subKey: comp.key, color: e.target.value, seriesIndex }), style: { width: "40px", height: "24px", border: "none", background: "none", cursor: "pointer" } })] }, comp.key));
                    })] }));
        };
        return (_jsxs("div", { className: "vnsc-settings-panel", children: [_jsxs("div", { className: "vnsc-settings-panel__header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.indicatorKicker", "Indicators") }), _jsx("h3", { style: { margin: "4px 0", fontSize: "18px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.indicatorEditor", "Pane Indicators") })] }), _jsxs("select", { value: activeSelectedPaneId, onChange: (e) => activeOnSelectedPaneIdChange(e.target.value), style: {
                                padding: "8px 12px",
                                fontSize: "14px",
                                background: "var(--vnsc-bg-secondary)",
                                border: "1px solid var(--vnsc-border)",
                                borderRadius: "6px",
                                color: "var(--vnsc-text-primary)",
                            }, children: paneState.panes.map((p) => (_jsx("option", { value: p.id, children: safeT(`pane.${p.id}`, p.label) }, p.id))) })] }), selectedPane ? (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [_jsx("div", { className: "vnsc-settings-series-list", style: { display: "flex", flexDirection: "column", gap: "12px" }, children: selectedPane.series.map((series, idx) => (_jsxs("div", { style: { padding: "12px", border: "1px solid var(--vnsc-border)", borderRadius: "6px", background: "var(--vnsc-bg-secondary, #111820)" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("div", { children: _jsx("span", { style: { fontSize: "14px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: formatSeriesDisplayName(series.type, series.params, t, idx) }) }), _jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, children: [_jsxs("select", { value: series.yAxis, onChange: (e) => paneState.dispatch({
                                                            type: "updateSeriesYAxis",
                                                            paneId: selectedPane.id,
                                                            seriesType: series.type,
                                                            yAxis: e.target.value,
                                                            seriesIndex: idx,
                                                        }), style: {
                                                            padding: "6px 10px",
                                                            fontSize: "13px",
                                                            background: "var(--vnsc-bg-primary, #0a0e14)",
                                                            border: "1px solid var(--vnsc-border, #2a2a2a)",
                                                            borderRadius: "4px",
                                                            color: "var(--vnsc-text-primary)",
                                                            cursor: "pointer",
                                                        }, children: [_jsx("option", { value: "left", children: safeT("settings.yAxisLeft", "Left") }), _jsx("option", { value: "right", children: safeT("settings.yAxisRight", "Right") })] }), _jsx("button", { type: "button", className: "vnsc-btn", onClick: () => paneState.toggleSeriesVisible(selectedPane.id, series.type, idx), style: {
                                                            padding: "6px 10px",
                                                            fontSize: "13px",
                                                        }, children: series.visible === false ? safeT("settings.visible", "Show") : safeT("settings.hide", "Hide") }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--danger", onClick: () => paneState.removeSeries(selectedPane.id, series.type, idx), style: {
                                                            padding: "6px 10px",
                                                            fontSize: "13px",
                                                        }, children: safeT("settings.remove", "Remove") })] })] }), renderSeriesParams(selectedPane, series, idx)] }, `${series.type}-${idx}`))) }), _jsxs("div", { className: "vnsc-settings-composer", style: { marginTop: "16px", padding: "16px", border: "1px solid var(--vnsc-border)", borderRadius: "8px" }, children: [_jsx("h4", { style: { margin: "0 0 12px 0", fontSize: "15px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.addIndicator", "Add Indicator") }), _jsxs("div", { style: { display: "flex", gap: "12px", alignItems: "flex-end" }, children: [_jsxs("label", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)" }, children: safeT("settings.indicatorType", "Type") }), _jsxs("select", { value: composerType, onChange: (e) => setComposerType(e.target.value), style: {
                                                        padding: "8px 12px",
                                                        fontSize: "14px",
                                                        background: "var(--vnsc-bg-primary)",
                                                        border: "1px solid var(--vnsc-border)",
                                                        borderRadius: "6px",
                                                        color: "var(--vnsc-text-primary)",
                                                    }, children: availableSeriesTypes.map((type) => (_jsx("option", { value: type, children: formatSeriesDisplayName(type, undefined, t) }, type))) })] }), _jsxs("label", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)" }, children: safeT("settings.yAxis", "Axis") }), _jsxs("select", { value: composerYAxis, onChange: (e) => setComposerYAxis(e.target.value), style: {
                                                        padding: "8px 12px",
                                                        fontSize: "14px",
                                                        background: "var(--vnsc-bg-primary)",
                                                        border: "1px solid var(--vnsc-border)",
                                                        borderRadius: "6px",
                                                        color: "var(--vnsc-text-primary)",
                                                    }, children: [_jsx("option", { value: "left", children: safeT("settings.yAxisLeft", "Left") }), _jsx("option", { value: "right", children: safeT("settings.yAxisRight", "Right") })] })] }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--accent", onClick: handleAddSeries, style: {
                                                padding: "10px 18px",
                                                fontSize: "14px",
                                                fontWeight: "bold",
                                            }, children: safeT("settings.addIndicator", "Add") })] })] })] })) : (_jsx("div", { style: { color: "var(--vnsc-text-secondary)", fontSize: "15px", textAlign: "center", padding: "30px" }, children: safeT("settings.noPane", "No panes active") }))] }));
    };
    const getPaneLabel = (id, label) => {
        if (id === "price")
            return t("pane.price") || label;
        if (id === "volume")
            return t("pane.volume") || label;
        return t(`pane.${id}`) || label;
    };
    const getIndicatorSetLabel = (set) => {
        if (!set.isBuiltin) {
            return set.name;
        }
        switch (set.id) {
            case "builtin-vn-swing-setup":
                return t("indicatorSet.vnSwingSetup") || set.name;
            case "builtin-ema-multi":
                return t("indicatorSet.emaMulti") || set.name;
            case "builtin-orderflow-suite":
                return t("indicatorSet.orderflowSuite") || set.name;
            case "builtin-crypto-standard":
                return t("indicatorSet.cryptoStandard") || set.name;
            default:
                return set.name;
        }
    };
    const handleApplyIndicatorSet = (setId) => {
        const set = indicatorSets.getSetById(setId);
        if (!set)
            return;
        if (indicatorSets.applySet(setId)) {
            setIndicatorSetMessage(t("settings.setApplied", { name: getIndicatorSetLabel(set) }) || `Applied set "${getIndicatorSetLabel(set)}"`);
        }
    };
    const handleDeleteIndicatorSet = (setId) => {
        const set = indicatorSets.getSetById(setId);
        if (!set || set.isBuiltin)
            return;
        if (indicatorSets.deleteSet(setId)) {
            setIndicatorSetMessage(t("settings.setDeleted", { name: getIndicatorSetLabel(set) }) || `Deleted set "${getIndicatorSetLabel(set)}"`);
        }
    };
    const handleSaveCurrentIndicatorSet = () => {
        const name = indicatorSetName.trim() || t("settings.defaultSetName") || "New indicator set";
        const saved = indicatorSets.saveCurrentAsSet(name);
        if (!saved) {
            setIndicatorSetMessage(t("settings.importError") || "Invalid or malformed file");
            return;
        }
        setIndicatorSetName("");
        setIndicatorSetMessage(t("settings.setSaved", { name: saved.name }) || `Saved set "${saved.name}"`);
    };
    const handleImportIndicatorSetClick = () => {
        importInputRef.current?.click();
    };
    const handleImportIndicatorSetChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        const imported = await indicatorSets.importSet(file);
        event.target.value = "";
        if (!imported) {
            setIndicatorSetMessage(t("settings.importError") || "Invalid or malformed file");
            return;
        }
        setIndicatorSetMessage(t("settings.setImported", { name: getIndicatorSetLabel(imported) }) || `Imported set "${getIndicatorSetLabel(imported)}"`);
    };
    const renderIndicatorSetsSection = () => {
        const builtinSets = indicatorSets.builtinSets;
        const userSets = indicatorSets.userSets;
        const renderSetCard = (set, isBuiltin) => (_jsxs("div", { className: "vnsc-settings-series", children: [_jsxs("div", { className: "vnsc-settings-series__head", children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-series__title", children: getIndicatorSetLabel(set) }), _jsx("div", { className: "vnsc-settings-series__meta", children: t("settings.setPaneCount", { count: set.panes.filter((pane) => pane.visible).length }) || `${set.panes.filter((pane) => pane.visible).length} panes` })] }), _jsxs("div", { className: "vnsc-settings-series__actions", children: [_jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--accent", onClick: () => handleApplyIndicatorSet(set.id), children: safeT("settings.applySet", "Apply") }), !isBuiltin ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "vnsc-btn", onClick: () => indicatorSets.exportSet(set.id), children: safeT("settings.exportSet", "Export") }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--danger", onClick: () => handleDeleteIndicatorSet(set.id), children: safeT("settings.deleteSet", "Delete") })] })) : null] })] }), _jsx("div", { className: "vnsc-settings-pane__tags", children: set.panes.filter((pane) => pane.visible).map((pane) => (_jsx("span", { className: "vnsc-tag", children: getPaneLabel(pane.id, pane.label) }, `${set.id}-${pane.id}`))) })] }, set.id));
        return (_jsxs("div", { className: "vnsc-settings-panel", children: [_jsxs("div", { className: "vnsc-settings-panel__header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.indicatorSetsKicker", "Indicator Sets") }), _jsx("h3", { style: { margin: "4px 0", fontSize: "18px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.indicatorSetsTitle", "Manage indicator sets") })] }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--accent", onClick: handleSaveCurrentIndicatorSet, style: { padding: "10px 18px", fontSize: "14px" }, children: safeT("settings.saveCurrentSet", "Save current configuration") })] }), _jsxs("div", { className: "vnsc-settings-row", style: { display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }, children: [_jsxs("label", { className: "vnsc-settings-field", style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "14px", fontWeight: "bold" }, children: safeT("settings.setName", "Set name") }), _jsx("input", { type: "text", className: "vnsc-settings-input", value: indicatorSetName, placeholder: safeT("settings.setNamePlaceholder", "Enter set name..."), onChange: (event) => setIndicatorSetName(event.target.value), style: { padding: "8px 12px", fontSize: "14px", background: "var(--vnsc-bg-secondary)", border: "1px solid var(--vnsc-border)", borderRadius: "6px", color: "var(--vnsc-text-primary)" } })] }), _jsxs("div", { className: "vnsc-settings-field", style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("span", { style: { fontSize: "14px", fontWeight: "bold" }, children: safeT("settings.importSet", "Import from file") }), _jsx("button", { type: "button", className: "vnsc-btn", onClick: handleImportIndicatorSetClick, style: { padding: "8px 16px", fontSize: "14px" }, children: safeT("settings.importSet", "Import") }), _jsx("input", { ref: importInputRef, type: "file", accept: ".vnsc-set,application/json", style: { display: "none" }, onChange: handleImportIndicatorSetChange })] })] }), indicatorSetMessage ? _jsx("div", { className: "vnsc-settings-note", style: { fontSize: "13px", color: "var(--vnsc-accent)", marginBottom: "12px" }, children: indicatorSetMessage }) : null, _jsx("div", { className: "vnsc-settings-panel__header vnsc-settings-panel__header--subtle", style: { marginBottom: "12px" }, children: _jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.builtinSets", "Built-in Templates") }), _jsx("h4", { style: { margin: "4px 0", fontSize: "15px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.builtinSetsTitle", "Built-in templates") })] }) }), _jsx("div", { className: "vnsc-settings-series-list", children: builtinSets.map((set) => renderSetCard(set, true)) }), _jsx("div", { className: "vnsc-settings-panel__header vnsc-settings-panel__header--subtle", style: { marginTop: "16px", marginBottom: "12px" }, children: _jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.mySets", "My Sets") }), _jsx("h4", { style: { margin: "4px 0", fontSize: "15px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.mySetsTitle", "Saved sets") })] }) }), _jsx("div", { className: "vnsc-settings-series-list", children: userSets.length > 0
                        ? userSets.map((set) => renderSetCard(set, false))
                        : _jsx("div", { className: "vnsc-settings-empty", style: { fontSize: "14px", color: "var(--vnsc-text-secondary)", textAlign: "center", padding: "20px" }, children: safeT("settings.noUserSets", "No saved sets yet") }) })] }));
    };
    const renderThemeSection = () => (_jsxs("div", { className: "vnsc-settings-panel", style: { display: "flex", flexDirection: "column", gap: "20px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.themeKicker", "Theme") }), _jsx("h3", { style: { margin: "4px 0", fontSize: "18px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.appearanceShell", "Appearance") })] }), _jsx("button", { type: "button", className: "vnsc-btn", onClick: activeToggleTheme, style: {
                            padding: "8px 16px",
                            fontSize: "14px",
                        }, children: activeIsDark ? safeT("theme.switchToLight", "Switch to Light") : safeT("theme.switchToDark", "Switch to Dark") })] }), _jsx("hr", { style: { border: "none", borderTop: "1px solid var(--vnsc-border)", margin: 0 } }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("div", { children: _jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.timezone", "Timezone") }) }), _jsxs("select", { value: activeTimezone, onChange: (e) => activeOnTimezoneChange(e.target.value), style: {
                            padding: "8px 12px",
                            background: "var(--vnsc-bg-secondary)",
                            border: "1px solid var(--vnsc-border)",
                            borderRadius: "6px",
                            color: "var(--vnsc-text-primary)",
                            minWidth: "200px",
                            fontSize: "14px",
                        }, children: [_jsx("option", { value: "Asia/Ho_Chi_Minh", children: safeT("timezone.hcm", "Vietnam") }), _jsx("option", { value: "UTC", children: safeT("timezone.utc", "UTC") }), _jsx("option", { value: "America/New_York", children: safeT("timezone.ny", "New York") }), _jsx("option", { value: "Europe/London", children: safeT("timezone.london", "London") })] })] }), onDataAdapterChange !== undefined && (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("div", { children: _jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.datasource", "Data source") }) }), _jsxs("select", { value: dataAdapterName || "local", onChange: (e) => onDataAdapterChange(e.target.value), style: {
                            padding: "8px 12px",
                            background: "var(--vnsc-bg-secondary)",
                            border: "1px solid var(--vnsc-border)",
                            borderRadius: "6px",
                            color: "var(--vnsc-text-primary)",
                            minWidth: "200px",
                            fontSize: "14px",
                        }, children: [_jsx("option", { value: "binance", children: safeT("settings.dataAdapter.binance", "Binance") }), _jsx("option", { value: "local", children: safeT("settings.dataAdapter.local", "Offline data") }), _jsx("option", { value: "vnstocks", children: safeT("settings.dataAdapter.vnstocks", "VNStocks") })] })] })), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.priceMarkers", "Show Price Markers") }), _jsx("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "2px" }, children: safeT("settings.priceMarkersNote", "Display price tag on active drawing") })] }), _jsx("input", { type: "checkbox", checked: activeShowDrawingPriceMarkers, onChange: (e) => activeOnShowDrawingPriceMarkersChange(e.target.checked), style: { width: "16px", height: "16px", cursor: "pointer" } })] }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.whale", "Whale money flow") }), _jsx("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "2px" }, children: safeT("settings.whaleNote", "Display large transactions") })] }), _jsx("input", { type: "checkbox", checked: activeEnableWhale, onChange: (e) => activeOnEnableWhaleChange(e.target.checked), style: { width: "16px", height: "16px", cursor: "pointer" } })] }), activeEnableWhale && (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("span", { style: { fontSize: "15px", color: "var(--vnsc-text-secondary)" }, children: safeT("settings.whaleThreshold", "Threshold (VND)") }), _jsx("input", { type: "number", value: activeWhaleThreshold, onChange: (e) => activeOnWhaleThresholdChange(parseInt(e.target.value, 10) || 1000000), style: {
                            padding: "8px 12px",
                            background: "var(--vnsc-bg-secondary)",
                            border: "1px solid var(--vnsc-border)",
                            borderRadius: "6px",
                            color: "var(--vnsc-text-primary)",
                            width: "160px",
                            fontSize: "14px",
                        } })] })), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.cvd", "CVD") }), _jsx("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "2px" }, children: safeT("settings.cvdNote", "Cumulative Volume Delta") })] }), _jsx("input", { type: "checkbox", checked: activeEnableCVD, onChange: (e) => activeOnEnableCVDChange(e.target.checked), style: { width: "16px", height: "16px", cursor: "pointer" } })] }), activeEnableCVD && (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("span", { style: { fontSize: "15px", color: "var(--vnsc-text-secondary)" }, children: safeT("settings.cvdMode", "CVD Mode") }), _jsxs("select", { value: activeCvdMode, onChange: (e) => activeOnCVDModeChange(e.target.value), style: {
                            padding: "8px 12px",
                            background: "var(--vnsc-bg-secondary)",
                            border: "1px solid var(--vnsc-border)",
                            borderRadius: "6px",
                            color: "var(--vnsc-text-primary)",
                            fontSize: "14px",
                        }, children: [_jsx("option", { value: "oscillator", children: safeT("settings.cvdOscillator", "Oscillator") }), _jsx("option", { value: "histogram", children: safeT("settings.cvdHistogram", "Histogram") })] })] })), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: "15px", fontWeight: "bold", color: "var(--vnsc-text-primary)" }, children: safeT("settings.alertAudioEnabled", "Alert Sound") }), _jsx("div", { style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", marginTop: "2px" }, children: safeT("settings.alertAudioEnabledNote", "Play chime on alert cross") })] }), _jsx("input", { type: "checkbox", checked: activeAlertAudioEnabled, onChange: (e) => activeOnAlertAudioEnabledChange(e.target.checked), style: { width: "16px", height: "16px", cursor: "pointer" } })] })] }));
    const renderResetSection = () => (_jsxs("div", { className: "vnsc-settings-panel", children: [_jsxs("div", { className: "vnsc-settings-panel__header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [_jsxs("div", { children: [_jsx("div", { className: "vnsc-settings-kicker", style: { fontSize: "13px", color: "var(--vnsc-text-secondary)", textTransform: "uppercase" }, children: safeT("settings.resetKicker", "Reset") }), _jsx("h3", { style: { margin: "4px 0", fontSize: "18px", color: "var(--vnsc-text-primary)" }, children: safeT("settings.resetDefaults", "Reset layout parameters") })] }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--danger", onClick: activeOnReset, style: { padding: "10px 18px", fontSize: "14px" }, children: safeT("settings.resetLayout", "Reset Defaults") })] }), _jsx("div", { style: { fontSize: "14px", color: "var(--vnsc-text-secondary)", marginTop: "10px" }, children: safeT("settings.resetNote", "This will reset all panes to default size and remove custom indicators.") })] }));
    const safeT = useCallback((key, fallback, params) => {
        const val = t(key, params);
        return val === key ? fallback : val;
    }, [t]);
    return createPortal(_jsx("div", { ref: backdropRef, className: "vnsc-settings-backdrop", "data-testid": "settings-backdrop", onClick: (e) => {
            if (e.target === backdropRef.current)
                onClose?.();
        }, children: _jsxs("div", { className: "vnsc-settings-modal", "data-testid": "settings-modal", style: {
                background: "var(--vnsc-bg-primary, #0a0e14)",
                border: "1px solid var(--vnsc-border, #2a2a2a)",
                borderRadius: "8px",
                width: "760px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }, children: [_jsxs("div", { className: "vnsc-settings-modal__header", children: [_jsx("h2", { className: "vnsc-settings-modal__title", children: safeT("settings.dialogKicker", "Settings") }), _jsx("button", { type: "button", className: "vnsc-settings-modal__close", onClick: onClose, title: safeT("settings.dialogClose", "Close"), children: "\u00D7" })] }), _jsx("div", { className: "vnsc-settings-tabs", children: SECTIONS.map((section) => (_jsx("button", { type: "button", className: `vnsc-settings-tab ${activeSection === section.key ? "vnsc-settings-tab--active" : ""}`, onClick: () => setActiveSection(section.key), children: t(section.labelKey) || section.key }, section.key))) }), _jsx("div", { className: "vnsc-settings-body", children: children ?? (_jsxs("div", { style: { color: "var(--vnsc-text-secondary, #a0a0a0)", fontSize: "15px" }, children: [activeSection === "layout" ? renderLayoutSection() : null, activeSection === "indicators" ? renderIndicatorsSection() : null, activeSection === "indicatorSets" ? renderIndicatorSetsSection() : null, activeSection === "theme" ? renderThemeSection() : null, activeSection === "reset" ? renderResetSection() : null] })) })] }) }), portalTarget || document.body);
}
