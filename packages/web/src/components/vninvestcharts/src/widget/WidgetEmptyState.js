import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from "react";
import { useWidgetI18n } from "./context/WidgetI18nContext.js";
export const WidgetEmptyState = memo(function WidgetEmptyState({ loading }) {
    const { t } = useWidgetI18n();
    const copy = loading ? t("widget.loading") : t("widget.noData");
    return (_jsxs("div", { role: "status", "aria-live": "polite", style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minHeight: 320,
            padding: 24,
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(2, 6, 23, 0.03), rgba(2, 6, 23, 0.06))",
            color: "#334155",
            fontSize: 14,
            fontWeight: 600,
        }, children: [_jsx("style", { children: "@keyframes rsc-widget-spin { to { transform: rotate(360deg); } }" }), loading ? (_jsx("span", { "aria-hidden": "true", style: {
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    animation: "rsc-widget-spin 1s linear infinite",
                } })) : null, _jsx("span", { children: copy })] }));
});
