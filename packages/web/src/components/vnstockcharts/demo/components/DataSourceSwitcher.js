import { jsx as _jsx } from "react/jsx-runtime";
/**
 * OB-M03 — DataSourceSwitcher
 * Toggle Binance Online ↔ Offline ↔ VNInvest data source.
 */
import { useDemoI18n } from "../i18n.js";
export function DataSourceSwitcher({ activeSource, onSwitch }) {
    const { t } = useDemoI18n();
    const sources = [
        { id: "binance", label: t("dataSource.binanceOnline") },
        { id: "offline", label: t("dataSource.binanceOffline") },
        { id: "vninvest", label: t("dataSource.vninvest") },
    ];
    return (_jsx("div", { className: "gc-datasource-switcher", role: "group", "aria-label": t("dataSource.label"), children: sources.map(({ id, label }) => (_jsx("button", { className: `gc-datasource-btn${activeSource === id ? " gc-datasource-btn--active" : ""}`, onClick: () => onSwitch(id), "aria-pressed": activeSource === id, type: "button", children: label }, id))) }));
}
