import React from "react";
import { useStockChart } from "./StockChartContext";
import { useChart } from "./ChartContext";

export function withStockChart(Component: any) {
    return function WrappedComponent(props: any) {
        const context = useStockChart();
        return <Component {...props} stockChartContext={context} />;
    };
}

export function withChart(Component: any) {
    return function WrappedComponent(props: any) {
        const context = useChart();
        return <Component {...props} chartContext={context} />;
    };
}

export function withChartAndStockChart(Component: any) {
    return function WrappedComponent(props: any) {
        const stockChartContext = useStockChart();
        const chartContext = useChart();
        return <Component {...props} stockChartContext={stockChartContext} chartContext={chartContext} />;
    };
}
