import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import { WidgetI18nContext } from "./context/WidgetI18nContext.js";
export class WidgetErrorBoundary extends Component {
    static contextType = WidgetI18nContext;
    context;
    state = {
        hasError: false,
        error: null,
    };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        this.props.onError?.(error, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { role: "alert", style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 240,
                    padding: 24,
                    borderRadius: 16,
                    background: "rgba(15, 23, 42, 0.04)",
                    color: "#b91c1c",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                }, children: this.context.t("widget.error") }));
        }
        return this.props.children;
    }
}
