import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from "d3-format";
import { Component } from "react";
import PropTypes from "prop-types";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import { isDefined, functor } from "../utils/index.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
class RSITooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { onClick, fontFamily, fontSize, yAccessor, displayFormat, className } = this.props;
        const { options, labelFill, textFill } = this.props;
        const { displayValuesFor } = this.props;
        const { chartConfig: { width, height } } = moreProps;
        const currentItem = displayValuesFor(this.props, moreProps);
        const rsi = isDefined(currentItem) && yAccessor(currentItem);
        const value = (rsi && displayFormat(rsi)) || "n/a";
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        const tooltipLabel = `RSI (${options.windowSize}): `;
        return (_jsx("g", { className: className, transform: `translate(${x}, ${y})`, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, children: tooltipLabel }), _jsx("tspan", { fill: textFill, children: value })] }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
RSITooltip.propTypes = {
    origin: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.func
    ]).isRequired,
    options: PropTypes.shape({
        windowSize: PropTypes.number.isRequired,
    }).isRequired,
    className: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    onClick: PropTypes.func,
    yAccessor: PropTypes.func.isRequired,
    displayFormat: PropTypes.func.isRequired,
    displayValuesFor: PropTypes.func,
    textFill: PropTypes.string,
    labelFill: PropTypes.string,
};
RSITooltip.defaultProps = {
    displayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    origin: [0, 0],
    className: "vninvestcharts-tooltip",
};
export default RSITooltip;
