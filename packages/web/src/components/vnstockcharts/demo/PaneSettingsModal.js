import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSeries, listRegistered, SERIES_SUB_COMPONENTS } from "../lib/core/index.js";
import { useIndicatorSets } from "../lib/core/hooks/useIndicatorSets.js";
import { isDefaultPaneId } from "../lib/core/types/pane-descriptor.js";
import { useDemoI18n } from "./i18n.js";
function describeSeries(series, index) {
    const label = series.type;
    if (series.type === "EMA" && typeof series.params?.period === "number") {
        return `EMA(${series.params.period}) #${index + 1}`;
    }
    if (series.type === "RSI" && typeof series.params?.period === "number") {
        return `RSI(${series.params.period}) #${index + 1}`;
    }
    if (series.type === "BollingerBand" && typeof series.params?.period === "number") {
        return `BB(${series.params.period}) #${index + 1}`;
    }
    if (series.type === "MACD") {
        const fast = typeof series.params?.fast === "number" ? series.params.fast : 12;
        const slow = typeof series.params?.slow === "number" ? series.params.slow : 26;
        return `MACD(${fast},${slow}) #${index + 1}`;
    }
    if (series.type === "Whale" && typeof series.params?.threshold === "number") {
        return `Whale(${series.params.threshold}) #${index + 1}`;
    }
    return `${label} #${index + 1}`;
}
function parseNumber(value, fallback) {
    const next = Number.parseFloat(value);
    return Number.isFinite(next) ? next : fallback;
}
export function PaneSettingsModal({ open, section, onSectionChange, selectedPaneId, onSelectedPaneIdChange, paneState, maxVisiblePanes, onMaxVisiblePanesChange, maxVisibleBars, onMaxVisibleBarsChange, showNonTradingDays, onShowNonTradingDaysChange, showDrawingPriceMarkers, onShowDrawingPriceMarkersChange, enableWhale, onEnableWhaleChange, whaleThreshold, onWhaleThresholdChange, enableCVD, onEnableCVDChange, cvdMode, onCVDModeChange, onAddPane, onReset, isDark, toggleTheme, onClose, dataAdapterName, onDataAdapterChange, }) {
    const { t, getPaneLabel } = useDemoI18n();
    const dialogRef = useRef(null);
    const importInputRef = useRef(null);
    const [indicatorSetName, setIndicatorSetName] = useState("");
    const [indicatorSetMessage, setIndicatorSetMessage] = useState("");
    const availableSeriesTypes = useMemo(() => listRegistered(), []);
    const [composerType, setComposerType] = useState("EMA");
    const [composerYAxis, setComposerYAxis] = useState("right");
    const selectedPane = useMemo(() => paneState.panes.find((pane) => pane.id === selectedPaneId) ?? paneState.visiblePanes[0] ?? paneState.panes[0], [paneState.panes, paneState.visiblePanes, selectedPaneId]);
    const indicatorSets = useIndicatorSets({
        currentPanes: paneState.panes,
        onApplyPanes: (nextPanes) => {
            paneState.replaceLayout(nextPanes);
            const nextSelectedPaneId = nextPanes.find((pane) => pane.visible)?.id ?? nextPanes[0]?.id ?? "";
            if (nextSelectedPaneId) {
                onSelectedPaneIdChange(nextSelectedPaneId);
            }
        },
    });
    useEffect(() => {
        if (!open) {
            return;
        }
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);
    useEffect(() => {
        if (!open || availableSeriesTypes.length === 0) {
            return;
        }
        if (!availableSeriesTypes.includes(composerType)) {
            setComposerType(availableSeriesTypes[0]);
        }
    }, [availableSeriesTypes, composerType, open]);
    const resolvedComposerType = availableSeriesTypes.includes(composerType)
        ? composerType
        : availableSeriesTypes[0] ?? "EMA";
    const composerEntry = useMemo(() => {
        if (availableSeriesTypes.length === 0) {
            return null;
        }
        try {
            return getSeries(resolvedComposerType);
        }
        catch {
            return null;
        }
    }, [availableSeriesTypes.length, resolvedComposerType]);
    useEffect(() => {
        if (composerEntry) {
            setComposerYAxis(composerEntry.defaultYAxis);
        }
    }, [composerEntry, resolvedComposerType]);
    const getIndicatorSetLabel = (set) => {
        if (!set.isBuiltin) {
            return set.name;
        }
        switch (set.id) {
            case "builtin-vn-swing-setup":
                return t("indicatorSet.vnSwingSetup");
            case "builtin-ema-multi":
                return t("indicatorSet.emaMulti");
            case "builtin-orderflow-suite":
                return t("indicatorSet.orderflowSuite");
            case "builtin-crypto-standard":
                return t("indicatorSet.cryptoStandard");
            default:
                return set.name;
        }
    };
    const handleApplyIndicatorSet = (setId) => {
        const set = indicatorSets.getSetById(setId);
        if (!set) {
            return;
        }
        if (indicatorSets.applySet(setId)) {
            setIndicatorSetMessage(t("settings.setApplied", { name: getIndicatorSetLabel(set) }));
        }
    };
    const handleDeleteIndicatorSet = (setId) => {
        const set = indicatorSets.getSetById(setId);
        if (!set || set.isBuiltin) {
            return;
        }
        if (indicatorSets.deleteSet(setId)) {
            setIndicatorSetMessage(t("settings.setDeleted", { name: getIndicatorSetLabel(set) }));
        }
    };
    const handleSaveCurrentIndicatorSet = () => {
        const saved = indicatorSets.saveCurrentAsSet(indicatorSetName.trim() || t("settings.defaultSetName"));
        if (!saved) {
            setIndicatorSetMessage(t("settings.importError"));
            return;
        }
        setIndicatorSetName("");
        setIndicatorSetMessage(t("settings.setSaved", { name: saved.name }));
    };
    const handleImportIndicatorSetClick = () => {
        importInputRef.current?.click();
    };
    const handleImportIndicatorSetChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const imported = await indicatorSets.importSet(file);
        event.target.value = "";
        if (!imported) {
            setIndicatorSetMessage(t("settings.importError"));
            return;
        }
        setIndicatorSetMessage(t("settings.setImported", { name: getIndicatorSetLabel(imported) }));
    };
    if (!open) {
        return null;
    }
    const visibleCount = paneState.visiblePanes.length;
    const overLimit = visibleCount > maxVisiblePanes;
    const canAddPane = paneState.canAddPane;
    const paneLabel = (pane) => getPaneLabel(pane.id, pane.label);
    const sectionLabels = useMemo(() => ({
        layout: t("settings.layout"),
        indicators: t("settings.indicators"),
        indicatorSets: t("settings.indicatorSets"),
        theme: t("settings.theme"),
        reset: t("settings.reset"),
    }), [t]);
    const handleBackdropMouseDown = (event) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };
    const handleAddSeries = () => {
        if (!selectedPane || !composerEntry) {
            return;
        }
        paneState.addSeries(selectedPane.id, {
            type: resolvedComposerType,
            yAxis: composerYAxis,
            params: { ...composerEntry.defaultParams },
        });
    };
    const handleSeriesParamChange = (pane, series, seriesIndex, patch) => {
        paneState.updateSeriesParams(pane.id, series.type, patch, seriesIndex);
    };
    const handleDeletePane = (pane) => {
        paneState.deletePane(pane.id);
        if (pane.id === selectedPaneId) {
            const nextSelectedPaneId = paneState.visiblePanes.find((visiblePane) => visiblePane.id !== pane.id)?.id
                ?? paneState.panes.find((nextPane) => nextPane.id !== pane.id)?.id
                ?? "";
            if (nextSelectedPaneId) {
                onSelectedPaneIdChange(nextSelectedPaneId);
            }
        }
    };
    const renderSeriesParams = (pane, series, seriesIndex) => {
        let entry;
        try {
            entry = getSeries(series.type);
        }
        catch {
            return null;
        }
        const fields = entry.settingsFields ?? [];
        const renderField = (field) => {
            const rawValue = series.params?.[field.key];
            const currentValue = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : field.defaultValue;
            return (_jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t(field.labelKey) }), _jsx("input", { type: field.type, className: "gc-settings-input", min: field.min, max: field.max, step: field.step ?? 1, value: currentValue, onChange: (event) => handleSeriesParamChange(pane, series, seriesIndex, { [field.key]: parseNumber(event.target.value, currentValue) }) })] }, field.key));
        };
        const colorPicker = (_jsxs("label", { className: "gc-settings-field gc-settings-field--color", children: [_jsx("span", { children: t("settings.seriesColor") }), _jsx("input", { type: "color", className: "gc-settings-color-input", value: series.color ?? "#2962ff", onChange: (event) => paneState.updateSeriesColor(pane.id, series.type, event.target.value, seriesIndex) })] }, "__color__"));
        const subComponents = SERIES_SUB_COMPONENTS[series.type];
        const subColorSection = subComponents && subComponents.length > 0 ? (_jsxs("div", { className: "gc-settings-sub-colors", children: [_jsx("span", { className: "gc-settings-sub-colors__label", children: t("settings.subColors") }), subComponents.map((comp) => (_jsxs("label", { className: "gc-settings-field gc-settings-field--color", children: [_jsx("span", { children: t(comp.labelKey) }), _jsx("input", { type: "color", value: series.subColors?.[comp.key] ?? comp.defaultColor, onChange: (event) => paneState.updateSeriesSubColor(pane.id, series.type, comp.key, event.target.value, seriesIndex) })] }, comp.key)))] })) : null;
        if (fields.length === 0) {
            return (_jsxs(_Fragment, { children: [colorPicker, subColorSection] }));
        }
        const gridClassName = fields.length >= 3
            ? "gc-settings-param-grid gc-settings-param-grid--three"
            : "gc-settings-param-grid";
        return (_jsxs("div", { className: gridClassName, children: [fields.map(renderField), colorPicker, subColorSection] }));
    };
    const renderLayoutSection = () => (_jsxs("div", { className: "gc-settings-panel", children: [_jsxs("div", { className: "gc-settings-panel__header", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.layoutKicker") }), _jsx("h3", { children: t("settings.managePanes") })] }), _jsxs("div", { className: "gc-settings-stat", children: [visibleCount, "/", maxVisiblePanes] })] }), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", children: [_jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t("settings.maxVisible") }), _jsx("input", { type: "number", className: "gc-settings-input", min: 1, max: 12, step: 1, value: maxVisiblePanes, onChange: (event) => onMaxVisiblePanesChange(Math.max(1, parseNumber(event.target.value, maxVisiblePanes))) })] }), _jsx("button", { type: "button", className: "gc-btn gc-btn--accent", onClick: onAddPane, disabled: !canAddPane, children: t("settings.addPane") })] }), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", children: [_jsxs("label", { className: "gc-settings-field gc-settings-field--compact", children: [_jsx("span", { children: t("settings.maxVisibleBars") }), _jsx("input", { type: "range", className: "gc-settings-range", min: 100, max: 2000, step: 50, value: maxVisibleBars, onChange: (event) => onMaxVisibleBarsChange(Math.min(2000, Math.max(100, parseNumber(event.target.value, maxVisibleBars)))) }), _jsx("div", { className: "gc-settings-note gc-settings-note--tight", children: t("settings.maxVisibleBarsNote") })] }), _jsxs("label", { className: "gc-settings-field gc-settings-field--toggle", children: [_jsx("input", { type: "checkbox", checked: showNonTradingDays, onChange: (event) => onShowNonTradingDaysChange(event.target.checked) }), _jsxs("div", { children: [_jsx("span", { children: t("settings.showNonTradingDays") }), _jsx("div", { className: "gc-settings-note gc-settings-note--tight", children: t("settings.showNonTradingDaysNote") })] })] })] }), _jsx("div", { className: "gc-settings-pane-list", children: paneState.panes.map((pane) => {
                    const visibleIndex = paneState.visiblePanes.findIndex((visiblePane) => visiblePane.id === pane.id);
                    const hidden = !pane.visible;
                    const isDefaultPane = isDefaultPaneId(pane.id);
                    const isSelected = pane.id === (selectedPane?.id ?? selectedPaneId);
                    const canMoveUp = pane.visible && visibleIndex > 0;
                    const canMoveDown = pane.visible && visibleIndex >= 0 && visibleIndex < paneState.visiblePanes.length - 1;
                    return (_jsxs("div", { className: `gc-settings-pane${hidden ? " gc-settings-pane--hidden" : ""}${isSelected ? " gc-settings-pane--selected" : ""}`, onClick: () => onSelectedPaneIdChange(pane.id), role: "button", tabIndex: 0, children: [_jsxs("div", { className: "gc-settings-pane__head", children: [_jsxs("div", { children: [_jsxs("div", { className: "gc-settings-pane__label", children: [paneLabel(pane), pane.pinned ? _jsx("span", { className: "gc-settings-pill", children: t("settings.pinned") }) : null, isDefaultPane ? _jsx("span", { className: "gc-settings-pill", children: t("settings.defaultPane") }) : _jsx("span", { className: "gc-settings-pill gc-settings-pill--muted", children: t("settings.customPane") })] }), _jsx("div", { className: "gc-settings-pane__meta", children: t("settings.seriesMeta", { count: pane.series.length, ratio: Math.round(pane.heightRatio * 100) }) })] }), _jsxs("div", { className: "gc-settings-pane__actions", children: [_jsx("button", { type: "button", className: "gc-btn", onClick: (event) => { event.stopPropagation(); pane.visible ? paneState.toggleVisible(pane.id) : paneState.restorePane(pane.id); }, disabled: hidden && !paneState.canAddPane, children: pane.visible ? t("settings.hide") : t("settings.restore") }), _jsx("button", { type: "button", className: "gc-btn", onClick: (event) => { event.stopPropagation(); if (pane.visible)
                                                    paneState.toggleVisible(pane.id); }, disabled: pane.pinned || hidden, children: pane.pinned ? t("settings.locked") : t("settings.visible") }), !isDefaultPane ? (_jsx("button", { type: "button", className: "gc-btn gc-btn--danger", onClick: (event) => { event.stopPropagation(); handleDeletePane(pane); }, children: t("settings.deletePane") })) : null] })] }), !isDefaultPane ? (_jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t("settings.paneName") }), _jsx("input", { type: "text", className: "gc-settings-input", value: pane.label, onChange: (event) => paneState.renamePane(pane.id, event.target.value) })] })) : null, _jsxs("div", { className: "gc-settings-pane__footer", children: [_jsx("div", { className: "gc-settings-pane__tags", children: pane.series.map((series, index) => (_jsx("span", { className: "gc-tag", children: describeSeries(series, index) }, `${pane.id}-${series.type}-${index}`))) }), _jsxs("div", { className: "gc-settings-pane__arrows", children: [_jsx("button", { type: "button", className: "gc-btn", onClick: (event) => { event.stopPropagation(); paneState.reorderPanes(visibleIndex, visibleIndex - 1); }, disabled: !canMoveUp, children: "\u2191" }), _jsx("button", { type: "button", className: "gc-btn", onClick: (event) => { event.stopPropagation(); paneState.reorderPanes(visibleIndex, visibleIndex + 1); }, disabled: !canMoveDown, children: "\u2193" })] })] })] }, pane.id));
                }) }), overLimit ? _jsx("div", { className: "gc-settings-note gc-settings-note--warn", children: t("settings.overLimit") }) : null] }));
    const renderIndicatorsSection = () => (_jsxs("div", { className: "gc-settings-panel", children: [_jsxs("div", { className: "gc-settings-panel__header", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.indicatorKicker") }), _jsx("h3", { children: t("settings.indicatorEditor") })] }), _jsxs("label", { className: "gc-settings-field gc-settings-field--compact", children: [_jsx("span", { children: t("settings.pane") }), _jsx("select", { className: "gc-settings-select", value: selectedPane?.id ?? selectedPaneId, onChange: (event) => onSelectedPaneIdChange(event.target.value), children: paneState.panes.map((pane) => (_jsx("option", { value: pane.id, children: paneLabel(pane) }, pane.id))) })] })] }), selectedPane ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "gc-settings-pane-summary", children: [_jsxs("div", { className: "gc-settings-pane-summary__title", children: [paneLabel(selectedPane), selectedPane.pinned ? _jsx("span", { className: "gc-settings-pill", children: t("settings.pinned") }) : null, selectedPane.visible ? _jsx("span", { className: "gc-settings-pill gc-settings-pill--ok", children: t("settings.visible") }) : _jsx("span", { className: "gc-settings-pill gc-settings-pill--muted", children: t("settings.hidden") })] }), _jsx("div", { className: "gc-settings-note", children: t("settings.paneSummary") })] }), _jsx("div", { className: "gc-settings-series-list", children: selectedPane.series.map((series, seriesIndex) => {
                            const revealEnabled = selectedPane.visible || paneState.canAddPane;
                            return (_jsxs("div", { className: "gc-settings-series", children: [_jsxs("div", { className: "gc-settings-series__head", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-series__title", children: describeSeries(series, seriesIndex) }), _jsx("div", { className: "gc-settings-series__meta", children: series.visible === false ? t("settings.hidden") : t("settings.visible") })] }), _jsxs("label", { className: "gc-settings-field gc-settings-field--compact", children: [_jsx("span", { children: t("settings.yAxis") }), _jsxs("select", { className: "gc-settings-select", value: series.yAxis, onChange: (event) => paneState.updateSeriesYAxis(selectedPane.id, series.type, event.target.value, seriesIndex), children: [_jsx("option", { value: "left", children: t("settings.yAxisLeft") }), _jsx("option", { value: "right", children: t("settings.yAxisRight") })] })] }), _jsxs("div", { className: "gc-settings-series__actions", children: [_jsx("button", { type: "button", className: "gc-btn", onClick: () => paneState.toggleSeriesVisible(selectedPane.id, series.type, seriesIndex), disabled: !revealEnabled && series.visible === false, children: series.visible === false ? t("settings.visible") : t("settings.hide") }), _jsx("button", { type: "button", className: "gc-btn gc-btn--danger", onClick: () => paneState.removeSeries(selectedPane.id, series.type, seriesIndex), children: t("settings.remove") })] })] }), _jsx("div", { className: "gc-settings-series__params", children: renderSeriesParams(selectedPane, series, seriesIndex) })] }, `${selectedPane.id}-${series.type}-${seriesIndex}`));
                        }) }), _jsxs("div", { className: "gc-settings-composer", children: [_jsxs("div", { className: "gc-settings-composer__head", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.addIndicator") }), _jsx("h4", { children: t("settings.createIndicator") })] }), _jsx("button", { type: "button", className: "gc-btn gc-btn--accent", onClick: handleAddSeries, disabled: !composerEntry || (!selectedPane.visible && !paneState.canAddPane), children: t("settings.addIndicator") })] }), _jsxs("div", { className: "gc-settings-param-grid gc-settings-param-grid--three", children: [_jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t("settings.indicatorType") }), _jsx("select", { className: "gc-settings-select", value: resolvedComposerType, onChange: (event) => setComposerType(event.target.value), children: availableSeriesTypes.map((type) => (_jsx("option", { value: type, children: type }, type))) })] }), _jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t("settings.yAxis") }), _jsxs("select", { className: "gc-settings-select", value: composerYAxis, onChange: (event) => setComposerYAxis(event.target.value), children: [_jsx("option", { value: "left", children: t("settings.yAxisLeft") }), _jsx("option", { value: "right", children: t("settings.yAxisRight") })] })] }), _jsx("div", { className: "gc-settings-note gc-settings-note--tight", children: t("settings.composerNote") })] })] })] })) : (_jsx("div", { className: "gc-settings-empty", children: t("settings.noPane") }))] }));
    const renderIndicatorSetsSection = () => {
        const builtinSets = indicatorSets.builtinSets;
        const userSets = indicatorSets.userSets;
        const renderSetCard = (set, isBuiltin) => (_jsxs("div", { className: "gc-settings-series", children: [_jsxs("div", { className: "gc-settings-series__head", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-series__title", children: getIndicatorSetLabel(set) }), _jsx("div", { className: "gc-settings-series__meta", children: t("settings.setPaneCount", { count: set.panes.filter((pane) => pane.visible).length }) })] }), _jsxs("div", { className: "gc-settings-series__actions", children: [_jsx("button", { type: "button", className: "gc-btn gc-btn--accent", onClick: () => handleApplyIndicatorSet(set.id), children: t("settings.applySet") }), !isBuiltin ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "gc-btn", onClick: () => indicatorSets.exportSet(set.id), children: t("settings.exportSet") }), _jsx("button", { type: "button", className: "gc-btn gc-btn--danger", onClick: () => handleDeleteIndicatorSet(set.id), children: t("settings.deleteSet") })] })) : null] })] }), _jsx("div", { className: "gc-settings-pane__tags", children: set.panes.filter((pane) => pane.visible).map((pane) => (_jsx("span", { className: "gc-tag", children: getPaneLabel(pane.id, pane.label) }, `${set.id}-${pane.id}`))) })] }, set.id));
        return (_jsxs("div", { className: "gc-settings-panel", children: [_jsxs("div", { className: "gc-settings-panel__header", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.indicatorSetsKicker") }), _jsx("h3", { children: t("settings.indicatorSetsTitle") })] }), _jsx("button", { type: "button", className: "gc-btn gc-btn--accent", onClick: handleSaveCurrentIndicatorSet, children: t("settings.saveCurrentSet") })] }), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", children: [_jsxs("label", { className: "gc-settings-field", children: [_jsx("span", { children: t("settings.setName") }), _jsx("input", { type: "text", className: "gc-settings-input", value: indicatorSetName, placeholder: t("settings.setNamePlaceholder"), onChange: (event) => setIndicatorSetName(event.target.value) })] }), _jsxs("div", { className: "gc-settings-field gc-settings-field--compact", children: [_jsx("span", { children: t("settings.importSet") }), _jsx("button", { type: "button", className: "gc-btn", onClick: handleImportIndicatorSetClick, children: t("settings.importSet") }), _jsx("input", { ref: importInputRef, type: "file", accept: ".vnsc-set,application/json", style: { display: "none" }, onChange: handleImportIndicatorSetChange })] })] }), indicatorSetMessage ? _jsx("div", { className: "gc-settings-note", children: indicatorSetMessage }) : null, _jsx("div", { className: "gc-settings-panel__header gc-settings-panel__header--subtle", children: _jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.builtinSets") }), _jsx("h4", { children: t("settings.builtinSetsTitle") })] }) }), _jsx("div", { className: "gc-settings-series-list", children: builtinSets.map((set) => renderSetCard(set, true)) }), _jsx("div", { className: "gc-settings-panel__header gc-settings-panel__header--subtle", children: _jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.mySets") }), _jsx("h4", { children: t("settings.mySetsTitle") })] }) }), _jsx("div", { className: "gc-settings-series-list", children: userSets.length > 0
                        ? userSets.map((set) => renderSetCard(set, false))
                        : _jsx("div", { className: "gc-settings-empty", children: t("settings.noUserSets") }) })] }));
    };
    const renderThemeSection = () => (_jsxs("div", { className: "gc-settings-panel", children: [_jsxs("div", { className: "gc-settings-panel__header", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.themeKicker") }), _jsx("h3", { children: t("settings.appearanceShell") })] }), _jsx("button", { type: "button", className: "gc-btn gc-btn--accent", onClick: toggleTheme, children: isDark ? t("theme.switchToLight") : t("theme.switchToDark") })] }), _jsx("div", { className: "gc-settings-note", children: t("theme.shellMode", { mode: isDark ? t("theme.mode.dark") : t("theme.mode.light") }) }), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", style: { marginTop: 16 }, children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.priceMarkersKicker") }), _jsxs("div", { className: "gc-settings-field", style: { marginTop: 6 }, children: [_jsx("span", { children: t("settings.priceMarkers") }), _jsx("div", { className: "gc-settings-note gc-settings-note--tight", children: t("settings.priceMarkersNote") })] })] }), _jsx("button", { type: "button", className: `gc-btn${showDrawingPriceMarkers ? " gc-btn--accent" : ""}`, "aria-pressed": showDrawingPriceMarkers, onClick: () => onShowDrawingPriceMarkersChange(!showDrawingPriceMarkers), children: showDrawingPriceMarkers ? t("settings.visible") : t("settings.hidden") })] }), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", style: { marginTop: 12 }, children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.whale") }), _jsxs("div", { className: "gc-settings-field", style: { marginTop: 6 }, children: [_jsx("span", { children: t("settings.whale") }), _jsx("div", { className: "gc-settings-note gc-settings-note--tight", children: t("settings.whaleNote") })] })] }), _jsx("button", { type: "button", className: `gc-btn${enableWhale ? " gc-btn--accent" : ""}`, "aria-pressed": enableWhale, onClick: () => onEnableWhaleChange(!enableWhale), children: enableWhale ? t("settings.visible") : t("settings.hidden") })] }), enableWhale && (_jsx("div", { className: "gc-settings-row", style: { marginTop: 12 }, children: _jsxs("div", { className: "gc-settings-field", children: [_jsx("label", { htmlFor: "whale-threshold", style: { display: "block", marginBottom: 6 }, children: t("settings.whaleThreshold") }), _jsx("input", { id: "whale-threshold", type: "text", value: whaleThreshold.toLocaleString(), onChange: (e) => {
                                const numeric = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                                onWhaleThresholdChange(Number.isFinite(numeric) && numeric > 0 ? numeric : 1_000_000);
                            }, style: {
                                width: "100%",
                                padding: "6px 8px",
                                border: "1px solid var(--gc-border-color)",
                                borderRadius: "4px",
                                backgroundColor: isDark ? "#1a1a1a" : "#f9f9f9",
                                color: isDark ? "#fff" : "#000",
                                fontFamily: "monospace",
                                fontSize: "12px",
                            } })] }) })), _jsxs("div", { className: "gc-settings-row gc-settings-row--split", style: { marginTop: 16 }, children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.cvd") }), _jsx("div", { className: "gc-settings-field", style: { marginTop: 6 }, children: _jsx("span", { style: { fontSize: "12px", color: isDark ? "#aaa" : "#666" }, children: t("settings.cvdNote") }) })] }), _jsx("button", { type: "button", className: `gc-btn${enableCVD ? " gc-btn--accent" : ""}`, "aria-pressed": enableCVD, onClick: () => onEnableCVDChange(!enableCVD), children: enableCVD ? t("settings.visible") : t("settings.hidden") })] }), enableCVD && (_jsx("div", { className: "gc-settings-row", style: { marginTop: 12 }, children: _jsxs("div", { className: "gc-settings-field", children: [_jsx("label", { htmlFor: "cvd-mode", style: { display: "block", marginBottom: 6 }, children: t("settings.cvdMode") }), _jsxs("select", { id: "cvd-mode", value: cvdMode, onChange: (e) => onCVDModeChange(e.target.value), style: {
                                width: "100%",
                                padding: "6px 8px",
                                border: "1px solid var(--gc-border-color)",
                                borderRadius: "4px",
                                backgroundColor: isDark ? "#1a1a1a" : "#f9f9f9",
                                color: isDark ? "#fff" : "#000",
                                fontFamily: "inherit",
                                fontSize: "12px",
                            }, children: [_jsx("option", { value: "oscillator", children: t("settings.cvdOscillator") }), _jsx("option", { value: "histogram", children: t("settings.cvdHistogram") })] })] }) })), dataAdapterName !== undefined && onDataAdapterChange !== undefined && (_jsxs("div", { className: "gc-settings-row gc-settings-row--split", style: { marginTop: 16 }, children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.dataAdapterKicker") }), _jsx("div", { className: "gc-settings-field", style: { marginTop: 6 }, children: _jsx("span", { children: t("settings.dataAdapter") }) })] }), _jsxs("select", { className: "vnsc-candle-type-select", value: dataAdapterName, onChange: (e) => onDataAdapterChange(e.target.value), "aria-label": t("settings.dataAdapter"), children: [_jsx("option", { value: "binance", children: t("settings.dataAdapter.binance") }), _jsx("option", { value: "local", children: t("settings.dataAdapter.local") }), _jsx("option", { value: "vnstocks", children: t("settings.dataAdapter.vnstocks") })] })] }))] }));
    const renderResetSection = () => (_jsxs("div", { className: "gc-settings-panel", children: [_jsxs("div", { className: "gc-settings-panel__header", children: [_jsxs("div", { children: [_jsx("div", { className: "gc-settings-kicker", children: t("settings.resetKicker") }), _jsx("h3", { children: t("settings.resetDefaults") })] }), _jsx("button", { type: "button", className: "gc-btn gc-btn--danger", onClick: onReset, children: t("settings.resetLayout") })] }), _jsx("div", { className: "gc-settings-note", children: t("settings.resetNote") })] }));
    return (_jsx("div", { className: "gc-settings-backdrop", onMouseDown: handleBackdropMouseDown, children: _jsxs("div", { ref: dialogRef, className: "gc-settings-modal", role: "dialog", "aria-modal": "true", "aria-label": t("settings.dialogKicker"), children: [_jsxs("header", { className: "gc-settings-modal__header", children: [_jsx("div", { className: "gc-settings-modal__hero", children: _jsxs("div", { className: "gc-settings-modal__meta", children: [_jsx("span", { className: "gc-settings-badge gc-settings-badge--accent", children: sectionLabels[section] }), _jsx("span", { className: "gc-settings-badge", children: `${t("common.panes")} ${visibleCount}/${maxVisiblePanes}` }), selectedPane ? _jsx("span", { className: "gc-settings-badge", children: paneLabel(selectedPane) }) : null] }) }), _jsx("button", { type: "button", className: "gc-settings-modal__close", onClick: onClose, "aria-label": t("settings.dialogClose"), children: "\u00D7" })] }), _jsxs("div", { className: "gc-settings-modal__body", children: [_jsxs("nav", { className: "gc-settings-modal__nav", "aria-label": t("settings.manageSections"), children: [_jsx("div", { className: "gc-settings-modal__nav-head", children: _jsx("div", { className: "gc-settings-kicker", children: t("settings.manageSections") }) }), [
                                    ["layout", t("settings.layout")],
                                    ["indicators", t("settings.indicators")],
                                    ["indicatorSets", t("settings.indicatorSets")],
                                    ["theme", t("settings.theme")],
                                    ["reset", t("settings.reset")],
                                ].map(([nextSection, label]) => (_jsx("button", { type: "button", className: `gc-settings-modal__nav-item${section === nextSection ? " gc-settings-modal__nav-item--active" : ""}`, onClick: () => onSectionChange(nextSection), children: label }, nextSection)))] }), _jsx("div", { className: "gc-settings-modal__content", children: _jsxs("div", { className: "gc-settings-modal__surface", children: [section === "layout" ? renderLayoutSection() : null, section === "indicators" ? renderIndicatorsSection() : null, section === "indicatorSets" ? renderIndicatorSetsSection() : null, section === "theme" ? renderThemeSection() : null, section === "reset" ? renderResetSection() : null] }) })] })] }) }));
}
