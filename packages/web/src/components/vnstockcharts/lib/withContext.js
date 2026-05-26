import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { useStockChart } from "./StockChartContext.js";
import { useChart } from "./ChartContext.js";
export function withStockChart(Component) {
    return function WrappedComponent(props) {
        const context = useStockChart();
        return _jsx(Component, { ...props, stockChartContext: context });
    };
}
export function withChart(Component) {
    return function WrappedComponent(props) {
        const context = useChart();
        return _jsx(Component, { ...props, chartContext: context });
    };
}
export function withChartAndStockChart(Component) {
    return function WrappedComponent(props) {
        const stockChartContext = useStockChart();
        const chartContext = useChart();
        return _jsx(Component, { ...props, stockChartContext: stockChartContext, chartContext: chartContext });
    };
}
