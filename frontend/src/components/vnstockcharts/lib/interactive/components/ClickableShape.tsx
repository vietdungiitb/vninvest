import { Component } from "react";
import PropTypes from "prop-types";

import GenericChartComponent from "../../GenericChartComponent";
import { getMouseCanvas } from "../../GenericComponent";

import { isHovering2 } from "./StraightLine";
import { hexToRGBA } from "../../utils";

class ClickableShape extends Component<any, any> {
	[key: string]: any;
	static defaultProps: any;
	constructor(props: any) {
		super(props);
		this.saveNode = this.saveNode.bind(this);
		this.drawOnCanvas = this.drawOnCanvas.bind(this);
		this.isHover = this.isHover.bind(this);
	}
	saveNode(node: any) {
		this.node = node;
	}
	isHover(moreProps: any) {
		const { mouseXY } = moreProps;
		if (this.closeIcon) {
			const { textBox } = this.props;
			const { x, y } = this.closeIcon;
			const halfWidth = textBox.closeIcon.width / 2;

			const start1 = [x - halfWidth, y - halfWidth];
			const end1 = [x + halfWidth, y + halfWidth];
			const start2 = [x - halfWidth, y + halfWidth];
			const end2 = [x + halfWidth, y - halfWidth];

			if (isHovering2(start1, end1, mouseXY, 3) || isHovering2(start2, end2, mouseXY, 3)) {
				return true;
			}
		}
		return false;
	}
	drawOnCanvas(ctx: CanvasRenderingContext2D, moreProps: any) {
		const { stroke, strokeWidth, strokeOpacity, hovering, textBox } = this.props;

		const [x, y] = helper(this.props, moreProps, ctx);

		this.closeIcon = { x, y };
		ctx.beginPath();

		ctx.lineWidth = hovering ? strokeWidth + 1 : strokeWidth;
		ctx.strokeStyle = hexToRGBA(stroke, strokeOpacity);
		const halfWidth = textBox.closeIcon.width / 2;
		ctx.moveTo(x - halfWidth, y - halfWidth);
		ctx.lineTo(x + halfWidth, y + halfWidth);
		ctx.moveTo(x - halfWidth, y + halfWidth);
		ctx.lineTo(x + halfWidth, y - halfWidth);
		ctx.stroke();
	}
	renderSVG() {
		return null;
	}
	render() {
		const { interactiveCursorClass } = this.props;
		const { show } = this.props;
		const { onHover, onUnHover, onClick } = this.props;

		return show
			? <GenericChartComponent {...({ ref: this.saveNode } as any)}
				interactiveCursorClass={interactiveCursorClass}
				isHover={this.isHover}

				onClickWhenHover={onClick}

				svgDraw={this.renderSVG}

				canvasDraw={this.drawOnCanvas}
				canvasToDraw={getMouseCanvas}

				onHover={onHover}
				onUnHover={onUnHover}

				drawOn={["pan", "mousemove", "drag"]}
			/>
			: null;
	}
}

function helper(props: any, moreProps: any, ctx: CanvasRenderingContext2D) {
	const { yValue, text, textBox } = props;
	const { fontFamily, fontStyle, fontWeight, fontSize } = props;
	ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

	const { chartConfig: { yScale } } = moreProps;

	const x = textBox.left
		+ textBox.padding.left
		+ ctx.measureText(text).width
		+ textBox.padding.right
		+ textBox.closeIcon.padding.left
		+ textBox.closeIcon.width / 2;

	const y = yScale(yValue);

	return [x, y];

}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ClickableShape.propTypes = {
	stroke: PropTypes.string.isRequired,
	strokeOpacity: PropTypes.number.isRequired,
	strokeWidth: PropTypes.number.isRequired,
	textBox: PropTypes.object.isRequired,
	hovering: PropTypes.bool,
	interactiveCursorClass: PropTypes.string,
	show: PropTypes.bool,
	onHover: PropTypes.func,
	onUnHover: PropTypes.func,
	onClick: PropTypes.func,
};


ClickableShape.defaultProps = {
	show: false,
	fillOpacity: 1,
	strokeOpacity: 1,
	strokeWidth: 1,
};

export default ClickableShape;
