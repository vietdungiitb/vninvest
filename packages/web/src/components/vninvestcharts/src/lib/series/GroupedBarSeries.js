import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
import { getAxisCanvas } from "../GenericComponent.js";
import StackedBarSeries, { drawOnCanvasHelper, svgHelper, identityStack } from "./StackedBarSeries.js";
class GroupedBarSeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        const { xAccessor } = moreProps;
        drawOnCanvasHelper(ctx, this.props, moreProps, xAccessor, identityStack, postProcessor);
    }
    renderSVG(moreProps) {
        const { xAccessor } = moreProps;
        return _jsx("g", { className: "vninvestcharts-grouped-bar-series", children: svgHelper(this.props, moreProps, xAccessor, identityStack, postProcessor) });
    }
    render() {
        return _jsx(GenericChartComponent, { svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, canvasToDraw: getAxisCanvas, drawOn: ["pan"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
GroupedBarSeries.propTypes = {
    baseAt: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.func,
    ]).isRequired,
    direction: PropTypes.oneOf(["up", "down"]).isRequired,
    stroke: PropTypes.bool.isRequired,
    widthRatio: PropTypes.number.isRequired,
    opacity: PropTypes.number.isRequired,
    fill: PropTypes.oneOfType([
        PropTypes.func, PropTypes.string
    ]).isRequired,
    className: PropTypes.oneOfType([
        PropTypes.func, PropTypes.string
    ]).isRequired,
    yAccessor: PropTypes.arrayOf(PropTypes.func),
};
GroupedBarSeries.defaultProps = {
    ...StackedBarSeries.defaultProps,
    widthRatio: 0.8,
    spaceBetweenBar: 5,
};
function postProcessor(array) {
    return array.map(each => {
        return {
            ...each,
            x: each.x + each.offset - each.groupOffset,
            width: each.groupWidth,
        };
    });
}
export default GroupedBarSeries;
