import { Component } from "react";
import PropTypes from "prop-types";

import { path as d3Path } from "d3-path";

import GenericChartComponent from "../../GenericChartComponent";
import { getMouseCanvas } from "../../GenericComponent";
import { generateLine, isHovering } from "./StraightLine";

import { isDefined, isNotDefined, noop, hexToRGBA } from "../../utils";

class ChannelWithArea extends Component<any, any> {
	[key: string]: any;
	static defaultProps: any;
	constructor(props: any) {
		super(props);

		this.renderSVG = this.renderSVG.bind(this);
		this.drawOnCanvas = this.drawOnCanvas.bind(this);
		this.isHover = this.isHover.bind(this);
	}
	isHover(moreProps: any) {
		const { tolerance, onHover } = this.props;

		if (isDefined(onHover)) {

			const { lines, line1, line2 } = helper(this.props, moreProps) as any;

			if (isDefined(line1) && isDefined(line2)) {
				const { mouseXY, xScale, chartConfig: { yScale } } = moreProps;

				const line1Hovering = isHovering({
					x1Value: lines.line1.x1,
					y1Value: lines.line1.y1,
					x2Value: lines.line1.x2,
					y2Value: lines.line1.y2,
					type: "LINE",
					mouseXY,
					tolerance,
					xScale,
					yScale,
				});
				const line2Hovering = isHovering({
					x1Value: lines.line2.x1,
					y1Value: lines.line2.y1,
					x2Value: lines.line2.x2,
					y2Value: lines.line2.y2,
					type: "LINE",
					mouseXY,
					tolerance,
					xScale,
					yScale,
				});

				return line1Hovering || line2Hovering;
			}
		}
		return false;
	}
	drawOnCanvas(ctx: CanvasRenderingContext2D, moreProps: any) {
		const { stroke, strokeWidth, fillOpacity, strokeOpacity, fill } = this.props;
		const { line1, line2 } = helper(this.props, moreProps) as any;

		if (line1 !== undefined) {
			const { x1, y1, x2, y2 } = line1;

			ctx.lineWidth = strokeWidth;
			ctx.strokeStyle = hexToRGBA(stroke, strokeOpacity);

			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
			if (line2 !== undefined) {
				const {
					y1: line2Y1,
					y2: line2Y2
				} = line2;

				ctx.beginPath();
				ctx.moveTo(x1, line2Y1);
				ctx.lineTo(x2, line2Y2);
				ctx.stroke();

				ctx.fillStyle = hexToRGBA(fill, fillOpacity);
				ctx.beginPath();
				ctx.moveTo(x1, y1);

				ctx.lineTo(x2, y2);
				ctx.lineTo(x2, line2Y2);
				ctx.lineTo(x1, line2Y1);

				ctx.closePath();
				ctx.fill();
			}
		}
	}
	renderSVG(moreProps: any) {
		const { stroke, strokeWidth, fillOpacity, fill, strokeOpacity } = this.props;
		const { line1, line2 } = helper(this.props, moreProps) as any;

		if (line1 !== undefined) {
			const { x1, y1, x2, y2 } = line1;
			const line = isDefined(line2)
				? <line
					strokeWidth={strokeWidth}
					stroke={stroke}
					strokeOpacity={strokeOpacity}
					x1={x1}
					y1={line2.y1}
					x2={x2}
					y2={line2.y2}
				/>
				: null;
			const area = isDefined(line2)
				? <path
					fill={fill}
					fillOpacity={fillOpacity}
					d={getPath(line1, line2)}
				/>
				: null;

			return (
				<g>
					<line
						strokeWidth={strokeWidth}
						stroke={stroke}
						strokeOpacity={strokeOpacity}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
					/>
					{line}
					{area}
				</g>
			);
		}
	}
	render() {
		const { selected, interactiveCursorClass } = this.props;
		const { onDragStart, onDrag, onDragComplete, onHover, onUnHover } = this.props;

		return <GenericChartComponent
			isHover={this.isHover}

			svgDraw={this.renderSVG}
			canvasToDraw={getMouseCanvas}
			canvasDraw={this.drawOnCanvas}

			interactiveCursorClass={interactiveCursorClass}
			selected={selected}

			onDragStart={onDragStart}
			onDrag={onDrag}
			onDragComplete={onDragComplete}
			onHover={onHover}
			onUnHover={onUnHover}

			drawOn={["mousemove", "mouseleave", "pan", "drag"]}
		/>
	}
}

function getPath(line1: any, line2: any) {
	const ctx = d3Path();
	ctx.moveTo(line1.x1, line1.y1);
	ctx.lineTo(line1.x2, line1.y2);
	ctx.lineTo(line1.x2, line2.y2);
	ctx.lineTo(line1.x1, line2.y1);

	ctx.closePath();
	return ctx.toString();
}

function getLines(props: any, moreProps: any) {
	const { startXY, endXY, dy, type } = props;
	const { xScale } = moreProps;

	if (isNotDefined(startXY) || isNotDefined(endXY)) {
		return {};
	}
	const line1 = generateLine({
		type,
		start: startXY,
		end: endXY,
		xScale,
	})!;
	const line2 = isDefined(dy)
		? {
			...line1,
			y1: line1.y1 + dy,
			y2: line1.y2 + dy,
		}
		: undefined;


	return {
		line1,
		line2,
	};
}

function helper(props: any, moreProps: any) {
	const lines: any = getLines(props, moreProps);
	const { xScale, chartConfig: { yScale } } = moreProps;

	const x1 = xScale(lines.line1.x1);
	const y1 = yScale(lines.line1.y1);
	const x2 = xScale(lines.line1.x2);
	const y2 = yScale(lines.line1.y2);

	const line2 = lines.line2 !== undefined
		? {
			x1,
			y1: yScale(lines.line2.y1),
			x2,
			y2: yScale(lines.line2.y2),
		}
		: undefined;

	return {
		lines,
		line1: {
			x1, y1, x2, y2
		},
		line2
	};
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ChannelWithArea.propTypes = {
	interactiveCursorClass: PropTypes.string,
	stroke: PropTypes.string.isRequired,
	strokeWidth: PropTypes.number.isRequired,
	fill: PropTypes.string.isRequired,
	fillOpacity: PropTypes.number.isRequired,
	strokeOpacity: PropTypes.number.isRequired,

	type: PropTypes.oneOf([
		"XLINE",
		"RAY",
		"LINE",
	]).isRequired,

	onDragStart: PropTypes.func.isRequired,
	onDrag: PropTypes.func.isRequired,
	onDragComplete: PropTypes.func.isRequired,
	onHover: PropTypes.func,
	onUnHover: PropTypes.func,

	defaultClassName: PropTypes.string,

	tolerance: PropTypes.number.isRequired,
	selected: PropTypes.bool.isRequired,
};

ChannelWithArea.defaultProps = {
	onDragStart: noop,
	onDrag: noop,
	onDragComplete: noop,
	type: "LINE",

	strokeWidth: 1,
	tolerance: 4,
	selected: false,
};

export default ChannelWithArea;

