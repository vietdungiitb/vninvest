
import React, { Component } from "react";
import PropTypes from "prop-types";
import GenericComponent, { getMouseCanvas } from "../GenericComponent";
import StockChartContext from "../StockChartContext";

import { hexToRGBA, isDefined, isNotDefined, strokeDashTypes, getStrokeDasharray } from "../utils";

class CrossHairCursor extends Component<any, any> {
	static defaultProps: any;
	declare context: any;

	constructor(props: any) {
		super(props);
		this.renderSVG = this.renderSVG.bind(this);
		this.drawOnCanvas = this.drawOnCanvas.bind(this);
	}
	drawOnCanvas(ctx: any, moreProps: any) {
		const lines = helper(this.props, moreProps);

		if (isDefined(lines)) {
				const safeLines = lines as any[];

			const { margin, ratio } = this.context;
			const originX = 0.5 * ratio + margin.left;
			const originY = 0.5 * ratio + margin.top;

			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(ratio, ratio);

			ctx.translate(originX, originY);

				safeLines.forEach((line: any) => {
				const dashArray = getStrokeDasharray(line.strokeDasharray).split(",").map(d => +d);

				ctx.strokeStyle = hexToRGBA(line.stroke, line.opacity);
				ctx.setLineDash(dashArray);
				ctx.beginPath();
				ctx.moveTo(line.x1, line.y1);
				ctx.lineTo(line.x2, line.y2);
				ctx.stroke();
			});

			ctx.restore();
		}
	}
	renderSVG(moreProps: any) {
		const { className } = this.props;
		const lines = helper(this.props, moreProps);

		if (isNotDefined(lines)) return null;
			const safeLines = lines as any[];

		return (
			<g className={`react-stockcharts-crosshair ${className}`}>
					{safeLines.map(({ strokeDasharray, ...rest }: any, idx: number) =>
					<line
						key={idx}
						strokeDasharray={getStrokeDasharray(strokeDasharray)}
						{...rest} />)}
			</g>
		);
	}
	render() {
		return <GenericComponent
			svgDraw={this.renderSVG}
			clip={false}
			canvasDraw={this.drawOnCanvas}
			canvasToDraw={getMouseCanvas}
			drawOn={["mousemove", "pan", "drag"]}
		/>;
	}
}

(CrossHairCursor as any).contextType = StockChartContext;

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
CrossHairCursor.propTypes = {
	className: PropTypes.string,
	strokeDasharray: PropTypes.oneOf(strokeDashTypes),
};

function customX(props: any, moreProps: any) {
	const { xScale, xAccessor, currentItem, mouseXY } = moreProps;
	const { snapX } = props;
	const x = snapX
		? Math.round(xScale(xAccessor(currentItem)))
		: mouseXY[0];
	return x;
}


CrossHairCursor.defaultProps = {
	stroke: "#000000",
	opacity: 0.3,
	strokeDasharray: "ShortDash",
	snapX: true,
	customX,
};

function helper(props: any, moreProps: any) {
	const {
		mouseXY, currentItem, show, height, width
	} = moreProps;

	const { customX, stroke, opacity, strokeDasharray } = props;

	if (!show || isNotDefined(currentItem)) return null;

	const line1 = {
		x1: 0,
		x2: width,
		y1: mouseXY[1],
		y2: mouseXY[1],
		stroke, strokeDasharray, opacity,
	};
	const x = customX(props, moreProps);

	const line2 = {
		x1: x,
		x2: x,
		y1: 0,
		y2: height,
		stroke, strokeDasharray, opacity,
	};
	return [line1, line2];
}

export default CrossHairCursor;
