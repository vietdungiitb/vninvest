import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericComponent from "../GenericComponent.js";
import StockChartContext from "../StockChartContext.js";
import { isDefined, hexToRGBA, functor } from "../utils/index.js";
import LabelAnnotation, { defaultProps, helper } from "./LabelAnnotation.js";
class Label extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
        this.drawOnCanvas = this.drawOnCanvas.bind(this);
    }
    drawOnCanvas(ctx, moreProps) {
        drawOnCanvas2(ctx, this.props, this.context, moreProps);
    }
    render() {
        return _jsx(GenericComponent, { canvasToDraw: this.props.selectCanvas, svgDraw: this.renderSVG, canvasDraw: this.drawOnCanvas, drawOn: [] });
    }
    renderSVG(moreProps) {
        const { chartConfig } = moreProps;
        return _jsx(LabelAnnotation, { yScale: getYScale(chartConfig), ...this.props, text: getText(this.props) });
    }
}
Label.contextType = StockChartContext;
function getText(props) {
    return functor(props.text)(props);
}
function getYScale(chartConfig) {
    return Array.isArray(chartConfig) ? undefined : chartConfig.yScale;
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
Label.propTypes = {
    className: PropTypes.string,
    selectCanvas: PropTypes.func,
    text: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]).isRequired,
    textAnchor: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    opacity: PropTypes.number,
    rotate: PropTypes.number,
    onClick: PropTypes.func,
    xAccessor: PropTypes.func,
    xScale: PropTypes.func,
    yScale: PropTypes.func,
    datum: PropTypes.object,
    x: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.func
    ]),
    y: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.func
    ])
};
Label.defaultProps = {
    ...defaultProps,
    selectCanvas: (canvases) => canvases.bg,
};
function drawOnCanvas2(ctx, props, context, moreProps) {
    ctx.save();
    const { canvasOriginX, canvasOriginY, margin, ratio } = context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    if (isDefined(canvasOriginX))
        ctx.translate(canvasOriginX, canvasOriginY);
    else
        ctx.translate(margin.left + (0.5 * ratio), margin.top + (0.5 * ratio));
    drawOnCanvas(ctx, props, moreProps);
    ctx.restore();
}
function drawOnCanvas(ctx, props, moreProps) {
    const { textAnchor, fontFamily, fontSize, opacity, rotate } = props;
    const { xScale, chartConfig, xAccessor } = moreProps;
    const { xPos, yPos, fill, text } = helper(props, xAccessor, xScale, getYScale(chartConfig));
    const radians = (rotate / 180) * Math.PI;
    ctx.save();
    ctx.translate(xPos, yPos);
    ctx.rotate(radians);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = hexToRGBA(fill, opacity);
    ctx.textAlign = textAnchor === "middle" ? "center" : textAnchor;
    ctx.beginPath();
    ctx.fillText(text, 0, 0);
    ctx.restore();
}
export default Label;
