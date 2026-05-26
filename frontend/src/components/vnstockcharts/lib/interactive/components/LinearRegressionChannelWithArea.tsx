import { Component } from "react";
import PropTypes from "prop-types";
import { sum, deviation } from "d3-array";
import { path as d3Path } from "d3-path";

import GenericChartComponent from "../../GenericChartComponent";
import { getMouseCanvas } from "../../GenericComponent";
import { isHovering2 } from "./StraightLine";

import { isDefined, getClosestItemIndexes, noop, zipper, hexToRGBA } from "../../utils";

class LinearRegressionChannelWithArea extends Component<any, any> {
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
			const { mouseXY } = moreProps;

			const { x1, y1, x2, y2, dy } = helper(this.props, moreProps);
			const yDiffs = [-dy, 0, dy];

			const hovering = yDiffs.reduce((result, diff) => result || isHovering2(
				[x1, y1 + diff], [x2, y2 + diff], mouseXY, tolerance
			), false);
			return hovering;
		}
		return false;
	}
	drawOnCanvas(ctx: CanvasRenderingContext2D, moreProps: any) {
		const { stroke, strokeWidth, fillOpacity, strokeOpacity, fill } = this.props;
		const { x1, y1, x2, y2, dy } = helper(this.props, moreProps);

		ctx.lineWidth = strokeWidth;
		ctx.strokeStyle = hexToRGBA(stroke, strokeOpacity);
		ctx.fillStyle = hexToRGBA(fill, fillOpacity);

		ctx.beginPath();
		ctx.moveTo(x1, y1 - dy);
		ctx.lineTo(x2, y2 - dy);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(x2, y2 + dy);
		ctx.lineTo(x1, y1 + dy);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(x1, y1 - dy);
		ctx.lineTo(x2, y2 - dy);
		ctx.lineTo(x2, y2 + dy);
		ctx.lineTo(x1, y1 + dy);
		ctx.closePath();
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(x2, y2);
		ctx.lineTo(x1, y1);
		ctx.stroke();
	}
	renderSVG(moreProps: any) {
		const { stroke, strokeWidth, fillOpacity, strokeOpacity, fill } = this.props;
		const { x1, y1, x2, y2, dy } = helper(this.props, moreProps);
		const line = {
			strokeWidth,
			stroke,
			strokeOpacity,
		};
		const ctx = d3Path();
		ctx.moveTo(x1, y1 - dy);
		ctx.lineTo(x2, y2 - dy);
		ctx.lineTo(x2, y2 + dy);
		ctx.lineTo(x1, y1 + dy);
		ctx.closePath();
		return (
			<g>
				<line
					{...line}
					x1={x1}
					y1={y1 - dy}
					x2={x2}
					y2={y2 - dy}
				/>
				<line
					{...line}
					x1={x1}
					y1={y1 + dy}
					x2={x2}
					y2={y2 + dy}
				/>
				<path
					d={ctx.toString()}
					fill={fill}
					fillOpacity={fillOpacity}
				/>
				<line
					{...line}
					x1={x1}
					y1={y1}
					x2={x2}
					y2={y2}
				/>
			</g>
		);
	}
	render() {
		const { selected, interactiveCursorClass } = this.props;
		const { onHover, onUnHover } = this.props;

		return <GenericChartComponent
			isHover={this.isHover}

			svgDraw={this.renderSVG}
			canvasToDraw={getMouseCanvas}
			canvasDraw={this.drawOnCanvas}

			interactiveCursorClass={interactiveCursorClass}
			selected={selected}

			onHover={onHover}
			onUnHover={onUnHover}

			drawOn={["mousemove", "mouseleave", "pan", "drag"]}
		/>
	}
}

export function edge1Provider(props: any) {
	return function(moreProps: any) {
		const { x1, y1 } = helper(props, moreProps);
		return [x1, y1];
	};
}

export function edge2Provider(props: any) {
	return function(moreProps: any) {
		const { x2, y2 } = helper(props, moreProps);
		return [x2, y2];
	};
}


function helper(props: any, moreProps: any) {
	const { x1Value, x2Value, type } = props;

	const { xScale, chartConfig: { yScale }, fullData } = moreProps;
	const { xAccessor } = moreProps;

	const { left } = getClosestItemIndexes(fullData, x1Value, xAccessor, false);
	const { right } = getClosestItemIndexes(fullData, x2Value, xAccessor, false);

	const startIndex = Math.min(left, right);
	const endIndex = Math.max(left, right) + 1;

	const array = fullData.slice(startIndex, endIndex);

	const xs = array.map((d: any) => xAccessor(d).valueOf());
	const ys = array.map((d: any) => d.close);
	const n = array.length;

	const combine = zipper()
		.combine((x: any, y: any) => x * y);

	const xys = combine(xs, ys);
	const xSquareds = xs.map((x: any) => Math.pow(x, 2));

	const b = (n * sum(xys) - sum(xs) * sum(ys)) / (n * sum(xSquareds) - Math.pow(sum(xs), 2));
	const a = (sum(ys) - b * sum(xs)) / n;

	const newy1 = a + b * x1Value;
	const newy2 = a + b * x2Value;

	const x1 = xScale(x1Value);
	const y1 = yScale(newy1);
	const x2 = xScale(x2Value);
	const y2 = yScale(newy2);

	const stdDev = type === "SD"
		? deviation(array, (d: any) => d.close) ?? 0
		: 0;

	const dy = yScale(newy1 - stdDev) - y1;

	return {
		x1, y1, x2, y2, dy
	};
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
LinearRegressionChannelWithArea.propTypes = {
	selected: PropTypes.bool.isRequired,
	interactiveCursorClass: PropTypes.string,
	tolerance: PropTypes.number.isRequired,
	onHover: PropTypes.func,
	onUnHover: PropTypes.func,
	stroke: PropTypes.string.isRequired,
	strokeWidth: PropTypes.number.isRequired,
	fillOpacity: PropTypes.number.isRequired,
	strokeOpacity: PropTypes.number.isRequired,
	fill: PropTypes.string.isRequired,
};

LinearRegressionChannelWithArea.defaultProps = {
	strokeWidth: 1,
	tolerance: 4,
	selected: false,
};

export default LinearRegressionChannelWithArea;

