import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent, { getAxisCanvas } from "../GenericChartComponent.js";
import { hexToRGBA, isDefined, functor, plotDataLengthBarWidth } from "../utils/index.js";
class CandlestickSeries extends Component {
    // NOTE: React 19 no longer runs propTypes validation at runtime.
    // PropTypes kept for documentation and IDE tooling only.
    static propTypes = {
        className: PropTypes.string,
        wickClassName: PropTypes.string,
        candleClassName: PropTypes.string,
        widthRatio: PropTypes.number,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
        fill: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        stroke: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        wickStroke: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        yAccessor: PropTypes.func,
        clip: PropTypes.bool,
    };
    static defaultProps = {
        className: "react-stockcharts-candlestick",
        wickClassName: "react-stockcharts-candlestick-wick",
        candleClassName: "react-stockcharts-candlestick-candle",
        yAccessor: (d) => ({ open: d.open, high: d.high, low: d.low, close: d.close }),
        width: plotDataLengthBarWidth,
        wickStroke: "#000000",
        fill: (d) => d.close > d.open ? "#6BA583" : "#FF0000",
        stroke: "#000000",
        candleStrokeWidth: 0.5,
        widthRatio: 0.8,
        opacity: 0.5,
        clip: true,
    };
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        drawOnCanvas(ctx, this.props, moreProps);
    }
    renderSVG(moreProps) {
        const { className, wickClassName, candleClassName } = this.props;
        const { xScale, chartConfig: { yScale }, plotData, xAccessor } = moreProps;
        const candleData = getCandleData(this.props, xAccessor, xScale, yScale, plotData);
        return (_jsxs("g", { className: className, children: [_jsx("g", { className: wickClassName, children: getWicksSVG(candleData) }, "wicks"), _jsx("g", { className: candleClassName, children: getCandlesSVG(this.props, candleData) }, "candles")] }));
    }
    render() {
        const { clip } = this.props;
        return (_jsx(GenericChartComponent, { clip: clip, svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, canvasToDraw: getAxisCanvas, drawOn: ["pan"] }));
    }
}
function getWicksSVG(candleData) {
    return candleData.map((each, idx) => {
        const d = each.wick;
        return _jsx("path", { className: each.className, stroke: d.stroke, d: `M${d.x},${d.y1} L${d.x},${d.y2} M${d.x},${d.y3} L${d.x},${d.y4}` }, idx);
    });
}
function getCandlesSVG(props, candleData) {
    const { opacity = 0.5, candleStrokeWidth = 0.5 } = props;
    return candleData.map((d, idx) => {
        if (d.width <= 1)
            return _jsx("line", { className: d.className, x1: d.x, y1: d.y, x2: d.x, y2: d.y + d.height, stroke: d.fill }, idx);
        else if (d.height === 0)
            return _jsx("line", { x1: d.x, y1: d.y, x2: d.x + d.width, y2: d.y + d.height, stroke: d.fill }, idx);
        return _jsx("rect", { className: d.className, fillOpacity: opacity, x: d.x, y: d.y, width: d.width, height: d.height, fill: d.fill, stroke: d.stroke, strokeWidth: candleStrokeWidth }, idx);
    });
}
function drawOnCanvas(ctx, props, moreProps) {
    const { opacity = 0.5, candleStrokeWidth = 0.5 } = props;
    const { xScale, chartConfig: { yScale }, plotData, xAccessor } = moreProps;
    const candleData = getCandleData(props, xAccessor, xScale, yScale, plotData);
    candleData.forEach((each) => {
        const d = each.wick;
        ctx.strokeStyle = d.stroke;
        ctx.fillStyle = d.stroke;
        ctx.fillRect(d.x - 0.5, d.y1, 1, d.y2 - d.y1);
        ctx.fillRect(d.x - 0.5, d.y3, 1, d.y4 - d.y3);
    });
    candleData.forEach((d) => {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = candleStrokeWidth;
        ctx.fillStyle = d.width <= 1 ? d.fill : hexToRGBA(d.fill, opacity);
        if (d.width <= 1)
            ctx.fillRect(d.x - 0.5, d.y, 1, d.height);
        else if (d.height === 0)
            ctx.fillRect(d.x, d.y - 0.5, d.width, 1);
        else {
            ctx.fillRect(d.x, d.y, d.width, d.height);
            if (d.stroke !== "none")
                ctx.strokeRect(d.x, d.y, d.width, d.height);
        }
    });
}
function getCandleData(props, xAccessor, xScale, yScale, plotData) {
    const { wickStroke: wickStrokeProp, fill: fillProp, stroke: strokeProp, yAccessor } = props;
    const wickStroke = functor(wickStrokeProp);
    const fill = functor(fillProp);
    const stroke = functor(strokeProp);
    const widthFunctor = functor(props.width);
    const width = widthFunctor(props, { xScale, xAccessor, plotData });
    const offset = 0.5 * width > 0.7 ? Math.round(0.5 * width) : Math.floor(0.5 * width);
    return plotData.filter((d) => isDefined(yAccessor(d).close)).map((d) => {
        const x = Math.round(xScale(xAccessor(d)));
        const ohlc = yAccessor(d);
        const y = Math.round(yScale(Math.max(ohlc.open, ohlc.close)));
        const height = Math.round(Math.abs(yScale(ohlc.open) - yScale(ohlc.close)));
        return {
            x: x - offset,
            y: y,
            wick: {
                stroke: wickStroke(ohlc),
                x: x,
                y1: Math.round(yScale(ohlc.high)),
                y2: y,
                y3: y + height,
                y4: Math.round(yScale(ohlc.low)),
            },
            height: height,
            width: offset * 2,
            fill: fill(ohlc),
            stroke: stroke(ohlc),
        };
    });
}
export default CandlestickSeries;
