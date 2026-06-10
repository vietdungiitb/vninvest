import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import { format } from "d3-format";
import { utcFormat } from "d3-time-format";
import displayValuesFor from "./displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import { isDefined, functor } from "../utils/index.js";
import ToolTipText from "./ToolTipText.js";
import ToolTipTSpanLabel from "./ToolTipTSpanLabel.js";
class OHLCTooltip extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    renderSVG(moreProps) {
        const { displayValuesFor } = this.props;
        const { xDisplayFormat, accessor, volumeFormat, ohlcFormat, percentFormat, displayTexts } = this.props;
        const chartConfigList = moreProps.chartConfig;
        const config = Array.isArray(chartConfigList)
            ? chartConfigList.find((each) => each.id === moreProps.chartId) || chartConfigList[0]
            : chartConfigList;
        if (!config)
            return null;
        const { width, height } = config;
        const { displayXAccessor } = moreProps;
        const currentItem = displayValuesFor(this.props, moreProps);
        let displayDate, open, high, low, close, volume, percent;
        displayDate = open = high = low = close = volume = percent = displayTexts.na;
        if (isDefined(currentItem) && isDefined(accessor(currentItem))) {
            const item = accessor(currentItem);
            volume = isDefined(item.volume) ? volumeFormat(item.volume) : displayTexts.na;
            displayDate = xDisplayFormat(displayXAccessor(item));
            open = ohlcFormat(item.open);
            high = ohlcFormat(item.high);
            low = ohlcFormat(item.low);
            close = ohlcFormat(item.close);
            percent = percentFormat((item.close - item.open) / item.open);
        }
        const { origin: originProp } = this.props;
        const origin = functor(originProp);
        const [x, y] = origin(width, height);
        const itemsToDisplay = {
            displayDate,
            open,
            high,
            low,
            close,
            percent,
            volume,
            x,
            y
        };
        return this.props.children(this.props, moreProps, itemsToDisplay);
    }
    render() {
        return (_jsx(GenericChartComponent, { clip: false, svgDraw: this.renderSVG, drawOn: ["mousemove"] }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
OHLCTooltip.propTypes = {
    className: PropTypes.string,
    accessor: PropTypes.func,
    xDisplayFormat: PropTypes.func,
    children: PropTypes.func,
    volumeFormat: PropTypes.func,
    percentFormat: PropTypes.func,
    ohlcFormat: PropTypes.func,
    origin: PropTypes.oneOfType([PropTypes.array, PropTypes.func]),
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    onClick: PropTypes.func,
    displayValuesFor: PropTypes.func,
    textFill: PropTypes.string,
    labelFill: PropTypes.string,
    displayTexts: PropTypes.object,
};
const displayTextsDefault = {
    d: "Date: ",
    o: " O: ",
    h: " H: ",
    l: " L: ",
    c: " C: ",
    v: " Vol: ",
    na: "n/a"
};
OHLCTooltip.defaultProps = {
    accessor: (d) => {
        return {
            date: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume
        };
    },
    xDisplayFormat: utcFormat("%Y-%m-%d"),
    volumeFormat: format(".4s"),
    percentFormat: format(".2%"),
    ohlcFormat: format(".2f"),
    displayValuesFor: displayValuesFor,
    origin: [0, 0],
    children: defaultDisplay,
    displayTexts: displayTextsDefault,
};
function defaultDisplay(props, moreProps, itemsToDisplay) {
    const { className, textFill, labelFill, onClick, fontFamily, fontSize, displayTexts } = props;
    const { displayDate, open, high, low, close, volume, x, y } = itemsToDisplay;
    return (_jsx("g", { className: `vninvestcharts-tooltip-hover ${className}`, transform: `translate(${x}, ${y})`, onClick: onClick, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, x: 0, dy: "5", children: displayTexts.d }, "label"), _jsx("tspan", { fill: textFill, children: displayDate }, "value"), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: displayTexts.o }, "label_O"), _jsx("tspan", { fill: textFill, children: open }, "value_O"), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: displayTexts.h }, "label_H"), _jsx("tspan", { fill: textFill, children: high }, "value_H"), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: displayTexts.l }, "label_L"), _jsx("tspan", { fill: textFill, children: low }, "value_L"), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: displayTexts.c }, "label_C"), _jsx("tspan", { fill: textFill, children: close }, "value_C"), _jsx(ToolTipTSpanLabel, { fill: labelFill, children: displayTexts.v }, "label_Vol"), _jsx("tspan", { fill: textFill, children: volume }, "value_Vol")] }) }));
}
export default OHLCTooltip;
