import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { select, pointer, pointers } from "d3-selection";
import { isDefined, mousePosition, d3Window, MOUSEMOVE, MOUSEUP, MOUSEENTER, MOUSELEAVE, TOUCHMOVE, TOUCHEND, noop } from "./utils/index.js";
import { getCurrentCharts } from "./utils/ChartDataUtil.js";
const EventCapture = forwardRef((props, ref) => {
    const { mouseMove, zoom, pan: panEnabled, focus: initialFocus, useCrossHairStyleCursor, width, height, chartConfig, xScale, disableInteraction, getAllPanConditions, onMouseMove, onMouseEnter, onMouseLeave, onZoom, onPinchZoom, onPinchZoomEnd, onPan, onPanEnd, onDragStart, onDrag, onDragComplete, onClick, onDoubleClick, onContextMenu, onMouseDown, } = props;
    const nodeRef = useRef(null);
    // Instance variables as refs to avoid re-renders on every change
    const longPressTimerRef = useRef(null);
    const longPressStartPosRef = useRef(null);
    const panEndTimeoutRef = useRef(null);
    const clickedTimeoutRef = useRef(null);
    const mouseInsideRef = useRef(false);
    const focusRef = useRef(initialFocus);
    const mouseInteractionRef = useRef(true);
    const panHappenedRef = useRef(false);
    const dragHappenedRef = useRef(false);
    const clickedRef = useRef(false);
    const lastNewPosRef = useRef(null);
    const dxRef = useRef(0);
    const dyRef = useRef(0);
    const panStartRef = useRef(null);
    const dragStartPositionRef = useRef(null);
    const dragInProgressRef = useRef(false);
    const pinchZoomStartRef = useRef(null);
    // React state for properties that affect layout/classes
    const [panInProgress, setPanInProgress] = useState(false);
    const [cursorOverrideClass, setCursorOverrideClass] = useState(null);
    // Imperative methods exposed to ChartCanvas
    useImperativeHandle(ref, () => ({
        setCursorClass(className) {
            if (className !== cursorOverrideClass) {
                setCursorOverrideClass(className ?? null);
            }
        }
    }));
    // Sync focus prop
    useEffect(() => {
        focusRef.current = initialFocus;
    }, [initialFocus]);
    // Cleanup timers and window-level listeners on unmount
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current !== null)
                clearTimeout(longPressTimerRef.current);
            if (panEndTimeoutRef.current !== null)
                clearTimeout(panEndTimeoutRef.current);
            if (clickedTimeoutRef.current !== null)
                clearTimeout(clickedTimeoutRef.current);
            if (nodeRef.current) {
                const win = d3Window(nodeRef.current);
                select(win)
                    .on(MOUSEMOVE, null)
                    .on(MOUSEUP, null)
                    .on(TOUCHMOVE, null)
                    .on(TOUCHEND, null);
            }
        };
    }, []);
    const shouldPan = () => {
        return panEnabled && onPan && isDefined(panStartRef.current);
    };
    const canPan = (e) => {
        const panConditions = getAllPanConditions();
        const normalizedPanConditions = Array.isArray(panConditions) ? panConditions : [panConditions];
        const { panEnabled: panEnabledCondition, draggable: somethingSelected, panSuppressedByEvent, } = normalizedPanConditions.reduce((returnObj, a) => {
            return {
                draggable: returnObj.draggable || a.draggable,
                panEnabled: returnObj.panEnabled && a.panEnabled,
                panSuppressedByEvent: returnObj.panSuppressedByEvent || Boolean(e && a?.shouldDisablePanOnMouseDown?.(e)),
            };
        }, {
            draggable: false,
            panEnabled: panEnabled,
            panSuppressedByEvent: false,
        });
        return {
            panEnabled: panEnabledCondition,
            somethingSelected,
            panSuppressedByEvent,
        };
    };
    const queuePanEnd = () => {
        if (isDefined(panEndTimeoutRef.current)) {
            clearTimeout(panEndTimeoutRef.current);
        }
        panEndTimeoutRef.current = setTimeout(() => {
            handlePanEnd();
        }, 100);
    };
    const handlePanEnd = (e = undefined) => {
        if (isDefined(panStartRef.current)) {
            const { panStartXScale, chartsToPan } = panStartRef.current;
            const win = d3Window(nodeRef.current);
            select(win)
                .on(MOUSEMOVE, mouseInsideRef.current ? handleMouseMove : null)
                .on(MOUSEUP, null)
                .on(TOUCHMOVE, null)
                .on(TOUCHEND, null);
            if (panHappenedRef.current && panEnabled && onPanEnd) {
                const dx = dxRef.current;
                const dy = dyRef.current;
                dxRef.current = 0;
                dyRef.current = 0;
                onPanEnd(lastNewPosRef.current, panStartXScale, { dx, dy }, chartsToPan, e);
            }
            setPanInProgress(false);
            panStartRef.current = null;
        }
    };
    const handlePan = (e) => {
        if (shouldPan()) {
            panHappenedRef.current = true;
            const { panStartXScale, panOrigin, chartsToPan } = panStartRef.current;
            const mouseXY = mouseInteractionRef.current
                ? pointer(e, nodeRef.current)
                : pointers(e, nodeRef.current)[0];
            lastNewPosRef.current = mouseXY;
            const dx = mouseXY[0] - panOrigin[0];
            const dy = mouseXY[1] - panOrigin[1];
            dxRef.current = dx;
            dyRef.current = dy;
            onPan(mouseXY, panStartXScale, { dx, dy }, chartsToPan, e);
        }
    };
    const handleMouseMove = (e) => {
        if (mouseInteractionRef.current && mouseMove && !panInProgress) {
            const newPos = pointer(e, nodeRef.current);
            onMouseMove(newPos, "mouse", e);
        }
    };
    const handleDrag = (e) => {
        if (onDrag) {
            dragHappenedRef.current = true;
            const mouseXY = pointer(e, nodeRef.current);
            onDrag({
                startPos: dragStartPositionRef.current,
                mouseXY
            }, e);
        }
    };
    const handleDragEnd = (e) => {
        const mouseXY = pointer(e, nodeRef.current);
        const win = d3Window(nodeRef.current);
        select(win)
            .on(MOUSEMOVE, mouseInsideRef.current ? handleMouseMove : null)
            .on(MOUSEUP, null);
        if (dragHappenedRef.current && onDragComplete) {
            onDragComplete({
                mouseXY
            }, e);
        }
        dragInProgressRef.current = false;
        mouseInteractionRef.current = true;
    };
    const handleMouseDown = (e) => {
        if (e.button !== 0) {
            return;
        }
        panHappenedRef.current = false;
        dragHappenedRef.current = false;
        focusRef.current = true;
        if (!panInProgress && mouseInteractionRef.current) {
            const mouseXY = mousePosition(e);
            const currentCharts = getCurrentCharts(chartConfig, mouseXY);
            const { panEnabled: panEnabledCondition, somethingSelected, panSuppressedByEvent, } = canPan(e);
            const pan = panEnabledCondition && !somethingSelected && !panSuppressedByEvent;
            if (pan) {
                panStartRef.current = {
                    panStartXScale: xScale,
                    panOrigin: mouseXY,
                    chartsToPan: currentCharts
                };
                setPanInProgress(true);
                const win = d3Window(nodeRef.current);
                select(win)
                    .on(MOUSEMOVE, handlePan)
                    .on(MOUSEUP, handlePanEnd);
            }
            else {
                const win = d3Window(nodeRef.current);
                select(win)
                    .on(MOUSEMOVE, handleMouseMove);
                if (somethingSelected) {
                    dragInProgressRef.current = true;
                    panStartRef.current = null;
                    dragStartPositionRef.current = mouseXY;
                    onDragStart({ startPos: mouseXY }, e);
                    select(win)
                        .on(MOUSEMOVE, handleDrag)
                        .on(MOUSEUP, handleDragEnd);
                }
            }
            onMouseDown(mouseXY, currentCharts, e);
        }
        e.preventDefault();
    };
    const handleClick = (e) => {
        const mouseXY = pointer(e, nodeRef.current);
        if (!panHappenedRef.current && !dragHappenedRef.current) {
            if (clickedRef.current) {
                onDoubleClick(mouseXY, e);
                clickedRef.current = false;
            }
            else {
                onClick(mouseXY, e);
                clickedRef.current = true;
                if (clickedTimeoutRef.current) {
                    clearTimeout(clickedTimeoutRef.current);
                }
                clickedTimeoutRef.current = setTimeout(() => {
                    if (clickedRef.current) {
                        clickedRef.current = false;
                    }
                }, 400);
            }
        }
    };
    const handleRightClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const mouseXY = mousePosition(e, nodeRef.current?.getBoundingClientRect());
        if (isDefined(panStartRef.current)) {
            const { panStartXScale, panOrigin, chartsToPan } = panStartRef.current;
            if (panHappenedRef.current) {
                onPanEnd(mouseXY, panStartXScale, panOrigin, chartsToPan, e);
            }
            const win = d3Window(nodeRef.current);
            select(win)
                .on(MOUSEMOVE, null)
                .on(MOUSEUP, null);
            setPanInProgress(false);
            panStartRef.current = null;
        }
        onContextMenu(mouseXY, e);
    };
    const handleTouchStart = (e) => {
        mouseInteractionRef.current = false;
        if (e.touches.length === 1) {
            panHappenedRef.current = false;
            const touchXY = pointer(e, nodeRef.current);
            onMouseMove(touchXY, "touch", e);
            if (panEnabled) {
                const currentCharts = getCurrentCharts(chartConfig, touchXY);
                panStartRef.current = {
                    panStartXScale: xScale,
                    panOrigin: touchXY,
                    chartsToPan: currentCharts,
                };
                setPanInProgress(true);
                const win = d3Window(nodeRef.current);
                select(win)
                    .on(TOUCHMOVE, handlePan, false)
                    .on(TOUCHEND, handlePanEnd, false);
            }
        }
        else if (e.touches.length === 2) {
            if (panInProgress && panEnabled && onPanEnd) {
                const { panStartXScale, panOrigin, chartsToPan } = panStartRef.current;
                const win = d3Window(nodeRef.current);
                select(win)
                    .on(MOUSEMOVE, mouseInsideRef.current ? handleMouseMove : null)
                    .on(MOUSEUP, null)
                    .on(TOUCHMOVE, handlePinchZoom, false)
                    .on(TOUCHEND, handlePinchZoomEnd, false);
                const [touch1Pos, touch2Pos] = pointers(e, nodeRef.current);
                if (panHappenedRef.current && panEnabled && onPanEnd) {
                    onPanEnd(lastNewPosRef.current, panStartXScale, panOrigin, chartsToPan, e);
                }
                setPanInProgress(false);
                pinchZoomStartRef.current = {
                    xScale,
                    touch1Pos,
                    touch2Pos,
                    range: xScale.range(),
                    chartsToPan,
                };
            }
        }
    };
    const handleTouchMove = (e) => {
        const touchXY = pointer(e, nodeRef.current);
        onMouseMove(touchXY, "touch", e);
    };
    const handlePinchZoom = (e) => {
        const [touch1Pos, touch2Pos] = pointers(e, nodeRef.current);
        const { chartsToPan, ...initialPinch } = pinchZoomStartRef.current;
        if (zoom && onPinchZoom) {
            onPinchZoom(initialPinch, {
                touch1Pos,
                touch2Pos,
                xScale,
            }, e);
        }
    };
    const handlePinchZoomEnd = (e) => {
        const win = d3Window(nodeRef.current);
        select(win)
            .on(TOUCHMOVE, null)
            .on(TOUCHEND, null);
        const { chartsToPan, ...initialPinch } = pinchZoomStartRef.current;
        if (zoom && onPinchZoomEnd) {
            onPinchZoomEnd(initialPinch, e);
        }
        pinchZoomStartRef.current = null;
    };
    const handlePointerDown = (e) => {
        if (e.pointerType === "mouse")
            return;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        catch {
            // ignore in tests
        }
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
        }
        longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
        if (onContextMenu) {
            const eSnapshot = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType };
            longPressTimerRef.current = setTimeout(() => {
                if (longPressStartPosRef.current && nodeRef.current) {
                    const rect = nodeRef.current.getBoundingClientRect();
                    const mouseXY = [eSnapshot.clientX - rect.left, eSnapshot.clientY - rect.top];
                    onContextMenu(mouseXY, eSnapshot);
                }
                longPressTimerRef.current = null;
                longPressStartPosRef.current = null;
            }, 500);
        }
    };
    const handlePointerMoveLongPress = (e) => {
        if (e.pointerType === "mouse" || !longPressStartPosRef.current)
            return;
        const dx = e.clientX - longPressStartPosRef.current.x;
        const dy = e.clientY - longPressStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
            if (longPressTimerRef.current !== null) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            longPressStartPosRef.current = null;
        }
    };
    const handlePointerUpLongPress = (_e) => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        longPressStartPosRef.current = null;
    };
    // Event bindings for element and window
    useEffect(() => {
        const element = nodeRef.current;
        if (!element)
            return;
        const handleEnter = (e) => {
            mouseInsideRef.current = true;
            if (!panInProgress && !dragInProgressRef.current) {
                const win = d3Window(element);
                select(win).on(MOUSEMOVE, handleMouseMove);
            }
            if (onMouseEnter)
                onMouseEnter(e);
        };
        const handleLeave = (e) => {
            mouseInsideRef.current = false;
            if (!panInProgress && !dragInProgressRef.current) {
                const win = d3Window(element);
                select(win).on(MOUSEMOVE, null);
            }
            if (onMouseLeave)
                onMouseLeave(e);
        };
        const handleWheel = (e) => {
            const yZoom = Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 0;
            const mouseXY = mousePosition(e);
            e.preventDefault();
            if (zoom && yZoom && !panInProgress) {
                const zoomDir = e.deltaY > 0 ? 1 : -1;
                if (onZoom)
                    onZoom(zoomDir, mouseXY, e);
            }
            else if (focusRef.current) {
                if (shouldPan()) {
                    const { panStartXScale, chartsToPan } = panStartRef.current;
                    lastNewPosRef.current = mouseXY;
                    panHappenedRef.current = true;
                    dxRef.current += e.deltaX;
                    dyRef.current += e.deltaY;
                    const dxdy = { dx: dxRef.current, dy: dyRef.current };
                    if (onPan)
                        onPan(mouseXY, panStartXScale, dxdy, chartsToPan, e);
                }
                else {
                    const currentCharts = getCurrentCharts(chartConfig, mouseXY);
                    dxRef.current = 0;
                    dyRef.current = 0;
                    panStartRef.current = {
                        panStartXScale: xScale,
                        panOrigin: mouseXY,
                        chartsToPan: currentCharts
                    };
                    setPanInProgress(true);
                }
                queuePanEnd();
            }
        };
        select(element)
            .on(MOUSEENTER, handleEnter)
            .on(MOUSELEAVE, handleLeave);
        element.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            select(element)
                .on(MOUSEENTER, null)
                .on(MOUSELEAVE, null);
            element.removeEventListener("wheel", handleWheel);
        };
    }, [panInProgress, chartConfig, xScale, zoom, onZoom, onPan, onMouseEnter, onMouseLeave]);
    const className = cursorOverrideClass != null
        ? cursorOverrideClass
        : !useCrossHairStyleCursor ? "" : panInProgress
            ? "vninvestcharts-grabbing-cursor"
            : "vninvestcharts-crosshair-cursor";
    const interactionProps = disableInteraction || {
        onMouseDown: handleMouseDown,
        onClick: handleClick,
        onContextMenu: handleRightClick,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMoveLongPress,
        onPointerUp: handlePointerUpLongPress,
        onPointerCancel: handlePointerUpLongPress,
    };
    return (_jsx("rect", { ref: nodeRef, className: className, width: width, height: height, style: { opacity: 0, touchAction: "none" }, ...interactionProps }));
});
EventCapture.displayName = "EventCapture";
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
