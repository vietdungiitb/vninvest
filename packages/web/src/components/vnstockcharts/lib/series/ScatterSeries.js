import { jsx as _jsx } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
import { getAxisCanvas } from "../GenericComponent.js";
import { hexToRGBA, functor } from "../utils/index.js";
class ScatterSeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const { xAccessor } = moreProps;
        const points = helper(this.props, moreProps, xAccessor);
        drawOnCanvas(ctx, this.props, points);
    }
    renderSVG(moreProps) {
        const { className, markerProps } = this.props;
        const { xAccessor } = moreProps;
        const points = helper(this.props, moreProps, xAccessor);
        return _jsx("g", { className: className, children: points.map((point, idx) => {
                const { marker: Marker } = point;
                return _jsx(Marker, { ...markerProps, point: point }, idx);
            }) });
    }
    render() {
        return _jsx(GenericChartComponent, { svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, canvasToDraw: getAxisCanvas, drawOn: ["pan"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ScatterSeries.propTypes = {
    className: PropTypes.string,
    yAccessor: PropTypes.func.isRequired,
    marker: PropTypes.func,
    markerProvider: PropTypes.func,
    markerProps: PropTypes.object,
};
ScatterSeries.defaultProps = {
    className: "react-stockcharts-scatter",
};
function helper(props, moreProps, xAccessor) {
    const { yAccessor, markerProvider, markerProps } = props;
    let { marker: Marker } = props;
    const { xScale, chartConfig: { yScale }, plotData } = moreProps;
    if (!(markerProvider || Marker))
        throw new Error("required prop, either marker or markerProvider missing");
    return plotData.map((d) => {
        if (markerProvider)
            Marker = markerProvider(d);
        const mProps = { ...Marker.defaultProps, ...markerProps };
        const fill = functor(mProps.fill);
        const stroke = functor(mProps.stroke);
        return {
            x: xScale(xAccessor(d)),
            y: yScale(yAccessor(d)),
            fill: hexToRGBA(fill(d), mProps.opacity),
            stroke: stroke(d),
            datum: d,
            marker: Marker,
        };
    });
}
function drawOnCanvas(ctx, props, points) {
    const { markerProps } = props;
    const groupedByFill = points.reduce((acc, point) => {
        if (!acc.has(point.fill)) {
            acc.set(point.fill, []);
        }
        acc.get(point.fill).push(point);
        return acc;
    }, new Map());
    groupedByFill.forEach((fillValues, fillKey) => {
        if (fillKey !== "none") {
            ctx.fillStyle = fillKey;
        }
        fillValues.forEach((point) => {
            const { marker } = point;
            marker.drawOnCanvas({ ...marker.defaultProps, ...markerProps, fill: fillKey }, point, ctx);
        });
    });
}
export default ScatterSeries;
