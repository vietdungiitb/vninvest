import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from "react";
import { ChartPane } from "./ChartPane.js";
import { PaneSplitter } from "./PaneSplitter.js";
import { DataProvider } from "./context/DataContext.js";
import { PaneManagerProvider } from "./context/PaneManagerContext.js";
import { usePaneManager } from "./hooks/usePaneManager.js";
export function ChartTerminal({ data, panes, adapter, children, className, style, ...rest }) {
    const paneState = usePaneManager(panes);
    const mergedStyle = {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
        height: "100%",
        minHeight: 0,
        ...style,
    };
    return (_jsx(PaneManagerProvider, { value: paneState, children: _jsx(DataProvider, { value: { data, adapter }, children: _jsxs("section", { ...rest, className: className, style: mergedStyle, children: [paneState.panes.map((pane, index) => (_jsxs(Fragment, { children: [_jsx(ChartPane, { pane: pane }), index < paneState.panes.length - 1 ? (_jsx(PaneSplitter, { onResize: (heightPx) => paneState.resizePane(pane.id, heightPx) })) : null] }, pane.id))), children] }) }) }));
}
