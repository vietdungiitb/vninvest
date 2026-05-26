import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { functor } from "../utils/index.js";
class SvgPathAnnotation extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }
    handleClick(e) {
        const { onClick } = this.props;
        if (onClick) {
            const { xScale, yScale, datum } = this.props;
            onClick({ xScale, yScale, datum }, e);
        }
    }
    render() {
        const { className, stroke, opacity } = this.props;
        const { xAccessor, xScale, yScale, path } = this.props;
        const { x, y, fill, tooltip } = helper(this.props, xAccessor, xScale, yScale);
        return (_jsxs("g", { className: className, onClick: this.handleClick, children: [_jsx("title", { children: tooltip }), _jsx("path", { d: path({ x, y }), stroke: stroke, fill: fill, opacity: opacity })] }));
    }
}
function helper(props, xAccessor, xScale, yScale) {
    const { x, y, datum, fill, tooltip, plotData } = props;
    const xFunc = functor(x);
    const yFunc = functor(y);
    const [xPos, yPos] = [xFunc({ xScale, xAccessor, datum, plotData }), yFunc({ yScale, datum, plotData })];
    return {
        x: xPos,
        y: yPos,
        fill: functor(fill)(datum),
        tooltip: functor(tooltip)(datum),
    };
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SvgPathAnnotation.propTypes = {
    className: PropTypes.string,
    path: PropTypes.func.isRequired,
    onClick: PropTypes.func,
    xAccessor: PropTypes.func,
    xScale: PropTypes.func,
    yScale: PropTypes.func,
    datum: PropTypes.object,
    stroke: PropTypes.string,
    fill: PropTypes.string,
    opacity: PropTypes.number,
};
SvgPathAnnotation.defaultProps = {
    className: "react-stockcharts-svgpathannotation",
    opacity: 1,
    x: ({ xScale, xAccessor, datum }) => xScale(xAccessor(datum)),
};
export default SvgPathAnnotation;
