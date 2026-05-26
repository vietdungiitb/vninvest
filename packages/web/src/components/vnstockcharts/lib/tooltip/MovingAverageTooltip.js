import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { format } from "d3-format";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
import { functor } from "../utils/index.js";
class SingleMAToolTip extends Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }
    handleClick(e) {
        const { onClick, forChart, options } = this.props;
        onClick({ chartId: forChart, ...options }, e);
    }
    render() {
        const { textFill, labelFill } = this.props;
        const translate = "translate(" + this.props.origin[0] + ", " + this.props.origin[1] + ")";
        return (_jsxs("g", { transform: translate, children: [_jsx("line", { x1: 0, y1: 2, x2: 0, y2: 28, stroke: this.props.color, strokeWidth: "4px" }), _jsxs(ToolTipText, { x: 5, y: 11, fontFamily: this.props.fontFamily, fontSize: this.props.fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, children: this.props.displayName }), _jsx("tspan", { x: "5", dy: "15", fill: textFill, children: this.props.value })] }), _jsx("rect", { x: 0, y: 0, width: 55, height: 30, onClick: this.handleClick, fill: "none", stroke: "none" })] }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SingleMAToolTip.propTypes = {
    origin: PropTypes.array.isRequired,
    color: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    fontFamily: PropTypes.string,
    textFill: PropTypes.string,
    labelFill: PropTypes.string,
    fontSize: PropTypes.number,
    forChart: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    options: PropTypes.object.isRequired,
};
class MovingAverageTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { displayValuesFor } = this.props;
        const { chartId } = moreProps;
        const chartConfigList = moreProps.chartConfig;
        const config = Array.isArray(chartConfigList)
            ? chartConfigList.find((each) => each.id === chartId) || chartConfigList[0]
            : chartConfigList;
        const { className, onClick, width, fontFamily, fontSize, textFill, labelFill } = this.props;
        const { origin: originProp, displayFormat, options } = this.props;
        const { height } = config;
        const currentItem = displayValuesFor(this.props, moreProps);
        if (!config)
            return null;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        const [ox, oy] = config.origin;
        return (_jsx("g", { transform: `translate(${ox + x}, ${oy + y})`, className: className, children: options
                .map((each, idx) => {
                const yValue = currentItem && each.yAccessor(currentItem);
                const tooltipLabel = `${each.type} (${each.windowSize})`;
                const yDisplayValue = yValue ? displayFormat(yValue) : "n/a";
                return _jsx(SingleMAToolTip, { origin: [width * idx, 0], color: each.stroke, displayName: tooltipLabel, value: yDisplayValue, options: each, forChart: chartId, onClick: onClick, fontFamily: fontFamily, fontSize: fontSize, textFill: textFill, labelFill: labelFill }, idx);
            }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
MovingAverageTooltip.propTypes = {
    className: PropTypes.string,
    displayFormat: PropTypes.func.isRequired,
    origin: PropTypes.array.isRequired,
    displayValuesFor: PropTypes.func,
    onClick: PropTypes.func,
    textFill: PropTypes.string,
    labelFill: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    width: PropTypes.number,
    options: PropTypes.arrayOf(PropTypes.shape({
        yAccessor: PropTypes.func.isRequired,
        type: PropTypes.string.isRequired,
        stroke: PropTypes.string.isRequired,
        windowSize: PropTypes.number.isRequired,
        echo: PropTypes.any,
    })),
};
MovingAverageTooltip.defaultProps = {
    className: "react-stockcharts-tooltip react-stockcharts-moving-average-tooltip",
    displayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    origin: [0, 10],
    width: 65,
};
export default MovingAverageTooltip;
