import { createContext, createElement, useContext } from "react";
const ChartSyncContext = createContext(undefined);
export function ChartSyncProvider({ value, children }) {
    return createElement(ChartSyncContext.Provider, { value }, children);
}
export function useChartSync() {
    const context = useContext(ChartSyncContext);
    if (!context) {
        throw new Error("useChartSync must be used within a ChartSyncProvider");
    }
    return context;
}
export { ChartSyncContext };
