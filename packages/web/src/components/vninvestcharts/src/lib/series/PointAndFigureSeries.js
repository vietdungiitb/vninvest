import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
import { getAxisCanvas } from "../GenericComponent.js";
import { isDefined, isNotDefined } from "../utils/index.js";
class PointAndFigureSeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const { xAccessor } = moreProps;
        const { xScale, chartConfig: { yScale }, plotData } = moreProps;
        const columns = getColumns(xScale, xAccessor, yScale, plotData);
        drawOnCanvas(ctx, this.props, columns);
    }
    render() {
        const { clip } = this.props;
        return _jsx(GenericChartComponent, { clip: clip, svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, canvasToDraw: getAxisCanvas, drawOn: ["pan"] });
    }
    renderSVG(moreProps) {
        const { xAccessor } = moreProps;
        const { xScale, chartConfig: { yScale }, plotData } = moreProps;
        const { stroke, fill, strokeWidth, className } = this.props;
        const columns = getColumns(xScale, xAccessor, yScale, plotData);
        return (_jsx("g", { className: className, children: columns.map((col, idx) => (_jsx("g", { className: col.className, transform: `translate(${col.offset[0]}, ${col.offset[1]})`, children: col.boxes.map((box, i) => {
                    if (col.direction > 0) {
                        return (_jsxs("g", { children: [_jsx("line", { className: "up", strokeWidth: strokeWidth, stroke: stroke.up, fill: fill.up, x1: 0, y1: box.open, x2: box.columnWidth, y2: box.close }), _jsx("line", { className: "up", strokeWidth: strokeWidth, stroke: stroke.up, fill: fill.up, x1: 0, y1: box.close, x2: box.columnWidth, y2: box.open })] }, `${idx}-${i}`));
                    }
                    return (_jsx("ellipse", { className: "down", strokeWidth: strokeWidth, stroke: stroke.down, fill: fill.down, cx: box.columnWidth / 2, cy: (box.open + box.close) / 2, rx: box.columnWidth / 2, ry: box.boxHeight / 2 }, `${idx}-${i}`));
                }) }, idx))) }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
PointAndFigureSeries.propTypes = {
    className: PropTypes.string,
    strokeWidth: PropTypes.number.isRequired,
    stroke: PropTypes.object.isRequired,
    fill: PropTypes.object.isRequired,
    clip: PropTypes.bool.isRequired,
};
PointAndFigureSeries.defaultProps = {
    className: "vninvestcharts-point-and-figure",
    strokeWidth: 1,
    stroke: {
        up: "#6BA583",
        down: "#FF0000"
    },
    fill: {
        up: "none",
        down: "none"
    },
    clip: true,
};
function drawOnCanvas(ctx, props, columns) {
    const { stroke, fill, strokeWidth } = props;
    ctx.lineWidth = strokeWidth;
    columns.forEach((col) => {
        const [offsetX, offsetY] = col.offset;
        col.boxes.forEach((box) => {
            if (col.direction > 0) {
                ctx.fillStyle = fill.up;
                ctx.strokeStyle = stroke.up;
                ctx.beginPath();
                ctx.moveTo(offsetX, offsetY + box.open);
                ctx.lineTo(offsetX + box.columnWidth, offsetY + box.close);
                ctx.moveTo(offsetX, offsetY + box.close);
                ctx.lineTo(offsetX + box.columnWidth, offsetY + box.open);
                ctx.stroke();
            }
            else {
                ctx.fillStyle = fill.down;
                ctx.strokeStyle = stroke.down;
                ctx.beginPath();
                const [x, y] = [offsetX + box.columnWidth / 2, offsetY + box.open + box.boxHeight / 2];
                const [rx, ry] = [box.columnWidth / 2, box.boxHeight / 2];
                ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
                ctx.stroke();
            }
        });
    });
    ctx.stroke();
}
function getColumns(xScale, xAccessor, yScale, plotData) {
    const width = xScale(xAccessor(plotData[plotData.length - 1]))
        - xScale(xAccessor(plotData[0]));
    const columnWidth = (width / (plotData.length - 1));
    let anyBox, j = 0;
    while (isNotDefined(anyBox)) {
        if (isDefined(plotData[j].close)) {
            anyBox = plotData[j].boxes[0];
        }
        else {
            break;
        }
        j++;
    }
    const boxHeight = Math.abs(yScale(anyBox.open) - yScale(anyBox.close));
    const columns = plotData
        .filter((d) => isDefined(d.close))
        .map((d) => {
        const boxes = d.boxes.map((box) => ({
            columnWidth: columnWidth,
            boxHeight: boxHeight,
            open: yScale(box.open),
            close: yScale(box.close),
        }));
        const xOffset = (xScale(xAccessor(d)) - (columnWidth / 2));
        return {
            boxes: boxes,
            direction: d.direction,
            offset: [xOffset, 0],
        };
    });
    return columns;
}
export default PointAndFigureSeries;
