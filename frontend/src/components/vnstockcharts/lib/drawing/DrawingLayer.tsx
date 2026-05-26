import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GenericChartComponent, { getMouseCanvas } from "../GenericChartComponent";
import { createDraftFromTool, createTool, isDrawingToolName } from "./registry";
import { appendPoint, replacePoint } from "./shared";
import type { DrawingObject, DrawingToolType, Point } from "./types";
import { renderDrawingToCanvas, renderDrawingActionHandles, renderRubberBand, renderMeasurementLabel, type RenderCanvasOptions } from "./renderCanvas";
import { computeLiveMeasurement } from "./measuring";
import { getResizeHandleIndex, hitTestActionHandles, isDrawingInRect } from "./hitTest";
import type { PointerDeviceType } from "./hitTest";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "./clipboard";
import {
	createDrawingCoordinateBridgeFromMoreProps,
	buildRenderScalesFromMoreProps,
	resolveBridgePixelOffset,
	resolveActiveChartConfig,
	resolveBaseChartConfig,
	resolveChartPaneId,
	resolveChartScaleDomain,
	resolveDrawingChartConfig,
} from "./morePropsCoordinateBridge";
import { hitTestDrawingWithContext, resolveDrawingPointWithContext } from "./drawingInteractionBridge";
import { resolveDrawingInteractionContext } from "./drawingInteractionBridge";
import { type MagnetSensitivity, type SnapResult } from "./snap";
import type { UseDrawingInteractionReturn } from "./useDrawingInteraction";
import { getSelectedObjectIds } from "./stateMachine";
import type { ChartConfig } from "../StockChartContext";
import { subscribeDrawingStyleChanges } from "./drawingStyleRegistry";
import { resolveSemanticPointLabels } from "./renderCanvas";


export interface DrawingLayerLiveMeasurementLabels {
	priceDeltaPrefix?: string;  // e.g. "Δ giá: "
	pctLabel?: string;           // e.g. "% thay đổi: "
	barsLabel?: string;          // e.g. "Nến: "
}

export interface DrawingLayerProps {
	activeTool: string;
	interaction: UseDrawingInteractionReturn;
	magnetSensitivity?: MagnetSensitivity;
	focusedPointIndex?: number | null;
	onToolUsed?: () => void;
	onContextMenu?: (moreProps: any, event: unknown) => void;
	/** Optional labels for the live measurement overlay shown while drawing */
	liveMeasurementLabels?: DrawingLayerLiveMeasurementLabels;
	/** Fires when the user clicks directly on a semantic pattern point handle (A/B/C/D etc.) */
	onSemanticPointClick?: (pointIndex: number) => void;
	// ── GAP-4: Multi-select batch handlers ────────────────────────────────
	/** Called when a multi-select delete-all action is triggered (keyboard or toolbar) */
	onMultiSelectDeleteAll?: () => void;
	/** Called when a multi-select lock-all action is triggered */
	onMultiSelectLockAll?: (locked: boolean) => void;
	/** Called when a multi-select set-visible-all action is triggered */
	onMultiSelectSetVisibleAll?: (visible: boolean) => void;
	/** Called when a multi-select batch-color action is triggered */
	onMultiSelectBatchColor?: (color: string) => void;
}

type ChartConfigLike = ChartConfig;

function getSelectedDrawingId(drawingState: UseDrawingInteractionReturn["drawingState"]) {
	switch (drawingState.type) {
		case "selected":
			return drawingState.objectId;
		case "selectedMultiple":
			return undefined;
		case "moving":
		case "resizing":
		case "editing":
			return drawingState.objectId;
		default:
			return undefined;
	}
}

function sortVisibleDrawings(drawings: readonly DrawingObject[]) {
	return drawings
		.map((drawing, index) => ({ drawing, index }))
		.filter(({ drawing }) => drawing.visible !== false)
		.sort((left, right) => (left.drawing.zIndex ?? 0) - (right.drawing.zIndex ?? 0) || left.index - right.index)
		.map(({ drawing }) => drawing);
}


function getVisibleDrawings(interaction: UseDrawingInteractionReturn) {
	return sortVisibleDrawings(interaction.history.present);
}

function resolveDrawingInteractionContextFromMoreProps(
	moreProps: any,
	chartConfig = resolveActiveChartConfig(moreProps),
	mousePosition: readonly [number, number] = moreProps.mouseXY ?? [NaN, NaN],
) {
	if (!chartConfig) {
		return undefined;
	}

	const bridge = createDrawingCoordinateBridgeFromMoreProps(moreProps, chartConfig);
	if (!bridge) {
		return undefined;
	}

	return resolveDrawingInteractionContext({
		bridge,
		paneId: resolveChartPaneId(chartConfig),
		scaleSlotId: chartConfig.yScaleId,
		chartWidth: chartConfig.width,
		chartHeight: chartConfig.height,
		x: mousePosition[0],
		y: mousePosition[1],
		plotData: (Array.isArray(moreProps.plotData) ? moreProps.plotData : []) as any[],
		xAccessor: moreProps.xAccessor as ((datum: any) => Date | number | undefined) | undefined,
		yDomain: resolveChartScaleDomain(chartConfig),
		pixelOffset: resolveBridgePixelOffset(moreProps, chartConfig),
	});
}

function resolveDrawingInteractionContextForDrawing(
	moreProps: any,
	drawing?: DrawingObject,
	mousePosition: readonly [number, number] = moreProps.mouseXY ?? [NaN, NaN],
	preferCurrentCharts = false,
) {
	const chartConfig = drawing
		? resolveDrawingChartConfig(moreProps, drawing, preferCurrentCharts)
		: resolveActiveChartConfig(moreProps);
	return resolveDrawingInteractionContextFromMoreProps(moreProps, chartConfig, mousePosition);
}

function findHitDrawing(interaction: UseDrawingInteractionReturn, moreProps: any) {
	const drawings = getVisibleDrawings(interaction);
	return [...drawings].reverse().find((drawing) => {
		const context = resolveDrawingInteractionContextForDrawing(moreProps, drawing, undefined, true);
		if (!context) {
			return false;
		}

		return hitTestDrawingWithContext(drawing, context);
	});
}

function withChartTranslation(
	ctx: CanvasRenderingContext2D,
	baseChartConfig: ChartConfigLike,
	targetChartConfig: ChartConfigLike,
	render: () => void,
) {
	const [baseOriginX, baseOriginY] = baseChartConfig.origin;
	const [targetOriginX, targetOriginY] = targetChartConfig.origin;
	const deltaX = targetOriginX - baseOriginX;
	const deltaY = targetOriginY - baseOriginY;

	if (deltaX === 0 && deltaY === 0) {
		render();
		return;
	}

	ctx.save();
	ctx.translate(deltaX, deltaY);
	try {
		render();
	} finally {
		ctx.restore();
	}
}

function translateDrawing(drawing: DrawingObject, deltaX: number, deltaY: number): DrawingObject {
	if (deltaX === 0 && deltaY === 0) {
		return drawing;
	}

	return {
		...drawing,
		points: drawing.points.map((point) => ({
			x: point.x + deltaX,
			y: point.y + deltaY,
		})),
		style: { ...drawing.style },
		fibLevels: drawing.fibLevels ? [...drawing.fibLevels] : undefined,
		riskReward: drawing.riskReward ? { ...drawing.riskReward } : undefined,
		updatedAt: Date.now(),
	};
}

export function translateDrawingsByIds(
	drawings: readonly DrawingObject[],
	objectIds: readonly string[],
	deltaX: number,
	deltaY: number,
) {
	if (deltaX === 0 && deltaY === 0) {
		return [...drawings];
	}

	const selectedObjectIdSet = new Set(objectIds);
	return drawings.map((drawing) => (selectedObjectIdSet.has(drawing.id)
		? translateDrawing(drawing, deltaX, deltaY)
		: drawing));
}

function calculatePositionRiskReward(type: DrawingObject["type"], startPoint: Point | undefined, endPoint: Point | undefined) {
	if (!startPoint || !endPoint) {
		return undefined;
	}

	if (type === "longPosition") {
		return {
			entry: startPoint.y,
			stop: Math.min(startPoint.y, endPoint.y),
			target: Math.max(startPoint.y, endPoint.y),
		};
	}

	if (type === "shortPosition") {
		return {
			entry: startPoint.y,
			stop: Math.max(startPoint.y, endPoint.y),
			target: Math.min(startPoint.y, endPoint.y),
		};
	}

	return undefined;
}

function constrainResizePoint(drawing: DrawingObject, handleIndex: number, nextPoint: Point): Point {
	switch (drawing.type) {
		case "hLine": {
			const anchorIndex = handleIndex === 0 ? 1 : 0;
			const anchorPoint = drawing.points[anchorIndex];
			return {
				x: nextPoint.x,
				y: anchorPoint?.y ?? nextPoint.y,
			};
		}
		case "vLine": {
			const anchorIndex = handleIndex === 0 ? 1 : 0;
			const anchorPoint = drawing.points[anchorIndex];
			return {
				x: anchorPoint?.x ?? nextPoint.x,
				y: nextPoint.y,
			};
		}
		default:
			return nextPoint;
	}
}

function resizeDrawing(drawing: DrawingObject, handleIndex: number, nextPoint: Point): DrawingObject {
	if (drawing.points.length === 0) {
		return drawing;
	}

	const targetIndex = Math.max(0, Math.min(handleIndex, drawing.points.length - 1));
	const constrainedPoint = constrainResizePoint(drawing, targetIndex, nextPoint);
	const updated = replacePoint(drawing, targetIndex, { ...constrainedPoint });
	const resized: DrawingObject = {
		...updated,
		style: { ...drawing.style },
		fibLevels: drawing.fibLevels ? [...drawing.fibLevels] : undefined,
		riskReward: drawing.riskReward ? { ...drawing.riskReward } : undefined,
		updatedAt: Date.now(),
	};

	if (drawing.type === "longPosition" || drawing.type === "shortPosition") {
		return {
			...resized,
			riskReward: calculatePositionRiskReward(drawing.type, resized.points[0], resized.points[1]),
		};
	}

	return resized;
}

export function resizeDrawingsByIds(
	drawings: readonly DrawingObject[],
	objectIds: readonly string[],
	handleIndex: number,
	nextPoint: Point,
) {
	if (objectIds.length === 0) {
		return [...drawings];
	}

	const selectedObjectIdSet = new Set(objectIds);
	return drawings.map((drawing) => (selectedObjectIdSet.has(drawing.id)
		? resizeDrawing(drawing, handleIndex, nextPoint)
		: drawing));
}

function toDrawingPoint(moreProps: any, interaction: UseDrawingInteractionReturn, activeTool: string, magnetSensitivity: MagnetSensitivity) {
	const context = resolveDrawingInteractionContextForDrawing(
		moreProps,
		interaction.drawingState.type === "drawing" ? interaction.drawingState.object : undefined,
	);
	if (!context) {
		return undefined;
	}

	return resolveDrawingPointWithContext(getVisibleDrawings(interaction), context, magnetSensitivity);
}

function currentDrawing(drawings: readonly DrawingObject[], drawingState: UseDrawingInteractionReturn["drawingState"]) {
	if (drawingState.type === "drawing" || drawingState.type === "complete") {
		return drawingState.object;
	}
	return drawings.find((drawing) => drawing.id === getSelectedDrawingId(drawingState));
}

function isMultiStepTool(toolName: DrawingToolType) {
	return (
		toolName === "channel" ||
		toolName === "parallelChannel" ||
		toolName === "pitchfork" ||
		toolName === "abcdPattern" ||
		toolName === "elliottImpulse" ||
		toolName === "elliottCorrection" ||
		toolName === "elliottTriangle" ||
		toolName === "elliottDoubleCombo" ||
		toolName === "elliottTripleCombo" ||
		toolName === "xabcdPattern" ||
		toolName === "cypherPattern" ||
		toolName === "headAndShoulders" ||
		toolName === "trianglePattern" ||
		toolName === "threeDrivesPattern" ||
		// DT-13: 3-point extended fib tools
		toolName === "fibChannel" ||
		toolName === "trendBasedFibTime" ||
		toolName === "fibWedge" ||
		toolName === "pitchfan"
	);
}



export default function DrawingLayer({ activeTool, interaction, magnetSensitivity = "normal", focusedPointIndex = null, onToolUsed, onContextMenu, liveMeasurementLabels, onSemanticPointClick, onMultiSelectDeleteAll, onMultiSelectLockAll, onMultiSelectSetVisibleAll, onMultiSelectBatchColor }: DrawingLayerProps) {
	const [, setStyleRevision] = useState(0);
	useEffect(() => subscribeDrawingStyleChanges(() => {
		setStyleRevision((value) => value + 1);
	}), []);
	const [, setRubberBandTick] = useState(0);
	const [selectionModifierPressed, setSelectionModifierPressed] = useState(false);

	const selectedObjectIds = useMemo(() => getSelectedObjectIds(interaction.drawingState), [interaction.drawingState]);
	const selectedObjectIdSet = useMemo(() => new Set(selectedObjectIds), [selectedObjectIds]);
	const selectedDrawingId = getSelectedDrawingId(interaction.drawingState);
	const selectedDrawing = selectedDrawingId
		? interaction.history.present.find((drawing) => drawing.id === selectedDrawingId)
		: undefined;
	const canDragSelectedDrawing = activeTool === "cursor" && selectedDrawingId !== undefined && selectedDrawing?.locked !== true;
	const canGroupDrag = activeTool === "cursor" && interaction.drawingState.type === "selectedMultiple";
	const snapRef = useRef<SnapResult | null>(null);
	const pendingResizeHandleRef = useRef<number | null>(null);
	// Track which semantic point handle the mouse is hovering over (for cursor feedback)
	const hoveredSemanticHandleIdxRef = useRef<number | null>(null);
	const [hoveredSemanticHandleIdx, setHoveredSemanticHandleIdx] = useState<number | null>(null);
	const rubberBandRef = useRef<{ startPixel: [number, number]; currentPixel: [number, number] } | null>(null);
	const rubberBandJustCommittedRef = useRef(false);
	const interactionRef = useRef(interaction);
	const lastMovePropsRef = useRef<any>(null);
	// DT-9: track pointer device type for hit-tolerance adaptation
	const pointerDeviceRef = useRef<PointerDeviceType>("mouse");
	useEffect(() => { interactionRef.current = interaction; });
	const dragSessionRef = useRef<{
		mode: "move" | "resize";
		objectId: string;
		selectedObjectIds: string[];
		startChartPoint?: Point;
		handleIndex?: number;
		chartConfig?: ChartConfigLike;
		baseDrawings: DrawingObject[];
	} | null>(null);
	const dragPreviewRef = useRef<DrawingObject[] | null>(null);

	const drawToCanvas = useCallback((ctx: CanvasRenderingContext2D, moreProps: any): void => {
		const baseChartConfig = resolveBaseChartConfig(moreProps);
		if (!baseChartConfig) {
			return;
		}

		const baseDrawings = dragPreviewRef.current ? sortVisibleDrawings(dragPreviewRef.current) : getVisibleDrawings(interaction);
		const drawings = [...baseDrawings];
		const draft = currentDrawing(drawings, interaction.drawingState);
		if (draft && !drawings.some((drawing) => drawing.id === draft.id)) {
			drawings.push(draft);
		}

		for (const drawing of drawings) {
			const chartConfig = resolveDrawingChartConfig(moreProps, drawing) || baseChartConfig;
			const renderScales = buildRenderScalesFromMoreProps(moreProps, chartConfig);
			if (!renderScales) {
				continue;
			}

			// Filter out drawings with invalid/NaN mapped pixel coordinates.
			// Handled dynamically by D3 xScale/yScale, preventing rendering errors or NaN positions
			// while keeping all drawings visible when zooming in or drawing in the margins.
			const hasInvalidPoints = drawing.points.some((pt) => {
				const px = renderScales.xScale(new Date(pt.x));
				const py = renderScales.yScale(pt.y);
				return !Number.isFinite(px) || !Number.isFinite(py);
			});
			if (hasInvalidPoints) {
				continue;
			}

			const canvasOptions: RenderCanvasOptions = {
				chartWidth: chartConfig.width,
				chartHeight: chartConfig.height,
				plotData: renderScales.plotData,
				isSelected: selectedObjectIdSet.has(drawing.id),
				focusedPointIndex: selectedDrawingId === drawing.id ? focusedPointIndex : null,
			};

			withChartTranslation(ctx, baseChartConfig, chartConfig, () => {
				renderDrawingToCanvas(ctx, drawing, renderScales, canvasOptions);
				if (canvasOptions.isSelected && activeTool === "cursor") {
					renderDrawingActionHandles(ctx, drawing, renderScales, canvasOptions.chartWidth, canvasOptions.chartHeight);
				}
			});
		}

		const snap = snapRef.current;
		if (interaction.drawingState.type === "drawing" && snap) {
			const draftChartConfig = resolveDrawingChartConfig(moreProps, interaction.drawingState.object) || resolveActiveChartConfig(moreProps) || baseChartConfig;
			const renderScales = buildRenderScalesFromMoreProps(moreProps, draftChartConfig);
			if (renderScales) {
				withChartTranslation(ctx, baseChartConfig, draftChartConfig, () => {
					ctx.save();
					ctx.beginPath();
					ctx.arc(snap.pixelPoint.x, snap.pixelPoint.y, 6, 0, Math.PI * 2);
					ctx.fillStyle = "#f5a623";
					ctx.strokeStyle = "#ffffff";
					ctx.lineWidth = 1.5;
					ctx.setLineDash([]);
					ctx.fill();
					ctx.stroke();
					ctx.restore();
				});
			}
		}

		if (rubberBandRef.current) {
			const { startPixel, currentPixel } = rubberBandRef.current;
			renderRubberBand(ctx, startPixel[0], startPixel[1], currentPixel[0], currentPixel[1]);
		}

		// ─── DT-6: Live measurement overlay ──────────────────────────────────────
		if (interaction.drawingState.type === "drawing") {
			const draftObj = interaction.drawingState.object;
			const MEASURE_TOOLS = new Set(["trendLine", "ray", "extendedLine", "channel", "arrow", "gannFan", "parallelChannel", "fibExtension"]);
			if (draftObj.points.length >= 2 && MEASURE_TOOLS.has(draftObj.type)) {
				const draftChartConfig = resolveDrawingChartConfig(moreProps, draftObj) || resolveActiveChartConfig(moreProps) || baseChartConfig;
				const renderScales = buildRenderScalesFromMoreProps(moreProps, draftChartConfig);
				if (renderScales) {
					const p0 = draftObj.points[0]!;
					const p1 = draftObj.points[draftObj.points.length - 1]!;
					const measurement = computeLiveMeasurement(p0, p1, renderScales);
					if (measurement) {
						const sign = measurement.priceDelta >= 0 ? "+" : "";
						const priceDeltaText = (liveMeasurementLabels?.priceDeltaPrefix ?? "Δ ") + `${sign}${measurement.priceDelta.toFixed(2)}`;
						const pctText = `${sign}${(measurement.pricePct * 100).toFixed(2)}%`;
						const barsText = `${measurement.barCount} ${liveMeasurementLabels?.barsLabel ?? "nến"}`;
						const midX = (measurement.px0.x + measurement.px1.x) / 2;
						const midY = (measurement.px0.y + measurement.px1.y) / 2;
						withChartTranslation(ctx, baseChartConfig, draftChartConfig, () => {
							renderMeasurementLabel(ctx, midX, midY, {
								priceDeltaText,
								pctText,
								barsText,
								chartWidth: draftChartConfig.width,
								chartHeight: draftChartConfig.height,
							});
						});
					}
				}
			}
		}
	}, [activeTool, interaction, interaction.drawingState, selectedObjectIdSet, liveMeasurementLabels]);

	const isHover = useCallback((moreProps: any) => {
		if (activeTool !== "cursor") {
			return false;
		}

		if (selectionModifierPressed) {
			return true;
		}

		// Show pointer cursor when hovering over a resize handle of the selected drawing
		// (gives visual feedback that semantic/resize points are clickable)
		if (selectedDrawing && selectedDrawingId) {
			const context = resolveDrawingInteractionContextForDrawing(moreProps, selectedDrawing, undefined, true);
			if (context) {
				const handleIndex = getResizeHandleIndex(
					selectedDrawing,
					context.mousePosition[0],
					context.mousePosition[1],
					context.renderScales,
				);
				if (handleIndex !== null) {
					return true;
				}
			}
		}

		const hit = findHitDrawing(interaction, moreProps);
		return hit != null;
	}, [activeTool, selectedDrawing, selectedDrawingId, interaction.history.present, selectionModifierPressed]);

	const handleDragStart = useCallback((moreProps: any, e?: any) => {
		// Ctrl/Meta held = rubber-band selection mode; never start a drag-move session.
		// This prevents drawing movement from racing with rubber-band commit on mouse-up.
		if (rubberBandRef.current) {
			pendingResizeHandleRef.current = null;
			return;
		}

		// Fix D: Shift/Ctrl/Meta+click = multi-select; bail early so no drag session is
		// created and no interaction.startMoving/startResizing call puts the state machine
		// in "moving" state. handleClick will fire (dragHappened=false) and own the
		// selection logic cleanly.
		// NOTE: Ctrl+click on empty space sets rubberBandRef (caught above); Ctrl+click ON
		// a drawing keeps rubberBandRef=null so we must catch it here too.
		// Root-cause fix: moreProps.event is NEVER populated by ChartCanvas→triggerEvent;
		// the raw DOM event arrives as the 2nd callback argument (e) instead.
		const nativeEvent = (e ?? moreProps.event) as MouseEvent | undefined;
		if (nativeEvent?.shiftKey || nativeEvent?.ctrlKey || nativeEvent?.metaKey) {
			pendingResizeHandleRef.current = null;
			return;
		}

		if (!canDragSelectedDrawing || !selectedDrawingId || !selectedDrawing) {
			// Check for group drag when multiple drawings are selected
			if (canGroupDrag) {
				const hit = findHitDrawing(interaction, moreProps);
				if (hit && selectedObjectIdSet.has(hit.id) && hit.locked !== true) {
					const startChartPoint = resolveDrawingInteractionContextForDrawing(moreProps, hit, moreProps.startPos, true)?.chartPoint;
					if (!startChartPoint) {
						pendingResizeHandleRef.current = null;
						return;
					}
					const chartConfig = resolveDrawingChartConfig(moreProps, hit, true) || resolveActiveChartConfig(moreProps);
					if (!chartConfig) {
						pendingResizeHandleRef.current = null;
						return;
					}
					const draggableIds = selectedObjectIds.filter(
						(id) => !interaction.history.present.find((d) => d.id === id)?.locked,
					);
					dragSessionRef.current = {
						mode: "move",
						objectId: hit.id,
						selectedObjectIds: draggableIds,
						startChartPoint,
						chartConfig,
						baseDrawings: interaction.history.present,
					};
					dragPreviewRef.current = null;
					pendingResizeHandleRef.current = null;
					return;
				}
			}
			pendingResizeHandleRef.current = null;
			return;
		}

		const startChartPoint = resolveDrawingInteractionContextForDrawing(moreProps, selectedDrawing, moreProps.startPos, true)?.chartPoint;
		if (!startChartPoint) {
			pendingResizeHandleRef.current = null;
			return;
		}

		const chartConfig = resolveDrawingChartConfig(moreProps, selectedDrawing, true) || resolveActiveChartConfig(moreProps);
		if (!chartConfig) {
			pendingResizeHandleRef.current = null;
			return;
		}

		// Use the explicitly focused point (toolbar "Điểm: X A B C D" selection) as fallback
		// so that dragging while a specific point is focused edits only that point.
		const resizeHandleIndex = pendingResizeHandleRef.current ?? focusedPointIndex;
		if (resizeHandleIndex != null) {
			dragSessionRef.current = {
				mode: "resize",
				objectId: selectedDrawingId,
				selectedObjectIds: [selectedDrawingId],
				handleIndex: resizeHandleIndex,
				chartConfig,
				baseDrawings: interaction.history.present,
			};
			interaction.startResizing(selectedDrawingId, String(resizeHandleIndex));
		} else {
			dragSessionRef.current = {
				mode: "move",
				objectId: selectedDrawingId,
				selectedObjectIds: [selectedDrawingId],
				startChartPoint,
				chartConfig,
				baseDrawings: interaction.history.present,
			};
			interaction.startMoving(selectedDrawingId, startChartPoint, startChartPoint);
		}
		dragPreviewRef.current = null;
		pendingResizeHandleRef.current = null;
	}, [canDragSelectedDrawing, canGroupDrag, focusedPointIndex, interaction, selectedDrawing, selectedDrawingId, selectedObjectIdSet, selectedObjectIds]);

	const handleDrag = useCallback((moreProps: any) => {
		// Fix C: rubber-band active → update currentPixel from drag events.
		// EventCapture routes MOUSEMOVE to handleDrag (not handleMouseMove) when
		// somethingSelected=true, so handleMouseMove never fires during this drag.
		if (rubberBandRef.current) {
			const xy = moreProps.mouseXY;
			if (xy) {
				rubberBandRef.current = {
					...rubberBandRef.current,
					currentPixel: [xy[0] as number, xy[1] as number],
				};
				setRubberBandTick((v) => v + 1);
			}
			return;
		}

		const session = dragSessionRef.current;
		if (!session) {
			return;
		}

		const currentChartPoint = resolveDrawingInteractionContextFromMoreProps(moreProps, session.chartConfig, moreProps.mouseXY)?.chartPoint;
		if (!currentChartPoint) {
			return;
		}

		if (session.mode === "resize" && session.handleIndex != null) {
			// Clamp the dragged point to the visible time range so a single-point
			// drag (e.g. resizing point D of ABCD) cannot exit the chart time frame.
			const resizeCtx = resolveDrawingInteractionContextFromMoreProps(moreProps, session.chartConfig);
			let clampedPoint = currentChartPoint;
			if (resizeCtx && session.chartConfig) {
				const xMinR = resizeCtx.renderScales.xScaleInvert(0).getTime();
				const xMaxR = resizeCtx.renderScales.xScaleInvert(session.chartConfig.width).getTime();
				clampedPoint = {
					x: Math.max(xMinR, Math.min(xMaxR, currentChartPoint.x)),
					y: currentChartPoint.y,
				};
			}
			dragPreviewRef.current = resizeDrawingsByIds(session.baseDrawings, session.selectedObjectIds, session.handleIndex, clampedPoint);
			return;
		}

		if (!session.startChartPoint) {
			return;
		}

		let deltaX = currentChartPoint.x - session.startChartPoint.x;
		const deltaY = currentChartPoint.y - session.startChartPoint.y;

		// Clamp deltaX so that no point of any moving drawing exits the visible x-range.
		// This prevents the drawing from being dragged beyond the chart time boundaries.
		const clampChartConfig = session.chartConfig;
		const ctx2 = clampChartConfig
			? resolveDrawingInteractionContextFromMoreProps(moreProps, clampChartConfig)
			: undefined;
		if (ctx2 && clampChartConfig) {
			const chartWidth = clampChartConfig.width;
			const xMin = ctx2.renderScales.xScaleInvert(0).getTime();
			const xMax = ctx2.renderScales.xScaleInvert(chartWidth).getTime();
			for (const drawing of session.baseDrawings) {
				if (!session.selectedObjectIds.includes(drawing.id)) {
					continue;
				}
				for (const pt of drawing.points) {
					// How far can we move before this point exits each edge?
					// positive = pt is currently inside that edge; negative = already past it.
					const leftHeadroom = pt.x - xMin;
					const rightHeadroom = xMax - pt.x;

					if (deltaX > 0) {
						// Moving right: cap at remaining room; if point is already at/past right
						// edge (rightHeadroom <= 0) block rightward movement entirely.
						deltaX = Math.min(deltaX, Math.max(0, rightHeadroom));
					}
					if (deltaX < 0) {
						// Moving left: cap at remaining room; if point is already at/past left
						// edge (leftHeadroom <= 0) block leftward movement entirely.
						deltaX = Math.max(deltaX, -Math.max(0, leftHeadroom));
					}
				}
			}
		}

		dragPreviewRef.current = translateDrawingsByIds(session.baseDrawings, session.selectedObjectIds, deltaX, deltaY);
	}, []);

	const handleDragComplete = useCallback(() => {
		const session = dragSessionRef.current;
		if (!session) {
			pendingResizeHandleRef.current = null;
			return;
		}

		const previewDrawings = dragPreviewRef.current;
		dragSessionRef.current = null;
		pendingResizeHandleRef.current = null;
		dragPreviewRef.current = null;

		// No actual drag movement happened (previewDrawings is null when handleDrag never fired).
		// Let handleClick own the selection logic for plain clicks, Shift+click, and Ctrl+click.
		if (!previewDrawings) {
			return;
		}

		if (previewDrawings.length !== session.baseDrawings.length || previewDrawings.some((drawing, index) => drawing !== session.baseDrawings[index])) {
			interaction.replaceDrawings(previewDrawings);
		}

		if (session.selectedObjectIds.length > 1) {
			interaction.setSelectedObjects(session.selectedObjectIds);
		} else {
			interaction.selectObject(session.objectId);
		}
	}, [interaction]);

	const handleMouseDown = useCallback((moreProps: any, e?: any) => {
		// DT-9-T02: detect pointer device type from native event
		// Root-cause fix: raw DOM event arrives as 2nd arg (e), not via moreProps.event.
		const nativeDown = (e ?? moreProps.event) as (PointerEvent & { touches?: TouchList }) | undefined;
		if (nativeDown) {
			const pt = (nativeDown as PointerEvent).pointerType;
			if (pt === "touch" || pt === "pen") {
				pointerDeviceRef.current = pt;
			} else {
				pointerDeviceRef.current = "mouse";
			}
			// DT-9-T06: block pinch (multi-touch) from starting a drawing
			if (nativeDown.touches && nativeDown.touches.length > 1) {
				return;
			}
		}

		if (activeTool === "cursor" && canDragSelectedDrawing && selectedDrawingId && selectedDrawing) {
			const context = resolveDrawingInteractionContextForDrawing(moreProps, selectedDrawing, undefined, true);
			if (context) {
				// CE21-DT1: abort drag when pointer is over an action handle
				const chartConfig = resolveDrawingChartConfig(moreProps, selectedDrawing, true) ?? resolveActiveChartConfig(moreProps);
				const actionHandle = hitTestActionHandles(
					context.mousePosition[0],
					context.mousePosition[1],
					selectedDrawing,
					context.renderScales,
					pointerDeviceRef.current,
					chartConfig?.width,
					chartConfig?.height,
				);
				if (actionHandle !== null) {
					pendingResizeHandleRef.current = null;
					return;
				}
				pendingResizeHandleRef.current = getResizeHandleIndex(
					selectedDrawing,
					context.mousePosition[0],
					context.mousePosition[1],
					context.renderScales,
				);
			} else {
				pendingResizeHandleRef.current = null;
			}
		} else {
			pendingResizeHandleRef.current = null;
		}

		// Plain cursor drags pan the chart again; reserve rubber-band selection for Ctrl/Cmd+drag.
		if (activeTool === "cursor" && (nativeDown?.ctrlKey || nativeDown?.metaKey)) {
			const hit = findHitDrawing(interaction, moreProps);
			if (!hit) {
				const xy = moreProps.mouseXY ?? [0, 0];
				rubberBandRef.current = {
					startPixel: [xy[0] as number, xy[1] as number],
					currentPixel: [xy[0] as number, xy[1] as number],
				};
				setRubberBandTick((v) => v + 1);
			}
		}

		if (!isDrawingToolName(activeTool)) {
			return;
		}

		if (interaction.drawingState.type === "drawing") {
			return;
		}

		const resolved = toDrawingPoint(moreProps, interaction, activeTool, magnetSensitivity);
		if (!resolved?.point) {
			return;
		}
		snapRef.current = resolved.snap;
		const chartConfig = resolveActiveChartConfig(moreProps);

		const toolName = activeTool as DrawingToolType;
		const draft = createDraftFromTool(toolName, resolved.point);
		interaction.dispatch({
			type: "START_DRAWING",
			toolName,
			object: {
				...draft,
				paneId: chartConfig?.paneId,
				yScaleId: chartConfig?.yScaleId,
			},
		});
	}, [activeTool, canDragSelectedDrawing, interaction, magnetSensitivity, selectedDrawing, selectedDrawingId]);

	const handleMouseMove = useCallback((moreProps: any) => {
		lastMovePropsRef.current = moreProps;

		if (rubberBandRef.current) {
			const xy = moreProps.mouseXY ?? rubberBandRef.current.currentPixel;
			rubberBandRef.current = {
				startPixel: rubberBandRef.current.startPixel,
				currentPixel: [xy[0] as number, xy[1] as number],
			};
			setRubberBandTick((v) => v + 1);
		}

		// Detect if mouse is over a resize handle of the selected drawing to update the
		// cursor class (pointer cursor signals the point is draggable/clickable).
		// Applies to ALL drawing types, not just semantic ones (XABCD / Elliott).
		if (activeTool === "cursor" && selectedDrawing && selectedDrawingId) {
			const ctx = resolveDrawingInteractionContextForDrawing(moreProps, selectedDrawing, undefined, true);
			const newIdx = ctx
				? (getResizeHandleIndex(selectedDrawing, ctx.mousePosition[0], ctx.mousePosition[1], ctx.renderScales) ?? null)
				: null;
			if (newIdx !== hoveredSemanticHandleIdxRef.current) {
				hoveredSemanticHandleIdxRef.current = newIdx;
				setHoveredSemanticHandleIdx(newIdx);
			}
		} else if (hoveredSemanticHandleIdxRef.current !== null) {
			hoveredSemanticHandleIdxRef.current = null;
			setHoveredSemanticHandleIdx(null);
		}

		if (interaction.drawingState.type !== "drawing") {
			snapRef.current = null;
			return;
		}

		const resolved = toDrawingPoint(moreProps, interaction, interaction.drawingState.toolName, magnetSensitivity);
		if (!resolved?.point) {
			snapRef.current = null;
			return;
		}
		snapRef.current = resolved.snap;

		const tool = createTool(interaction.drawingState.toolName);
		const updated = tool.updateDraft(interaction.drawingState.object, resolved.point);
		interaction.dispatch({ type: "UPDATE_DRAWING", object: updated });
	}, [activeTool, interaction, magnetSensitivity, selectedDrawing, selectedDrawingId]);

	const handleClick = useCallback((moreProps: any, e?: any) => {
		// Root-cause fix: raw DOM event arrives as 2nd arg (e), not via moreProps.event.
		const nativeClick = (e ?? moreProps.event) as MouseEvent | undefined;
		if (activeTool === "cursor" && interaction.drawingState.type !== "drawing") {
			// DT-2: skip deselect if rubber-band just committed a selection
			if (rubberBandJustCommittedRef.current) {
				rubberBandJustCommittedRef.current = false;
				return;
			}

			// CE21-DT1: check action handles on the selected drawing before normal hit test
			if (selectedDrawing && selectedDrawingId) {
				const context = resolveDrawingInteractionContextForDrawing(moreProps, selectedDrawing, undefined, true);
				if (context) {
					const chartConfig = resolveDrawingChartConfig(moreProps, selectedDrawing, true) ?? resolveActiveChartConfig(moreProps);
					const actionHandle = hitTestActionHandles(
						context.mousePosition[0],
						context.mousePosition[1],
						selectedDrawing,
						context.renderScales,
						pointerDeviceRef.current,
						chartConfig?.width,
						chartConfig?.height,
					);
					if (actionHandle === "delete") {
						interaction.deleteSelected();
						return;
					}
					if (actionHandle === "clone") {
						const base = cloneDrawingSnapshot(selectedDrawing);
						const cloned = offsetDrawingByPixels(base, 10, 10);
						interaction.dispatch({ type: "PUSH", drawing: cloned });
						interaction.selectObject(cloned.id);
						return;
					}
					if (actionHandle === "lock") {
						interaction.updateDrawing(selectedDrawingId, { locked: !selectedDrawing.locked });
						return;
					}

					// Semantic point click: if this drawing has labelled points (Elliott, harmonic
					// patterns, etc.) and the pointer is on a resize handle, focus that point.
					if (onSemanticPointClick && resolveSemanticPointLabels(selectedDrawing) !== null) {
						const handleIndex = getResizeHandleIndex(
							selectedDrawing,
							context.mousePosition[0],
							context.mousePosition[1],
							context.renderScales,
						);
						if (handleIndex !== null) {
							onSemanticPointClick(handleIndex);
							pendingResizeHandleRef.current = null;
							return;
						}
					}
				}
			}

			const hit = findHitDrawing(interaction, moreProps);

			if (!hit) {
				interaction.cancelDrawing();
				return;
			}

			const handleSelect = () => {
				interaction.selectObject(hit.id);
			};

			if (nativeClick?.shiftKey || nativeClick?.ctrlKey || nativeClick?.metaKey) {
				const nextSelectedIds = selectedObjectIdSet.has(hit.id)
					? selectedObjectIds.filter((id) => id !== hit.id)
					: [...selectedObjectIds, hit.id];
				interaction.setSelectedObjects(nextSelectedIds);
			} else {
				handleSelect();
			}
			return;
		}

		if (interaction.drawingState.type !== "drawing" || !isDrawingToolName(activeTool)) {
			return;
		}

		const resolved = toDrawingPoint(moreProps, interaction, interaction.drawingState.toolName, magnetSensitivity);
		if (!resolved?.point) {
			snapRef.current = null;
			return;
		}
		snapRef.current = resolved.snap;

		const toolName = interaction.drawingState.toolName;
		const draft = interaction.drawingState.object;

		if (toolName === "polyline") {
			const updated = appendPoint(draft, resolved.point);
			interaction.dispatch({ type: "UPDATE_DRAWING", object: updated });
			return;
		}

		if (isMultiStepTool(toolName)) {
			const startPoint = draft.points[0];
			const lastIndex = draft.points.length - 1;
			// Find the next interior placeholder (i > 0, i < lastIndex).
			// The last point (lastIndex) is always the cursor preview via replaceLastPoint in updateDraft,
			// so it is never a real placeholder and must be excluded from this search.
			const nextInteriorIdx = startPoint
				? draft.points.findIndex((p, i) => i > 0 && i < lastIndex && p.x === startPoint.x && p.y === startPoint.y)
				: -1;

			if (nextInteriorIdx >= 0) {
				// Confirm this interior placeholder; last point keeps tracking cursor via replaceLastPoint
				const updated = replacePoint(draft, nextInteriorIdx, resolved.point);
				interaction.dispatch({ type: "UPDATE_DRAWING", object: updated });
				return;
			}

			// No interior placeholders remain — this is the final click (e.g. D in ABCD).
			// Confirm the last point with the explicit click position.
			const finalUpdated = replacePoint(draft, lastIndex, resolved.point);
			interaction.dispatch({ type: "COMPLETE_DRAWING", object: finalUpdated });
			interaction.dispatch({ type: "PUSH", drawing: finalUpdated });
			interaction.selectObject(finalUpdated.id);
			onToolUsed?.();
			return;
		}

		const completed = createTool(toolName).updateDraft(draft, resolved.point);
		interaction.dispatch({ type: "COMPLETE_DRAWING", object: completed });
		interaction.dispatch({ type: "PUSH", drawing: completed });
		interaction.selectObject(completed.id);
		snapRef.current = null;
		onToolUsed?.();
	}, [activeTool, interaction, magnetSensitivity, onToolUsed, selectedObjectIds, selectedObjectIdSet]);

	const handleContextMenu = useCallback((moreProps: any, e?: any) => {
		const nativeEvent = (e ?? moreProps.event) as MouseEvent | undefined;
		nativeEvent?.preventDefault?.();
		nativeEvent?.stopPropagation?.();

		if (interaction.drawingState.type === "drawing") {
			return;
		}

		const hit = findHitDrawing(interaction, moreProps);
		if (hit && selectedDrawingId !== hit.id) {
			interaction.selectObject(hit.id);
		}

		onContextMenu?.({
			...moreProps,
			hitDrawing: hit ?? null,
		}, nativeEvent);
	}, [interaction, onContextMenu, selectedDrawingId]);

	const handleDoubleClick = useCallback((moreProps: any) => {
		if (activeTool === "cursor" && interaction.drawingState.type !== "drawing") {
			const hit = findHitDrawing(interaction, moreProps);
			if (hit?.type === "text" && hit.locked !== true) {
				interaction.startEditing(hit.id, hit.text ?? "");
				return;
			}
		}

		if (interaction.drawingState.type !== "drawing" || interaction.drawingState.toolName !== "polyline") {
			return;
		}

		const resolved = toDrawingPoint(moreProps, interaction, interaction.drawingState.toolName, magnetSensitivity);
		if (!resolved?.point) {
			snapRef.current = null;
			return;
		}
		snapRef.current = resolved.snap;

		const tool = createTool("polyline");
		const completed = tool.updateDraft(interaction.drawingState.object, resolved.point);
		interaction.dispatch({ type: "UPDATE_DRAWING", object: completed });
		interaction.dispatch({ type: "COMPLETE_DRAWING", object: completed });
		interaction.dispatch({ type: "PUSH", drawing: completed });
		interaction.selectObject(completed.id);
		snapRef.current = null;
		onToolUsed?.();
	}, [activeTool, interaction, magnetSensitivity, onToolUsed]);

	const chartCursorClass = useMemo(() => {
		switch (activeTool) {
			case "hLine":
				return "react-stockcharts-ns-resize-cursor";
			case "vLine":
				return "react-stockcharts-ew-resize-cursor";
			case "text":
				return "react-stockcharts-default-cursor";
			case "cursor":
			case "crosshair":
				return undefined;
			default:
				return "react-stockcharts-crosshair-cursor";
		}
	}, [activeTool]);

	const handleHover = useCallback(() => undefined, []);
	const handleUnHover = useCallback(() => undefined, []);

	// When hovering a semantic point handle, show pointer (hand) to signal it's a clickable/draggable point
	const selectedCursorClass = hoveredSemanticHandleIdx !== null
		? "react-stockcharts-pointer-cursor"
		: selectionModifierPressed
			? "react-stockcharts-multiselect-cursor"
			: canDragSelectedDrawing
				? "react-stockcharts-move-cursor"
				: chartCursorClass;
	const shouldDisablePan = isDrawingToolName(activeTool) || (activeTool === "cursor" && selectionModifierPressed);
	const shouldDisablePanOnMouseDown = useCallback((event: unknown) => {
		const modifierEvent = (typeof event === "object" && event !== null)
			? event as { ctrlKey?: boolean; metaKey?: boolean }
			: undefined;
		return activeTool === "cursor" && Boolean(modifierEvent?.ctrlKey || modifierEvent?.metaKey);
	}, [activeTool]);

	useEffect(() => {
		if (activeTool !== "cursor") {
			setSelectionModifierPressed(false);
			return;
		}

		const syncSelectionModifierPressed = (nextValue: boolean) => {
			setSelectionModifierPressed((current) => (current === nextValue ? current : nextValue));
		};

		const handleModifierKeyChange = (event: KeyboardEvent) => {
			syncSelectionModifierPressed(Boolean(event.ctrlKey || event.metaKey));
		};

		const resetSelectionModifier = () => {
			syncSelectionModifierPressed(false);
		};

		document.addEventListener("keydown", handleModifierKeyChange);
		document.addEventListener("keyup", handleModifierKeyChange);
		window.addEventListener("blur", resetSelectionModifier);

		return () => {
			document.removeEventListener("keydown", handleModifierKeyChange);
			document.removeEventListener("keyup", handleModifierKeyChange);
			window.removeEventListener("blur", resetSelectionModifier);
		};
	}, [activeTool]);

	// DT-2: commit rubber-band selection on pointer up
	useEffect(() => {
		const handlePointerUp = () => {
			if (!rubberBandRef.current) {
				return;
			}
			const { startPixel, currentPixel } = rubberBandRef.current;
			rubberBandRef.current = null;
			setRubberBandTick((v) => v + 1);

			const dx = Math.abs(currentPixel[0] - startPixel[0]);
			const dy = Math.abs(currentPixel[1] - startPixel[1]);
			if (dx < 4 && dy < 4) {
				return; // tiny drag treated as click — handleClick handles deselect
			}

			const moreProps = lastMovePropsRef.current;
			if (!moreProps) {
				return;
			}

			const chartConfig = resolveActiveChartConfig(moreProps);
			const renderScales = chartConfig ? buildRenderScalesFromMoreProps(moreProps, chartConfig) : null;
			if (!renderScales) {
				return;
			}

			const rect = {
				minX: Math.min(startPixel[0], currentPixel[0]),
				maxX: Math.max(startPixel[0], currentPixel[0]),
				minY: Math.min(startPixel[1], currentPixel[1]),
				maxY: Math.max(startPixel[1], currentPixel[1]),
			};

			const matchingIds = interactionRef.current.history.present
				.filter((d) => d.visible !== false)
				.filter((d) => isDrawingInRect(d, rect, renderScales, chartConfig?.width, chartConfig?.height))
				.map((d) => d.id);

			rubberBandJustCommittedRef.current = true;
			interactionRef.current.setSelectedObjects(matchingIds);
		};

		document.addEventListener("pointerup", handlePointerUp);
		return () => document.removeEventListener("pointerup", handlePointerUp);
	}, []); // uses refs only — stable for component lifetime

	// DT-2: Ctrl+A (select all) and Escape (deselect / cancel rubber-band)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (activeTool !== "cursor") {
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "a") {
				e.preventDefault();
				const allIds = interactionRef.current.history.present
					.filter((d) => d.visible !== false)
					.map((d) => d.id);
				interactionRef.current.setSelectedObjects(allIds);
				return;
			}
			// GAP-4: Delete/Backspace triggers batch delete when multiple drawings are selected
			if ((e.key === "Delete" || e.key === "Backspace") && interactionRef.current.drawingState.type === "selectedMultiple") {
				e.preventDefault();
				onMultiSelectDeleteAll?.();
				return;
			}
			if (e.key === "Escape") {
				rubberBandRef.current = null;
				setSelectionModifierPressed(false);
				setRubberBandTick((v) => v + 1);
				interactionRef.current.cancelDrawing();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [activeTool]); // activeTool may change

	return (
		<GenericChartComponent
			clip={false}
			allowAnyChart
			selected={canDragSelectedDrawing || canGroupDrag || selectionModifierPressed}
			interactiveCursorClass={selectedCursorClass}
			disablePan={shouldDisablePan}
			shouldDisablePanOnMouseDown={shouldDisablePanOnMouseDown}
			isHover={isHover}
			onHover={handleHover}
			onUnHover={handleUnHover}
			onDragStart={handleDragStart}
			onDrag={handleDrag}
			onDragComplete={handleDragComplete}
			svgDraw={() => null}
			canvasDraw={drawToCanvas}
			canvasToDraw={getMouseCanvas}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onClick={handleClick}
			onContextMenu={handleContextMenu}
			onDoubleClick={handleDoubleClick}
			drawOn={[
				"mousemove",
				"click",
				"drag",
				"dragend",
				"pan",
				"zoom",
			]}
		/>
	);
}