import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from "d3-format";
import React, { Component } from "react";
import PropTypes from "prop-types";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import { functor } from "../utils/index.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
class StochasticTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { onClick, fontFamily, fontSize, yAccessor, displayFormat, label } = this.props;
        const { className, options, appearance, labelFill } = this.props;
        const { displayValuesFor } = this.props;
        const { chartConfig: { width, height } } = moreProps;
        const currentItem = displayValuesFor(this.props, moreProps);
        const { stroke } = appearance;
        const stochastic = currentItem && yAccessor(currentItem);
        const K = (stochastic && stochastic.K && displayFormat(stochastic.K)) || "n/a";
        const D = (stochastic && stochastic.D && displayFormat(stochastic.D)) || "n/a";
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        return (_jsx("g", { className: className, transform: `translate(${x}, ${y})`, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, children: `${label} %K(` }), _jsx("tspan", { fill: stroke.kLine, children: `${options.windowSize}, ${options.kWindowSize}` }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: "): " }), _jsx("tspan", { fill: stroke.kLine, children: K }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: " %D (" }), _jsx("tspan", { fill: stroke.dLine, children: options.dWindowSize }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: "): " }), _jsx("tspan", { fill: stroke.dLine, children: D })] }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
StochasticTooltip.propTypes = {
    origin: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.func
    ]).isRequired,
    className: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    labelFill: PropTypes.string,
    onClick: PropTypes.func,
    yAccessor: PropTypes.func.isRequired,
    options: PropTypes.shape({
        windowSize: PropTypes.number.isRequired,
        kWindowSize: PropTypes.number.isRequired,
        dWindowSize: PropTypes.number.isRequired,
    }).isRequired,
    appearance: PropTypes.shape({
        stroke: PropTypes.shape({
            dLine: PropTypes.string.isRequired,
            kLine: PropTypes.string.isRequired,
        }).isRequired,
    }).isRequired,
    displayFormat: PropTypes.func.isRequired,
    displayValuesFor: PropTypes.func,
    label: PropTypes.string.isRequired,
};
StochasticTooltip.defaultProps = {
    displayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    origin: [0, 0],
    className: "react-stockcharts-tooltip",
    label: "STO",
};
export default StochasticTooltip;
