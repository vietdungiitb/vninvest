import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
import { getAxisCanvas } from "../GenericComponent.js";
import { isDefined, functor } from "../utils/index.js";
class OHLCSeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const { yAccessor } = this.props;
        const { xAccessor } = moreProps;
        const { xScale, chartConfig: { yScale }, plotData } = moreProps;
        const barData = getOHLCBars(this.props, xAccessor, yAccessor, xScale, yScale, plotData);
        drawOnCanvas(ctx, barData);
    }
    render() {
        const { clip } = this.props;
        return _jsx(GenericChartComponent, { svgDraw: this.renderSVG, canvasToDraw: getAxisCanvas, canvasDraw: this.drawOnCanvas, clip: clip, drawOn: ["pan"] });
    }
    renderSVG(moreProps) {
        const { className, yAccessor } = this.props;
        const { xAccessor } = moreProps;
        const { xScale, chartConfig: { yScale }, plotData } = moreProps;
        const barData = getOHLCBars(this.props, xAccessor, yAccessor, xScale, yScale, plotData);
        const { strokeWidth, bars } = barData;
        return _jsx("g", { className: className, children: bars.map((d, idx) => _jsx("path", { className: d.className, stroke: d.stroke, strokeWidth: strokeWidth, d: `M${d.openX1} ${d.openY} L${d.openX2} ${d.openY} M${d.x} ${d.y1} L${d.x} ${d.y2} M${d.closeX1} ${d.closeY} L${d.closeX2} ${d.closeY}` }, idx)) });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
OHLCSeries.propTypes = {
    className: PropTypes.string,
    classNames: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.string
    ]).isRequired,
    stroke: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.string
    ]).isRequired,
    yAccessor: PropTypes.func.isRequired,
    clip: PropTypes.bool.isRequired,
};
OHLCSeries.defaultProps = {
    className: "vninvestcharts-ohlc",
    yAccessor: (d) => ({ open: d.open, high: d.high, low: d.low, close: d.close }),
    classNames: (d) => isDefined(d.absoluteChange) ? (d.absoluteChange > 0 ? "up" : "down") : "firstbar",
    stroke: (d) => isDefined(d.absoluteChange) ? (d.absoluteChange > 0 ? "#6BA583" : "#FF0000") : "#000000",
    clip: true,
};
function drawOnCanvas(ctx, barData) {
    const { strokeWidth, bars } = barData;
    const wickNest = Array.from(bars.reduce((acc, bar) => {
        if (!acc.has(bar.stroke)) {
            acc.set(bar.stroke, []);
        }
        acc.get(bar.stroke).push(bar);
        return acc;
    }, new Map()).entries()).map((entry) => ({ key: entry[0], values: entry[1] }));
    ctx.lineWidth = strokeWidth;
    wickNest.forEach((outer) => {
        const { key, values } = outer;
        ctx.strokeStyle = key;
        values.forEach((d) => {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y1);
            ctx.lineTo(d.x, d.y2);
            ctx.moveTo(d.openX1, d.openY);
            ctx.lineTo(d.openX2, d.openY);
            ctx.moveTo(d.closeX1, d.closeY);
            ctx.lineTo(d.closeX2, d.closeY);
            ctx.stroke();
        });
    });
}
function getOHLCBars(props, xAccessor, yAccessor, xScale, yScale, plotData) {
    const { classNames: classNamesProp, stroke: strokeProp } = props;
    const strokeFunc = functor(strokeProp);
    const classNameFunc = functor(classNamesProp);
    const width = xScale(xAccessor(plotData[plotData.length - 1]))
        - xScale(xAccessor(plotData[0]));
    const barWidth = width / (plotData.length - 1);
    const strokeWidth = Math.max(1, Math.round(barWidth / 4));
    const bars = plotData
        .filter((d) => isDefined(yAccessor(d).close))
        .map((d) => {
        const ohlc = yAccessor(d);
        const x = Math.round(xScale(xAccessor(d)));
        const y1 = yScale(ohlc.high), y2 = yScale(ohlc.low), openX1 = x - barWidth, openX2 = x + strokeWidth / 2, openY = yScale(ohlc.open), closeX1 = x - strokeWidth / 2, closeX2 = x + barWidth, closeY = yScale(ohlc.close), className = classNameFunc(d), stroke = strokeFunc(d);
        return { x, y1, y2, openX1, openX2, openY, closeX1, closeX2, closeY, stroke, className };
    });
    return { barWidth, strokeWidth, bars };
}
export default OHLCSeries;
