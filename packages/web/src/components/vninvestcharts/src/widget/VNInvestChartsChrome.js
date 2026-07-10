import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PaneHeader, IndicatorLegend, ChartSplitter } from "../lib/core/index.js";
import { createDrawingSelectionToolbarModel, resolveDrawingSelectionToolbarPosition, FloatingSelectionToolbar } from "../lib/drawing/index.js";

export function buildPaneToolbarWrapperProps(pane, snapshot, hoveredPaneId, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner, size) {
    var paneLeft = snapshot.plotBounds.left;
    var paneRight = Math.max(0, size.width - (snapshot.plotBounds.left + snapshot.plotBounds.width));
    var paneToolbarRight = paneRight + 3;
    return {
        "data-rsc-fork-pointer-owner": useForkRuntime ? "pane-toolbar" : undefined,
        className: "rsc-pane-wrap vnsc-pane-wrap".concat(hoveredPaneId === pane.id ? " rsc-pane-wrap--active vnsc-pane-wrap--active" : ""),
        onPointerDownCapture: useForkRuntime ? function () { return claimForkPointerOwner("pane-toolbar"); } : undefined,
        onPointerUpCapture: useForkRuntime ? function () { return releaseForkPointerOwner("pane-toolbar"); } : undefined,
        onPointerCancelCapture: useForkRuntime ? function () { return releaseForkPointerOwner("pane-toolbar"); } : undefined,
        style: {
            position: "absolute",
            top: snapshot.headerAnchor.top,
            left: paneLeft,
            right: paneToolbarRight,
            height: 28,
            zIndex: 20,
        },
    };
}

export function buildPaneSplitterWrapperProps(pane, snapshot, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner) {
    return {
        "data-rsc-fork-pointer-owner": useForkRuntime ? "pane-splitter" : undefined,
        onPointerDownCapture: useForkRuntime ? function () { return claimForkPointerOwner("pane-splitter"); } : undefined,
        onPointerUpCapture: useForkRuntime ? function () { return releaseForkPointerOwner("pane-splitter"); } : undefined,
        onPointerCancelCapture: useForkRuntime ? function () { return releaseForkPointerOwner("pane-splitter"); } : undefined,
    };
}

export function buildDrawingChromeWrapperProps(useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner) {
    return {
        "data-rsc-fork-pointer-owner": useForkRuntime ? "drawing-chrome" : undefined,
        onPointerDownCapture: useForkRuntime ? function () { return claimForkPointerOwner("drawing-chrome"); } : undefined,
        onPointerUpCapture: useForkRuntime ? function () { return releaseForkPointerOwner("drawing-chrome"); } : undefined,
        onPointerCancelCapture: useForkRuntime ? function () { return releaseForkPointerOwner("drawing-chrome"); } : undefined,
    };
}

export function renderDefaultPaneToolbarContent(pane, paneHeaderLabels, indicatorLegendLabels) {
    return _jsx(PaneHeader, { pane: pane, className: "vnsc-pane-header", onToggleVisible: pane.onToggleVisible, onRemove: pane.onRemove, onAddSeries: pane.onAddSeries, addButtonRef: undefined, labels: paneHeaderLabels, children: _jsx(IndicatorLegend, { pane: pane, onToggleSeries: pane.onToggleSeries, onRemoveSeries: pane.onRemoveSeries, className: "rsc-pane-header__legend", labels: indicatorLegendLabels }) });
}

export function renderDefaultChartSplitterContent(splitterIndex, available, localApplyDelta, localResetToDefault, snapshot, t) {
    return _jsx(ChartSplitter, { className: "vnsc-splitter", splitterIndex: splitterIndex, available: available, onCommitDelta: localApplyDelta, onDoubleClick: localResetToDefault, title: t("library.splitterHint") || "Drag to resize", style: {
            top: snapshot.bounds.top + snapshot.bounds.height,
            left: snapshot.plotBounds.left,
            right: Math.max(0, snapshot.plotBounds.left + snapshot.plotBounds.width),
        } });
}

export function buildDrawingChromeContent(selectedDrawing, drawingWorkspace, isDark, magnetSensitivity, paneSnapshots, resolvedLegacyVisibleRange, useForkRuntime, effectiveForkVisibleRange, size, t, plotData, visibleDomainRef, cloneSelectedDrawing, toggleSelectedLock, handleStartTextEdit, bringSelectedToFront, sendSelectedToBack) {
    if (!selectedDrawing) {
        return null;
    }
    var labels = {
        clone: t("drawing.clone") || "Clone",
        lock: t("drawing.lock") || "Lock",
        unlock: t("drawing.unlock") || "Unlock",
        hide: t("drawing.hide") || "Hide",
        show: t("drawing.show") || "Show",
        edit: t("drawing.edit") || "Edit",
        bringToFront: t("drawing.bringToFront") || "Bring to Front",
        sendToBack: t("drawing.sendToBack") || "Send to Back",
        delete: t("drawing.delete") || "Delete",
        openProperties: t("drawing.properties") || "Settings",
    };
    var toolbarModel = createDrawingSelectionToolbarModel(selectedDrawing, labels);
    if (!toolbarModel) {
        return null;
    }
    var position = resolveDrawingSelectionToolbarPosition({
        drawing: selectedDrawing,
        paneSnapshots: paneSnapshots,
        plotData: plotData,
        visibleDomain: visibleDomainRef.current,
        shellSize: { width: size.width, height: size.height },
    });
    if (!position) {
        return null;
    }
    var handleAction = function (actionId) {
        switch (actionId) {
            case "clone":
                cloneSelectedDrawing();
                break;
            case "toggleLock":
                toggleSelectedLock();
                break;
            case "toggleVisibility":
                if (selectedDrawing) {
                    drawingWorkspace === null || drawingWorkspace === void 0 ? void 0 : drawingWorkspace.interaction.updateDrawing(selectedDrawing.id, {
                        visible: selectedDrawing.visible === false,
                    });
                }
                break;
            case "editText":
                handleStartTextEdit();
                break;
            case "bringToFront":
                bringSelectedToFront();
                break;
            case "sendToBack":
                sendSelectedToBack();
                break;
            case "delete":
                if (selectedDrawing && drawingWorkspace) {
                    var nextDrawings = drawingWorkspace.interaction.allDrawings.filter(function (d) { return d.id !== selectedDrawing.id; });
                    drawingWorkspace.interaction.replaceDrawings(nextDrawings);
                    drawingWorkspace.selectDrawing(null);
                }
                break;
            case "openProperties":
                drawingWorkspace === null || drawingWorkspace === void 0 ? void 0 : drawingWorkspace.openDock("properties");
                break;
            default:
                break;
        }
    };
    return _jsx(FloatingSelectionToolbar, { model: toolbarModel, position: position, ariaLabel: t("drawing.inspectorTitle") || "Drawing Toolbar", isDark: isDark, onAction: handleAction, drawing: selectedDrawing, onUpdate: function (patch) {
            drawingWorkspace === null || drawingWorkspace === void 0 ? void 0 : drawingWorkspace.interaction.updateDrawing(selectedDrawing.id, patch);
        } });
}
