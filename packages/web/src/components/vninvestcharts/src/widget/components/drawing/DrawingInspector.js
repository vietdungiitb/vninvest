import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { resolveDrawingStyle, saveDrawingTemplate, subscribeDrawingStyle } from "../../../lib/drawing/drawingStyleRegistry.js";
import { listTemplates, saveTemplate, deleteTemplate, loadTemplateData } from "../../../lib/drawing/drawingTemplateStorage.js";
import { isLineFamilyType, lineTypeFlagsFor, LINE_FAMILY_TYPES } from "../../../lib/drawing/stateMachine.js";
import { getSegmentKeys, hasSubSegments } from "../../../lib/drawing/segmentRegistry.js";
const FIB_TOOLS_WITH_LEVEL_CONFIGS = new Set([
    "fibonacci",
    "fibExtension",
    "fibArc",
    "fibTimeZone",
    "fibChannel",
    "fibSpeedResistanceFan",
    "fibCircles",
    "trendBasedFibTime",
    "fibWedge",
]);
function isColorString(value) {
    return typeof value === "string" && value.startsWith("#") ? value : "#ffffff";
}
function updateStyle(drawing, patch) {
    return {
        style: {
            ...drawing.style,
            ...patch,
        },
    };
}
/** DT-10-T06: Alert configuration sub-panel shown inside DrawingInspector. */
function DrawingAlertPanel({ drawing, labels, locked, onUpdate, }) {
    const condition = drawing.alertCondition;
    const enabled = condition?.enabled ?? false;
    const direction = condition?.direction ?? "either";
    const cooldownSec = Math.round((condition?.cooldownMs ?? 60_000) / 1000);
    function setCondition(patch) {
        const next = {
            enabled,
            direction,
            cooldownMs: cooldownSec * 1000,
            triggeredAt: condition?.triggeredAt,
            ...condition,
            ...patch,
        };
        onUpdate({ alertCondition: next });
    }
    function toggleEnabled() {
        setCondition({ enabled: !enabled });
    }
    return (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("strong", { children: labels.alertTitle ?? "🔔 Alert" }), _jsx("input", { type: "checkbox", checked: enabled, disabled: locked, onChange: toggleEnabled, "aria-label": labels.alertEnabled ?? "Enable alert" }), _jsx("span", { style: { fontSize: 12 }, children: labels.alertEnabled ?? "Enable" })] }), enabled && (_jsxs("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }, children: [_jsxs("label", { style: { fontSize: 12 }, children: [labels.alertDirection ?? "Trigger direction", _jsxs("select", { value: direction, disabled: locked, style: { marginLeft: 8, fontSize: 12 }, onChange: (event) => setCondition({ direction: event.target.value }), children: [_jsx("option", { value: "crossAbove", children: labels.alertCrossAbove ?? "Cross above" }), _jsx("option", { value: "crossBelow", children: labels.alertCrossBelow ?? "Cross below" }), _jsx("option", { value: "either", children: labels.alertEither ?? "Either" })] })] }), _jsxs("label", { style: { fontSize: 12 }, children: [labels.alertCooldown ?? "Cooldown (sec)", _jsx("input", { type: "number", min: "5", max: "3600", step: "5", value: cooldownSec, disabled: locked, style: { marginLeft: 8, width: 64, fontSize: 12, padding: "1px 4px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }, onChange: (event) => setCondition({ cooldownMs: Number(event.target.value) * 1000 }), "aria-label": labels.alertCooldownSeconds ?? "sec" }), " ", labels.alertCooldownSeconds ?? "sec"] })] }))] }));
}
export default function DrawingInspector({ drawing, labels, textEditor, embedded = false, position, plotData = [], onUpdate, onDelete, onClone, onToggleLock, onToggleVisible, onBringToFront, onSendToBack, onClose, }) {
    const [, setStyleRevision] = useState(0);
    const [activeTab, setActiveTab] = useState("style");
    const [templatesList, setTemplatesList] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newLevelRatio, setNewLevelRatio] = useState("");
    const newLevelInputRef = useRef(null);
    useEffect(() => {
        if (drawing) {
            setTemplatesList(listTemplates(drawing.type));
            setSelectedTemplate("");
            setNewTemplateName("");
        }
    }, [drawing?.type]);
    const handleSaveTemplate = () => {
        if (!drawing)
            return;
        const name = newTemplateName.trim();
        if (!name)
            return;
        saveTemplate(drawing.type, name, resolveDrawingStyle(drawing), { segmentStyles: drawing.segmentStyles, segmentVisible: drawing.segmentVisible });
        const updatedList = listTemplates(drawing.type);
        setTemplatesList(updatedList);
        setSelectedTemplate(name);
        setNewTemplateName("");
    };
    const handleDeleteTemplate = () => {
        if (!drawing || !selectedTemplate)
            return;
        deleteTemplate(drawing.type, selectedTemplate);
        const updatedList = listTemplates(drawing.type);
        setTemplatesList(updatedList);
        setSelectedTemplate("");
    };
    const handleLoadTemplate = () => {
        if (!drawing || !selectedTemplate)
            return;
        const template = loadTemplateData(drawing.type, selectedTemplate);
        if (template) {
            onUpdate({ style: { ...drawing.style, ...template.style }, ...(template.segmentStyles ? { segmentStyles: template.segmentStyles } : {}), ...(template.segmentVisible ? { segmentVisible: template.segmentVisible } : {}) });
        }
    };
    useEffect(() => {
        if (!drawing) {
            return undefined;
        }
        return subscribeDrawingStyle(drawing.id, () => {
            setStyleRevision((value) => value + 1);
        });
    }, [drawing]);
    if (!drawing) {
        return null;
    }
    function addNewFibLevel() {
        if (!drawing)
            return;
        const parsed = parseFloat(newLevelRatio);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10)
            return;
        const configs = drawing.fibLevelConfigs ?? [];
        if (configs.some((c) => Math.abs(c.ratio - parsed) < 0.0001))
            return; // duplicate guard
        const updated = [...configs, { ratio: parsed, visible: true }];
        onUpdate({ fibLevelConfigs: updated });
        setNewLevelRatio("");
        newLevelInputRef.current?.focus();
    }
    const effectiveDrawing = {
        ...drawing,
        style: resolveDrawingStyle(drawing),
    };
    const style = effectiveDrawing.style;
    const locked = drawing.locked === true;
    const visible = drawing.visible !== false;
    const strokeDasharray = style.strokeDasharray ?? "solid";
    const left = position?.x ?? 16;
    const top = position?.y ?? 16;
    return (_jsxs("div", { className: `vnsc-drawing-inspector${embedded ? " vnsc-drawing-inspector--embedded" : ""}`, style: embedded ? undefined : { left, top }, role: "toolbar", "aria-label": labels.title, children: [_jsxs("div", { className: "vnsc-drawing-inspector__header", children: [_jsxs("div", { className: "vnsc-drawing-inspector__title", children: [_jsx("strong", { children: labels.title }), _jsx("span", { children: drawing.type })] }), _jsx("button", { type: "button", className: "vnsc-drawing-inspector__icon", onClick: onClose, "aria-label": labels.close, children: "x" })] }), _jsxs("div", { className: "vnsc-drawing-inspector__tabs", style: { display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "12px", background: "rgba(0,0,0,0.15)" }, children: [_jsx("button", { type: "button", style: {
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: activeTab === "style" ? "rgba(255,255,255,0.05)" : "transparent",
                            border: "none",
                            borderBottom: activeTab === "style" ? "2px solid #0891b2" : "none",
                            color: activeTab === "style" ? "#fff" : "#888",
                            cursor: "pointer",
                            outline: "none"
                        }, onClick: () => setActiveTab("style"), children: labels.title }), _jsx("button", { type: "button", style: {
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: activeTab === "coordinates" ? "rgba(255,255,255,0.05)" : "transparent",
                            border: "none",
                            borderBottom: activeTab === "coordinates" ? "2px solid #0891b2" : "none",
                            color: activeTab === "coordinates" ? "#fff" : "#888",
                            cursor: "pointer",
                            outline: "none"
                        }, onClick: () => setActiveTab("coordinates"), children: labels.coordinatesTitle ?? "Coordinates" }), _jsx("button", { type: "button", style: {
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: activeTab === "templates" ? "rgba(255,255,255,0.05)" : "transparent",
                            border: "none",
                            borderBottom: activeTab === "templates" ? "2px solid #0891b2" : "none",
                            color: activeTab === "templates" ? "#fff" : "#888",
                            cursor: "pointer",
                            outline: "none"
                        }, onClick: () => setActiveTab("templates"), children: labels.templatesTitle ?? "Templates" })] }), activeTab === "style" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "vnsc-drawing-inspector__swatches", children: [_jsxs("label", { className: "vnsc-drawing-inspector__field", children: [_jsx("span", { children: labels.stroke }), _jsx("input", { type: "color", value: isColorString(style.stroke), onChange: (event) => onUpdate(updateStyle(drawing, { stroke: event.target.value })), "aria-label": labels.stroke })] }), _jsxs("label", { className: "vnsc-drawing-inspector__field", children: [_jsx("span", { children: labels.fill }), _jsx("input", { type: "color", value: isColorString(style.fill), onChange: (event) => onUpdate(updateStyle(drawing, { fill: event.target.value })), "aria-label": labels.fill })] })] }), _jsx("div", { className: "vnsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.strokeWidth }), _jsx("input", { type: "range", min: "1", max: "5", step: "1", value: style.strokeWidth, onChange: (event) => onUpdate(updateStyle(drawing, { strokeWidth: Number(event.target.value) })), "aria-label": labels.strokeWidth })] }) }), _jsx("div", { className: "vnsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.lineStyle }), _jsxs("select", { value: strokeDasharray, onChange: (event) => onUpdate(updateStyle(drawing, { strokeDasharray: event.target.value })), "aria-label": labels.lineStyle, children: [_jsx("option", { value: "solid", children: labels.solid }), _jsx("option", { value: "dashed", children: labels.dashed }), _jsx("option", { value: "dotted", children: labels.dotted })] })] }) }), _jsx("div", { className: "vnsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.opacity }), _jsx("input", { type: "range", min: "0.1", max: "1", step: "0.05", value: style.opacity ?? 1, onChange: (event) => onUpdate(updateStyle(drawing, { opacity: Number(event.target.value) })), "aria-label": labels.opacity })] }) }), isLineFamilyType(drawing.type) && labels.lineTypeLabel && (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsx("span", { children: labels.lineTypeLabel }), _jsx("div", { className: "vnsc-drawing-inspector__radio-group", role: "radiogroup", "aria-label": labels.lineTypeLabel, children: LINE_FAMILY_TYPES.map((lt) => {
                                    const labelText = lt === "trendLine" ? (labels.lineTypeTrendLine ?? "Segment") :
                                        lt === "ray" ? (labels.lineTypeRay ?? "Ray") :
                                            (labels.lineTypeExtendedLine ?? "Line");
                                    return (_jsxs("label", { className: "vnsc-drawing-inspector__radio-option", children: [_jsx("input", { type: "radio", name: `drawing-line-type-${drawing.id}`, value: lt, checked: drawing.type === lt, disabled: locked, onChange: () => onUpdate(lineTypeFlagsFor(lt)) }), labelText] }, lt));
                                }) })] })), (drawing.type === "trendLine" || drawing.type === "channel") && (_jsxs("label", { className: "vnsc-drawing-inspector__field", style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: drawing.showMeasurement === true, disabled: locked, onChange: () => onUpdate({ showMeasurement: !drawing.showMeasurement }) }), _jsx("span", { children: "Show permanent measure" })] })), FIB_TOOLS_WITH_LEVEL_CONFIGS.has(drawing.type) && drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0 && (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsx("strong", { children: labels.fibLevelsTitle ?? "Fibonacci Levels" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }, children: drawing.fibLevelConfigs.map((cfg, idx) => {
                                    const configs = drawing.fibLevelConfigs;
                                    return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: cfg.visible, disabled: locked, "aria-label": `${(cfg.ratio * 100).toFixed(1)}%`, onChange: () => {
                                                    const updated = configs.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c);
                                                    onUpdate({ fibLevelConfigs: updated });
                                                } }), _jsxs("span", { style: { minWidth: 48, fontSize: 11 }, children: [(cfg.ratio * 100).toFixed(1), "%"] }), _jsx("input", { type: "color", value: cfg.color ?? drawing.style.stroke, disabled: locked, style: { width: 24, height: 24, cursor: "pointer", border: "none", padding: 0, background: "none" }, "aria-label": `color-${(cfg.ratio * 100).toFixed(1)}`, onChange: (event) => {
                                                    const updated = configs.map((c, i) => i === idx ? { ...c, color: event.target.value } : c);
                                                    onUpdate({ fibLevelConfigs: updated });
                                                } }), _jsx("button", { type: "button", className: "vnsc-drawing-inspector__button vnsc-drawing-inspector__button--danger", style: { padding: "1px 6px", fontSize: 11 }, disabled: locked || configs.length <= 1, onClick: () => {
                                                    const updated = configs.filter((_, i) => i !== idx);
                                                    onUpdate({ fibLevelConfigs: updated });
                                                }, children: labels.fibRemoveLevel ?? "Delete" })] }, idx));
                                }) }), !locked && (_jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: [_jsx("input", { ref: newLevelInputRef, type: "number", min: "0", max: "10", step: "0.001", value: newLevelRatio, placeholder: "0.5", style: { width: 72, padding: "2px 6px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }, onChange: (event) => setNewLevelRatio(event.target.value), onKeyDown: (event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                addNewFibLevel();
                                            }
                                        }, "aria-label": labels.fibAddLevel ?? "Add level" }), _jsx("button", { type: "button", className: "vnsc-drawing-inspector__button", style: { fontSize: 11 }, onClick: addNewFibLevel, children: labels.fibAddLevel ?? "Add level" })] }))] })), (drawing.type === "longPosition" || drawing.type === "shortPosition") && (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsx("strong", { style: { fontSize: 12 }, children: labels.rrTitle ?? "Order Entry" }), ["entry", "stop", "target"].map((field) => {
                                const fieldLabel = field === "entry" ? (labels.rrEntry ?? "Entry") :
                                    field === "stop" ? (labels.rrStop ?? "Stop") :
                                        (labels.rrTarget ?? "Target");
                                const currentValue = drawing.riskReward?.[field] ?? "";
                                return (_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }, children: [_jsx("span", { style: { width: 44, flexShrink: 0 }, children: fieldLabel }), _jsx("input", { type: "number", step: "any", min: "0.001", value: currentValue, disabled: locked, style: { flex: 1, minWidth: 0, fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)", background: "transparent", color: "inherit" }, onChange: (e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!Number.isFinite(val) || val <= 0)
                                                    return;
                                                const rr = { ...(drawing.riskReward ?? { entry: 0, stop: 0, target: 0 }) };
                                                rr[field] = val;
                                                onUpdate({ riskReward: rr });
                                            } })] }, field));
                            }), (() => {
                                const rr = drawing.riskReward;
                                if (!rr || !rr.entry || !rr.stop || !rr.target)
                                    return null;
                                const risk = Math.abs(rr.entry - rr.stop);
                                const reward = Math.abs(rr.target - rr.entry);
                                const ratio = risk > 0 ? (reward / risk).toFixed(1) : "n/a";
                                return _jsxs("span", { style: { fontSize: 11, marginTop: 4, opacity: 0.7, display: "block" }, children: ["R/R 1:", ratio] });
                            })()] })), hasSubSegments(drawing.type) && (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsx("strong", { style: { fontSize: 12 }, children: labels.segmentsTitle ?? "Segments" }), getSegmentKeys(drawing.type).map((key) => {
                                const segStyle = drawing.segmentStyles?.[key];
                                const segVisible = drawing.segmentVisible?.[key] !== false;
                                const currentColor = segStyle?.stroke ?? drawing.style.stroke;
                                return (_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }, children: [_jsx("input", { type: "checkbox", checked: segVisible, disabled: locked, onChange: (e) => {
                                                onUpdate({ segmentVisible: { ...(drawing.segmentVisible ?? {}), [key]: e.target.checked } });
                                            } }), _jsx("span", { style: { flex: 1 }, children: key }), _jsx("input", { type: "color", value: currentColor, disabled: locked, style: { width: 28, height: 24, padding: 1, border: "none", background: "none", cursor: locked ? "default" : "pointer" }, onChange: (e) => {
                                                onUpdate({ segmentStyles: { ...(drawing.segmentStyles ?? {}), [key]: { ...(drawing.segmentStyles?.[key] ?? {}), stroke: e.target.value } } });
                                            } })] }, key));
                            })] })), _jsxs("div", { className: "vnsc-drawing-inspector__actions", children: [_jsx("button", { type: "button", onClick: onClone, className: "vnsc-drawing-inspector__button", children: labels.clone }), _jsx("button", { type: "button", onClick: onToggleVisible, className: "vnsc-drawing-inspector__button", children: visible ? labels.hide : labels.show }), _jsx("button", { type: "button", onClick: onBringToFront, className: "vnsc-drawing-inspector__button", children: labels.bringToFront }), _jsx("button", { type: "button", onClick: onSendToBack, className: "vnsc-drawing-inspector__button", children: labels.sendToBack }), _jsx("button", { type: "button", onClick: onDelete, className: "vnsc-drawing-inspector__button vnsc-drawing-inspector__button--danger", disabled: locked, children: labels.delete }), labels.saveStyle && (_jsx("button", { type: "button", className: "vnsc-drawing-inspector__button", onClick: () => { saveDrawingTemplate(drawing.type, style, { segmentStyles: drawing.segmentStyles, segmentVisible: drawing.segmentVisible }); }, children: labels.saveStyle }))] }), _jsx(DrawingAlertPanel, { drawing: drawing, labels: labels, locked: locked, onUpdate: onUpdate }), ["text", "callout", "priceLabel"].includes(drawing.type) && textEditor && (_jsxs("div", { className: "vnsc-drawing-inspector__field", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }, children: [_jsx("strong", { children: textEditor.labels.title }), !textEditor.active && (_jsx("button", { type: "button", className: "vnsc-drawing-inspector__button", onClick: textEditor.onStartEdit, disabled: locked, children: textEditor.labels.edit }))] }), _jsx("span", { children: textEditor.labels.label }), textEditor.active ? (_jsxs(_Fragment, { children: [_jsx("textarea", { value: textEditor.value, placeholder: textEditor.labels.placeholder, onChange: (event) => textEditor.onChange(event.target.value), onKeyDown: (event) => {
                                            if (event.key === "Escape") {
                                                event.preventDefault();
                                                textEditor.onCancel();
                                                return;
                                            }
                                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                                                event.preventDefault();
                                                textEditor.onCommit();
                                            }
                                        }, rows: 4, style: {
                                            width: "100%",
                                            resize: "vertical",
                                            borderRadius: 10,
                                            border: "1px solid rgba(148, 163, 184, 0.36)",
                                            padding: "10px 12px",
                                            font: "inherit",
                                            background: "rgba(15, 23, 42, 0.04)",
                                            color: "inherit",
                                        } }), _jsxs("div", { className: "vnsc-drawing-inspector__actions", children: [_jsx("button", { type: "button", className: "vnsc-drawing-inspector__button", onClick: textEditor.onCommit, children: textEditor.labels.save }), _jsx("button", { type: "button", className: "vnsc-drawing-inspector__button", onClick: textEditor.onCancel, children: textEditor.labels.cancel })] })] })) : (_jsx("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.5, opacity: 0.92, marginTop: 6 }, children: drawing.text?.trim().length ? drawing.text : textEditor.labels.empty }))] }))] })), activeTab === "coordinates" && (_jsx("div", { className: "vnsc-drawing-inspector__coordinates", style: { display: "flex", flexDirection: "column", padding: "0 12px 12px 12px", maxHeight: "320px", overflowY: "auto" }, children: drawing.points.map((point, index) => {
                    const pointLabel = drawing.waveLabels?.[index] || `Point ${index + 1}`;
                    const dateVal = new Date(point.x);
                    const timeString = Number.isFinite(dateVal.getTime())
                        ? new Date(dateVal.getTime() - dateVal.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                        : "";
                    return (_jsxs("div", { style: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }, children: [_jsx("span", { style: { fontSize: "11px", fontWeight: "bold", color: "#0891b2", display: "block", marginBottom: 6 }, children: pointLabel }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsxs("label", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: "10px", color: "#a3a3a3" }, children: [labels.priceLabel ?? "Price", _jsx("input", { type: "number", step: "any", value: point.y, disabled: locked, style: {
                                                    width: "100%",
                                                    padding: "4px 6px",
                                                    fontSize: "11px",
                                                    background: "rgba(0,0,0,0.3)",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    borderRadius: "4px",
                                                    color: "#fff",
                                                    outline: "none"
                                                }, onChange: (e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (!Number.isFinite(val))
                                                        return;
                                                    const nextPoints = [...drawing.points];
                                                    nextPoints[index] = { ...point, y: val };
                                                    onUpdate({ points: nextPoints });
                                                } })] }), _jsxs("label", { style: { flex: 1.2, display: "flex", flexDirection: "column", gap: 4, fontSize: "10px", color: "#a3a3a3" }, children: [labels.timeLabel ?? "Time", _jsx("input", { type: "datetime-local", value: timeString, disabled: locked, style: {
                                                    width: "100%",
                                                    padding: "3px 4px",
                                                    fontSize: "11px",
                                                    background: "rgba(0,0,0,0.3)",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    borderRadius: "4px",
                                                    color: "#fff",
                                                    outline: "none"
                                                }, onChange: (e) => {
                                                    const mappedX = validateAndMapXCoordinate(e.target.value, plotData);
                                                    if (mappedX !== null) {
                                                        const nextPoints = [...drawing.points];
                                                        nextPoints[index] = { ...point, x: mappedX };
                                                        onUpdate({ points: nextPoints });
                                                    }
                                                } })] })] })] }, index));
                }) })), activeTab === "templates" && (_jsxs("div", { className: "vnsc-drawing-inspector__templates-tab", style: { display: "flex", flexDirection: "column", gap: "12px", padding: "0 12px 12px 12px" }, children: [_jsxs("div", { className: "vnsc-drawing-inspector__field", style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("label", { htmlFor: "inspector-template-select", style: { fontSize: "11px", fontWeight: "bold", color: "#888" }, children: labels.templatesLoad ?? "Load Template" }), _jsxs("div", { style: { display: "flex", gap: "6px" }, children: [_jsxs("select", { id: "inspector-template-select", value: selectedTemplate, onChange: (e) => setSelectedTemplate(e.target.value), style: {
                                            flex: 1,
                                            background: "rgba(30, 41, 59, 0.9)",
                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                            borderRadius: "4px",
                                            padding: "6px 8px",
                                            color: "#fff",
                                            fontSize: "12px",
                                        }, children: [_jsx("option", { value: "", children: "-- Select template --" }), templatesList.map((name) => (_jsx("option", { value: name, children: name }, name)))] }), _jsx("button", { type: "button", onClick: handleLoadTemplate, disabled: !selectedTemplate || locked, style: {
                                            background: selectedTemplate ? "#0891b2" : "rgba(255,255,255,0.05)",
                                            border: "none",
                                            borderRadius: "4px",
                                            padding: "6px 12px",
                                            color: selectedTemplate ? "#fff" : "#666",
                                            fontSize: "12px",
                                            cursor: selectedTemplate ? "pointer" : "default",
                                        }, children: labels.templatesLoad ?? "Load" }), _jsx("button", { type: "button", onClick: handleDeleteTemplate, disabled: !selectedTemplate || locked, style: {
                                            background: selectedTemplate ? "#ef5350" : "rgba(255,255,255,0.05)",
                                            border: "none",
                                            borderRadius: "4px",
                                            padding: "6px 12px",
                                            color: selectedTemplate ? "#fff" : "#666",
                                            fontSize: "12px",
                                            cursor: selectedTemplate ? "pointer" : "default",
                                        }, children: labels.templatesDelete ?? "Delete" })] })] }), _jsx("div", { style: { height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" } }), _jsxs("div", { className: "vnsc-drawing-inspector__field", style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [_jsx("label", { htmlFor: "inspector-template-new-name", style: { fontSize: "11px", fontWeight: "bold", color: "#888" }, children: labels.templatesSave ?? "Save As" }), _jsxs("div", { style: { display: "flex", gap: "6px" }, children: [_jsx("input", { id: "inspector-template-new-name", type: "text", placeholder: labels.templatesNamePlaceholder ?? "New template name...", value: newTemplateName, disabled: locked, onChange: (e) => setNewTemplateName(e.target.value), style: {
                                            flex: 1,
                                            background: "rgba(30, 41, 59, 0.9)",
                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                            borderRadius: "4px",
                                            padding: "6px 8px",
                                            color: "#fff",
                                            fontSize: "12px",
                                        } }), _jsx("button", { type: "button", onClick: handleSaveTemplate, disabled: !newTemplateName.trim() || locked, style: {
                                            background: newTemplateName.trim() ? "#0891b2" : "rgba(255,255,255,0.05)",
                                            border: "none",
                                            borderRadius: "4px",
                                            padding: "6px 12px",
                                            color: newTemplateName.trim() ? "#fff" : "#666",
                                            fontSize: "12px",
                                            cursor: newTemplateName.trim() ? "pointer" : "default",
                                        }, children: labels.templatesSave ?? "Save" })] })] })] }))] }));
}
function validateAndMapXCoordinate(inputTimeString, plotData) {
    if (!inputTimeString)
        return null;
    const T = new Date(inputTimeString).getTime();
    if (!Number.isFinite(T) || plotData.length === 0)
        return null;
    let nearestBar = plotData[0];
    let minDiff = Math.abs(new Date(plotData[0].date).getTime() - T);
    for (const bar of plotData) {
        const barTime = new Date(bar.date).getTime();
        const diff = Math.abs(barTime - T);
        if (diff < minDiff) {
            minDiff = diff;
            nearestBar = bar;
        }
    }
    return new Date(nearestBar.date).getTime();
}
