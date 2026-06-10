import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
export class PaneErrorBoundary extends Component {
    state = {
        hasError: false,
        error: null
    };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error(`[PaneErrorBoundary] Error in pane ${this.props.paneId}:`, error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || (_jsx("div", { style: {
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(220, 53, 69, 0.05)",
                    color: "#dc3545",
                    border: "1px dashed #dc3545",
                    fontSize: "12px",
                    padding: "10px",
                    boxSizing: "border-box"
                }, children: _jsxs("span", { children: ["L\u1ED7i hi\u1EC3n th\u1ECB Pane ", this.props.paneId, ". Chi ti\u1EBFt: ", this.state.error?.message] }) }));
        }
        return this.props.children;
    }
}
