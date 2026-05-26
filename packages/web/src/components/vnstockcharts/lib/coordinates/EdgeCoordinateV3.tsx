
import React from "react";

import { hexToRGBA, isDefined, getStrokeDasharray } from "../utils";

/* eslint-disable react/prop-types */
export function renderSVG(props: any) {
	const { className } = props;

	const edge = helper(props);
	if (edge === null) return null;
	let line, coordinateBase, coordinate;

	if (isDefined(edge.line)) {
		const edgeLine = edge.line!;
		line = (
			<line
				className="react-stockcharts-cross-hair"
				strokeOpacity={edgeLine.opacity}
				stroke={edgeLine.stroke}
				strokeDasharray={getStrokeDasharray(edgeLine.strokeDasharray)}
				x1={edgeLine.x1}
				y1={edgeLine.y1}
				x2={edgeLine.x2}
				y2={edgeLine.y2}
			/>
		);
	}
	if (isDefined(edge.coordinateBase)) {
		const edgeCoordinateBase = edge.coordinateBase!;
		const edgeCoordinate = edge.coordinate!;
		const { rectWidth, rectHeight, arrowWidth } = edgeCoordinateBase;

		const path =
			edge.orient === "left"
				? `M0,0L0,${rectHeight}L${rectWidth},${rectHeight}L${rectWidth +
					  arrowWidth},10L${rectWidth},0L0,0L0,0`
				: `M0,${arrowWidth}L${arrowWidth},${rectHeight}L${rectWidth +
					  arrowWidth},${rectHeight}L${rectWidth +
					  arrowWidth},0L${arrowWidth},0L0,${arrowWidth}`;

		coordinateBase =
			edge.orient === "left" || edge.orient === "right" ? (
				<g
					key={1}
					transform={`translate(${edgeCoordinateBase.edgeXRect},${
						edgeCoordinateBase.edgeYRect
					})`}
				>
					<path
						d={path}
						className="react-stockchart-text-background"
						height={rectHeight}
						width={rectWidth}
						stroke={edgeCoordinateBase.stroke}
						strokeLinejoin="miter"
						strokeOpacity={edgeCoordinateBase.strokeOpacity}
						strokeWidth={edgeCoordinateBase.strokeWidth}
						fill={edgeCoordinateBase.fill}
						fillOpacity={edgeCoordinateBase.opacity}
					/>
				</g>
			) : (
				<rect
					key={1}
					className="react-stockchart-text-background"
					x={edgeCoordinateBase.edgeXRect}
					y={edgeCoordinateBase.edgeYRect}
					height={rectHeight}
					width={rectWidth}
					fill={edgeCoordinateBase.fill}
					opacity={edgeCoordinateBase.opacity}
				/>
			);

			coordinate = (
			<text
				key={2}
					x={edgeCoordinate.edgeXText}
					y={edgeCoordinate.edgeYText}
					textAnchor={edgeCoordinate.textAnchor as any}
					fontFamily={edgeCoordinate.fontFamily}
					fontSize={edgeCoordinate.fontSize}
				dy=".32em"
					fill={edgeCoordinate.textFill}
			>
					{edgeCoordinate.displayCoordinate}
			</text>
		);
	}
	return (
		<g className={className}>
			{line}
			{coordinateBase}
			{coordinate}
		</g>
	);
}
/* eslint-enable react/prop-types */

function helper(props: any) {
	const {
		coordinate: displayCoordinate,
		show,
		type,
		orient,
		edgeAt,
		hideLine,
		lineStrokeDasharray
	} = props;
	const {
		fill,
		opacity,
		fontFamily,
		fontSize,
		textFill,
		lineStroke,
		lineOpacity
	} = props;
	const { stroke, strokeOpacity, strokeWidth } = props;
	const { arrowWidth, rectWidth, rectHeight, rectRadius } = props;
	const { x1, y1, x2, y2, dx } = props;

	if (!show) return null;

	let coordinateBase, coordinate;
	if (isDefined(displayCoordinate)) {
		const textAnchor = "middle";

		let edgeXRect, edgeYRect, edgeXText, edgeYText;

		if (type === "horizontal") {
			edgeXRect =
				dx + (orient === "right" ? edgeAt + 1 : edgeAt - rectWidth - 1);
			edgeYRect = y1 - rectHeight / 2 - strokeWidth;
			edgeXText =
				dx +
				(orient === "right"
					? edgeAt + rectWidth / 2
					: edgeAt - rectWidth / 2);
			edgeYText = y1;
		} else {
			const dy = orient === "bottom" ? strokeWidth - 1 : -strokeWidth + 1;
			edgeXRect = x1 - rectWidth / 2;
			edgeYRect =
				(orient === "bottom" ? edgeAt : edgeAt - rectHeight) + dy;
			edgeXText = x1;
			edgeYText =
				(orient === "bottom"
					? edgeAt + rectHeight / 2
					: edgeAt - rectHeight / 2) + dy;
		}

		coordinateBase = {
			edgeXRect,
			edgeYRect,
			rectHeight: rectHeight + strokeWidth,
			rectWidth,
			rectRadius,
			fill,
			opacity,
			arrowWidth,
			stroke,
			strokeOpacity,
			strokeWidth
		};
		coordinate = {
			edgeXText,
			edgeYText,
			textAnchor,
			fontFamily,
			fontSize,
			textFill,
			displayCoordinate
		};
	}

	const line = hideLine
		? undefined
		: {
			opacity: lineOpacity,
			stroke: lineStroke,
			strokeDasharray: lineStrokeDasharray,
			x1,
			y1,
			x2,
			y2
		};

	return {
		coordinateBase,
		coordinate,
		line,
		orient
	};
}

export function drawOnCanvas(ctx: any, props: any) {
	const { fontSize, fontFamily } = props;

	ctx.font = `${fontSize}px ${fontFamily}`;
	ctx.textBaseline = "middle";
	const width = Math.round(ctx.measureText(props.coordinate).width + 10);

	const edge = helper({ ...props, rectWidth: width });

	if (edge === null) return;

	if (isDefined(edge.line)) {
		const line = edge.line!;
		const dashArray = getStrokeDasharray(line.strokeDasharray)
			.split(",")
			.map((d: string) => +d);
		ctx.setLineDash(dashArray);
		ctx.strokeStyle = hexToRGBA(line.stroke, line.opacity);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(line.x1, line.y1);
		ctx.lineTo(line.x2, line.y2);
		ctx.stroke();
	}

	ctx.setLineDash([]);
	if (isDefined(edge.coordinateBase)) {
		const coordinateBase = edge.coordinateBase!;
		const coordinate = edge.coordinate!;
		const {
			rectWidth,
			rectHeight,
			rectRadius,
			arrowWidth
		} = coordinateBase;

		ctx.fillStyle = hexToRGBA(
			coordinateBase.fill,
			coordinateBase.opacity
		);
		if (isDefined(coordinateBase.stroke)) {
			ctx.strokeStyle = hexToRGBA(
				coordinateBase.stroke,
				coordinateBase.strokeOpacity
			);
			ctx.lineWidth = coordinateBase.strokeWidth;
		}

		let x = coordinateBase.edgeXRect;
		const y = coordinateBase.edgeYRect;
		const halfHeight = rectHeight / 2;

		ctx.beginPath();
		if (edge.orient === "right") {
			x -= arrowWidth;
			ctx.moveTo(x, y + halfHeight);
			ctx.lineTo(x + arrowWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y + rectHeight);
			ctx.lineTo(x + arrowWidth, y + rectHeight);
			ctx.closePath();
		} else if (edge.orient === "left") {
			ctx.moveTo(x, y);
			ctx.lineTo(x + rectWidth, y);
			ctx.lineTo(x + rectWidth + arrowWidth, y + halfHeight);
			ctx.lineTo(x + rectWidth, y + rectHeight);
			ctx.lineTo(x, y + rectHeight);
			ctx.closePath();
		} else {
			if (rectRadius) {
				roundRect(ctx, x, y, rectWidth, rectHeight, 3);
			} else {
				ctx.rect(x, y, rectWidth, rectHeight);
			}
		}
		ctx.fill();

		if (isDefined(coordinateBase.stroke)) {
			ctx.stroke();
		}

		ctx.fillStyle = coordinate.textFill;
		ctx.textAlign =
			coordinate.textAnchor === "middle"
				? "center"
				: coordinate.textAnchor;
		ctx.fillText(
			coordinate.displayCoordinate,
			coordinate.edgeXText,
			coordinate.edgeYText
		);
	}
}

function roundRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

// export default EdgeCoordinate;
