import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import OverlayBarSeries from "./OverlayBarSeries.js";
import StraightLine from "./StraightLine.js";
class ElderRaySeries extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.fillForEachBar = this.fillForEachBar.bind(this);
        this.yAccessorTop = this.yAccessorTop.bind(this);
        this.yAccessorBullTop = this.yAccessorBullTop.bind(this);
        this.yAccessorBearTop = this.yAccessorBearTop.bind(this);
        this.yAccessorBullBottom = this.yAccessorBullBottom.bind(this);
        this.yAccessorBearBottom = this.yAccessorBearBottom.bind(this);
        this.yAccessorForBarBase = this.yAccessorForBarBase.bind(this);
    }
    yAccessorTop(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && Math.max(yAccessor(d).bullPower, 0);
    }
    yAccessorBullTop(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && (yAccessor(d).bullPower > 0 ? yAccessor(d).bullPower : undefined);
    }
    yAccessorBearTop(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && (yAccessor(d).bearPower > 0 ? yAccessor(d).bearPower : undefined);
    }
    yAccessorBullBottom(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && (yAccessor(d).bullPower < 0 ? 0 : undefined);
    }
    yAccessorBearBottom(d) {
        const { yAccessor } = this.props;
        return yAccessor(d) && (yAccessor(d).bullPower < 0
            || yAccessor(d).bullPower * yAccessor(d).bearPower < 0
            ? Math.min(0, yAccessor(d).bullPower) : undefined);
    }
    yAccessorForBarBase(xScale, yScale, d) {
        const { yAccessor } = this.props;
        const y = yAccessor(d) && Math.min(yAccessor(d).bearPower, 0);
        return yScale(y);
    }
    fillForEachBar(d, yAccessorNumber) {
        const { bullPowerFill, bearPowerFill } = this.props;
        return yAccessorNumber % 2 === 0 ? bullPowerFill : bearPowerFill;
    }
    render() {
        const { className, opacity, stroke, straightLineStroke, straightLineOpacity, widthRatio } = this.props;
        const { clip } = this.props;
        return (_jsxs("g", { className: className, children: [_jsx(OverlayBarSeries, { baseAt: this.yAccessorForBarBase, className: "vninvestcharts-elderray-bar", stroke: stroke, fill: this.fillForEachBar, opacity: opacity, widthRatio: widthRatio, clip: clip, yAccessor: [this.yAccessorBullTop, this.yAccessorBearTop, this.yAccessorBullBottom, this.yAccessorBearBottom] }), _jsx(StraightLine, { className: "vninvestcharts-elderray-straight-line", yValue: 0, stroke: straightLineStroke, opacity: straightLineOpacity })] }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ElderRaySeries.propTypes = {
    className: PropTypes.string,
    yAccessor: PropTypes.func,
    opacity: PropTypes.number,
    stroke: PropTypes.bool,
    bullPowerFill: PropTypes.string,
    bearPowerFill: PropTypes.string,
    straightLineStroke: PropTypes.string,
    straightLineOpacity: PropTypes.number,
    widthRatio: PropTypes.number,
    clip: PropTypes.bool.isRequired,
};
ElderRaySeries.defaultProps = {
    className: "vninvestcharts-elderray-series",
    straightLineStroke: "#000000",
    straightLineOpacity: 0.3,
    opacity: 0.5,
    stroke: true,
    bullPowerFill: "#6BA583",
    bearPowerFill: "#FF0000",
    widthRatio: 0.8,
    clip: true,
};
export default ElderRaySeries;
