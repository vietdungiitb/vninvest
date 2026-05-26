import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import { hexToRGBA, strokeDashTypes, getStrokeDasharray } from "../utils/index.js";
import GenericChartComponent, { getAxisCanvas } from "../GenericChartComponent.js";
class StraightLine extends Component {
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const { type = "horizontal", stroke = "#000000", strokeWidth = 1, opacity = 0.5, strokeDasharray = "Solid", yValue, xValue } = this.props;
        const { xScale, chartConfig: { yScale, width, height } } = moreProps;
        ctx.beginPath();
        ctx.strokeStyle = hexToRGBA(stroke, opacity);
        ctx.lineWidth = strokeWidth;
        const { x1, y1, x2, y2 } = getLineCoordinates(type, xScale, yScale, xValue, yValue, width, height);
        ctx.setLineDash(getStrokeDasharray(strokeDasharray).split(",").map((d) => +d));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    renderSVG(moreProps) {
        const { xScale, chartConfig: { yScale, width, height } } = moreProps;
        const { className = "line ", type = "horizontal", stroke = "#000000", strokeWidth = 1, opacity = 0.5, strokeDasharray = "Solid", yValue, xValue } = this.props;
        const lineCoordinates = getLineCoordinates(type, xScale, yScale, xValue, yValue, width, height);
        return (_jsx("line", { className: className, strokeDasharray: getStrokeDasharray(strokeDasharray), stroke: stroke, strokeWidth: strokeWidth, strokeOpacity: opacity, ...lineCoordinates }));
    }
    render() {
        return (_jsx(GenericChartComponent, { svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, canvasToDraw: getAxisCanvas, drawOn: ["pan"] }));
    }
}
function getLineCoordinates(type, xScale, yScale, xValue, yValue, width, height) {
    return type === "horizontal"
        ? { x1: 0, y1: Math.round(yScale(yValue)), x2: width, y2: Math.round(yScale(yValue)) }
        : { x1: Math.round(xScale(xValue)), y1: 0, x2: Math.round(xScale(xValue)), y2: height };
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
StraightLine.propTypes = {
    className: PropTypes.string,
    type: PropTypes.oneOf(["vertical", "horizontal"]),
    stroke: PropTypes.string,
    strokeWidth: PropTypes.number,
    strokeDasharray: PropTypes.oneOf(strokeDashTypes),
    opacity: PropTypes.number.isRequired,
    yValue: PropTypes.number,
    xValue: PropTypes.oneOfType([PropTypes.number, PropTypes.instanceOf(Date)]),
};
export default StraightLine;
