import { forwardRef, useImperativeHandle, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { format } from "d3-format";
import { scaleTime } from "d3-scale";
import { timeFormat } from "d3-time-format";
import { discontinuousTimeScaleProviderBuilder } from "../lib/scale";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../lib/core/seriesValueResolver";
import {
	createPaneSpecsFromDescriptors,
	resolvePaneDataIndexAtPixel,
	resolvePanePixelAtDataIndex,
	resolvePanePixelAtValue,
	resolvePaneValueAtPixel,
	createCanonicalSeriesStore,
	type CanonicalSeriesStore,
	type EngineInstance,
	type EngineHistorySnapshot,
	type PaneRuntimeSnapshot,
	type VisibleRange as EngineVisibleRange,
} from "@vnstockcharts/vn-kline-engine-core";
import { EngineHost } from "@vnstockcharts/vn-kline-engine-react";
import { DynamicChart, DEFAULT_PANES, type PaneDescriptor, type ChartTheme, type SeriesTypeId, type VisibleRange, useChartTheme } from "../lib/core";
import type { EnrichedDatum, IndicatorMacdValue, IndicatorWhaleValue } from "../lib/core/calculators/types";
import { enrichData } from "../lib/core/calculators/enrichData";
import { enrichDataWithCanonicalStore } from "../lib/core/calculators/enrichDataWithCanonicalStore";
import { useCanvasResize } from "../lib/core/hooks/useCanvasResize";
import { computePaneScaleSlotDomains } from "../lib/core/paneScaleSlotDomains";
import { detectWhaleEvents } from "../lib/indicators/overlays/whaleDetector";
import { WhaleMarketBubbleOverlay } from "../lib/indicators/overlays/WhaleMarketBubbleOverlay";
import { CVDIndicator } from "../lib/indicators/overlays/CVDIndicator";
import { ExternalCVDOverlay } from "../lib/indicators/overlays/ExternalCVDOverlay";
import { DarkFlowBadge } from "../lib/indicators/overlays/DarkFlowBadge";
import type { WhaleOrder, CVDPoint, DarkFlowSignalType } from "../demo/vninvest/types";
import { useDrawingWorkspaceController, type DrawingDockTab, type DrawingWorkspaceController } from "../lib/drawing";
import type { MeasurementCoordinateBridge, MeasurementCoordinateInput, MeasurementCoordinatePixelInput } from "../lib/drawing/coordinateBridge";
import type { MeasurementPoint } from "../lib/drawing/measuring";
import type { DrawingObject, DrawingAlertCondition } from "../lib/drawing/types";
import type { Point } from "../lib/drawing/types";
import type { StockDataAdapter, Timeframe } from "../lib/types/adapter";
import type { OHLCVBar } from "../lib/types/ohlcv";
import { createHistoryChunkStore } from "./history/chunkStore";
import { computeResidentTarget, computeMissingSegments, computeTrimWindow } from "./history/historyWindowPlanner";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { WidgetEmptyState } from "./WidgetEmptyState";
import DrawingPriceLabelsOverlay from "./DrawingPriceLabelsOverlay";
import MeasurementOverlay from "./MeasurementOverlay";
import { WidgetI18nProvider } from "./context/WidgetI18nContext";
import type { WidgetLocale, WidgetMessages } from "./i18n/types";
import { setGlobalTimezone, type WidgetTimezone } from "../lib/utils/timezoneFormatter";

export type WidgetPaneRuntimeSnapshot = PaneRuntimeSnapshot;

export interface WidgetRuntimeCapabilities {
	engineRuntime: "legacy" | "fork";
	paneToolbar: boolean;
	paneSplitters: boolean;
	chartCanvasOverlays: boolean;
	measurementOverlay: boolean;
	drawingOverlays: boolean;
}

export interface WidgetPaneToolbarActions {
	toggleVisibility: () => void;
	removePane: () => void;
	addSeries: () => void;
	toggleSeries: (seriesType: SeriesTypeId, seriesIndex?: number) => void;
	removeSeries: (seriesType: SeriesTypeId, seriesIndex?: number) => void;
}

export interface WidgetPaneToolbarRenderContext {
	pane: PaneDescriptor;
	snapshot: WidgetPaneRuntimeSnapshot;
	hovered: boolean;
	actions: WidgetPaneToolbarActions;
}

export interface WidgetPaneSplitterRenderContext {
	pane: PaneDescriptor;
	snapshot: WidgetPaneRuntimeSnapshot;
	splitterIndex: number;
	top: number;
}

export interface WidgetDrawingChromeRenderContext {
	activeTool: string;
	drawingWorkspace: DrawingWorkspaceController | null;
	isDark: boolean;
	paneSnapshots: readonly WidgetPaneRuntimeSnapshot[];
	selectedDrawing: DrawingObject | null;
	visibleRange: VisibleRange | EngineVisibleRange | null;
	size: { width: number; height: number };
}

export interface WidgetCoordinateBridge extends MeasurementCoordinateBridge {
	engineRuntime: "fork";
	paneSnapshots: readonly WidgetPaneRuntimeSnapshot[];
	visibleRange: EngineVisibleRange;
}

export interface VNStockChartRef {
	exportDrawings(): DrawingObject[];
	importDrawings(drawings: DrawingObject[]): void;
}

export interface VNStockChartProps {
	adapter: StockDataAdapter;
	data?: readonly OHLCVBar[];
	symbol?: string;
	timeframe?: Timeframe;
	drawingUiEnabled?: boolean;
	drawings?: readonly DrawingObject[];
	defaultDrawings?: readonly DrawingObject[];
	drawingStorageKey?: string;
	defaultDrawingDockTab?: DrawingDockTab;
	engineRuntime?: "legacy" | "fork";
	useWebGL?: boolean;
	locale?: WidgetLocale;
	messages?: Partial<WidgetMessages>;
	theme?: ChartTheme;
	timezone?: WidgetTimezone;
	defaultTimezone?: WidgetTimezone;
	onTimezoneChange?: (timezone: WidgetTimezone) => void;
	panes?: readonly PaneDescriptor[];
	xExtents?: readonly [Date | number, Date | number];
	children?: ReactNode;
	className?: string;
	style?: CSSProperties;
	measurementEnabled?: boolean;
	selectedDrawing?: DrawingObject | null;
	showDrawingPriceMarkers?: boolean;
	showNonTradingDays?: boolean;
	enableWhale?: boolean;
	whaleThreshold?: number;
	/** H-02: External whale orders from VNInvest API (overrides internal detectWhaleEvents when provided). */
	whaleOrders?: readonly WhaleOrder[];
	enableCVD?: boolean;
	cvdMode?: "oscillator" | "histogram";
	/** H-03: External CVD series from VNInvest order-flow API (renders as line overlay). */
	externalCvdSeries?: readonly CVDPoint[];
	/** H-04: Dark flow strength 0–100 from detect_dark_flow. */
	darkFlowStrength?: number | null;
	/** H-04: Dark flow signal type label. */
	darkFlowSignalType?: DarkFlowSignalType;
	onClick?: (moreProps: { currentItem?: EnrichedDatum; currentCharts?: number[]; mouseXY?: [number, number] }, event: unknown) => void;
	onContextMenu?: (moreProps: { currentItem?: EnrichedDatum; currentCharts?: number[]; mouseXY?: [number, number] }, event: unknown) => void;
	onDrawingsChange?: (drawings: readonly DrawingObject[]) => void;
	onSelectedDrawingChange?: (drawing: DrawingObject | null) => void;
	onDrawingWorkspaceChange?: (workspace: DrawingWorkspaceController | null) => void;
	onVisibleDomainChange?: (domain: [Date | number, Date | number]) => void;
	onVisibleRangeChange?: (range: VisibleRange) => void;
	onBarsChange?: (bars: readonly OHLCVBar[]) => void;
	/**
	 * Increment this counter each time the user selects a new chart range to force
	 * the chart to reset its viewport, bypassing the spurious-reset guard that would
	 * otherwise keep the old zoomed view when data also grows in the same render.
	 */
	resetKey?: number;
	onPaneSnapshotsChange?: (snapshots: readonly WidgetPaneRuntimeSnapshot[]) => void;
	onPaneHover?: (paneId: string | null) => void;
	onPaneToggleVisibleRequest?: (paneId: string) => void;
	onPaneRemoveRequest?: (paneId: string) => void;
	onPaneAddSeriesRequest?: (paneId: string) => void;
	onPaneToggleSeriesRequest?: (paneId: string, seriesType: SeriesTypeId, seriesIndex?: number) => void;
	onPaneRemoveSeriesRequest?: (paneId: string, seriesType: SeriesTypeId, seriesIndex?: number) => void;
	onRuntimeCapabilitiesChange?: (capabilities: WidgetRuntimeCapabilities) => void;
	onCoordinateBridgeChange?: (bridge: WidgetCoordinateBridge | null) => void;
	renderPaneToolbar?: (context: WidgetPaneToolbarRenderContext) => ReactNode;
	renderPaneSplitter?: (context: WidgetPaneSplitterRenderContext) => ReactNode;
	renderDrawingChrome?: (context: WidgetDrawingChromeRenderContext) => ReactNode;
	onError?: (error: Error) => void;
	/** DT-10-T08: Callback fired when a drawing's alert condition triggers (price crosses reference level) */
	onDrawingAlert?: (drawing: DrawingObject, condition: DrawingAlertCondition, currentPrice: number) => void;
}

interface VNStockChartContentProps extends VNStockChartProps {
	onRuntimeDegraded?: (reason: "fork-no-render-output") => void;
}

const priceFormat = format(",.2f");
const volumeFormat = format(".3s");
const dateFormat = timeFormat("%d/%m/%Y %H:%M");
const CHART_MARGIN = { left: 60, right: 68, top: 8, bottom: 28 } as const;
const HISTORY_BACKFILL_PAGE_LIMIT = 1000;
const HISTORY_RECONCILE_MAX_PAGES = 12;

interface HistoryWindow {
	startMs: number;
	endMs: number;
}

type WidgetHistorySessionMode = "controlled" | "uncontrolled";

interface WidgetHistorySessionState {
	requestKey: string;
	mode: WidgetHistorySessionMode;
	revision: number;
}

function clampIndex(index: number, length: number) {
	if (length <= 0) {
		return 0;
	}
	const lastIndex = length - 1;
	return Math.min(lastIndex, Math.max(0, Math.floor(index)));
}

function asTimeValue(value: Date | number): number {
	return value instanceof Date ? value.getTime() : value;
}

function findNearestDateIndex(data: readonly EnrichedDatum[], targetTime: number): number {
	if (data.length === 0) {
		return 0;
	}

	let low = 0;
	let high = data.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midTime = data[mid].date.getTime();
		if (midTime === targetTime) {
			return mid;
		}
		if (midTime < targetTime) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	const right = Math.min(data.length - 1, Math.max(0, low));
	const left = Math.min(data.length - 1, Math.max(0, high));
	return Math.abs(data[left].date.getTime() - targetTime) <= Math.abs(data[right].date.getTime() - targetTime)
		? left
		: right;
}

function resolveDiscontinuousXExtents(
	extents: readonly [Date | number, Date | number] | undefined,
	data: readonly EnrichedDatum[],
	xAccessor: (datum: EnrichedDatum) => number,
) {
	if (data.length === 0) {
		return undefined;
	}

	const lastIndex = data.length - 1;
	const defaultStart = xAccessor(data[0]);
	const defaultEnd = xAccessor(data[lastIndex]);
	if (!extents) {
		return [defaultStart, defaultEnd] as [number, number];
	}

	const startIndex = findNearestDateIndex(data, asTimeValue(extents[0]));
	const endIndex = findNearestDateIndex(data, asTimeValue(extents[1]));
	return [xAccessor(data[startIndex]), xAccessor(data[endIndex])] as [number, number];
}

function resolveDateDomainFromDiscontinuous(
	domain: [Date | number, Date | number],
	data: readonly EnrichedDatum[],
	xAccessor: (datum: EnrichedDatum) => number,
): [Date, Date] {
	if (data.length === 0) {
		const epoch = new Date(0);
		return [epoch, epoch];
	}

	const firstIndexValue = xAccessor(data[0]);
	const lastDataIndex = data.length - 1;
	const resolveDate = (value: Date | number, fallbackIndex: number) => {
		if (typeof value !== "number" || !Number.isFinite(value)) {
			return data[fallbackIndex].date;
		}

		const dataIndex = clampIndex(Math.round(value - firstIndexValue), data.length);
		return data[dataIndex]?.date ?? data[fallbackIndex].date;
	};

	return [resolveDate(domain[0], 0), resolveDate(domain[1], lastDataIndex)];
}

function normalizeForkVisibleRange(range: EngineVisibleRange, data: readonly EnrichedDatum[]): VisibleRange | null {
	if (data.length === 0) {
		return null;
	}

	const rawStartIndex = clampIndex(Math.min(range.from, range.to), data.length);
	const rawEndIndex = clampIndex(Math.max(range.from, range.to), data.length);
	const startBar = data[rawStartIndex];
	const endBar = data[rawEndIndex];
	if (!startBar?.date || !endBar?.date) {
		return null;
	}

	return {
		startIndex: rawStartIndex,
		endIndex: rawEndIndex,
		startDate: startBar.date,
		endDate: endBar.date,
		barCount: rawEndIndex - rawStartIndex + 1,
	};
}

function resolveEngineSeriesValueForRuntime(datum: EnrichedDatum, series: PaneDescriptor["series"][number]) {
	switch (series.type) {
		case "MACD": {
			const value = resolveSeriesStructuredValue(datum, series) as IndicatorMacdValue | undefined;
			return value?.divergence;
		}
		case "Whale": {
			const value = resolveSeriesStructuredValue(datum, series) as IndicatorWhaleValue | undefined;
			const buy = value?.whaleBuyVol ?? 0;
			const sell = value?.whaleSellVol ?? 0;
			return buy - sell;
		}
		case "CVDApprox":
			return datum.cvdDelta ?? datum.cvdApprox;
		case "CVDRealtime":
			return datum.cvdRealtime;
		default:
			return resolveSeriesValue(datum, series);
	}
}

function buildLegacyPaneSnapshots(
	panes: readonly PaneDescriptor[],
	heights: readonly number[],
	canvasSize: { width: number; height: number },
	scaleSlotDomains: Record<string, [number, number]>,
): readonly WidgetPaneRuntimeSnapshot[] {
	const plotWidth = Math.max(0, canvasSize.width - CHART_MARGIN.left - CHART_MARGIN.right);
	let top = CHART_MARGIN.top;

	return panes.map((pane, index) => {
		const height = heights[index] ?? 0;
		const hasLeftAxis = pane.series.some((series) => series.visible !== false && series.yAxis === "left");
		// Treat yAxis == null/undefined as "right" (default axis side) so panes where
		// series have no explicit yAxis assignment still produce a right-side slot.
		const hasRightAxis = pane.series.some((series) => series.visible !== false && (series.yAxis === "right" || series.yAxis == null));
		const snapshotTop = top;
		top += height;
		const leftBounds = hasLeftAxis
			? {
				top: snapshotTop,
				left: 0,
				width: CHART_MARGIN.left,
				height,
			}
			: undefined;
		const rightBounds = hasRightAxis
			? {
				top: snapshotTop,
				left: canvasSize.width - CHART_MARGIN.right,
				width: CHART_MARGIN.right,
				height,
			}
			: undefined;
		const scaleSlotBounds = {
			...(leftBounds ? { [`${pane.id}-left`]: leftBounds } : {}),
			...(rightBounds ? { [`${pane.id}-right`]: rightBounds } : {}),
		};
		const scaleSlotStates = {
			...(leftBounds ? { [`${pane.id}-left`]: { side: "left" as const, mode: "auto" as const, visible: true, domain: scaleSlotDomains[`${pane.id}-left`] } } : {}),
			...(rightBounds ? { [`${pane.id}-right`]: { side: "right" as const, mode: "auto" as const, visible: true, domain: scaleSlotDomains[`${pane.id}-right`] } } : {}),
		};

		return {
			paneId: pane.id,
			bounds: {
				top: snapshotTop,
				left: 0,
				width: canvasSize.width,
				height,
			},
			plotBounds: {
				top: snapshotTop,
				left: CHART_MARGIN.left,
				width: plotWidth,
				height,
			},
			axisBounds: {
				...(leftBounds
					? {
						left: leftBounds,
					}
					: {}),
				...(rightBounds
					? {
						right: rightBounds,
					}
					: {}),
			},
			scaleSlotBounds,
			scaleSlotStates,
			headerAnchor: {
				top: snapshotTop,
				left: CHART_MARGIN.left,
				width: plotWidth,
			},
			labelAnchor: {
				top: snapshotTop,
				left: 0,
				height,
			},
		};
	});
}

export function normalizePaneDescriptorsForExplicitScaleSlots(panes: readonly PaneDescriptor[]): PaneDescriptor[] {
	return panes.map((pane) => {
		const normalizedSeries = pane.series.map((series) => ({
			...series,
			params: series.params ? { ...series.params } : undefined,
			scaleSlotId: series.scaleSlotId ?? `${pane.id}-${series.yAxis}`,
			subColors: series.subColors ? { ...series.subColors } : undefined,
		}));
		const activeSeries = normalizedSeries.filter((series) => series.visible !== false);
		const hasLeftAxis = activeSeries.some((series) => series.yAxis === "left");
		const hasRightAxis = activeSeries.some((series) => series.yAxis === "right");

		return {
			...pane,
			series: normalizedSeries,
			splitScale: hasLeftAxis && hasRightAxis,
		};
	});
}

const NORMALIZED_DEFAULT_PANES = normalizePaneDescriptorsForExplicitScaleSlots(DEFAULT_PANES);

function resolveVisiblePanes(panes: readonly PaneDescriptor[] | undefined): readonly PaneDescriptor[] {
	const candidatePanes = panes?.length ? normalizePaneDescriptorsForExplicitScaleSlots(panes) : NORMALIZED_DEFAULT_PANES;
	const nextPanes = candidatePanes.filter((pane) => pane.visible);
	return nextPanes.length > 0 ? nextPanes : NORMALIZED_DEFAULT_PANES.filter((pane) => pane.visible);
}

function inferAxisSideFromScaleSlotId(scaleSlotId: string) {
	if (scaleSlotId.endsWith("-left")) {
		return "left" as const;
	}
	if (scaleSlotId.endsWith("-right")) {
		return "right" as const;
	}
	return "right" as const;
}

function mergePaneSnapshotDomains(
	snapshots: readonly WidgetPaneRuntimeSnapshot[],
	scaleSlotDomains: Record<string, [number, number]>,
) {
	return snapshots.map((snapshot) => {
		const scaleSlotIds = new Set([
			...Object.keys(snapshot.scaleSlotBounds),
			...Object.keys(snapshot.scaleSlotStates ?? {}),
		]);

		const scaleSlotStates = Object.fromEntries(
			[...scaleSlotIds].map((scaleSlotId) => {
				const currentState = snapshot.scaleSlotStates[scaleSlotId];
				return [scaleSlotId, {
					side: currentState?.side ?? inferAxisSideFromScaleSlotId(scaleSlotId),
					mode: currentState?.mode ?? "auto",
					visible: currentState?.visible ?? true,
					domain: scaleSlotDomains[scaleSlotId] ?? currentState?.domain,
				}];
			}),
		);

		return {
			...snapshot,
			scaleSlotStates,
		};
	});
}

function resolvePreferredScaleSlotId(snapshot: WidgetPaneRuntimeSnapshot, requestedScaleSlotId?: string) {
	if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]) {
		return requestedScaleSlotId;
	}

	const visibleScaleSlotIds = Object.entries(snapshot.scaleSlotStates)
		.filter(([, state]) => state.visible)
		.map(([scaleSlotId]) => scaleSlotId);
	if (visibleScaleSlotIds.length === 0) {
		return undefined;
	}

	return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
		?? visibleScaleSlotIds[0];
}

function findPlotDataIndex(point: MeasurementPoint, data: readonly EnrichedDatum[]) {
	if (point.index >= 0 && point.index < data.length) {
		return point.index;
	}

	return data.findIndex((datum) => datum.date.getTime() === point.date.getTime());
}

function findPlotDataIndexByTime(timestamp: number, data: readonly EnrichedDatum[]) {
	return data.findIndex((datum) => datum.date.getTime() === timestamp);
}

function createWidgetCoordinateBridge({
	paneSnapshots,
	visibleRange,
	plotData,
}: {
	paneSnapshots: readonly WidgetPaneRuntimeSnapshot[];
	visibleRange: EngineVisibleRange | VisibleRange | null;
	plotData: readonly EnrichedDatum[];
}): WidgetCoordinateBridge | null {
	const normalizedVisibleRange = visibleRange
		? ("from" in visibleRange && "to" in visibleRange
			? visibleRange
			: { from: visibleRange.startIndex, to: visibleRange.endIndex })
		: null;

	if (!normalizedVisibleRange || plotData.length === 0 || paneSnapshots.length === 0) {
		return null;
	}

	const paneSnapshotMap = new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot] as const));

	const resolveWidgetChartPoint = (
		snapshot: WidgetPaneRuntimeSnapshot,
		resolvedScaleSlotId: string,
		x: number,
		y: number,
	): Point | undefined => {
		const index = resolvePaneDataIndexAtPixel(snapshot, normalizedVisibleRange, x, plotData.length);
		if (index === null) {
			return undefined;
		}

		const datum = plotData[index];
		const value = resolvePaneValueAtPixel(snapshot, resolvedScaleSlotId, y);
		if (!datum?.date || value === null) {
			return undefined;
		}

		return {
			x: datum.date.getTime(),
			y: value,
		};
	};

	const resolveWidgetPointPixel = (
		snapshot: WidgetPaneRuntimeSnapshot,
		resolvedScaleSlotId: string,
		point: Point,
		preferredIndex?: number,
	) => {
		const dataIndex = preferredIndex != null && preferredIndex >= 0 && preferredIndex < plotData.length
			&& plotData[preferredIndex]?.date.getTime() === point.x
			? preferredIndex
			: findPlotDataIndexByTime(point.x, plotData);
		if (dataIndex < 0) {
			return undefined;
		}

		const x = resolvePanePixelAtDataIndex(snapshot, normalizedVisibleRange, dataIndex, plotData.length);
		const y = resolvePanePixelAtValue(snapshot, resolvedScaleSlotId, point.y);
		if (x === null || y === null) {
			return undefined;
		}

		return { x, y };
	};

	return {
		engineRuntime: "fork",
		paneSnapshots,
		visibleRange: normalizedVisibleRange,
		resolveChartPoint: ({ paneId, x, y, scaleSlotId }) => {
			const snapshot = paneSnapshotMap.get(paneId);
			if (!snapshot) {
				return undefined;
			}

			const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
			if (!resolvedScaleSlotId) {
				return undefined;
			}

			return resolveWidgetChartPoint(snapshot, resolvedScaleSlotId, x, y);
		},
		chartPointToPixel: ({ paneId, point, scaleSlotId }) => {
			const snapshot = paneSnapshotMap.get(paneId);
			if (!snapshot) {
				return undefined;
			}

			const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
			if (!resolvedScaleSlotId) {
				return undefined;
			}

			return resolveWidgetPointPixel(snapshot, resolvedScaleSlotId, point);
		},
		resolveMeasurementPoint: ({ paneId, x, y, scaleSlotId }: MeasurementCoordinateInput) => {
			const snapshot = paneSnapshotMap.get(paneId);
			if (!snapshot) {
				return undefined;
			}

			const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
			if (!resolvedScaleSlotId) {
				return undefined;
			}

			const chartPoint = resolveWidgetChartPoint(snapshot, resolvedScaleSlotId, x, y);
			if (!chartPoint) {
				return undefined;
			}

			const index = findPlotDataIndexByTime(chartPoint.x, plotData);
			const datum = index >= 0 ? plotData[index] : undefined;
			if (!datum?.date) {
				return undefined;
			}

			return {
				index,
				date: datum.date,
				price: chartPoint.y,
			};
		},
		measurementPointToPixel: ({ paneId, point, scaleSlotId }: MeasurementCoordinatePixelInput) => {
			const snapshot = paneSnapshotMap.get(paneId);
			if (!snapshot) {
				return undefined;
			}

			const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
			if (!resolvedScaleSlotId) {
				return undefined;
			}

			return resolveWidgetPointPixel(snapshot, resolvedScaleSlotId, {
				x: point.date.getTime(),
				y: point.price,
			}, findPlotDataIndex(point, plotData));
		},
	};
}

function arePaneSnapshotsEqual(
	left: readonly WidgetPaneRuntimeSnapshot[],
	right: readonly WidgetPaneRuntimeSnapshot[],
) {
	if (left === right) {
		return true;
	}

	if (left.length !== right.length) {
		return false;
	}

	return JSON.stringify(left) === JSON.stringify(right);
}

function areRuntimeCapabilitiesEqual(
	left: WidgetRuntimeCapabilities | null | undefined,
	right: WidgetRuntimeCapabilities | null | undefined,
) {
	if (left === right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return left.engineRuntime === right.engineRuntime
		&& left.paneToolbar === right.paneToolbar
		&& left.paneSplitters === right.paneSplitters
		&& left.chartCanvasOverlays === right.chartCanvasOverlays
		&& left.measurementOverlay === right.measurementOverlay
		&& left.drawingOverlays === right.drawingOverlays;
}

const PANE_HEADER_HEIGHT = 28;

function resolveHoveredPaneId(
	event: ReactPointerEvent<HTMLDivElement>,
	snapshots: readonly WidgetPaneRuntimeSnapshot[],
) {
	const rect = event.currentTarget.getBoundingClientRect();
	const localX = event.clientX - rect.left;
	const localY = event.clientY - rect.top;
	// Only activate header hover when cursor is within the header strip, not the full pane.
	const hoveredSnapshot = snapshots.find((snapshot) => {
		const headerTop = snapshot.headerAnchor.top;
		const headerBottom = headerTop + PANE_HEADER_HEIGHT;
		const right = snapshot.bounds.left + snapshot.bounds.width;
		return localX >= snapshot.bounds.left && localX <= right && localY >= headerTop && localY <= headerBottom;
	});

	return hoveredSnapshot?.paneId ?? null;
}

function findPaneSnapshotAtPosition(
	snapshots: readonly WidgetPaneRuntimeSnapshot[],
	localX: number,
	localY: number,
) {
	return snapshots.find((snapshot) => {
		const right = snapshot.bounds.left + snapshot.bounds.width;
		const bottom = snapshot.bounds.top + snapshot.bounds.height;
		return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
	});
}

function resolveFetchWindow(timeframe: Timeframe): { from: Date; to: Date } {
	const to = new Date();
	const oneDay = 24 * 60 * 60 * 1000;
	const lookbackDays = (() => {
		switch (timeframe) {
			case "1m":
			case "3m":
			case "5m":
				return 7;
			case "15m":
			case "30m":
				return 14;
			case "1h":
				return 30;
			case "4h":
				return 90;
			case "1d":
				return 365;
			default:
				return 30;
		}
	})();
	return { from: new Date(to.getTime() - lookbackDays * oneDay), to };
}

function resolveTimeframeMs(timeframe: Timeframe): number {
	switch (timeframe) {
		case "1m":
			return 60_000;
		case "3m":
			return 3 * 60_000;
		case "5m":
			return 5 * 60_000;
		case "15m":
			return 15 * 60_000;
		case "30m":
			return 30 * 60_000;
		case "1h":
			return 60 * 60_000;
		case "2h":
			return 2 * 60 * 60_000;
		case "4h":
			return 4 * 60 * 60_000;
		case "1d":
			return 24 * 60 * 60_000;
		case "1w":
			return 7 * 24 * 60 * 60_000;
		case "1M":
			return 30 * 24 * 60 * 60_000;
		default:
			return 24 * 60 * 60_000;
	}
}

function computeLoadedHistoryWindow(bars: readonly OHLCVBar[]): HistoryWindow | null {
	if (bars.length === 0) {
		return null;
	}

	return {
		startMs: bars[0].date.getTime(),
		endMs: bars[bars.length - 1].date.getTime(),
	};
}

function resolveRetentionWindow(visibleDomain: readonly [Date, Date], timeframe: Timeframe): HistoryWindow {
	const visibleStartMs = visibleDomain[0].getTime();
	const visibleEndMs = visibleDomain[1].getTime();
	const spanMs = Math.max(resolveTimeframeMs(timeframe), visibleEndMs - visibleStartMs);

	return {
		startMs: visibleStartMs - spanMs,
		endMs: visibleEndMs + spanMs,
	};
}

function trimBarsToRetentionWindow(
	bars: readonly OHLCVBar[],
	visibleDomain: readonly [Date, Date] | null,
	timeframe: Timeframe,
): readonly OHLCVBar[] {
	if (!visibleDomain || bars.length === 0) {
		return bars;
	}

	const retentionWindow = resolveRetentionWindow(visibleDomain, timeframe);
	const trimmedBars = bars.filter((bar) => {
		const timestamp = bar.date.getTime();
		return timestamp >= retentionWindow.startMs && timestamp <= retentionWindow.endMs;
	});

	if (trimmedBars.length === 0 || trimmedBars.length === bars.length) {
		return bars;
	}

	return trimmedBars;
}

function mergeBarPagesByDate(previousBars: readonly OHLCVBar[], nextBars: readonly OHLCVBar[]): readonly OHLCVBar[] {
	return nextBars.reduce((mergedBars, nextBar) => mergeBarsByDate(mergedBars, nextBar), previousBars);
}

function mergeBarsByDate(previousBars: readonly OHLCVBar[], nextBar: OHLCVBar): readonly OHLCVBar[] {
	if (previousBars.length === 0) {
		return [nextBar];
	}
	const lastBar = previousBars[previousBars.length - 1];
	if (lastBar.date.getTime() === nextBar.date.getTime()) {
		return [...previousBars.slice(0, -1), nextBar];
	}
	if (lastBar.date.getTime() < nextBar.date.getTime()) {
		return [...previousBars, nextBar];
	}
	const existingIndex = previousBars.findIndex((bar) => bar.date.getTime() === nextBar.date.getTime());
	if (existingIndex >= 0) {
		return previousBars.map((bar, index) => (index === existingIndex ? nextBar : bar));
	}
	return [...previousBars, nextBar].sort((left, right) => left.date.getTime() - right.date.getTime());
}

const VNStockChartContent = forwardRef<VNStockChartRef, VNStockChartContentProps>(({
	adapter,
	data,
	symbol,
	timeframe,
	drawingUiEnabled = false,
	drawings,
	defaultDrawings,
	drawingStorageKey,
	defaultDrawingDockTab,
	engineRuntime = "fork",
	useWebGL = false,
	locale,
	theme,
	panes,
	xExtents: controlledXExtents,
	children,
	className,
	style,
	measurementEnabled,
	selectedDrawing,
	showDrawingPriceMarkers,
	showNonTradingDays = false,
	enableWhale,
	whaleThreshold = 1_000_000,
	whaleOrders,
	enableCVD,
	cvdMode = "oscillator",
	externalCvdSeries,
	darkFlowStrength,
	darkFlowSignalType,
	onClick,
	onContextMenu,
	onDrawingsChange,
	onSelectedDrawingChange,
	onDrawingWorkspaceChange,
	onVisibleDomainChange,
	onVisibleRangeChange,
	onBarsChange,
	onPaneSnapshotsChange,
	onPaneHover,
	onPaneToggleVisibleRequest,
	onPaneRemoveRequest,
	onPaneAddSeriesRequest,
	onPaneToggleSeriesRequest,
	onPaneRemoveSeriesRequest,
	onRuntimeCapabilitiesChange,
	onCoordinateBridgeChange,
	renderPaneToolbar,
	renderPaneSplitter,
	renderDrawingChrome,
	onError,
	onRuntimeDegraded,
	resetKey = 0,
}, forwardedRef) => {
	const { ref, size } = useCanvasResize<HTMLDivElement>();
	const hoveredPaneIdRef = useRef<string | null>(null);
	const forkDegradeNotifiedRef = useRef(false);
	const forkPaneSnapshotsRef = useRef<readonly WidgetPaneRuntimeSnapshot[]>([]);
	const forkVisibleRangeRef = useRef<EngineVisibleRange | null>(null);
	const lastEmittedDrawingWorkspaceRef = useRef<DrawingWorkspaceController | null>(null);
	const lastDrawingWorkspaceSubscriberRef = useRef<typeof onDrawingWorkspaceChange>(undefined);
	const latestDrawingWorkspaceSubscriberRef = useRef<typeof onDrawingWorkspaceChange>(onDrawingWorkspaceChange);
	const lastEmittedPaneSnapshotsRef = useRef<readonly WidgetPaneRuntimeSnapshot[]>([]);
	const lastPaneSnapshotsSubscriberRef = useRef<typeof onPaneSnapshotsChange>(undefined);
	const lastRuntimeCapabilitiesRef = useRef<WidgetRuntimeCapabilities | null>(null);
	const lastRuntimeCapabilitiesSubscriberRef = useRef<typeof onRuntimeCapabilitiesChange>(undefined);
	/** Ref to the fork engine instance — used to call setEnrichedData on data change */
	const engineInstanceRef = useRef<EngineInstance | null>(null);
	const [paneSnapshots, setPaneSnapshots] = useState<readonly WidgetPaneRuntimeSnapshot[]>([]);
	const [hoveredPaneId, setHoveredPaneId] = useState<string | null>(null);
	const [forkVisibleRange, setForkVisibleRange] = useState<EngineVisibleRange | null>(null);
	const [legacyVisibleRange, setLegacyVisibleRange] = useState<VisibleRange | null>(null);
	const themeState = useChartTheme("light");
	const resolvedTheme = theme ?? themeState.theme;
	const isDark = resolvedTheme === "dark";

	useEffect(() => {
		if (typeof document === "undefined") {
			return undefined;
		}

		const root = document.documentElement;
		const previousTheme = root.getAttribute("data-chart-theme");
		root.setAttribute("data-chart-theme", resolvedTheme);

		return () => {
			if (previousTheme === null) {
				if (root.getAttribute("data-chart-theme") === resolvedTheme) {
					root.removeAttribute("data-chart-theme");
				}
				return;
			}

			if (root.getAttribute("data-chart-theme") === resolvedTheme) {
				root.setAttribute("data-chart-theme", previousTheme);
			}
		};
	}, [resolvedTheme]);

	const hasExternalData = Array.isArray(data);
	const historySessionMode: WidgetHistorySessionMode = hasExternalData ? "controlled" : "uncontrolled";
	const [bars, setBars] = useState<readonly OHLCVBar[]>(data ?? []);
	const [loading, setLoading] = useState(() => !hasExternalData);
	const [error, setError] = useState<Error | null>(null);
	const barsRef = useRef<readonly OHLCVBar[]>(bars);
	const visibleDomainRef = useRef<[Date, Date] | null>(null);
	const historyWindowSyncInFlightRef = useRef(false);
	const pendingVisibleDomainRef = useRef<[Date, Date] | null>(null);
	const historyBackfillBeforeRef = useRef<number | null>(null);
	const historyForwardAfterRef = useRef<number | null>(null);
	const activeHistoryRequestKeyRef = useRef("");
	const activeHistorySessionRevisionRef = useRef(0);
	const historySessionRef = useRef<WidgetHistorySessionState>({
		requestKey: "",
		mode: historySessionMode,
		revision: 0,
	});
	barsRef.current = bars;
	const historyChunkStoreRef = useRef(createHistoryChunkStore());

	const resetHistorySessionControllerRefs = () => {
		visibleDomainRef.current = null;
		historyWindowSyncInFlightRef.current = false;
		pendingVisibleDomainRef.current = null;
		historyBackfillBeforeRef.current = null;
		historyForwardAfterRef.current = null;
	};

	useEffect(() => {
		if (historySessionMode !== "controlled") {
			return;
		}
		setBars(data ?? []);
		setLoading(false);
		setError(null);
	}, [data, historySessionMode]);

	useEffect(() => {
		onBarsChange?.(bars);
	}, [bars, onBarsChange]);

	const activeSymbol = symbol ?? "BTCUSDT";
	const activeTimeframe = timeframe ?? "1h";
	const drawingWorkspace = useDrawingWorkspaceController({
		defaultDockTab: defaultDrawingDockTab,
		defaultDrawings,
		drawings,
		drawingStorageKey,
		enabled: drawingUiEnabled,
		onDrawingsChange,
		symbol: activeSymbol,
		timeframe: activeTimeframe,
	});

	useImperativeHandle(forwardedRef, () => ({
		exportDrawings: () => {
			return [...drawingWorkspace.state.drawings];
		},
		importDrawings: (drawingsToImport) => {
			drawingWorkspace.interaction.replaceDrawings(drawingsToImport);
		},
	}), [drawingWorkspace]);

	const resolvedSelectedDrawing = selectedDrawing ?? (drawingUiEnabled ? drawingWorkspace.state.selectedDrawing : null);
	const activeLocale = locale ?? "vi";
	const useForkRuntime = engineRuntime === "fork";
	const activeHistoryRequestKey = `${activeSymbol}:${activeTimeframe}`;
	let historySession = historySessionRef.current;
	if (historySession.requestKey !== activeHistoryRequestKey || historySession.mode !== historySessionMode) {
		historySession = {
			requestKey: activeHistoryRequestKey,
			mode: historySessionMode,
			revision: historySession.revision + 1,
		};
		historySessionRef.current = historySession;
		resetHistorySessionControllerRefs();
	}
	const currentHistorySessionRequestKey = historySession.requestKey;
	const currentHistorySessionRevision = historySession.revision;
	const isControlledHistorySession = historySession.mode === "controlled";
	activeHistoryRequestKeyRef.current = currentHistorySessionRequestKey;
	activeHistorySessionRevisionRef.current = currentHistorySessionRevision;
	latestDrawingWorkspaceSubscriberRef.current = onDrawingWorkspaceChange;

	useEffect(() => {
		const nextWorkspace = drawingUiEnabled ? drawingWorkspace : null;
		const callbackChanged = lastDrawingWorkspaceSubscriberRef.current !== onDrawingWorkspaceChange;
		if (!callbackChanged && lastEmittedDrawingWorkspaceRef.current === nextWorkspace) {
			return;
		}

		lastEmittedDrawingWorkspaceRef.current = nextWorkspace;
		lastDrawingWorkspaceSubscriberRef.current = onDrawingWorkspaceChange;
		onDrawingWorkspaceChange?.(nextWorkspace);
	}, [drawingUiEnabled, drawingWorkspace, onDrawingWorkspaceChange]);

	useEffect(() => {
		return () => {
			lastEmittedDrawingWorkspaceRef.current = null;
			lastDrawingWorkspaceSubscriberRef.current = undefined;
			latestDrawingWorkspaceSubscriberRef.current?.(null);
		};
	}, []);

	useEffect(() => {
		onSelectedDrawingChange?.(resolvedSelectedDrawing);
	}, [onSelectedDrawingChange, resolvedSelectedDrawing]);
	const adapterLabel = useMemo(() => {
		const candidate = (adapter as unknown as Record<string, unknown>).label;
		return typeof candidate === "string" && candidate.length > 0 ? candidate : "widget-adapter";
	}, [adapter]);
	const visiblePanes = useMemo(() => resolveVisiblePanes(panes), [panes]);
	const enginePanes = useMemo(() => createPaneSpecsFromDescriptors(visiblePanes), [visiblePanes]);
	const engineOptions = useMemo(() => ({ useWebGL }), [useWebGL]);

	const canonicalStore = useMemo(() => {
		return createCanonicalSeriesStore<{
			plan: any;
			result: any;
			aoColors: (string | undefined)[];
		}>();
	}, [symbol, timeframe]);

	const enrichedData = useMemo<EnrichedDatum[]>(() => {
		return enrichDataWithCanonicalStore(bars, {
			series: visiblePanes.flatMap((pane) => pane.series),
			canonicalStore,
			sourceId: symbol ?? "unknown",
			timeframe: timeframe ?? "unknown",
		});
	}, [bars, visiblePanes, canonicalStore, symbol, timeframe]);
	const plotData = useMemo<EnrichedDatum[]>(() => enrichedData.filter((datum): datum is EnrichedDatum => Boolean(datum && datum.date)), [enrichedData]);
	const whaleEvents = useMemo((): import("../lib/indicators/overlays/whaleDetector").WhaleEvent[] => {
		// H-02: If external whale orders from API are provided, map them to WhaleEvent[]
		// using bar-timestamp matching. Falls back to internal detection when absent.
		if (enableWhale && whaleOrders && whaleOrders.length > 0 && plotData.length > 0) {
			const mapped: import("../lib/indicators/overlays/whaleDetector").WhaleEvent[] = [];
			for (const order of whaleOrders) {
				const ts = new Date(order.ts).valueOf();
				// Find nearest bar index by timestamp
				let nearestIdx = 0;
				let minDiff = Math.abs(plotData[0].date.valueOf() - ts);
				for (let i = 1; i < plotData.length; i++) {
					const diff = Math.abs(plotData[i].date.valueOf() - ts);
					if (diff < minDiff) { minDiff = diff; nearestIdx = i; }
				}
				const matchedValue = order.matched_value > 0 ? order.matched_value : order.price * order.volume;
				if (!Number.isFinite(matchedValue) || matchedValue <= 0) continue;
				mapped.push({
					index: nearestIdx,
					date: new Date(order.ts),
					buyVol: order.side === "buy" ? matchedValue : 0,
					sellVol: order.side === "sell" ? matchedValue : 0,
					netDelta: order.side === "buy" ? matchedValue : -matchedValue,
					dominance: order.side,
					sizeCategory: order.size_class === "whale" ? "mega" : order.size_class === "shark" ? "xlarge" : "large",
				});
			}
			return mapped;
		}
		return enableWhale ? detectWhaleEvents(plotData as unknown as readonly Record<string, unknown>[], whaleThreshold) : [];
	}, [enableWhale, plotData, whaleThreshold, whaleOrders]);
	const cvdData = useMemo(() => (enableCVD ? plotData : []), [enableCVD, plotData]);
	const scaleSlotDomains = useMemo(() => computePaneScaleSlotDomains(visiblePanes, plotData), [plotData, visiblePanes]);
	const chartInnerHeight = Math.max(1, size.height - CHART_MARGIN.top - CHART_MARGIN.bottom);
	const paneHeights = useMemo(
		() => visiblePanes.map((pane) => pane.heightRatio * chartInnerHeight),
		[chartInnerHeight, visiblePanes],
	);
	const legacyPaneSnapshots = useMemo(
		() => buildLegacyPaneSnapshots(visiblePanes, paneHeights, { width: size.width, height: size.height }, scaleSlotDomains),
		[paneHeights, scaleSlotDomains, size.height, size.width, visiblePanes],
	);
	const defaultLegacyVisibleRange = useMemo<VisibleRange | null>(() => {
		if (plotData.length === 0) {
			return null;
		}

		return {
			startIndex: 0,
			endIndex: plotData.length - 1,
			startDate: plotData[0].date,
			endDate: plotData[plotData.length - 1].date,
			barCount: plotData.length,
		};
	}, [plotData]);
	const resolvedLegacyVisibleRange = legacyVisibleRange ?? defaultLegacyVisibleRange;
	const forkCoordinateBridge = useMemo(
		() => createWidgetCoordinateBridge({
			paneSnapshots,
			visibleRange: forkVisibleRange,
			plotData,
		}),
		[forkVisibleRange, paneSnapshots, plotData],
	);
	const legacyCoordinateBridge = useMemo(
		() => createWidgetCoordinateBridge({
			paneSnapshots: legacyPaneSnapshots,
			visibleRange: resolvedLegacyVisibleRange,
			plotData,
		}),
		[legacyPaneSnapshots, plotData, resolvedLegacyVisibleRange],
	);
	const runtimeCapabilities = useMemo<WidgetRuntimeCapabilities>(() => ({
		engineRuntime: useForkRuntime ? "fork" : "legacy",
		paneToolbar: true,
		paneSplitters: true,
		chartCanvasOverlays: !useForkRuntime,
		measurementOverlay: !useForkRuntime || Boolean(forkCoordinateBridge),
		drawingOverlays: !useForkRuntime,
	}), [forkCoordinateBridge, useForkRuntime]);
	const paneSnapshotMap = useMemo(() => new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot] as const)), [paneSnapshots]);

	const computedXExtents = useMemo(() => {
		if (enrichedData.length === 0) {
			return undefined;
		}
		const firstBar = enrichedData[0];
		const lastBar = enrichedData[enrichedData.length - 1];
		if (firstBar.date.getTime() === lastBar.date.getTime()) {
			return [firstBar.date, new Date(lastBar.date.getTime() + 60_000)] as [Date, Date];
		}
		return [firstBar.date, lastBar.date] as [Date, Date];
	}, [enrichedData]);
	const resolvedXExtents = controlledXExtents ?? computedXExtents;
	const safeXAccessor = useCallback((datum?: EnrichedDatum) => datum?.date ?? new Date(0), []);
	const legacyChartScale = useMemo(() => {
		if (showNonTradingDays || plotData.length === 0) {
			return {
				data: plotData,
				xScale: scaleTime(),
				xAccessor: safeXAccessor,
				displayXAccessor: safeXAccessor,
				xExtents: resolvedXExtents,
				usesDiscontinuousScale: false,
			};
		}

		const scaleProvider = discontinuousTimeScaleProviderBuilder().inputDateAccessor((datum: EnrichedDatum) => datum.date);
		const scaled = scaleProvider(plotData as EnrichedDatum[]);
		const scaledData = scaled.data as EnrichedDatum[];
		const scaledXAccessor = scaled.xAccessor as (datum: EnrichedDatum) => number;

		return {
			data: scaledData,
			xScale: scaled.xScale,
			xAccessor: scaledXAccessor,
			displayXAccessor: scaled.displayXAccessor as (datum: EnrichedDatum) => Date,
			xExtents: resolveDiscontinuousXExtents(resolvedXExtents, scaledData, scaledXAccessor),
			usesDiscontinuousScale: true,
		};
	}, [plotData, resolvedXExtents, safeXAccessor, showNonTradingDays]);
	const chartSurfaceReady = size.width > 0 && size.height > 0 && (!(loading && !hasExternalData)) && plotData.length > 0;

	const reconcileVisibleHistoryWindow = useCallback(async (visibleDomain: [Date, Date]) => {
		if (isControlledHistorySession || loading) {
			return;
		}

		const requestKey = currentHistorySessionRequestKey;
		const sessionRevision = currentHistorySessionRevision;
		const visibleSpanMs = Math.max(resolveTimeframeMs(activeTimeframe), visibleDomain[1].getTime() - visibleDomain[0].getTime());
		const targetWindow = computeResidentTarget(
			{ startMs: visibleDomain[0].getTime(), endMs: visibleDomain[1].getTime() },
			visibleSpanMs,
		);
		let workingBars = historyChunkStoreRef.current.toSnapshot().bars;
		if (workingBars.length === 0) {
			return;
		}

		let pagesLoaded = 0;
		while (workingBars.length > 0 && pagesLoaded < HISTORY_RECONCILE_MAX_PAGES) {
			if (activeHistoryRequestKeyRef.current !== requestKey || activeHistorySessionRevisionRef.current !== sessionRevision) {
				return;
			}

			const loadedWindow = computeLoadedHistoryWindow(workingBars);
			if (!loadedWindow) {
				return;
			}

			const missingSegments = computeMissingSegments(targetWindow, loadedWindow);
			const needsLeftFill = missingSegments.some((s) => s.side === "left");
			const needsRightFill = missingSegments.some((s) => s.side === "right");
			if (!needsLeftFill && !needsRightFill) {
				break;
			}

			let progressed = false;

			if (needsLeftFill) {
				const earliestBar = workingBars[0];
				const beforeTimestamp = earliestBar?.date.getTime();
				if (beforeTimestamp && historyBackfillBeforeRef.current !== beforeTimestamp) {
					const olderBars = await adapter.fetchBarsBefore(activeSymbol, activeTimeframe, earliestBar.date, HISTORY_BACKFILL_PAGE_LIMIT) ?? [];
					if (activeHistoryRequestKeyRef.current !== requestKey || activeHistorySessionRevisionRef.current !== sessionRevision) {
						return;
					}

					const hasOlderBars = olderBars.some((bar) => bar.date.getTime() < beforeTimestamp);
					if (!hasOlderBars) {
						historyBackfillBeforeRef.current = beforeTimestamp;
					} else {
						historyBackfillBeforeRef.current = null;
						historyChunkStoreRef.current.prepend(olderBars);
						workingBars = historyChunkStoreRef.current.toSnapshot().bars;
						progressed = true;
						pagesLoaded += 1;
					}
				}
			}

			const refreshedWindow = computeLoadedHistoryWindow(workingBars);
			if (!refreshedWindow) {
				return;
			}

			if (refreshedWindow.endMs < targetWindow.endMs) {
				const latestBar = workingBars[workingBars.length - 1];
				const afterTimestamp = latestBar?.date.getTime();
				if (afterTimestamp && historyForwardAfterRef.current !== afterTimestamp) {
					const newerBars = await adapter.fetchBarsInRange(activeSymbol, activeTimeframe, latestBar.date, new Date(targetWindow.endMs)) ?? [];
					if (activeHistoryRequestKeyRef.current !== requestKey || activeHistorySessionRevisionRef.current !== sessionRevision) {
						return;
					}

					const hasNewerBars = newerBars.some((bar) => bar.date.getTime() > afterTimestamp);
					if (!hasNewerBars) {
						historyForwardAfterRef.current = afterTimestamp;
					} else {
						historyForwardAfterRef.current = null;
						historyChunkStoreRef.current.append(newerBars);
						workingBars = historyChunkStoreRef.current.toSnapshot().bars;
						progressed = true;
						pagesLoaded += 1;
					}
				}
			}

			if (!progressed) {
				break;
			}
		}

		if (activeHistoryRequestKeyRef.current !== requestKey || activeHistorySessionRevisionRef.current !== sessionRevision) {
			return;
		}

		const resolvedVisibleDomain = visibleDomainRef.current ?? visibleDomain;
		const resolvedVisibleSpanMs = Math.max(resolveTimeframeMs(activeTimeframe), resolvedVisibleDomain[1].getTime() - resolvedVisibleDomain[0].getTime());
		const resolvedResidentTarget = computeResidentTarget(
			{ startMs: resolvedVisibleDomain[0].getTime(), endMs: resolvedVisibleDomain[1].getTime() },
			resolvedVisibleSpanMs,
		);
		historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget));
		setBars(historyChunkStoreRef.current.toSnapshot().bars);
	}, [activeSymbol, activeTimeframe, adapter, currentHistorySessionRequestKey, currentHistorySessionRevision, isControlledHistorySession, loading]);

	const queueVisibleHistoryWindowSync = useCallback((visibleDomain: [Date, Date]) => {
		pendingVisibleDomainRef.current = visibleDomain;
		if (historyWindowSyncInFlightRef.current) {
			return;
		}

		historyWindowSyncInFlightRef.current = true;
		void (async () => {
			try {
				while (pendingVisibleDomainRef.current) {
					const nextVisibleDomain = pendingVisibleDomainRef.current;
					pendingVisibleDomainRef.current = null;
					await reconcileVisibleHistoryWindow(nextVisibleDomain);
				}
			} finally {
				historyWindowSyncInFlightRef.current = false;
				if (pendingVisibleDomainRef.current) {
					queueVisibleHistoryWindowSync(pendingVisibleDomainRef.current);
				}
			}
		})();
	}, [reconcileVisibleHistoryWindow]);

	useEffect(() => {
		if (isControlledHistorySession) {
			return undefined;
		}

		const controller = new AbortController();
		let unsubscribe: (() => void) | null = null;
		let disposed = false;
		const sessionRevision = currentHistorySessionRevision;
		const requestKey = currentHistorySessionRequestKey;

		historyChunkStoreRef.current.replaceAll([]);
		setBars([]);
		setLoading(true);
		setError(null);

		const { from, to } = resolveFetchWindow(activeTimeframe);

		void adapter
			.fetchBarsInRange(activeSymbol, activeTimeframe, from, to)
			.then((nextBars) => {
				if (
					disposed
					|| controller.signal.aborted
					|| activeHistoryRequestKeyRef.current !== requestKey
					|| activeHistorySessionRevisionRef.current !== sessionRevision
				) {
					return;
				}
				setBars(historyChunkStoreRef.current.replaceAll(nextBars).bars);
				setLoading(false);
				try {
					unsubscribe = adapter.subscribeToBar(activeSymbol, activeTimeframe, (nextBar) => {
						if (
							disposed
							|| controller.signal.aborted
							|| activeHistoryRequestKeyRef.current !== requestKey
							|| activeHistorySessionRevisionRef.current !== sessionRevision
						) {
							return;
						}
						historyChunkStoreRef.current.append([nextBar]);
						if (visibleDomainRef.current) {
							const liveVisibleSpanMs = Math.max(resolveTimeframeMs(activeTimeframe), visibleDomainRef.current[1].getTime() - visibleDomainRef.current[0].getTime());
							const liveResidentTarget = computeResidentTarget(
								{ startMs: visibleDomainRef.current[0].getTime(), endMs: visibleDomainRef.current[1].getTime() },
								liveVisibleSpanMs,
							);
							historyChunkStoreRef.current.trimToWindow(computeTrimWindow(liveResidentTarget));
						}
						setBars(historyChunkStoreRef.current.toSnapshot().bars);
					});
				} catch (subscribeError) {
					if (
						!disposed
						&& !controller.signal.aborted
						&& activeHistoryRequestKeyRef.current === requestKey
						&& activeHistorySessionRevisionRef.current === sessionRevision
					) {
						setError(subscribeError instanceof Error ? subscribeError : new Error(String(subscribeError)));
					}
				}
			})
			.catch((fetchError) => {
				if (
					disposed
					|| controller.signal.aborted
					|| activeHistoryRequestKeyRef.current !== requestKey
					|| activeHistorySessionRevisionRef.current !== sessionRevision
				) {
					return;
				}
				setLoading(false);
				setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
			});

		return () => {
			disposed = true;
			controller.abort();
			unsubscribe?.();
		};
	}, [adapter, activeSymbol, activeTimeframe, currentHistorySessionRequestKey, currentHistorySessionRevision, isControlledHistorySession]);

	useEffect(() => {
		const subscriberChanged = lastRuntimeCapabilitiesSubscriberRef.current !== onRuntimeCapabilitiesChange;
		if (!subscriberChanged && areRuntimeCapabilitiesEqual(lastRuntimeCapabilitiesRef.current, runtimeCapabilities)) {
			return;
		}

		lastRuntimeCapabilitiesRef.current = runtimeCapabilities;
		lastRuntimeCapabilitiesSubscriberRef.current = onRuntimeCapabilitiesChange;
		onRuntimeCapabilitiesChange?.(runtimeCapabilities);
	}, [onRuntimeCapabilitiesChange, runtimeCapabilities]);

	const emitCoordinateBridge = useCallback((
		nextPaneSnapshots: readonly WidgetPaneRuntimeSnapshot[],
		nextVisibleRange: EngineVisibleRange | null,
	) => {
		onCoordinateBridgeChange?.(useForkRuntime ? createWidgetCoordinateBridge({
			paneSnapshots: nextPaneSnapshots,
			visibleRange: nextVisibleRange,
			plotData,
		}) : null);
	}, [onCoordinateBridgeChange, plotData, useForkRuntime]);

	const emitPaneSnapshots = useCallback((nextSnapshots: readonly WidgetPaneRuntimeSnapshot[]) => {
		const mergedSnapshots = mergePaneSnapshotDomains(nextSnapshots, scaleSlotDomains);
		const subscriberChanged = lastPaneSnapshotsSubscriberRef.current !== onPaneSnapshotsChange;
		const snapshotsChanged = !arePaneSnapshotsEqual(lastEmittedPaneSnapshotsRef.current, mergedSnapshots);
		if (useForkRuntime) {
			forkPaneSnapshotsRef.current = mergedSnapshots;
		}
		setPaneSnapshots((currentSnapshots) => {
			if (arePaneSnapshotsEqual(currentSnapshots, mergedSnapshots)) {
				return currentSnapshots;
			}

			return mergedSnapshots;
		});
		if (snapshotsChanged || subscriberChanged) {
			lastEmittedPaneSnapshotsRef.current = mergedSnapshots;
			lastPaneSnapshotsSubscriberRef.current = onPaneSnapshotsChange;
			onPaneSnapshotsChange?.(mergedSnapshots);
		}
		if (useForkRuntime) {
			emitCoordinateBridge(mergedSnapshots, forkVisibleRangeRef.current);
		}
	}, [emitCoordinateBridge, onPaneSnapshotsChange, scaleSlotDomains, useForkRuntime]);

	useEffect(() => {
		if (!chartSurfaceReady) {
			forkPaneSnapshotsRef.current = [];
			forkVisibleRangeRef.current = null;
			onCoordinateBridgeChange?.(null);
			setPaneSnapshots((currentSnapshots) => (currentSnapshots.length === 0 ? currentSnapshots : []));
			return;
		}

		if (useForkRuntime) {
			if (forkPaneSnapshotsRef.current.length === 0) {
				onCoordinateBridgeChange?.(null);
				setPaneSnapshots((currentSnapshots) => (currentSnapshots.length === 0 ? currentSnapshots : []));
			}
			return;
		}
		forkPaneSnapshotsRef.current = [];
		forkVisibleRangeRef.current = null;
		onCoordinateBridgeChange?.(null);
		emitPaneSnapshots(legacyPaneSnapshots);
	}, [chartSurfaceReady, emitPaneSnapshots, legacyPaneSnapshots, onCoordinateBridgeChange, useForkRuntime]);

	// ── KF-SSOT-T03: Wire enrichedData → fork engine ─────────────────────────
	const handleEngineReady = useCallback((engine: EngineInstance) => {
		engineInstanceRef.current = engine;
	}, []);

	useEffect(() => {
		const engine = engineInstanceRef.current;
		if (!engine || !useForkRuntime) {
			return;
		}
		// Cast: EnrichedDatum[] → readonly Record<string, unknown>[] (intentional type erasure for layer isolation)
		engine.setEnrichedData(enrichedData as unknown as readonly Record<string, unknown>[]);
	}, [enrichedData, useForkRuntime]);

	// ── KF-12-T04: Push immutable history snapshot to fork engine ────────────
	useEffect(() => {
		const engine = engineInstanceRef.current;
		if (!engine || !useForkRuntime || !("setHistorySnapshot" in engine)) {
			return;
		}
		const snapshot = historyChunkStoreRef.current.toSnapshot() as unknown as EngineHistorySnapshot;
		(engine as EngineInstance & { setHistorySnapshot: (s: EngineHistorySnapshot) => void }).setHistorySnapshot(snapshot);
	}, [bars, useForkRuntime]);
	// ─────────────────────────────────────────────────────────────────────────

	const handleForkVisibleRangeChange = useCallback((range: EngineVisibleRange) => {
		forkVisibleRangeRef.current = range;
		setForkVisibleRange(range);
		emitCoordinateBridge(forkPaneSnapshotsRef.current, range);
		const normalizedRange = normalizeForkVisibleRange(range, plotData);
		if (!normalizedRange) {
			return;
		}

		const visibleDomain = [normalizedRange.startDate, normalizedRange.endDate] as [Date, Date];
		visibleDomainRef.current = visibleDomain;

		onVisibleRangeChange?.(normalizedRange);
		onVisibleDomainChange?.(visibleDomain);
		if (!isControlledHistorySession) {
			queueVisibleHistoryWindowSync(visibleDomain);
		}
	}, [emitCoordinateBridge, isControlledHistorySession, onVisibleDomainChange, onVisibleRangeChange, plotData, queueVisibleHistoryWindowSync]);

	const handleLegacyVisibleRangeChange = useCallback(
		(range: VisibleRange) => {
			setLegacyVisibleRange(range);
			onVisibleRangeChange?.(range);
		},
		[onVisibleRangeChange],
	);

	const handleLegacyVisibleDomainChange = useCallback((domain: [Date | number, Date | number]) => {
		const resolvedDomain = !legacyChartScale.usesDiscontinuousScale
			? [domain[0] instanceof Date ? domain[0] : new Date(domain[0]), domain[1] instanceof Date ? domain[1] : new Date(domain[1])] as [Date, Date]
			: resolveDateDomainFromDiscontinuous(domain, legacyChartScale.data, legacyChartScale.xAccessor as (datum: EnrichedDatum) => number);
		visibleDomainRef.current = resolvedDomain;

		onVisibleDomainChange?.(resolvedDomain);
		if (!isControlledHistorySession) {
			queueVisibleHistoryWindowSync(resolvedDomain);
		}
	}, [isControlledHistorySession, legacyChartScale, onVisibleDomainChange, queueVisibleHistoryWindowSync]);

	const emitHoveredPaneId = useCallback((paneId: string | null) => {
		if (hoveredPaneIdRef.current === paneId) {
			return;
		}

		hoveredPaneIdRef.current = paneId;
		setHoveredPaneId(paneId);
		onPaneHover?.(paneId);
	}, [onPaneHover]);

	const handleWidgetPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		const activeSnapshots = useForkRuntime ? paneSnapshots : legacyPaneSnapshots;
		emitHoveredPaneId(resolveHoveredPaneId(event, activeSnapshots));
	}, [emitHoveredPaneId, legacyPaneSnapshots, paneSnapshots, useForkRuntime]);

	const handleWidgetPointerLeave = useCallback(() => {
		emitHoveredPaneId(null);
	}, [emitHoveredPaneId]);

	const resolveForkEventPayload = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const localX = event.clientX - rect.left;
		const localY = event.clientY - rect.top;
		const snapshot = findPaneSnapshotAtPosition(paneSnapshots, localX, localY);
		if (!snapshot) {
			return {
				mouseXY: [localX, localY] as [number, number],
			};
		}

		const currentCharts = visiblePanes.findIndex((pane) => pane.id === snapshot.paneId);
		const dataIndex = forkVisibleRange
			? resolvePaneDataIndexAtPixel(snapshot, forkVisibleRange, localX, plotData.length)
			: null;

		return {
			currentItem: dataIndex === null ? undefined : plotData[dataIndex],
			currentCharts: currentCharts >= 0 ? [currentCharts] : undefined,
			mouseXY: [localX, localY] as [number, number],
		};
	}, [forkVisibleRange, paneSnapshots, plotData, visiblePanes]);

	const handleForkClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		if (!useForkRuntime || !onClick) {
			return;
		}

		onClick(resolveForkEventPayload(event), event.nativeEvent);
	}, [onClick, resolveForkEventPayload, useForkRuntime]);

	const handleForkContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		if (!useForkRuntime || !onContextMenu) {
			return;
		}

		event.preventDefault();
		onContextMenu(resolveForkEventPayload(event), event.nativeEvent);
	}, [onContextMenu, resolveForkEventPayload, useForkRuntime]);

	const engineTheme = useMemo(() => ({ mode: resolvedTheme }), [resolvedTheme]);
	const engineSeriesData = useMemo(() => {
		const seriesValuesById: Record<string, number[]> = {};
		for (const pane of visiblePanes) {
			for (let index = 0; index < pane.series.length; index += 1) {
				const series = pane.series[index];
				if (series.visible === false) {
					continue;
				}

				const seriesId = series.id ?? `${pane.id}-series-${index}`;
				const values = plotData
					.map((datum) => resolveEngineSeriesValueForRuntime(datum, series))
					.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

				if (values.length > 0) {
					seriesValuesById[seriesId] = values;
				}
			}
		}

		return seriesValuesById;
	}, [plotData, visiblePanes]);
	const engineDataSource = useMemo(() => ({
		sourceId: `${adapterLabel}:${activeSymbol}:${activeTimeframe}`,
		symbol: activeSymbol,
		timeframe: activeTimeframe,
		adapterLabel,
		seriesData: engineSeriesData,
	}), [adapterLabel, activeSymbol, activeTimeframe, engineSeriesData]);

	useEffect(() => {
		if (!useForkRuntime || !chartSurfaceReady || plotData.length === 0 || typeof window === "undefined") {
			forkDegradeNotifiedRef.current = false;
			return;
		}

		const timer = window.setTimeout(() => {
			if (forkDegradeNotifiedRef.current) {
				return;
			}

			const root = ref.current;
			if (!root) {
				return;
			}

			const canvas = root.querySelector('canvas[data-vn-kline-engine="canvas"]') as HTMLCanvasElement | null;
			if (!canvas || canvas.width <= 1 || canvas.height <= 1) {
				return;
			}

			const context = canvas.getContext("2d");
			if (!context || typeof context.getImageData !== "function") {
				return;
			}

			const columns = 6;
			const rows = 4;
			let hasRenderedPixels = false;

			for (let row = 0; row < rows && !hasRenderedPixels; row += 1) {
				for (let column = 0; column < columns; column += 1) {
					const x = Math.floor(((column + 0.5) / columns) * Math.max(1, canvas.width - 1));
					const y = Math.floor(((row + 0.5) / rows) * Math.max(1, canvas.height - 1));
					const pixel = context.getImageData(x, y, 1, 1).data;
					if ((pixel[3] ?? 0) > 0) {
						hasRenderedPixels = true;
						break;
					}
				}
			}

			if (!hasRenderedPixels) {
				forkDegradeNotifiedRef.current = true;
				onRuntimeDegraded?.("fork-no-render-output");
			}
		}, 450);

		return () => {
			window.clearTimeout(timer);
		};
	}, [chartSurfaceReady, onRuntimeDegraded, plotData.length, ref, useForkRuntime]);

	if (error) {
		throw error;
	}

	const ready = size.width > 0 && size.height > 0;
		if (!ready || (loading && !hasExternalData) || plotData.length === 0) {
		return (
			<div
				ref={ref}
				className={className}
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					minHeight: 0,
					...style,
				}}
			>
				<WidgetEmptyState loading={loading || !ready} />
			</div>
		);
	}

	const axisStroke = isDark ? "#64748b" : "#475569";
	const axisTickFill = isDark ? "#e2e8f0" : "#0f172a";
	const paneToolbarNodes = renderPaneToolbar
		? visiblePanes.map((pane) => {
			const snapshot = paneSnapshotMap.get(pane.id);
			if (!snapshot) {
				return null;
			}

			return (
				<div
					key={`${pane.id}-toolbar`}
					className={`rsc-pane-wrap${hoveredPaneId === pane.id ? " rsc-pane-wrap--active" : ""}`}
					style={{
						position: "absolute",
						top: snapshot.headerAnchor.top,
						left: 0,
						right: 0,
						height: 28,
						zIndex: 20,
					}}
				>
					{renderPaneToolbar({
						pane,
						snapshot,
						hovered: hoveredPaneId === pane.id,
						actions: {
							toggleVisibility: () => onPaneToggleVisibleRequest?.(pane.id),
							removePane: () => onPaneRemoveRequest?.(pane.id),
							addSeries: () => onPaneAddSeriesRequest?.(pane.id),
							toggleSeries: (seriesType, seriesIndex) => onPaneToggleSeriesRequest?.(pane.id, seriesType, seriesIndex),
							removeSeries: (seriesType, seriesIndex) => onPaneRemoveSeriesRequest?.(pane.id, seriesType, seriesIndex),
						},
					})}
				</div>
			);
		})
		: null;
	const paneSplitterNodes = renderPaneSplitter
		? visiblePanes.slice(0, -1).map((pane, splitterIndex) => {
			const snapshot = paneSnapshotMap.get(pane.id);
			if (!snapshot) {
				return null;
			}

			return renderPaneSplitter({
				pane,
				snapshot,
				splitterIndex,
				top: snapshot.bounds.top + snapshot.bounds.height,
			});
		})
		: null;
	const drawingChromeNode = renderDrawingChrome
		? renderDrawingChrome({
			activeTool: drawingWorkspace.state.activeTool,
			drawingWorkspace,
			isDark,
			paneSnapshots,
			selectedDrawing: resolvedSelectedDrawing,
			visibleRange: useForkRuntime ? forkVisibleRange : resolvedLegacyVisibleRange,
			size: { width: size.width, height: size.height },
		})
		: null;

	return (
		<div
			ref={ref}
			className={className}
			data-chart-theme={resolvedTheme}
			onPointerMove={handleWidgetPointerMove}
			onPointerLeave={handleWidgetPointerLeave}
			style={{
				position: "relative",
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				minHeight: 0,
				...style,
			}}
		>
			{useForkRuntime ? (
				<div
					className="rsc-engine-surface"
					onClick={handleForkClick}
					onContextMenu={handleForkContextMenu}
					style={{
						position: "relative",
						display: "flex",
						flex: 1,
						minHeight: 0,
					}}
				>
					<EngineHost
						panes={enginePanes}
						dataSource={engineDataSource}
						engineOptions={engineOptions}
						theme={engineTheme}
						locale={activeLocale}
						onEngineReady={handleEngineReady}
						onVisibleRangeChange={handleForkVisibleRangeChange}
						onPaneSnapshotsChange={emitPaneSnapshots}
						onPaneHover={emitHoveredPaneId}
						style={{ flex: 1, minHeight: 0 }}
					/>
					{resolvedSelectedDrawing && showDrawingPriceMarkers && forkCoordinateBridge ? (
						<DrawingPriceLabelsOverlay
							enabled
							highlighted
							runtime="fork"
							priceFormat={(value: number) => priceFormat(value)}
							drawing={resolvedSelectedDrawing}
							coordinateBridge={forkCoordinateBridge}
							paneSnapshots={paneSnapshots}
							height={size.height}
						/>
					) : null}
					<MeasurementOverlay
						enabled={measurementEnabled ?? false}
						isDark={isDark}
						priceFormat={priceFormat}
						coordinateBridge={forkCoordinateBridge}
						paneSnapshots={paneSnapshots}
						width={size.width}
						height={size.height}
					/>
				</div>
			) : (
				<div
					style={{
						position: "relative",
						display: "flex",
						flex: 1,
						minHeight: 0,
					}}
				>
					<DynamicChart
						key={legacyChartScale.usesDiscontinuousScale ? "disc" : "cont"}
						panes={visiblePanes}
						heights={paneHeights}
						data={legacyChartScale.data}
						width={size.width}
						height={size.height}
						margin={CHART_MARGIN}
						type="hybrid"
						seriesName={`vnstock-${activeSymbol}-${activeTimeframe}-r${resetKey}`}
						xScale={legacyChartScale.xScale}
						xAccessor={legacyChartScale.xAccessor}
						displayXAccessor={legacyChartScale.displayXAccessor}
						xExtents={legacyChartScale.xExtents}
						ratio={typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1}
						mouseMoveEvent
						zoomEvent
						panEvent
						useCrossHairStyleCursor
						onClick={onClick}
						onContextMenu={onContextMenu}
						onVisibleDomainChange={handleLegacyVisibleDomainChange}
						onVisibleRangeChange={handleLegacyVisibleRangeChange}
						axisStroke={axisStroke}
						axisTickFill={axisTickFill}
						isDark={isDark}
						dateFormat={(date: Date) => dateFormat(date)}
						priceFormat={(value: number) => priceFormat(value)}
						volumeFormat={(value: number) => volumeFormat(value)}
						className={className}
					>
						{whaleEvents.length > 0 && (
							<WhaleMarketBubbleOverlay
								events={whaleEvents}
								visibleRange={resolvedLegacyVisibleRange}
							/>
						)}
						{enableCVD && cvdData.length > 0 && (
							<CVDIndicator
								data={cvdData}
								visibleRange={resolvedLegacyVisibleRange}
								mode={cvdMode}
							/>
						)}
						{externalCvdSeries && externalCvdSeries.length > 0 && (
							<ExternalCVDOverlay
								series={externalCvdSeries}
							/>
						)}
						{children}
					</DynamicChart>
					{resolvedSelectedDrawing && showDrawingPriceMarkers && legacyCoordinateBridge ? (
						<DrawingPriceLabelsOverlay
							enabled
							highlighted
							runtime="legacy"
							priceFormat={(value: number) => priceFormat(value)}
							drawing={resolvedSelectedDrawing}
							coordinateBridge={legacyCoordinateBridge}
							paneSnapshots={legacyPaneSnapshots}
							height={size.height}
						/>
					) : null}
					{legacyCoordinateBridge ? (
						<MeasurementOverlay
							enabled={measurementEnabled ?? false}
							isDark={isDark}
							priceFormat={priceFormat}
							coordinateBridge={legacyCoordinateBridge}
							paneSnapshots={legacyPaneSnapshots}
							width={size.width}
							height={size.height}
						/>
					) : null}
				</div>
			)}
			{typeof darkFlowStrength === "number" && Number.isFinite(darkFlowStrength) ? (
				<DarkFlowBadge strength={darkFlowStrength} signalType={darkFlowSignalType} />
			) : null}
			{paneToolbarNodes}
			{paneSplitterNodes}
			{drawingChromeNode}
		</div>
	);
});
VNStockChartContent.displayName = "VNStockChartContent";

export const VNStockChart = forwardRef<VNStockChartRef, VNStockChartProps>((props, ref) => {
	const requestedRuntime = props.engineRuntime ?? "fork";
	const [fallbackRuntime, setFallbackRuntime] = useState<"legacy" | null>(null);

	useEffect(() => {
		setFallbackRuntime(null);
	}, [requestedRuntime]);

	useEffect(() => {
		const targetTz = props.timezone || props.defaultTimezone || "Asia/Ho_Chi_Minh";
		setGlobalTimezone(targetTz);
	}, [props.timezone, props.defaultTimezone]);

	const effectiveRuntime = fallbackRuntime ?? requestedRuntime;

	const handleBoundaryError = useCallback((caughtError: Error) => {
		props.onError?.(caughtError);
		if (effectiveRuntime === "fork" && fallbackRuntime === null) {
			setFallbackRuntime("legacy");
		}
	}, [effectiveRuntime, fallbackRuntime, props.onError]);

	const handleRuntimeDegraded = useCallback((reason: "fork-no-render-output") => {
		if (requestedRuntime === "fork" && fallbackRuntime === null && reason === "fork-no-render-output") {
			setFallbackRuntime("legacy");
		}
	}, [fallbackRuntime, requestedRuntime]);
	const contentRuntimeKey = `${effectiveRuntime}-${props.showNonTradingDays ? "calendar" : "trading"}`;

	return (
		<WidgetI18nProvider locale={props.locale} messages={props.messages}>
			<WidgetErrorBoundary key={effectiveRuntime} onError={handleBoundaryError}>
				<VNStockChartContent ref={ref} key={contentRuntimeKey} {...props} engineRuntime={effectiveRuntime} onRuntimeDegraded={handleRuntimeDegraded} />
			</WidgetErrorBoundary>
		</WidgetI18nProvider>
	);
});
VNStockChart.displayName = "VNStockChart";
