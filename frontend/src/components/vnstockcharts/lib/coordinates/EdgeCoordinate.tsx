
import React, { Component } from "react";
import PropTypes from "prop-types";

import { hexToRGBA, isDefined } from "../utils";

class EdgeCoordinate extends Component<any, any> {
	static defaultProps: any;
	static drawOnCanvasStatic: any;

	render() {
		const { className } = this.props;

		const edge = helper(this.props);
		if (edge === null) return null;
		let line, coordinateBase, coordinate;

		if (isDefined(edge.line)) {
				const edgeLine = edge.line!;
			line = <line
					className="react-stockcharts-cross-hair" opacity={edgeLine.opacity} stroke={edgeLine.stroke}
					x1={edgeLine.x1} y1={edgeLine.y1}
					x2={edgeLine.x2} y2={edgeLine.y2} />;
		}
		if (isDefined(edge.coordinateBase)) {
				const edgeCoordinateBase = edge.coordinateBase!;
				const edgeCoordinate = edge.coordinate!;

				const { rectWidth, rectHeight, arrowWidth } = edgeCoordinateBase;

			const path = edge.orient === "left"
				? `M0,0L0,${ rectHeight }L${ rectWidth },${ rectHeight }L${ rectWidth + arrowWidth },10L${ rectWidth },0L0,0L0,0`
				: `M0,${ arrowWidth }L${ arrowWidth },${ rectHeight }L${ rectWidth + arrowWidth },${ rectHeight }L${ rectWidth + arrowWidth },0L${ arrowWidth },0L0,${ arrowWidth }`;

			coordinateBase = edge.orient === "left" || edge.orient === "right"
					? <g transform={`translate(${edgeCoordinateBase.edgeXRect},${edgeCoordinateBase.edgeYRect})`}>
					<path d={path} key={1} className="react-stockchart-text-background"
						height={rectHeight} width={rectWidth}
							fill={edgeCoordinateBase.fill} opacity={edgeCoordinateBase.opacity} />
				</g>
				: <rect key={1} className="react-stockchart-text-background"
						x={edgeCoordinateBase.edgeXRect}
						y={edgeCoordinateBase.edgeYRect}
					height={rectHeight} width={rectWidth}
						fill={edgeCoordinateBase.fill} opacity={edgeCoordinateBase.opacity} />;

				coordinate = (<text key={2} x={edgeCoordinate.edgeXText}
					y={edgeCoordinate.edgeYText}
					textAnchor={edgeCoordinate.textAnchor as any}
					fontFamily={edgeCoordinate.fontFamily}
					fontSize={edgeCoordinate.fontSize}
					dy=".32em" fill={edgeCoordinate.textFill} >{edgeCoordinate.displayCoordinate}</text>);
		}
		return (
			<g className={className}>
				{line}
				{coordinateBase}
				{coordinate}
			</g>
		);
	}
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
EdgeCoordinate.propTypes = {
	className: PropTypes.string,
	type: PropTypes.oneOf(["vertical", "horizontal"]).isRequired,
	coordinate: PropTypes.any.isRequired,
	x1: PropTypes.number.isRequired,
	y1: PropTypes.number.isRequired,
	x2: PropTypes.number.isRequired,
	y2: PropTypes.number.isRequired,
	orient: PropTypes.oneOf(["bottom", "top", "left", "right"]),
	rectWidth: PropTypes.number,
	hideLine: PropTypes.bool,
	fill: PropTypes.string,
	opacity: PropTypes.number,
	fontFamily: PropTypes.string.isRequired,
	fontSize: PropTypes.number.isRequired,
};

EdgeCoordinate.defaultProps = {
	className: "react-stockcharts-edgecoordinate",
	orient: "left",
	hideLine: false,
	fill: "#8a8a8a",
	opacity: 1,
	fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
	fontSize: 13,
	textFill: "#FFFFFF",
	lineStroke: "#000000",
	lineOpacity: 0.3,
	arrowWidth: 10,
};


function helper(props: any) {
	const { coordinate: displayCoordinate, show, type, orient, edgeAt, hideLine } = props;
	const { fill, opacity, fontFamily, fontSize, textFill, lineStroke, lineOpacity, arrowWidth } = props;
	const { rectWidth, rectHeight } = props;
	const { x1, y1, x2, y2 } = props;

	if (!show) return null;

	let edgeXRect, edgeYRect, edgeXText, edgeYText;

	if (type === "horizontal") {

		edgeXRect = (orient === "right") ? edgeAt + 1 : edgeAt - rectWidth - arrowWidth - 1;
		edgeYRect = y1 - (rectHeight / 2);
		edgeXText = (orient === "right") ? edgeAt + (rectWidth / 2) + arrowWidth : edgeAt - (rectWidth / 2) - arrowWidth;
		edgeYText = y1;
	} else {
		edgeXRect = x1 - (rectWidth / 2);
		edgeYRect = (orient === "bottom") ? edgeAt : edgeAt - rectHeight;
		edgeXText = x1;
		edgeYText = (orient === "bottom") ? edgeAt + (rectHeight / 2) : edgeAt - (rectHeight / 2);
	}
	let coordinateBase, coordinate;
	const textAnchor = "middle";
	if (isDefined(displayCoordinate)) {
		coordinateBase = {
			edgeXRect, edgeYRect, rectHeight, rectWidth, fill, opacity, arrowWidth
		};
		coordinate = {
			edgeXText, edgeYText, textAnchor, fontFamily, fontSize, textFill, displayCoordinate
		};
	}

	const line = hideLine ? undefined : {
		opacity: lineOpacity, stroke: lineStroke, x1, y1, x2, y2
	};
	return {
		coordinateBase, coordinate, line, orient
	};
}

EdgeCoordinate.drawOnCanvasStatic = (ctx: any, props: any) => {
	props = { ...EdgeCoordinate.defaultProps, ...props };

	const edge = helper(props);

	if (edge === null) return;

	if (isDefined(edge.coordinateBase)) {
		const edgeCoordinateBase = edge.coordinateBase!;
		const edgeCoordinate = edge.coordinate!;
		const edgeLine = edge.line!;
		const { rectWidth, rectHeight, arrowWidth } = edgeCoordinateBase;

		ctx.fillStyle = hexToRGBA(edgeCoordinateBase.fill, edgeCoordinateBase.opacity);

		const x = edgeCoordinateBase.edgeXRect;
		const y = edgeCoordinateBase.edgeYRect;

		ctx.beginPath();

		if (edge.orient === "right") {
			ctx.moveTo(x, y + rectHeight / 2);
			ctx.lineTo(x + arrowWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y + rectHeight);
			ctx.lineTo(x + arrowWidth, y + rectHeight);
			ctx.closePath();
		} else if (edge.orient === "left") {
			ctx.moveTo(x, y);
			ctx.lineTo(x + rectWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y + rectHeight / 2);
			ctx.lineTo(x + rectWidth, y + rectHeight);
			ctx.lineTo(x, y + rectHeight);
			ctx.closePath();
		} else {
			ctx.rect(x, y, rectWidth, rectHeight);
		}
		ctx.fill();

		ctx.font = `${ edgeCoordinate.fontSize }px ${edgeCoordinate.fontFamily}`;
		ctx.fillStyle = edgeCoordinate.textFill;
		ctx.textAlign = edgeCoordinate.textAnchor === "middle" ? "center" : edgeCoordinate.textAnchor;
		ctx.textBaseline = "middle";

		ctx.fillText(edgeCoordinate.displayCoordinate, edgeCoordinate.edgeXText, edgeCoordinate.edgeYText);
	}
	if (isDefined(edge.line)) {
		const edgeLine = edge.line!;
		ctx.strokeStyle = hexToRGBA(edgeLine.stroke, edgeLine.opacity);

		ctx.beginPath();
		ctx.moveTo(edgeLine.x1, edgeLine.y1);
		ctx.lineTo(edgeLine.x2, edgeLine.y2);
		ctx.stroke();
	}
};

export default EdgeCoordinate;
