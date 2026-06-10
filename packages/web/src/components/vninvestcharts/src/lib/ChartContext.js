import { createContext, useContext } from "react";
const ChartContext = createContext(undefined);
export const ChartProvider = ChartContext.Provider;
export const useChart = () => {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a ChartProvider");
    }
    return context;
};
export default ChartContext;
