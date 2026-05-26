import { Component } from "react";
import PropTypes from "prop-types";

import {
	isDefined,
	noop,
	getStrokeDasharray,
	hexToRGBA,
} from "../utils";
import GenericChartComponent from "../GenericChartComponent";
import { getMouseCanvas } from "../GenericComponent";

class Brush extends Component<any, any> {
	[key: string]: any;
	static defaultProps: any;
	constructor(props: any, context: any) {
		super(props, context);
		this.handleZoomStart = this.handleZoomStart.bind(this);
		this.handleDrawSquare = this.handleDrawSquare.bind(this);
		this.handleZoomComplete = this.handleZoomComplete.bind(this);
		this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this);
		this.removeWindowListeners = this.removeWindowListeners.bind(this);

		this.drawOnCanvas = this.drawOnCanvas.bind(this);
		this.renderSVG = this.renderSVG.bind(this);
		this.saveNode = this.saveNode.bind(this);
		this.terminate = this.terminate.bind(this);
		this.state = {
			rect: null,
		};
	}
	componentWillUnmount() {
		this.removeWindowListeners();
	}
	removeWindowListeners() {
		if (typeof window === "undefined") return;
		window.removeEventListener("mouseup", this.handleWindowMouseUp);
		window.removeEventListener("touchend", this.handleWindowMouseUp);
	}
	terminate() {
		this.removeWindowListeners();
		this.zoomHappening = false;
		this.setState({
			x1y1: null,
			start: null,
			end: null,
			rect: null,
		});
	}
	saveNode(node: any) {
		this.node = node;
	}
	drawOnCanvas(ctx: CanvasRenderingContext2D) {
		const { rect } = this.state;
		if (isDefined(rect)) {
			const { x, y, height, width } = rect;
			const { stroke, fill, strokeDashArray } = this.props;
			const { strokeOpacity, fillOpacity } = this.props;

			const dashArray = getStrokeDasharray(strokeDashArray)
				.split(",")
				.map(d => +d);

			ctx.strokeStyle = hexToRGBA(stroke, strokeOpacity);
			ctx.fillStyle = hexToRGBA(fill, fillOpacity);
			ctx.setLineDash(dashArray);
			ctx.beginPath();
			ctx.fillRect(x, y, width, height);
			ctx.strokeRect(x, y, width, height);
		}
	}
	renderSVG() {
		const { rect } = this.state;
		if (isDefined(rect)) {
			const { x, y, height, width } = rect;
			const { stroke, strokeDashArray } = this.props;
			const { strokeOpacity, fillOpacity } = this.props;

			const dashArray = getStrokeDasharray(strokeDashArray)
				.split(",")
				.map(d => +d);

				return (
					<rect strokeDasharray={dashArray.join(",")}
					stroke={stroke}
					fill="none"
					strokeOpacity={strokeOpacity}
					fillOpacity={fillOpacity}
					x={x}
					y={y}
					width={width}
					height={height}
				/>
			);
		}
	}
	handleZoomStart(moreProps: any) {
		this.zoomHappening = false;
		this.lastMoreProps = moreProps;
		this.removeWindowListeners();
		const {
			mouseXY,
			currentItem,
			chartConfig: { yScale },
			xAccessor,
			xScale,
		} = moreProps;
		const [mouseX, mouseY] = mouseXY;
		const xValue = isDefined(currentItem)
			? xAccessor(currentItem)
			: isDefined(xScale.invert)
			? xScale.invert(mouseX)
			: mouseX;

		const x1y1 = isDefined(currentItem)
			? [xScale(xAccessor(currentItem)), mouseY]
			: [mouseX, mouseY];

		this.setState({
			selected: true,
			x1y1,
			start: {
				item: currentItem,
				xValue,
				yValue: yScale.invert(mouseY),
			},
		}, () => {
			if (typeof window !== "undefined") {
				window.addEventListener("mouseup", this.handleWindowMouseUp);
				window.addEventListener("touchend", this.handleWindowMouseUp);
			}
		});
	}
	handleDrawSquare(moreProps: any) {
		if (this.state.x1y1 == null) return;

		this.zoomHappening = true;
		this.lastMoreProps = moreProps;

		const {
			mouseXY,
			currentItem,
			chartConfig: { yScale },
			xAccessor,
			xScale,
		} = moreProps;
		const [mouseX, mouseY] = mouseXY;
		const xValue = isDefined(currentItem)
			? xAccessor(currentItem)
			: isDefined(xScale.invert)
			? xScale.invert(mouseX)
			: mouseX;

		const [x2, y2] = isDefined(currentItem)
			? [xScale(xAccessor(currentItem)), mouseY]
			: [mouseX, mouseY];

		const { x1y1: [x1, y1] } = this.state;

		const x = Math.min(x1, x2);
		const y = Math.min(y1, y2);
		const height = Math.abs(y2 - y1);
		const width = Math.abs(x2 - x1);

		this.setState({
			selected: true,
			end: {
				item: currentItem,
				xValue,
				yValue: yScale.invert(mouseY),
			},
			rect: {
				x, y, height, width
			},
		});
	}
	handleWindowMouseUp() {
		this.handleZoomComplete(this.lastMoreProps);
	}
	handleZoomComplete(moreProps: any = this.lastMoreProps) {
		this.removeWindowListeners();
		const shouldBrush = this.zoomHappening;
		this.zoomHappening = false;
		if (shouldBrush) {
			const { onBrush } = this.props;
			const { start, end } = this.state;
			onBrush({ start, end }, moreProps);
		}
		this.setState({
			selected: false,
			rect: null,
		});
	}
	render() {
		const { enabled } = this.props;
		if (!enabled) return null;

		return (
			<GenericChartComponent
				{...({ ref: this.saveNode } as any)}
				disablePan={enabled}
				selected={this.state.selected}
				interactiveCursorClass="react-stockcharts-crosshair-cursor"

				svgDraw={this.renderSVG}
				canvasToDraw={getMouseCanvas}
				canvasDraw={this.drawOnCanvas}

				onMouseDown={this.handleZoomStart}
				onMouseMove={this.handleDrawSquare}
				onClick={this.handleZoomComplete}

				drawOn={["mousemove", "pan", "drag"]}
			/>
		);
	}
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
Brush.propTypes = {
	enabled: PropTypes.bool.isRequired,
	onStart: PropTypes.func.isRequired,
	onBrush: PropTypes.func.isRequired,

	type: PropTypes.oneOf(["1D", "2D"]),
	stroke: PropTypes.string,
	fill: PropTypes.string,
	strokeOpacity: PropTypes.number,
	fillOpacity: PropTypes.number,
	interactiveState: PropTypes.object,
	strokeDashArray: PropTypes.string,
};

Brush.defaultProps = {
	type: "2D",
	stroke: "#000000",
	fillOpacity: 0.3,
	strokeOpacity: 1,
	fill: "#3h3h3h",
	onBrush: noop,
	onStart: noop,
	strokeDashArray: "ShortDash",
};

export default Brush;
