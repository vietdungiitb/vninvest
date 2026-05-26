import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { overrideDrawingStyle, resolveDrawingStyle, saveDrawingTemplate, subscribeDrawingStyle } from "./drawingStyleRegistry.js";
import { isLineFamilyType, lineTypeFlagsFor, LINE_FAMILY_TYPES } from "./stateMachine.js";
function isColorString(value) {
    return typeof value === "string" && value.startsWith("#") ? value : "#ffffff";
}
function dashPatternFromStyle(value) {
    switch (value) {
        case "dashed":
            return [6, 4];
        case "dotted":
            return [2, 4];
        default:
            return [];
    }
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
    return (_jsxs("div", { className: "rsc-drawing-inspector__field", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("strong", { children: labels.alertTitle ?? "🔔 Cảnh báo" }), _jsx("input", { type: "checkbox", checked: enabled, disabled: locked, onChange: toggleEnabled, "aria-label": labels.alertEnabled ?? "Bật cảnh báo" }), _jsx("span", { style: { fontSize: 12 }, children: labels.alertEnabled ?? "Bật" })] }), enabled && (_jsxs("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }, children: [_jsxs("label", { style: { fontSize: 12 }, children: [labels.alertDirection ?? "Hướng kích hoạt", _jsxs("select", { value: direction, disabled: locked, style: { marginLeft: 8, fontSize: 12 }, onChange: (event) => setCondition({ direction: event.target.value }), children: [_jsx("option", { value: "crossAbove", children: labels.alertCrossAbove ?? "Cắt lên" }), _jsx("option", { value: "crossBelow", children: labels.alertCrossBelow ?? "Cắt xuống" }), _jsx("option", { value: "either", children: labels.alertEither ?? "Cả hai" })] })] }), _jsxs("label", { style: { fontSize: 12 }, children: [labels.alertCooldown ?? "Cooldown (giây)", _jsx("input", { type: "number", min: "5", max: "3600", step: "5", value: cooldownSec, disabled: locked, style: { marginLeft: 8, width: 64, fontSize: 12, padding: "1px 4px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }, onChange: (event) => setCondition({ cooldownMs: Number(event.target.value) * 1000 }), "aria-label": labels.alertCooldownSeconds ?? "giây" }), " ", labels.alertCooldownSeconds ?? "giây"] })] }))] }));
}
export default function DrawingInspector({ drawing, labels, textEditor, position, onUpdate, onDelete, onClone, onToggleLock, onToggleVisible, onBringToFront, onSendToBack, onClose, }) {
    const [, setStyleRevision] = useState(0);
    const [newLevelRatio, setNewLevelRatio] = useState("");
    const newLevelInputRef = useRef(null);
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
    return (_jsxs("div", { className: "rsc-drawing-inspector", style: { left, top }, role: "toolbar", "aria-label": labels.title, children: [_jsxs("div", { className: "rsc-drawing-inspector__header", children: [_jsxs("div", { className: "rsc-drawing-inspector__title", children: [_jsx("strong", { children: labels.title }), _jsx("span", { children: drawing.type })] }), _jsx("button", { type: "button", className: "rsc-drawing-inspector__icon", onClick: onClose, "aria-label": labels.close, children: "x" })] }), _jsxs("div", { className: "rsc-drawing-inspector__swatches", children: [_jsxs("label", { className: "rsc-drawing-inspector__field", children: [_jsx("span", { children: labels.stroke }), _jsx("input", { type: "color", value: isColorString(style.stroke), onChange: (event) => overrideDrawingStyle(drawing.id, { color: event.target.value }), "aria-label": labels.stroke })] }), _jsxs("label", { className: "rsc-drawing-inspector__field", children: [_jsx("span", { children: labels.fill }), _jsx("input", { type: "color", value: isColorString(style.fill), onChange: (event) => onUpdate(updateStyle(drawing, { fill: event.target.value })), "aria-label": labels.fill })] })] }), _jsx("div", { className: "rsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.strokeWidth }), _jsx("input", { type: "range", min: "1", max: "5", step: "1", value: style.strokeWidth, onChange: (event) => overrideDrawingStyle(drawing.id, { lineWidth: Number(event.target.value) }), "aria-label": labels.strokeWidth })] }) }), _jsx("div", { className: "rsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.lineStyle }), _jsxs("select", { value: strokeDasharray, onChange: (event) => overrideDrawingStyle(drawing.id, { dashPattern: dashPatternFromStyle(event.target.value) }), "aria-label": labels.lineStyle, children: [_jsx("option", { value: "solid", children: labels.solid }), _jsx("option", { value: "dashed", children: labels.dashed }), _jsx("option", { value: "dotted", children: labels.dotted })] })] }) }), _jsx("div", { className: "rsc-drawing-inspector__field", children: _jsxs("label", { children: [_jsx("span", { children: labels.opacity }), _jsx("input", { type: "range", min: "0.1", max: "1", step: "0.05", value: style.opacity ?? 1, onChange: (event) => overrideDrawingStyle(drawing.id, { opacity: Number(event.target.value) }), "aria-label": labels.opacity })] }) }), isLineFamilyType(drawing.type) && labels.lineTypeLabel && (_jsxs("div", { className: "rsc-drawing-inspector__field", children: [_jsx("span", { children: labels.lineTypeLabel }), _jsx("div", { className: "rsc-drawing-inspector__radio-group", role: "radiogroup", "aria-label": labels.lineTypeLabel, children: LINE_FAMILY_TYPES.map((lt) => {
                            const labelText = lt === "trendLine" ? (labels.lineTypeTrendLine ?? "Đoạn thẳng") :
                                lt === "ray" ? (labels.lineTypeRay ?? "Tia") :
                                    (labels.lineTypeExtendedLine ?? "Đường thẳng");
                            return (_jsxs("label", { className: "rsc-drawing-inspector__radio-option", children: [_jsx("input", { type: "radio", name: `drawing-line-type-${drawing.id}`, value: lt, checked: drawing.type === lt, disabled: locked, onChange: () => onUpdate(lineTypeFlagsFor(lt)) }), labelText] }, lt));
                        }) })] })), (drawing.type === "fibonacci" || drawing.type === "fibExtension") && drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0 && (_jsxs("div", { className: "rsc-drawing-inspector__field", children: [_jsx("strong", { children: labels.fibLevelsTitle ?? "Các mức Fibonacci" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }, children: drawing.fibLevelConfigs.map((cfg, idx) => {
                            const configs = drawing.fibLevelConfigs;
                            return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: cfg.visible, disabled: locked, "aria-label": `${(cfg.ratio * 100).toFixed(1)}%`, onChange: () => {
                                            const updated = configs.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c);
                                            onUpdate({ fibLevelConfigs: updated });
                                        } }), _jsxs("span", { style: { minWidth: 48, fontSize: 11 }, children: [(cfg.ratio * 100).toFixed(1), "%"] }), _jsx("input", { type: "color", value: cfg.color ?? drawing.style.stroke, disabled: locked, style: { width: 24, height: 24, cursor: "pointer", border: "none", padding: 0, background: "none" }, "aria-label": `color-${(cfg.ratio * 100).toFixed(1)}`, onChange: (event) => {
                                            const updated = configs.map((c, i) => i === idx ? { ...c, color: event.target.value } : c);
                                            onUpdate({ fibLevelConfigs: updated });
                                        } }), _jsx("button", { type: "button", className: "rsc-drawing-inspector__button rsc-drawing-inspector__button--danger", style: { padding: "1px 6px", fontSize: 11 }, disabled: locked || configs.length <= 1, onClick: () => {
                                            const updated = configs.filter((_, i) => i !== idx);
                                            onUpdate({ fibLevelConfigs: updated });
                                        }, children: labels.fibRemoveLevel ?? "Xóa" })] }, idx));
                        }) }), !locked && (_jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: [_jsx("input", { ref: newLevelInputRef, type: "number", min: "0", max: "10", step: "0.001", value: newLevelRatio, placeholder: "0.5", style: { width: 72, padding: "2px 6px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }, onChange: (event) => setNewLevelRatio(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addNewFibLevel();
                                    }
                                }, "aria-label": labels.fibAddLevel ?? "Thêm mức" }), _jsx("button", { type: "button", className: "rsc-drawing-inspector__button", style: { fontSize: 11 }, onClick: addNewFibLevel, children: labels.fibAddLevel ?? "Thêm mức" })] }))] })), _jsxs("div", { className: "rsc-drawing-inspector__actions", children: [_jsxs("button", { type: "button", onClick: onToggleLock, className: "rsc-drawing-inspector__button", children: ["\t\t\t\t\t", locked ? labels.unlock : labels.lock] }), "\t\t\t\t", _jsx("button", { type: "button", onClick: onClone, className: "rsc-drawing-inspector__button", children: labels.clone }), _jsx("button", { type: "button", onClick: onToggleVisible, className: "rsc-drawing-inspector__button", children: visible ? labels.hide : labels.show }), _jsx("button", { type: "button", onClick: onBringToFront, className: "rsc-drawing-inspector__button", children: labels.bringToFront }), _jsx("button", { type: "button", onClick: onSendToBack, className: "rsc-drawing-inspector__button", children: labels.sendToBack }), _jsx("button", { type: "button", onClick: onDelete, className: "rsc-drawing-inspector__button rsc-drawing-inspector__button--danger", disabled: locked, children: labels.delete }), labels.saveStyle && (_jsx("button", { type: "button", className: "rsc-drawing-inspector__button", onClick: () => saveDrawingTemplate(drawing.type, style), children: labels.saveStyle }))] }), _jsx(DrawingAlertPanel, { drawing: drawing, labels: labels, locked: locked, onUpdate: onUpdate }), drawing.type === "text" && textEditor && (_jsxs("div", { className: "rsc-drawing-inspector__field", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }, children: [_jsx("strong", { children: textEditor.labels.title }), !textEditor.active && (_jsx("button", { type: "button", className: "rsc-drawing-inspector__button", onClick: textEditor.onStartEdit, disabled: locked, children: textEditor.labels.edit }))] }), _jsx("span", { children: textEditor.labels.label }), textEditor.active ? (_jsxs(_Fragment, { children: [_jsx("textarea", { value: textEditor.value, placeholder: textEditor.labels.placeholder, onChange: (event) => textEditor.onChange(event.target.value), onKeyDown: (event) => {
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
                                } }), _jsxs("div", { className: "rsc-drawing-inspector__actions", children: [_jsx("button", { type: "button", className: "rsc-drawing-inspector__button", onClick: textEditor.onCommit, children: textEditor.labels.save }), _jsx("button", { type: "button", className: "rsc-drawing-inspector__button", onClick: textEditor.onCancel, children: textEditor.labels.cancel })] })] })) : (_jsx("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.5, opacity: 0.92, marginTop: 6 }, children: drawing.text?.trim().length ? drawing.text : textEditor.labels.empty }))] }))] }));
}
