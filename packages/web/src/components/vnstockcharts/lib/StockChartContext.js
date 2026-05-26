import { createContext, useContext } from "react";
const StockChartContext = createContext(undefined);
export const StockChartProvider = StockChartContext.Provider;
export const useStockChart = () => {
    const context = useContext(StockChartContext);
    if (!context) {
        throw new Error("useStockChart must be used within a StockChartProvider");
    }
    return context;
};
export default StockChartContext;
