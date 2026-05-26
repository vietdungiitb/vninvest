import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PropTypes from "prop-types";
import BarSeries from "./BarSeries.js";
import LineSeries from "./LineSeries.js";
import StraightLine from "./StraightLine.js";
import { MACD as appearanceOptions } from "../indicator/defaultOptionsForAppearance.js";
const MACDSeries = (props) => {
    const { className = "react-stockcharts-macd-series", opacity = 0.6, divergenceStroke = false, widthRatio = 0.5, width = BarSeries.defaultProps.width, stroke, fill, clip = true, zeroLineStroke = "#000000", zeroLineOpacity = 0.3, yAccessor, } = props;
    const strokeConfig = stroke ?? appearanceOptions.stroke;
    const fillConfig = fill ?? appearanceOptions.fill;
    const yAccessorForMACD = (d) => yAccessor(d)?.macd;
    const yAccessorForSignal = (d) => yAccessor(d)?.signal;
    const yAccessorForDivergence = (d) => yAccessor(d)?.divergence;
    const yAccessorForDivergenceBase = (_xScale, yScale) => yScale(0);
    return (_jsxs("g", { className: className, children: [_jsx(BarSeries, { baseAt: yAccessorForDivergenceBase, className: "macd-divergence", width: width, widthRatio: widthRatio, stroke: divergenceStroke, fill: fillConfig.divergence, opacity: opacity, clip: clip, yAccessor: yAccessorForDivergence }), _jsx(LineSeries, { yAccessor: yAccessorForMACD, stroke: strokeConfig.macd, fill: "none" }), _jsx(LineSeries, { yAccessor: yAccessorForSignal, stroke: strokeConfig.signal, fill: "none" }), _jsx(StraightLine, { stroke: zeroLineStroke, opacity: zeroLineOpacity, yValue: 0 })] }));
};
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
MACDSeries.propTypes = {
    className: PropTypes.string,
    yAccessor: PropTypes.func.isRequired,
    opacity: PropTypes.number,
    divergenceStroke: PropTypes.bool,
    zeroLineStroke: PropTypes.string,
    zeroLineOpacity: PropTypes.number,
    clip: PropTypes.bool.isRequired,
    stroke: PropTypes.shape({
        macd: PropTypes.string.isRequired,
        signal: PropTypes.string.isRequired,
    }).isRequired,
    fill: PropTypes.shape({
        divergence: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
    }).isRequired,
    widthRatio: PropTypes.number,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
};
export default MACDSeries;
