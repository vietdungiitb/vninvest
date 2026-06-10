import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from "d3-format";
import { Component } from "react";
import PropTypes from "prop-types";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
import { functor } from "../utils/index.js";
class MACDTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { onClick, fontFamily, fontSize, displayFormat, className } = this.props;
        const { yAccessor, options, appearance, labelFill } = this.props;
        const { displayValuesFor } = this.props;
        const chartConfigList = moreProps.chartConfig;
        const config = Array.isArray(chartConfigList)
            ? chartConfigList.find((each) => each.id === moreProps.chartId) || chartConfigList[0]
            : chartConfigList;
        if (!config)
            return null;
        const { width, height } = config;
        const currentItem = displayValuesFor(this.props, moreProps);
        const macdValue = currentItem && yAccessor(currentItem);
        const macd = (macdValue && macdValue.macd && displayFormat(macdValue.macd)) || "n/a";
        const signal = (macdValue && macdValue.signal && displayFormat(macdValue.signal)) || "n/a";
        const divergence = (macdValue && macdValue.divergence && displayFormat(macdValue.divergence)) || "n/a";
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        return (_jsx("g", { className: className, transform: `translate(${x}, ${y})`, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, children: "MACD (" }), _jsx("tspan", { fill: appearance.stroke.macd, children: options.slow }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: ", " }), _jsx("tspan", { fill: appearance.stroke.macd, children: options.fast }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: "): " }), _jsx("tspan", { fill: appearance.stroke.macd, children: macd }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: " Signal (" }), _jsx("tspan", { fill: appearance.stroke.signal, children: options.signal }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: "): " }), _jsx("tspan", { fill: appearance.stroke.signal, children: signal }), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: " Divergence: " }), _jsx("tspan", { fill: appearance.fill.divergence, children: divergence })] }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
MACDTooltip.propTypes = {
    origin: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.func
    ]).isRequired,
    className: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    labelFill: PropTypes.string,
    yAccessor: PropTypes.func.isRequired,
    options: PropTypes.shape({
        slow: PropTypes.number.isRequired,
        fast: PropTypes.number.isRequired,
        signal: PropTypes.number.isRequired,
    }).isRequired,
    appearance: PropTypes.shape({
        stroke: PropTypes.shape({
            macd: PropTypes.string.isRequired,
            signal: PropTypes.string.isRequired,
        }).isRequired,
        fill: PropTypes.shape({
            divergence: PropTypes.string.isRequired,
        }).isRequired,
    }).isRequired,
    displayFormat: PropTypes.func.isRequired,
    displayValuesFor: PropTypes.func,
    onClick: PropTypes.func,
};
MACDTooltip.defaultProps = {
    origin: [0, 0],
    displayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    className: "vninvestcharts-tooltip",
};
export default MACDTooltip;
