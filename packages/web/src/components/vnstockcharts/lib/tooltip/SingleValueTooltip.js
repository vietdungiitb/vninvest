import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { format } from "d3-format";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
import { isDefined, identity, noop, functor } from "../utils/index.js";
class SingleValueTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { onClick, fontFamily, fontSize, labelFill, valueFill, className } = this.props;
        const { xDisplayFormat, yDisplayFormat, xLabel, yLabel, xAccessor, yAccessor } = this.props;
        const { displayValuesFor } = this.props;
        const { chartConfig: { width, height } } = moreProps;
        const currentItem = displayValuesFor(this.props, moreProps);
        const xDisplayValue = isDefined(currentItem) && isDefined(xAccessor(currentItem)) ? xDisplayFormat(xAccessor(currentItem)) : "n/a";
        const yDisplayValue = isDefined(currentItem) && isDefined(yAccessor(currentItem)) ? yDisplayFormat(yAccessor(currentItem)) : "n/a";
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        return (_jsx("g", { className: className, transform: `translate(${x}, ${y})`, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [xLabel ? _jsx(ToolTipTSpanLabel, { x: 0, dy: "5", fill: labelFill, children: `${xLabel}: ` }) : null, xLabel ? _jsx("tspan", { fill: valueFill, children: `${xDisplayValue} ` }) : null, _jsx(ToolTipTSpanLabel, { fill: labelFill, children: `${yLabel}: ` }), _jsx("tspan", { fill: valueFill, children: yDisplayValue })] }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SingleValueTooltip.propTypes = {
    xDisplayFormat: PropTypes.func,
    yDisplayFormat: PropTypes.func.isRequired,
    xLabel: PropTypes.string,
    yLabel: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]).isRequired,
    labelFill: PropTypes.string.isRequired,
    valueFill: PropTypes.string,
    origin: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.func
    ]).isRequired,
    className: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    onClick: PropTypes.func,
    displayValuesFor: PropTypes.func,
    xAccessor: PropTypes.func,
    yAccessor: PropTypes.func,
};
SingleValueTooltip.defaultProps = {
    origin: [0, 0],
    labelFill: "#4682B4",
    valueFill: "#000000",
    yDisplayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    xAccessor: noop,
    yAccessor: identity,
    className: "react-stockcharts-tooltip",
};
export default SingleValueTooltip;
