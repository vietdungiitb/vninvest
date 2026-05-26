import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { functor } from "../utils/index.js";
class BarAnnotation extends Component {
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
        const { text, textXOffset, textYOffset, textAnchor, fontFamily, fontSize, textFill, textOpacity, textRotate } = this.props;
        const { x, y, fill, tooltip } = helper(this.props, xAccessor, xScale, yScale);
        const { textIcon, textIconFontSize, textIconFill, textIconOpacity, textIconRotate, textIconXOffset, textIconYOffset } = this.props;
        return (_jsxs("g", { className: className, onClick: this.handleClick, children: [tooltip != null ? _jsx("title", { children: tooltip }) : null, text != null ? (_jsx("text", { x: x, y: y, dx: textXOffset, dy: textYOffset, fontFamily: fontFamily, fontSize: fontSize, fill: textFill, opacity: textOpacity, transform: textRotate != null
                        ? `rotate(${textRotate}, ${x}, ${y})`
                        : undefined, textAnchor: textAnchor, children: text })) : null, textIcon != null ? (_jsx("text", { x: x, y: y, dx: textIconXOffset, dy: textIconYOffset, fontSize: textIconFontSize, fill: textIconFill, opacity: textIconOpacity, transform: textIconRotate != null
                        ? `rotate(${textIconRotate}, ${x}, ${y})`
                        : undefined, textAnchor: textAnchor, children: textIcon })) : null, path != null ? (_jsx("path", { d: path({ x, y }), stroke: stroke, fill: fill, opacity: opacity })) : null] }));
    }
}
function helper(props, xAccessor, xScale, yScale) {
    const { x, y, datum, fill, tooltip, plotData } = props;
    const xFunc = functor(x);
    const yFunc = functor(y);
    const [xPos, yPos] = [
        xFunc({ xScale, xAccessor, datum, plotData }),
        yFunc({ yScale, datum, plotData })
    ];
    return {
        x: xPos,
        y: yPos,
        fill: functor(fill)(datum),
        tooltip: functor(tooltip)(datum)
    };
}
/**
 * any unicode can be applied.
 * @param {any} type
 */
export function getArrowForTextIcon(type) {
    const arrows = {
        simpleUp: "⬆",
        simpleDown: "⬇",
        fatUp: "▲",
        fatDown: "▼",
        lightUp: "↑",
        lightDown: "↓",
        dashedUp: "⇡",
        dashedDown: "⇣",
        dashedRight: "➟",
        fatRight: "➡",
        right: "➤"
    };
    return arrows[type];
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
BarAnnotation.propTypes = {
    className: PropTypes.string,
    path: PropTypes.func,
    onClick: PropTypes.func,
    xAccessor: PropTypes.func,
    xScale: PropTypes.func,
    yScale: PropTypes.func,
    datum: PropTypes.object,
    stroke: PropTypes.string,
    fill: PropTypes.string,
    opacity: PropTypes.number,
    text: PropTypes.string,
    textAnchor: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    textOpacity: PropTypes.number,
    textFill: PropTypes.string,
    textRotate: PropTypes.number,
    textXOffset: PropTypes.number,
    textYOffset: PropTypes.number,
    textIcon: PropTypes.string,
    textIconFontSize: PropTypes.number,
    textIconOpacity: PropTypes.number,
    textIconFill: PropTypes.string,
    textIconRotate: PropTypes.number,
    textIconXOffset: PropTypes.number,
    textIconYOffset: PropTypes.number,
    textIconAnchor: PropTypes.string
};
BarAnnotation.defaultProps = {
    className: "react-stockcharts-bar-annotation",
    opacity: 1,
    fill: "#000000",
    textAnchor: "middle",
    fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
    fontSize: 10,
    textFill: "#000000",
    textOpacity: 1,
    textIconFill: "#000000",
    textIconFontSize: 10,
    x: ({ xScale, xAccessor, datum }) => xScale(xAccessor(datum))
};
export default BarAnnotation;
