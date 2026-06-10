import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import GenericComponent from "./GenericComponent.js";
import { isDefined, find } from "./utils/index.js";
import ChartContext from "./ChartContext.js";
import { useStockChart } from "./StockChartContext.js";
const ALWAYS_TRUE_TYPES = ["drag", "dragend"];
class GenericChartComponent extends GenericComponent {
    preCanvasDraw(ctx, moreProps) {
        super.preCanvasDraw(ctx, moreProps);
        ctx.save();
        const { margin, ratio } = this.context;
        const { chartConfig } = moreProps;
        const canvasOriginX = (0.5 * ratio) + chartConfig.origin[0] + margin.left;
        const canvasOriginY = (0.5 * ratio) + chartConfig.origin[1] + margin.top;
        const { chartConfig: { width, height } } = moreProps;
        const { clip, edgeClip } = this.props;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        if (edgeClip) {
            ctx.beginPath();
            ctx.rect(-1, canvasOriginY - 10, width + margin.left + margin.right + 1, height + 20);
            ctx.clip();
        }
        ctx.translate(canvasOriginX, canvasOriginY);
        if (clip) {
            ctx.beginPath();
            ctx.rect(-1, -1, width + 1, height + 1);
            ctx.clip();
        }
    }
    postCanvasDraw(ctx, moreProps) {
        super.postCanvasDraw(ctx, moreProps);
        ctx.restore();
    }
    updateMoreProps(moreProps) {
        super.updateMoreProps(moreProps);
        const { chartConfig: chartConfigList } = moreProps;
        if (chartConfigList && Array.isArray(chartConfigList)) {
            const { chartId } = this.props;
            this.moreProps.chartConfigList = chartConfigList;
            const chartConfig = find(chartConfigList, (each) => each.id === chartId) || chartConfigList[0];
            if (chartConfig) {
                this.moreProps.chartConfig = chartConfig;
            }
        }
        if (isDefined(this.moreProps.chartConfig)) {
            const { origin } = this.moreProps.chartConfig;
            if (!Array.isArray(origin)) {
                return;
            }
            const [ox, oy] = origin;
            if (isDefined(moreProps.mouseXY)) {
                const { mouseXY: [x, y] } = moreProps;
                this.moreProps.mouseXY = [x - ox, y - oy];
            }
            if (isDefined(moreProps.startPos)) {
                const { startPos: [x, y] } = moreProps;
                this.moreProps.startPos = [x - ox, y - oy];
            }
        }
    }
    shouldTypeProceed(type, moreProps) {
        if (this.props.allowAnyChart) {
            return true;
        }
        if ((type === "mousemove" || type === "click") && this.props.disablePan) {
            return true;
        }
        if (type === "mousedown" && this.props.disablePan) {
            return true;
        }
        if (ALWAYS_TRUE_TYPES.indexOf(type) === -1 && isDefined(moreProps) && isDefined(moreProps.currentCharts)) {
            return (moreProps.currentCharts.indexOf(this.props.chartId) > -1);
        }
        return true;
    }
}
// Wrapper to provide ChartContext values as props
const GenericChartComponentWrapper = (props) => {
    const chartContext = React.useContext(ChartContext);
    const { chartConfig } = useStockChart();
    const chartId = chartContext?.chartId ?? chartConfig[0]?.id ?? 0;
    return _jsx(GenericChartComponent, { ...props, chartId: chartId });
};
export default GenericChartComponentWrapper;
export { getAxisCanvas, getMouseCanvas } from "./GenericComponent.js";
