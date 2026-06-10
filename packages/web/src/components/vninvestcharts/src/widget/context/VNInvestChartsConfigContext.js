import { jsx as _jsx } from "react/jsx-runtime";
/**
 * WE2 P1-03: VNInvestChartsConfigContext
 *
 * Low-frequency configuration context: theme, locale, symbol, timeframe, adapter.
 * These values change only on user action (not per-frame), so they can safely
 * live in a single React context without causing re-render storms.
 */
import { createContext, useContext } from "react";
const defaultValue = {
    theme: "light",
    locale: "vi",
    adapter: undefined,
};
export const VNInvestChartsConfigContext = createContext(defaultValue);
export function useVNInvestChartsConfig() {
    return useContext(VNInvestChartsConfigContext);
}
export function VNInvestChartsConfigProvider({ value, children, }) {
    return (_jsx(VNInvestChartsConfigContext.Provider, { value: value, children: children }));
}
