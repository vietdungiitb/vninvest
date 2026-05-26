import { createContext, useContext } from "react";
export const ChartRenderContext = createContext(null);
export function useChartRenderContext() {
    const context = useContext(ChartRenderContext);
    if (!context) {
        throw new Error("useChartRenderContext phải được dùng bên trong ChartCanvas tree");
    }
    return context;
}
