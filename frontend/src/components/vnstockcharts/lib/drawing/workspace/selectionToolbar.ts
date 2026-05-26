import type { PaneRuntimeSnapshot } from "@vnstockcharts/vn-kline-engine-core";

import type { DrawingObject } from "../types";

export type DrawingSelectionToolbarActionId =
	| "clone"
	| "toggleLock"
	| "toggleVisibility"
	| "editText"
	| "bringToFront"
	| "sendToBack"
	| "delete"
	/** DT-19: Opens Tier-2 detail panel */
	| "openProperties";

export interface DrawingSelectionToolbarLabels {
	clone: string;
	lock: string;
	unlock: string;
	hide: string;
	show: string;
	edit: string;
	bringToFront: string;
	sendToBack: string;
	delete: string;
	/** DT-19: Label for the ⋯ button that opens the detail panel */
	openProperties?: string;
}

export interface DrawingSelectionToolbarAction {
	id: DrawingSelectionToolbarActionId;
	label: string;
	tone: "primary" | "secondary" | "danger";
	active?: boolean;
}

export interface DrawingSelectionToolbarModel {
	primaryActions: readonly DrawingSelectionToolbarAction[];
	secondaryActions: readonly DrawingSelectionToolbarAction[];
	dangerAction: DrawingSelectionToolbarAction;
}

export interface DrawingSelectionToolbarPosition {
	x: number;
	y: number;
}

interface PlotDatumLike {
	date: Date;
}

interface ResolveDrawingSelectionToolbarPositionArgs {
	drawing: DrawingObject | null;
	paneSnapshots: readonly PaneRuntimeSnapshot[];
	plotData: readonly PlotDatumLike[];
	visibleDomain?: readonly [Date, Date] | null;
	shellSize: { width: number; height: number };
	toolbarSize?: { width: number; height: number };
}

const DEFAULT_TOOLBAR_SIZE = { width: 248, height: 42 } as const;
const EDGE_PADDING = 12;
const VERTICAL_OFFSET = 12;

function clamp(value: number, minValue: number, maxValue: number) {
	return Math.min(maxValue, Math.max(minValue, value));
}

function resolvePaneSnapshot(drawing: DrawingObject, paneSnapshots: readonly PaneRuntimeSnapshot[]) {
	if (paneSnapshots.length === 0) {
		return null;
	}

	const preferredPaneId = drawing.paneId ?? "price";
	const matchedSnapshot = paneSnapshots.find((snapshot) => snapshot.paneId === preferredPaneId);
	if (matchedSnapshot) {
		return matchedSnapshot;
	}

	return drawing.paneId ? null : (paneSnapshots[0] ?? null);
}

function resolveScaleDomain(drawing: DrawingObject, snapshot: PaneRuntimeSnapshot) {
	if (drawing.yScaleId) {
		const domain = snapshot.scaleSlotStates?.[drawing.yScaleId]?.domain;
		return domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[0] !== domain[1]
			? domain
			: null;
	}

	const paneId = drawing.paneId ?? snapshot.paneId;
	const preferredScaleIds = [
		`${paneId}-right`,
		`${paneId}-left`,
	].filter((value): value is string => Boolean(value));

	for (const scaleId of preferredScaleIds) {
		const domain = snapshot.scaleSlotStates?.[scaleId]?.domain;
		if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[0] !== domain[1]) {
			return domain;
		}
	}

	return null;
}

function resolveVisibleTimeBounds(plotData: readonly PlotDatumLike[], visibleDomain?: readonly [Date, Date] | null) {
	if (visibleDomain) {
		return [visibleDomain[0].getTime(), visibleDomain[1].getTime()] as const;
	}

	if (plotData.length === 0) {
		return null;
	}

	return [plotData[0].date.getTime(), plotData[plotData.length - 1].date.getTime()] as const;
}

function resolveVisiblePlotData(plotData: readonly PlotDatumLike[], visibleDomain?: readonly [Date, Date] | null) {
	if (!visibleDomain) {
		return plotData;
	}

	const domainStart = visibleDomain[0].getTime();
	const domainEnd = visibleDomain[1].getTime();
	const filtered = plotData.filter((datum) => {
		const value = datum.date.getTime();
		return value >= domainStart && value <= domainEnd;
	});

	return filtered;
}

function resolveNearestVisibleIndex(plotData: readonly PlotDatumLike[], targetTime: number) {
	if (plotData.length === 0) {
		return 0;
	}

	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < plotData.length; index += 1) {
		const distance = Math.abs(plotData[index].date.getTime() - targetTime);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
}

export function createDrawingSelectionToolbarModel(
	drawing: DrawingObject | null,
	labels: DrawingSelectionToolbarLabels,
): DrawingSelectionToolbarModel | null {
	if (!drawing) {
		return null;
	}

	const primaryActions: DrawingSelectionToolbarAction[] = [
		{ id: "clone", label: labels.clone, tone: "primary" },
		{ id: "toggleLock", label: drawing.locked ? labels.unlock : labels.lock, tone: "primary", active: drawing.locked === true },
		{ id: "toggleVisibility", label: drawing.visible === false ? labels.show : labels.hide, tone: "primary", active: drawing.visible !== false },
	];

	const secondaryActions: DrawingSelectionToolbarAction[] = [
		...(drawing.type === "text" ? [{ id: "editText" as const, label: labels.edit, tone: "secondary" as const }] : []),
		{ id: "bringToFront" as const, label: labels.bringToFront, tone: "secondary" as const },
		{ id: "sendToBack" as const, label: labels.sendToBack, tone: "secondary" as const },
	];

	// DT-19: ⚙ button always shown as last secondary action
	secondaryActions.push({ id: "openProperties", label: labels.openProperties ?? "Chi tiết", tone: "secondary" });

	return {
		primaryActions,
		secondaryActions,
		dangerAction: { id: "delete", label: labels.delete, tone: "danger" },
	};
}

export function resolveDrawingSelectionToolbarPosition({
	drawing,
	paneSnapshots,
	plotData,
	visibleDomain,
	shellSize,
	toolbarSize = DEFAULT_TOOLBAR_SIZE,
}: ResolveDrawingSelectionToolbarPositionArgs): DrawingSelectionToolbarPosition | null {
	if (!drawing || drawing.points.length === 0 || shellSize.width <= 0 || shellSize.height <= 0) {
		return null;
	}

	const snapshot = resolvePaneSnapshot(drawing, paneSnapshots);
	if (!snapshot) {
		return null;
	}

	const timeBounds = resolveVisibleTimeBounds(plotData, visibleDomain);
	const scaleDomain = resolveScaleDomain(drawing, snapshot);
	if (!timeBounds || !scaleDomain) {
		return null;
	}

	const [timeStart, timeEnd] = timeBounds;
	const [minValue, maxValue] = scaleDomain;
	const timeSpan = Math.max(1, timeEnd - timeStart);
	const valueSpan = Math.max(1e-9, maxValue - minValue);
	const visiblePlotData = resolveVisiblePlotData(plotData, visibleDomain);
	if (visiblePlotData.length === 0) {
		return null;
	}
	const indexSpan = Math.max(1, visiblePlotData.length - 1);

	const pointPixels = drawing.points
		.map((point) => {
			const nearestVisibleIndex = resolveNearestVisibleIndex(visiblePlotData, point.x);
			const timeRatio = clamp((point.x - timeStart) / timeSpan, 0, 1);
			const indexRatio = clamp(nearestVisibleIndex / indexSpan, 0, 1);
			const yRatio = clamp((maxValue - point.y) / valueSpan, 0, 1);
			return {
				x: snapshot.plotBounds.left + (snapshot.plotBounds.width * (visiblePlotData.length > 1 ? indexRatio : timeRatio)),
				y: snapshot.plotBounds.top + (snapshot.plotBounds.height * yRatio),
			};
		})
		.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

	if (pointPixels.length === 0) {
		return null;
	}

	const centerX = pointPixels.reduce((sum, point) => sum + point.x, 0) / pointPixels.length;
	const topY = Math.min(...pointPixels.map((point) => point.y));
	const bottomY = Math.max(...pointPixels.map((point) => point.y));
	const paneTop = snapshot.bounds.top + EDGE_PADDING;
	const paneBottom = snapshot.bounds.top + snapshot.bounds.height - toolbarSize.height - EDGE_PADDING;
	const preferredY = topY - toolbarSize.height - VERTICAL_OFFSET;
	const fallbackY = bottomY + VERTICAL_OFFSET;
	const boundedX = clamp(
		centerX - (toolbarSize.width / 2),
		EDGE_PADDING,
		Math.max(EDGE_PADDING, shellSize.width - toolbarSize.width - EDGE_PADDING),
	);
	const boundedY = preferredY >= paneTop
		? preferredY
		: clamp(fallbackY, paneTop, Math.max(paneTop, paneBottom));

	return {
		x: boundedX,
		y: boundedY,
	};
}