import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { format } from "d3-format";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import { isDefined, functor } from "../utils/index.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
class BollingerBandTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { onClick, displayFormat, yAccessor, options, textFill, labelFill } = this.props;
        const { displayValuesFor } = this.props;
        const { chartConfig: { width, height } } = moreProps;
        const currentItem = displayValuesFor(this.props, moreProps);
        let top, middle, bottom;
        top = middle = bottom = "n/a";
        if (isDefined(currentItem)
            && isDefined(yAccessor(currentItem))) {
            const item = yAccessor(currentItem);
            top = displayFormat(item.top);
            middle = displayFormat(item.middle);
            bottom = displayFormat(item.bottom);
        }
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        const { sourcePath, windowSize, multiplier, movingAverageType } = options;
        const tooltipLabel = `BB(${sourcePath}, ${windowSize}, ${multiplier}, ${movingAverageType}): `;
        const tooltipValue = `${top}, ${middle}, ${bottom}`;
        return (_jsx("g", { transform: `translate(${x}, ${y})`, className: this.props.className, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: this.props.fontFamily, fontSize: this.props.fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, children: tooltipLabel }), _jsx("tspan", { fill: textFill, children: tooltipValue })] }) }));
    }
    render() {
        return _jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
BollingerBandTooltip.propTypes = {
    className: PropTypes.string,
    yAccessor: PropTypes.func.isRequired,
    displayValuesFor: PropTypes.func,
    displayFormat: PropTypes.func.isRequired,
    origin: PropTypes.array.isRequired,
    onClick: PropTypes.func,
    options: PropTypes.shape({
        sourcePath: PropTypes.string.isRequired,
        windowSize: PropTypes.number.isRequired,
        multiplier: PropTypes.number.isRequired,
        movingAverageType: PropTypes.string.isRequired,
    }).isRequired,
    textFill: PropTypes.string,
    labelFill: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
};
BollingerBandTooltip.defaultProps = {
    className: "react-stockcharts-tooltip react-stockcharts-bollingerband-tooltip",
    displayFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    origin: [0, 10],
};
export default BollingerBandTooltip;
