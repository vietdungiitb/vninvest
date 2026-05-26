import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent, { getAxisCanvas } from "../GenericChartComponent.js";
import { functor, isDefined, plotDataLengthBarWidth } from "../utils/index.js";
class BarSeries extends Component {
    // NOTE: React 19 no longer runs propTypes validation at runtime.
    // PropTypes kept for documentation and IDE tooling only.
    static propTypes = {
        baseAt: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
        stroke: PropTypes.bool,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
        yAccessor: PropTypes.func.isRequired,
        opacity: PropTypes.number,
        fill: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        className: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        clip: PropTypes.bool,
    };
    static defaultProps = {
        baseAt: (xScale, yScale) => yScale(0),
        fill: "#4682B4",
        stroke: false,
        width: plotDataLengthBarWidth,
        opacity: 0.5,
        clip: true,
    };
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const bars = getBars(this.props, moreProps);
        const { opacity = 0.5 } = this.props;
        bars.forEach((d) => {
            ctx.fillStyle = d.fill;
            ctx.globalAlpha = opacity;
            ctx.fillRect(d.x, d.y, d.width, d.height);
            if (d.stroke !== "none") {
                ctx.strokeStyle = d.stroke;
                ctx.strokeRect(d.x, d.y, d.width, d.height);
            }
        });
        ctx.globalAlpha = 1.0;
    }
    renderSVG(moreProps) {
        const bars = getBars(this.props, moreProps);
        const { opacity = 0.5 } = this.props;
        return (_jsx("g", { className: "react-stockcharts-bar-series", children: bars.map((d, i) => (_jsx("rect", { x: d.x, y: d.y, width: d.width, height: d.height, fill: d.fill, fillOpacity: opacity, stroke: d.stroke }, i))) }));
    }
    render() {
        const { clip } = this.props;
        return (_jsx(GenericChartComponent, { clip: clip, svgDraw: this.renderSVG, canvasToDraw: getAxisCanvas, canvasDraw: this.drawOnCanvas, drawOn: ["pan"] }));
    }
}
function getBars(props, moreProps) {
    const { baseAt, fill, stroke, yAccessor } = props;
    const { xScale, xAccessor, plotData, chartConfig: { yScale } } = moreProps;
    const getFill = functor(fill);
    const getBase = functor(baseAt);
    const widthFunctor = functor(props.width);
    const width = widthFunctor(props, { xScale, xAccessor, plotData });
    const offset = Math.floor(0.5 * width);
    return plotData
        .filter((d) => isDefined(yAccessor(d)))
        .map((d) => {
        const yValue = yAccessor(d);
        let y = yScale(yValue);
        const x = Math.round(xScale(xAccessor(d))) - offset;
        let h = getBase(xScale, yScale, d) - yScale(yValue);
        if (h < 0) {
            y = y + h;
            h = -h;
        }
        return {
            x,
            y: Math.round(y),
            height: Math.round(h),
            width: offset * 2,
            fill: getFill(d),
            stroke: stroke ? getFill(d) : "none",
        };
    });
}
export default BarSeries;
