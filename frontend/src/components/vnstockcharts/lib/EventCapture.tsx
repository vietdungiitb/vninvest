import { Component } from "react";
import PropTypes from "prop-types";
import { select, pointer, pointers } from "d3-selection";

import {
	isDefined, mousePosition,
	d3Window,
	MOUSEMOVE, MOUSEUP,
	MOUSEENTER, MOUSELEAVE,
	TOUCHMOVE, TOUCHEND,
	noop
} from "./utils";
import { getCurrentCharts } from "./utils/ChartDataUtil";

class EventCapture extends Component<any, any> {
	[key: string]: any;
	static defaultProps: any;
	constructor(props: any) {
		super(props);
		this.handleEnter = this.handleEnter.bind(this);
		this.handleLeave = this.handleLeave.bind(this);
		this.handleWheel = this.handleWheel.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handlePanEnd = this.handlePanEnd.bind(this);
		this.handlePan = this.handlePan.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchMove = this.handleTouchMove.bind(this);
		this.handlePinchZoom = this.handlePinchZoom.bind(this);
		this.handlePinchZoomEnd = this.handlePinchZoomEnd.bind(this);
		this.handlePointerDown = this.handlePointerDown.bind(this);
		this.handlePointerMoveLongPress = this.handlePointerMoveLongPress.bind(this);
		this.handlePointerUpLongPress = this.handlePointerUpLongPress.bind(this);

		this.longPressTimer = null;
		this.longPressStartPos = null;

		this.handleClick = this.handleClick.bind(this);

		this.handleRightClick = this.handleRightClick.bind(this);
		this.handleDrag = this.handleDrag.bind(this);
		this.handleDragEnd = this.handleDragEnd.bind(this);

		this.shouldPan = this.shouldPan.bind(this);
		this.canPan = this.canPan.bind(this);
		this.bindWheelListener = this.bindWheelListener.bind(this);

		this.setCursorClass = this.setCursorClass.bind(this);
		this.saveNode = this.saveNode.bind(this);

		this.mouseInside = false;
		this.focus = props.focus;

		this.mouseInteraction = true;
		this.state = {
			panInProgress: false,
		};
	}
	saveNode(node: any) {
		this.node = node;
	}
	componentDidMount() {
		if (this.node) {
			select(this.node)
				.on(MOUSEENTER, this.handleEnter)
				.on(MOUSELEAVE, this.handleLeave);
			this.bindWheelListener();
		}
	}
	componentDidUpdate(prevProps: any) {
		if (prevProps.focus !== this.props.focus) {
			this.focus = this.props.focus;
		}
		this.bindWheelListener();
	}
	componentWillUnmount() {
		if (this.longPressTimer !== null) {
			clearTimeout(this.longPressTimer);
		}
		if (this.node) {
			select(this.node)
				.on(MOUSEENTER, null)
				.on(MOUSELEAVE, null);
			this.node.removeEventListener("wheel", this.handleWheel);
			const win = d3Window(this.node);
			select(win)
				.on(MOUSEMOVE, null);
		}
	}
	bindWheelListener() {
		if (!this.node) return;
		this.node.removeEventListener("wheel", this.handleWheel);
		this.node.addEventListener("wheel", this.handleWheel, { passive: false });
	}
	handleEnter(e: any) {
		const { onMouseEnter } = this.props;
		this.mouseInside = true;
		if (!this.state.panInProgress
				&& !this.state.dragInProgress) {
			const win = d3Window(this.node);
			select(win)
				.on(MOUSEMOVE, this.handleMouseMove);
		}
		onMouseEnter(e);
	}
	handleLeave(e: any) {
		const { onMouseLeave } = this.props;
		this.mouseInside = false;
		if (!this.state.panInProgress
				&& !this.state.dragInProgress) {
			const win = d3Window(this.node);
			select(win)
				.on(MOUSEMOVE, null);
		}
		onMouseLeave(e);
	}
	handleWheel(e: any) {
		const { zoom, onZoom } = this.props;
		const { panInProgress } = this.state;

		const yZoom = Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 0;
		const mouseXY = mousePosition(e);
		e.preventDefault();

		if (zoom && yZoom && !panInProgress) {
			const zoomDir = e.deltaY > 0 ? 1 : -1;

			onZoom(zoomDir, mouseXY, e);
		} else if (this.focus) {
			if (this.shouldPan()) {
				const {
					panStartXScale,
					chartsToPan
				} = this.state.panStart;
				this.lastNewPos = mouseXY;
				this.panHappened = true;

				this.dx += e.deltaX;
				this.dy += e.deltaY;
				const dxdy = { dx: this.dx, dy: this.dy };

				this.props.onPan(mouseXY, panStartXScale, dxdy, chartsToPan, e);
			} else {
				const { xScale, chartConfig } = this.props;
				const currentCharts = getCurrentCharts(chartConfig, mouseXY);

				this.dx = 0;
				this.dy = 0;
				this.setState({
					panInProgress: true,
					panStart: {
						panStartXScale: xScale,
						panOrigin: mouseXY,
						chartsToPan: currentCharts
					},
				});
			}
			this.queuePanEnd();
		}
	}
	queuePanEnd() {
		if (isDefined(this.panEndTimeout)) {
			clearTimeout(this.panEndTimeout);
		}
		this.panEndTimeout = setTimeout(() => {
			this.handlePanEnd();
		}, 100);
	}
	handleMouseMove(e: any) {

		const { onMouseMove, mouseMove } = this.props;

		if (this.mouseInteraction
				&& mouseMove
				&& !this.state.panInProgress) {

			const newPos = pointer(e, this.node);

			onMouseMove(newPos, "mouse", e);
		}
	}
	handleClick(e: any) {
		const mouseXY = pointer(e, this.node);
		const { onClick, onDoubleClick } = this.props;

		if (!this.panHappened && !this.dragHappened) {
			if (this.clicked) {
				onDoubleClick(mouseXY, e);
				this.clicked = false;
			} else {
				onClick(mouseXY, e);
				this.clicked = true;
				setTimeout(() => {
					if (this.clicked) {
						this.clicked = false;
					}
				}, 400);
			}
		}
	}
	handleRightClick(e: any) {
		e.stopPropagation();
		e.preventDefault();
		const { onContextMenu, onPanEnd } = this.props;

		const mouseXY = mousePosition(e, this.node.getBoundingClientRect());

		if (isDefined(this.state.panStart)) {
			const { panStartXScale, panOrigin, chartsToPan } = this.state.panStart;
			if (this.panHappened) {
				onPanEnd(mouseXY, panStartXScale, panOrigin, chartsToPan, e);
			}
			const win = d3Window(this.node);
			select(win)
				.on(MOUSEMOVE, null)
				.on(MOUSEUP, null);

			this.setState({
				panInProgress: false,
				panStart: null,
			});
		}

		onContextMenu(mouseXY, e);
	}

	handleDrag(e: any) {
		if (this.props.onDrag) {
			this.dragHappened = true;
			const mouseXY = pointer(e, this.node);
			this.props.onDrag({
				startPos: this.state.dragStartPosition,
				mouseXY
			}, e);
		}
	}
	cancelDrag() {
		const win = d3Window(this.node);
		select(win)
			.on(MOUSEMOVE, this.mouseInside ? this.handleMouseMove : null)
			.on(MOUSEUP, null);

		this.setState({
			dragInProgress: false,
		});
		this.mouseInteraction = true;
	}
	handleDragEnd(e: any) {
		const mouseXY = pointer(e, this.node);

		const win = d3Window(this.node);
		select(win)
			.on(MOUSEMOVE, this.mouseInside ? this.handleMouseMove : null)
			.on(MOUSEUP, null);

		if (this.dragHappened) {
			this.props.onDragComplete({
				mouseXY
			}, e);
		}

		this.setState({
			dragInProgress: false,
		});
		this.mouseInteraction = true;
	}
	canPan(e?: any) {
		const { getAllPanConditions } = this.props;
		const { pan: initialPanEnabled } = this.props;
		const panConditions = getAllPanConditions();
		const normalizedPanConditions = Array.isArray(panConditions) ? panConditions : [panConditions];

		const {
			panEnabled,
			draggable: somethingSelected,
			panSuppressedByEvent,
		} = normalizedPanConditions
			.reduce((returnObj: any, a: any) => {
				return {
					draggable: returnObj.draggable || a.draggable,
					panEnabled: returnObj.panEnabled && a.panEnabled,
					panSuppressedByEvent: returnObj.panSuppressedByEvent || Boolean(e && a?.shouldDisablePanOnMouseDown?.(e)),
				};
			}, {
				draggable: false,
				panEnabled: initialPanEnabled,
				panSuppressedByEvent: false,
			});

		return {
			panEnabled,
			somethingSelected,
			panSuppressedByEvent,
		};
	}
	handleMouseDown(e: any) {
		if (e.button !== 0) {
			return;
		}
		const { xScale, chartConfig, onMouseDown } = this.props;

		this.panHappened = false;
		this.dragHappened = false;
		this.focus = true;

		if (!this.state.panInProgress
			&& this.mouseInteraction
		) {

			const mouseXY = mousePosition(e);
			const currentCharts = getCurrentCharts(chartConfig, mouseXY);
			const {
				panEnabled, somethingSelected, panSuppressedByEvent,
			} = this.canPan(e);
			const pan = panEnabled && !somethingSelected && !panSuppressedByEvent;

			if (pan) {
				this.setState({
					panInProgress: pan,
					panStart: {
						panStartXScale: xScale,
						panOrigin: mouseXY,
						chartsToPan: currentCharts
					},
				});

				const win = d3Window(this.node);
				select(win)
					.on(MOUSEMOVE, this.handlePan)
					.on(MOUSEUP, this.handlePanEnd);
			} else {
				const win = d3Window(this.node);
				select(win)
					.on(MOUSEMOVE, this.handleMouseMove);

				if (somethingSelected) {
				this.setState({
					panInProgress: false,
					dragInProgress: true,
					panStart: null,
					dragStartPosition: mouseXY,
				});
				this.props.onDragStart({ startPos: mouseXY }, e);

				const win = d3Window(this.node);
				select(win)
					.on(MOUSEMOVE, this.handleDrag)
					.on(MOUSEUP, this.handleDragEnd);
				}
			}

			onMouseDown(mouseXY, currentCharts, e);
		}
		e.preventDefault();
	}
	shouldPan() {
		const { pan: panEnabled, onPan } = this.props;
		return panEnabled
			&& onPan
			&& isDefined(this.state.panStart);
	}
	handlePan(e: any) {

		if (this.shouldPan()) {
			this.panHappened = true;

			const { panStartXScale, panOrigin, chartsToPan } = this.state.panStart;

			const mouseXY = this.mouseInteraction
				? pointer(e, this.node)
				: pointers(e, this.node)[0];

			this.lastNewPos = mouseXY;
			const dx = mouseXY[0] - panOrigin[0];
			const dy = mouseXY[1] - panOrigin[1];

			this.dx = dx;
			this.dy = dy;

			this.props.onPan(
				mouseXY, panStartXScale, { dx, dy }, chartsToPan, e
			);
		}
	}
	handlePanEnd(e: any = undefined) {
		const { pan: panEnabled, onPanEnd } = this.props;

		if (isDefined(this.state.panStart)) {
			const { panStartXScale, chartsToPan } = this.state.panStart;

			const win = d3Window(this.node);
			select(win)
				.on(MOUSEMOVE, this.mouseInside ? this.handleMouseMove : null)
				.on(MOUSEUP, null)
				.on(TOUCHMOVE, null)
				.on(TOUCHEND, null);

			if (this.panHappened
					&& panEnabled
					&& onPanEnd) {
				const { dx, dy } = this;

				delete this.dx;
				delete this.dy;
				onPanEnd(this.lastNewPos, panStartXScale, { dx, dy }, chartsToPan, e);
			}

			this.setState({
				panInProgress: false,
				panStart: null,
			});
		}
	}
	handleTouchMove(e: any) {
		const { onMouseMove } = this.props;
		const touchXY = pointer(e, this.node);
		onMouseMove(touchXY, "touch", e);
	}
	handleTouchStart(e: any) {
		this.mouseInteraction = false;

		const { pan: panEnabled, chartConfig, onMouseMove } = this.props;
		const { xScale, onPanEnd } = this.props;

		if (e.touches.length === 1) {

			this.panHappened = false;
			const touchXY = pointer(e, this.node);
			onMouseMove(touchXY, "touch", e);

			if (panEnabled) {
				const currentCharts = getCurrentCharts(chartConfig, touchXY);

				this.setState({
					panInProgress: true,
					panStart: {
						panStartXScale: xScale,
						panOrigin: touchXY,
						chartsToPan: currentCharts,
					}
				});

				const win = d3Window(this.node);
				select(win)
					.on(TOUCHMOVE, this.handlePan, false)
					.on(TOUCHEND, this.handlePanEnd, false);

			}
		} else if (e.touches.length === 2) {
			const { panInProgress, panStart } = this.state;

			if (panInProgress && panEnabled && onPanEnd) {
				const { panStartXScale, panOrigin, chartsToPan } = panStart;

				const win = d3Window(this.node);
				select(win)
					.on(MOUSEMOVE, this.mouseInside ? this.handleMouseMove : null)
					.on(MOUSEUP, null)
					.on(TOUCHMOVE, this.handlePinchZoom, false)
					.on(TOUCHEND, this.handlePinchZoomEnd, false);

				const [touch1Pos, touch2Pos] = pointers(e, this.node);

				if (this.panHappened
						&& panEnabled
						&& onPanEnd) {

					onPanEnd(this.lastNewPos, panStartXScale, panOrigin, chartsToPan, e);
				}

				this.setState({
					panInProgress: false,
					pinchZoomStart: {
						xScale,
						touch1Pos,
						touch2Pos,
						range: xScale.range(),
						chartsToPan,
					}
				});
			}
		}
	}
	handlePinchZoom(e: any) {
		const [touch1Pos, touch2Pos] = pointers(e, this.node);
		const { xScale, zoom: zoomEnabled, onPinchZoom } = this.props;

		const { chartsToPan, ...initialPinch } = this.state.pinchZoomStart;

		if (zoomEnabled && onPinchZoom) {
			onPinchZoom(initialPinch, {
				touch1Pos,
				touch2Pos,
				xScale,
			}, e);
		}
	}
	handlePinchZoomEnd(e: any) {

		const win = d3Window(this.node);
		select(win)
			.on(TOUCHMOVE, null)
			.on(TOUCHEND, null);

		const { zoom: zoomEnabled, onPinchZoomEnd } = this.props;

		const { chartsToPan, ...initialPinch } = this.state.pinchZoomStart;

		if (zoomEnabled && onPinchZoomEnd) {
			onPinchZoomEnd(initialPinch, e);
		}

		this.setState({
			pinchZoomStart: null
		});
	}
	// CE21: Pointer Events for touch/pen devices.
	// - setPointerCapture: ensures move events are delivered even if pointer leaves element.
	// - Long-press (500 ms, < 10 px movement) triggers onContextMenu — mobile replacement
	//   for right-click. Skips pointerType="mouse" (handled by existing mouse events).
	//
	// Browser compat: iOS 13+, Chrome 55+, Firefox 59+.
	handlePointerDown(e: React.PointerEvent<SVGRectElement>) {
		if (e.pointerType === "mouse") return;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// setPointerCapture may throw in jsdom/test environments; safe to ignore
		}
		// Start long-press detection
		if (this.longPressTimer !== null) {
			clearTimeout(this.longPressTimer);
		}
		this.longPressStartPos = { x: e.clientX, y: e.clientY };
		const { onContextMenu } = this.props;
		if (onContextMenu) {
			const eSnapshot = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType };
			this.longPressTimer = setTimeout(() => {
				if (this.longPressStartPos && this.node) {
					const rect = this.node.getBoundingClientRect();
					const mouseXY = [eSnapshot.clientX - rect.left, eSnapshot.clientY - rect.top];
					onContextMenu(mouseXY, eSnapshot);
				}
				this.longPressTimer = null;
				this.longPressStartPos = null;
			}, 500);
		}
	}
	handlePointerMoveLongPress(e: React.PointerEvent<SVGRectElement>) {
		if (e.pointerType === "mouse" || !this.longPressStartPos) return;
		const dx = e.clientX - this.longPressStartPos.x;
		const dy = e.clientY - this.longPressStartPos.y;
		if (Math.hypot(dx, dy) > 10) {
			if (this.longPressTimer !== null) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
			this.longPressStartPos = null;
		}
	}
	handlePointerUpLongPress(_e: React.PointerEvent<SVGRectElement>) {
		if (this.longPressTimer !== null) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
		this.longPressStartPos = null;
	}
	setCursorClass(cursorOverrideClass: any) {
		if (cursorOverrideClass !== this.state.cursorOverrideClass) {
			this.setState({
				cursorOverrideClass
			});
		}
	}
	render() {
		const { height, width, disableInteraction, useCrossHairStyleCursor } = this.props;
		const className = this.state.cursorOverrideClass != null
			? this.state.cursorOverrideClass
			: !useCrossHairStyleCursor ? "" : this.state.panInProgress
				? "react-stockcharts-grabbing-cursor"
				: "react-stockcharts-crosshair-cursor";

		const interactionProps = disableInteraction || {
			onMouseDown: this.handleMouseDown,
			onClick: this.handleClick,
			onContextMenu: this.handleRightClick,
			onTouchStart: this.handleTouchStart,
			onTouchMove: this.handleTouchMove,
			// CE21: Pointer capture + long-press context menu for touch/pen devices
			onPointerDown: this.handlePointerDown,
			onPointerMove: this.handlePointerMoveLongPress,
			onPointerUp: this.handlePointerUpLongPress,
			onPointerCancel: this.handlePointerUpLongPress,
		};

		// CE21: touch-action:none prevents browser scroll/zoom stealing on mobile.
		// Pointer Events API (iOS 13+, Chrome 55+, Firefox 59+) is handled by existing
		// Touch Events fallback; touch-action ensures gesture delivery to JS handlers.
		return (
			<rect ref={this.saveNode}
				className={className}
				width={width}
				height={height}
				style={{ opacity: 0, touchAction: "none" }}
				{...interactionProps}
			/>
		);
	}
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
EventCapture.propTypes = {
	mouseMove: PropTypes.bool.isRequired,
	zoom: PropTypes.bool.isRequired,
	pan: PropTypes.bool.isRequired,
	panSpeedMultiplier: PropTypes.number.isRequired,
	focus: PropTypes.bool.isRequired,
	useCrossHairStyleCursor: PropTypes.bool.isRequired,

	width: PropTypes.number.isRequired,
	height: PropTypes.number.isRequired,
	chartConfig: PropTypes.array,
	xScale: PropTypes.func.isRequired,
	xAccessor: PropTypes.func.isRequired,
	disableInteraction: PropTypes.bool.isRequired,

	getAllPanConditions: PropTypes.func.isRequired,

	onMouseMove: PropTypes.func,
	onMouseEnter: PropTypes.func,
	onMouseLeave: PropTypes.func,
	onZoom: PropTypes.func,
	onPinchZoom: PropTypes.func,
	onPinchZoomEnd: PropTypes.func.isRequired,
	onPan: PropTypes.func,
	onPanEnd: PropTypes.func,
	onDragStart: PropTypes.func,
	onDrag: PropTypes.func,
	onDragComplete: PropTypes.func,

	onClick: PropTypes.func,
	onDoubleClick: PropTypes.func,
	onContextMenu: PropTypes.func,
	onMouseDown: PropTypes.func,
	children: PropTypes.node,
};

EventCapture.defaultProps = {
	mouseMove: false,
	zoom: false,
	pan: false,
	panSpeedMultiplier: 1,
	focus: false,
	onDragComplete: noop,
	disableInteraction: false,
};

export default EventCapture;