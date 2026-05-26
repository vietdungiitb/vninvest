import { Component } from "react";
import PropTypes from "prop-types";
import PureComponent from "./utils/PureComponent";
import StockChartContext from "./StockChartContext";

import { hexToRGBA, isDefined } from "./utils";

class BackgroundText extends PureComponent {
	[key: string]: any;
	declare context: any;
	static defaultProps: any;
	static drawOnCanvas: any;
	static contextType = StockChartContext;
	componentDidMount() {
		if (this.context.chartCanvasType !== "svg" && isDefined(this.context.getCanvasContexts)) {
			const contexts = this.context.getCanvasContexts();
			const interval = isDefined(this.props.interval) ? this.props.interval : this.context.interval;
			if (contexts) BackgroundText.drawOnCanvas(contexts.bg, this.props, { interval }, this.props.children);
		}
	}
	componentDidUpdate() {
		this.componentDidMount();
	}
	render() {
		const { chartCanvasType } = this.context;

		if (chartCanvasType !== "svg") return null;

		const { x, y, fill, opacity, stroke, strokeOpacity, fontFamily, fontSize, textAnchor } = this.props;
		const props = { x, y, fill, opacity, stroke, strokeOpacity, fontFamily, fontSize, textAnchor };
		const interval = isDefined(this.props.interval) ? this.props.interval : this.context.interval;
		return (
			<text {...props}>{this.props.children(interval)}</text>
		);
	}
}

BackgroundText.drawOnCanvas = (ctx: any, props: any, { interval }: any, getText: any) => {
	ctx.clearRect(-1, -1, ctx.canvas.width + 2, ctx.canvas.height + 2);
	ctx.save();

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.translate(0.5, 0.5);

	const { x, y, fill, opacity, stroke, strokeOpacity, fontFamily, fontSize, textAnchor } = props;

	const text = getText(interval);

	ctx.strokeStyle = hexToRGBA(stroke, strokeOpacity);

	ctx.font = `${ fontSize }px ${ fontFamily }`;
	ctx.fillStyle = hexToRGBA(fill, opacity);
	ctx.textAlign = textAnchor === "middle" ? "center" : textAnchor;

	if (stroke !== "none") ctx.strokeText(text, x, y);
	ctx.fillText(text, x, y);

	ctx.restore();
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
BackgroundText.propTypes = {
	x: PropTypes.number.isRequired,
	y: PropTypes.number.isRequired,
	fontFamily: PropTypes.string,
	fontSize: PropTypes.number.isRequired,
	fill: PropTypes.string,
	stroke: PropTypes.string,
	opacity: PropTypes.number,
	strokeOpacity: PropTypes.number,
	textAnchor: PropTypes.string,
	children: PropTypes.func,
	interval: PropTypes.string,
};

BackgroundText.defaultProps = {
	opacity: 0.3,
	fill: "#9E7523",
	stroke: "#9E7523",
	strokeOpacity: 1,
	fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
	fontSize: 12,
	textAnchor: "middle",
};
export default BackgroundText;