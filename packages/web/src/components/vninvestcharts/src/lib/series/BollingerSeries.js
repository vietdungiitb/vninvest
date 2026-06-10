import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import LineSeries from "./LineSeries.js";
import AreaOnlySeries from "./AreaOnlySeries.js";
class BollingerSeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.yAccessorForTop = this.yAccessorForTop.bind(this);
        this.yAccessorForMiddle = this.yAccessorForMiddle.bind(this);
        this.yAccessorForBottom = this.yAccessorForBottom.bind(this);
        this.yAccessorForScalledBottom = this.yAccessorForScalledBottom.bind(this);
    }
    yAccessorForTop(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && yAccessor(d).top;
    }
    yAccessorForMiddle(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && yAccessor(d).middle;
    }
    yAccessorForBottom(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && yAccessor(d).bottom;
    }
    yAccessorForScalledBottom(scale, d) {
        const { yAccessor } = this.props;
        return scale(yAccessor(d) && yAccessor(d).bottom);
    }
    render() {
        const { areaClassName, className, opacity, fillMode } = this.props;
        const { stroke, strokeWidth, fill } = this.props;
        return (_jsxs("g", { className: className, children: [_jsx(LineSeries, { yAccessor: this.yAccessorForTop, stroke: stroke.top, strokeWidth: strokeWidth?.top, fill: "none" }), _jsx(LineSeries, { yAccessor: this.yAccessorForMiddle, stroke: stroke.middle, strokeWidth: strokeWidth?.middle, fill: "none" }), _jsx(LineSeries, { yAccessor: this.yAccessorForBottom, stroke: stroke.bottom, strokeWidth: strokeWidth?.bottom, fill: "none" }), _jsx(AreaOnlySeries, { className: areaClassName, yAccessor: this.yAccessorForTop, base: this.yAccessorForScalledBottom, stroke: "none", fill: fill, opacity: opacity, fillMode: fillMode })] }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
BollingerSeries.propTypes = {
    yAccessor: PropTypes.func.isRequired,
    className: PropTypes.string,
    areaClassName: PropTypes.string,
    opacity: PropTypes.number,
    type: PropTypes.string,
    stroke: PropTypes.shape({
        top: PropTypes.string.isRequired,
        middle: PropTypes.string.isRequired,
        bottom: PropTypes.string.isRequired,
    }).isRequired,
    strokeWidth: PropTypes.shape({
        top: PropTypes.number,
        middle: PropTypes.number,
        bottom: PropTypes.number,
    }),
    fill: PropTypes.string.isRequired,
    fillMode: PropTypes.string,
};
BollingerSeries.defaultProps = {
    className: "vninvestcharts-bollinger-band-series",
    areaClassName: "vninvestcharts-bollinger-band-series-area",
    opacity: 0.2
};
export default BollingerSeries;
