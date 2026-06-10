import { AxisGridRenderer } from "../canvas/AxisGridRenderer.js";
import { AxisGridRenderCache, buildAxisGridCacheKey } from "../canvas/AxisGridRenderCache.js";
import { BarRenderer } from "../canvas/BarRenderer.js";
import { CandlestickRenderer } from "../canvas/CandlestickRenderer.js";
import { CrosshairRenderer } from "../canvas/CrosshairRenderer.js";
import { createPaneProjector } from "../coordinates/paneProjector.js";
import { resolvePaneDataIndexAtPixel, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, resolvePaneValueAtPixel } from "../coordinates/coordinateBridge.js";
import { LineAreaRenderer } from "../canvas/LineAreaRenderer.js";
import { PaneLayoutEngine, clonePaneRuntimeSnapshot } from "../pane/PaneLayoutEngine.js";
import { UPSTREAM_BASELINE } from "../upstream.js";
import { DirtyFlag } from "./dirtyMask.js";
import { INDICATOR_ACCESSORS, getAccessorFor } from "./indicatorAccessors.js";
import { InteractionController } from "../interaction/InteractionController.js";
import { createDerivedCache, appendTailCache, replaceAllCache, queryYRange, } from "./derivedCache.js";
import { hitTestOverlayPrimitive } from "../overlay/canvasOverlayHitTest.js";
import { renderOverlayPrimitiveToCanvas } from "../overlay/canvasOverlayRenderer.js";
import { aggregateOhlc, chooseLodBucketSize } from "./LodBucketizer.js";
import { CandlestickLodWorkerLane, toCandlestickLodData, toCandlestickLodWorkerInput } from "./CandlestickLodWorkerLane.js";
const DEFAULT_THEME = { mode: "light" };
const DEFAULT_VISIBLE_RANGE = { from: 0, to: 300 };
const DEFAULT_LOCALE = "vi";
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;
const CAMERA_RANGE_MAX_ABS_INDEX = 1_000_000;
const MAX_VISIBLE_BARS = 40_000;
const SHARED_ENVELOPE_MIN_BAR_SPACE_PX = 2;
const SHARED_ENVELOPE_MAX_BAR_SPACE_PX = 64;
const DEFAULT_OVERLAY_INPUTS = {
    measurementEnabled: false,
    selectedPriceLabels: null,
    drawingPrimitives: null,
};
function clampUnit(value, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(0, Math.min(1, value));
}
function normalizeHexColor(input) {
    const hex8 = /^#([0-9a-fA-F]{8})$/;
    const hex6 = /^#([0-9a-fA-F]{6})$/;
    const hex3 = /^#([0-9a-fA-F]{3})$/;
    if (hex6.test(input)) {
        return input;
    }
    const match8 = input.match(hex8);
    if (match8) {
        return `#${match8[1].substring(0, 6)}`;
    }
    const match3 = input.match(hex3);
    if (!match3) {
        return null;
    }
    const expanded = match3[1]
        .split("")
        .map((char) => `${char}${char}`)
        .join("");
    return `#${expanded}`;
}
function withAlpha(color, alpha) {
    const safeAlpha = clampUnit(alpha, 0.2);
    const normalizedHex = normalizeHexColor(color);
    if (normalizedHex) {
        const channel = Math.round(safeAlpha * 255)
            .toString(16)
            .padStart(2, "0");
        return `${normalizedHex}${channel}`;
    }
    const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(",").map((part) => part.trim());
        if (parts.length >= 3) {
            const r = Number.parseFloat(parts[0]);
            const g = Number.parseFloat(parts[1]);
            const b = Number.parseFloat(parts[2]);
            if ([r, g, b].every((channel) => Number.isFinite(channel))) {
                return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${safeAlpha})`;
            }
        }
    }
    return color;
}
function clampOverlayIndex(index, length) {
    if (length <= 0) {
        return 0;
    }
    const lastIndex = length - 1;
    return Math.min(lastIndex, Math.max(0, Math.floor(index)));
}
function cloneOverlayState(overlayState) {
    return {
        crosshair: overlayState.crosshair ? { ...overlayState.crosshair } : null,
        hoveredPaneId: overlayState.hoveredPaneId,
        hoveredDataIndex: overlayState.hoveredDataIndex,
        xAxisTicks: overlayState.xAxisTicks.map((tick) => ({ ...tick })),
        measurement: overlayState.measurement
            ? {
                enabled: overlayState.measurement.enabled,
                hoverPoint: overlayState.measurement.hoverPoint ? { ...overlayState.measurement.hoverPoint } : null,
                draft: overlayState.measurement.draft
                    ? {
                        ...overlayState.measurement.draft,
                        start: { ...overlayState.measurement.draft.start },
                        end: { ...overlayState.measurement.draft.end },
                    }
                    : null,
                committed: overlayState.measurement.committed
                    ? {
                        ...overlayState.measurement.committed,
                        start: { ...overlayState.measurement.committed.start },
                        end: { ...overlayState.measurement.committed.end },
                    }
                    : null,
            }
            : null,
        drawingPriceLabels: overlayState.drawingPriceLabels
            ? {
                ...overlayState.drawingPriceLabels,
                labels: overlayState.drawingPriceLabels.labels.map((label) => ({ ...label })),
            }
            : null,
        drawingPrimitives: overlayState.drawingPrimitives.map(cloneDrawingPrimitiveState),
    };
}
function cloneOverlayCanvasPoint(point) {
    return { ...point };
}
function cloneOverlayCanvasPrimitive(primitive) {
    return {
        ...primitive,
        points: primitive.points.map(cloneOverlayCanvasPoint),
        style: {
            ...primitive.style,
            dashPattern: primitive.style.dashPattern ? [...primitive.style.dashPattern] : undefined,
        },
        levelLines: primitive.levelLines?.map((line) => ({ ...line })),
        arcLevels: primitive.arcLevels?.map((level) => ({
            ...level,
            labelPosition: level.labelPosition ? cloneOverlayCanvasPoint(level.labelPosition) : undefined,
        })),
        verticalMarkers: primitive.verticalMarkers?.map((marker) => ({
            ...marker,
            labelPosition: marker.labelPosition ? cloneOverlayCanvasPoint(marker.labelPosition) : undefined,
        })),
        segments: primitive.segments?.map((segment) => ({
            ...segment,
            start: cloneOverlayCanvasPoint(segment.start),
            end: cloneOverlayCanvasPoint(segment.end),
            labelPosition: segment.labelPosition ? cloneOverlayCanvasPoint(segment.labelPosition) : undefined,
            dashPattern: segment.dashPattern ? [...segment.dashPattern] : undefined,
        })),
        paths: primitive.paths?.map((path) => ({
            ...path,
            points: path.points.map(cloneOverlayCanvasPoint),
        })),
        pointMarkers: primitive.pointMarkers?.map((marker) => ({
            ...marker,
            point: cloneOverlayCanvasPoint(marker.point),
        })),
        labels: primitive.labels?.map((label) => ({
            ...label,
            position: cloneOverlayCanvasPoint(label.position),
        })),
        polygons: primitive.polygons?.map((polygon) => ({
            ...polygon,
            points: polygon.points.map(cloneOverlayCanvasPoint),
        })),
        semanticBadges: primitive.semanticBadges?.map((badge) => ({
            ...badge,
            position: cloneOverlayCanvasPoint(badge.position),
        })),
    };
}
function cloneDrawingPrimitiveInput(input) {
    return {
        key: input.key,
        paneId: input.paneId,
        scaleSlotId: input.scaleSlotId,
        primitive: cloneOverlayCanvasPrimitive(input.primitive),
        selected: input.selected,
        drawingId: input.drawingId,
        actionHandle: input.actionHandle,
        clipToPane: input.clipToPane,
    };
}
function cloneDrawingPrimitiveState(state) {
    return {
        key: state.key,
        paneId: state.paneId,
        scaleSlotId: state.scaleSlotId,
        primitive: cloneOverlayCanvasPrimitive(state.primitive),
        selected: state.selected,
        drawingId: state.drawingId,
        actionHandle: state.actionHandle,
        clipToPane: state.clipToPane,
    };
}
function cloneOverlayInputs(inputs) {
    return {
        measurementEnabled: inputs.measurementEnabled,
        selectedPriceLabels: inputs.selectedPriceLabels
            ? {
                ...inputs.selectedPriceLabels,
                markers: inputs.selectedPriceLabels.markers.map((marker) => ({ ...marker })),
            }
            : null,
        drawingPrimitives: inputs.drawingPrimitives?.map(cloneDrawingPrimitiveInput) ?? null,
    };
}
function cloneLogicalMeasurementPoint(point) {
    return {
        paneId: point.paneId,
        scaleSlotId: point.scaleSlotId,
        index: point.index,
        price: point.price,
    };
}
function cloneLogicalMeasurementSelection(selection) {
    return {
        paneId: selection.paneId,
        scaleSlotId: selection.scaleSlotId,
        start: cloneLogicalMeasurementPoint(selection.start),
        end: cloneLogicalMeasurementPoint(selection.end),
    };
}
function resolveVisibleScaleSlotIds(snapshot) {
    return Object.entries(snapshot.scaleSlotStates)
        .filter(([, state]) => state.visible)
        .map(([scaleSlotId]) => scaleSlotId);
}
function resolvePreferredMeasurementScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]) {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = resolveVisibleScaleSlotIds(snapshot);
    if (visibleScaleSlotIds.length === 0) {
        return undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? visibleScaleSlotIds[0];
}
function resolvePreferredPriceLabelScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]?.side === "right") {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = resolveVisibleScaleSlotIds(snapshot);
    if (visibleScaleSlotIds.length === 0) {
        return undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId] ? requestedScaleSlotId : undefined)
        ?? visibleScaleSlotIds[0];
}
export class KernelEngine {
    options;
    listeners = new Map();
    paneLayout = new PaneLayoutEngine();
    paneSpecs = [];
    paneSnapshots = [];
    visibleRange = DEFAULT_VISIBLE_RANGE;
    theme = DEFAULT_THEME;
    locale = DEFAULT_LOCALE;
    dataSource = null;
    /** Type-erased enriched bars from app layer ΓÇö set via setEnrichedData() */
    enrichedData = [];
    container = null;
    surface = null;
    canvas = null;
    axisGridRenderer = new AxisGridRenderer();
    axisGridCache = new AxisGridRenderCache(this.axisGridRenderer);
    lineAreaRenderer = new LineAreaRenderer();
    barRenderer = new BarRenderer();
    candlestickRenderer = new CandlestickRenderer();
    lastCandlestickRenderCache = new Map();
    candlestickLodWorkerLane;
    crosshairRenderer = new CrosshairRenderer();
    crosshairPos = null;
    interactionController = null;
    pendingRender = false;
    renderHandle = null;
    renderHandleKind = null;
    lastPaneSnapshotsKey = null;
    overlayState = {
        crosshair: null,
        hoveredPaneId: null,
        hoveredDataIndex: null,
        xAxisTicks: [],
        measurement: null,
        drawingPriceLabels: null,
        drawingPrimitives: [],
    };
    overlayInputs = cloneOverlayInputs(DEFAULT_OVERLAY_INPUTS);
    measurementHoverPoint = null;
    measurementDraft = null;
    measurementCommitted = null;
    lastOverlayStateKey = null;
    disposed = false;
    /** KF-12-T07: Dirty-reason mask — accumulates layer flags until flushed by RAF */
    pendingDirtyMask = DirtyFlag.NONE;
    /** KF-12-T08: Last mask consumed by flushScheduledRender (for test introspection) */
    lastFlushedMask = DirtyFlag.NONE;
    /** KF-12-T08: Overlay canvas for crosshair/hover (sits above main canvas, pointer-events: none) */
    overlayCanvas = null;
    /** Y-range derived cache keyed by field name */
    derivedCaches = new Map();
    customSlotDomains = new Map();
    activeDragSlot = null;
    isDraggingYAxis = false;
    activePanPaneId = null;
    /** Fields for which y-range caches are maintained */
    static CACHED_FIELDS = ["close", "high", "low", "volume"];
    // ── KF-12-T06: Camera state ──────────────────────────────────────────────
    /** Pixels per bar (zoom level). Derived from visibleRange + canvas width. */
    barSpacePx = 8;
    /** Bars from the right edge of the visible window to the last data bar. 0 = live edge. */
    rightOffsetBars = 0;
    /** Carries sub-bar drag pixels so deep zoom pan does not get stuck on per-event rounding. */
    panRemainderPx = 0;
    cameraEnvelopeMode = "shared";
    /**
     * When true the camera follows the latest bar so live-appends auto-scroll.
     * When false the camera is locked to the current rightOffsetBars position.
     */
    followLatest = true;
    // ─────────────────────────────────────────────────────────────────────────
    constructor(options = {}) {
        this.options = {
            useWebGL: options.useWebGL ?? false,
        };
        this.candlestickLodWorkerLane = new CandlestickLodWorkerLane(() => this.disposed, (lodData) => this.resolveCandlestickLodDomain(lodData), () => this.scheduleRender(DirtyFlag.PLOT));
    }
    mount(container) {
        if (this.container === container && this.surface !== null) {
            return;
        }
        if (this.surface !== null) {
            this.dispose("remount");
        }
        const surface = container.ownerDocument.createElement("div");
        surface.setAttribute("data-vn-kline-engine", "surface");
        surface.setAttribute("data-engine-upstream", UPSTREAM_BASELINE.repo);
        surface.style.position = "relative";
        surface.style.width = "100%";
        surface.style.height = "100%";
        surface.style.overflow = "hidden";
        const canvas = container.ownerDocument.createElement("canvas");
        canvas.setAttribute("data-vn-kline-engine", "canvas");
        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        // KF-12-T08: Overlay canvas sits above main canvas; DOM overlays read overlayState separately.
        const overlayCanvas = container.ownerDocument.createElement("canvas");
        overlayCanvas.setAttribute("data-vn-kline-engine", "overlay");
        overlayCanvas.style.position = "absolute";
        overlayCanvas.style.top = "0";
        overlayCanvas.style.left = "0";
        overlayCanvas.style.width = "100%";
        overlayCanvas.style.height = "100%";
        overlayCanvas.style.pointerEvents = "none";
        surface.append(canvas);
        surface.append(overlayCanvas);
        container.append(surface);
        this.container = container;
        this.surface = surface;
        this.canvas = canvas;
        this.overlayCanvas = overlayCanvas;
        this.disposed = false;
        this.refreshSurface();
        this.interactionController = new InteractionController(canvas, {
            onZoom: (delta, pivotX, pivotY) => this.handleZoom(delta, pivotX, pivotY),
            onPan: (deltaX, deltaY) => {
                if (this.overlayInputs.measurementEnabled || this.isDraggingYAxis) {
                    return;
                }
                this.handlePan(deltaX, deltaY);
            },
            onCrosshairMove: (x, y) => {
                this.crosshairPos = { x, y };
                this.emitOverlayStateIfChanged();
                this.scheduleRender(DirtyFlag.OVERLAY);
            },
            onCrosshairLeave: () => {
                this.crosshairPos = null;
                this.emitOverlayStateIfChanged();
                this.scheduleRender(DirtyFlag.OVERLAY);
            },
            onPointerDown: (context) => {
                const slot = this.findScaleSlotAt(context.localX, context.localY);
                if (slot) {
                    const snapshot = this.paneSnapshots.find(s => s.paneId === slot.paneId);
                    const currentDomain = snapshot?.scaleSlotStates[slot.scaleSlotId]?.domain;
                    if (currentDomain) {
                        this.activeDragSlot = {
                            paneId: slot.paneId,
                            scaleSlotId: slot.scaleSlotId,
                            startY: context.clientY,
                            startDomain: [...currentDomain],
                        };
                        this.isDraggingYAxis = true;
                    }
                }
                else {
                    const snapshot = this.resolveMeasurementSnapshot(context.localX, context.localY);
                    if (snapshot) {
                        this.activePanPaneId = snapshot.paneId;
                    }
                }
                this.handleMeasurementPointerDown(context);
                this.emitInteraction("pointerdown", context);
            },
            onPointerMove: (context) => {
                if (this.isDraggingYAxis && this.activeDragSlot) {
                    const snapshot = this.paneSnapshots.find(s => s.paneId === this.activeDragSlot.paneId);
                    const height = snapshot ? snapshot.plotBounds.height : 100;
                    const diffY = context.clientY - this.activeDragSlot.startY;
                    const ratio = Math.exp((diffY / height) * 2);
                    const [min, max] = this.activeDragSlot.startDomain;
                    const center = (min + max) / 2;
                    const halfSpan = (max - min) / 2;
                    const newDomain = [
                        center - halfSpan * ratio,
                        center + halfSpan * ratio
                    ];
                    this.customSlotDomains.set(this.activeDragSlot.scaleSlotId, newDomain);
                    this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
                    this.emitOverlayStateIfChanged();
                }
                this.handleMeasurementPointerMove(context);
                this.emitInteraction("pointermove", context);
            },
            onPointerUp: (context) => {
                this.isDraggingYAxis = false;
                this.activeDragSlot = null;
                this.activePanPaneId = null;
                this.emitInteraction("pointerup", context);
            },
            onPointerCancel: (context) => {
                this.isDraggingYAxis = false;
                this.activeDragSlot = null;
                this.activePanPaneId = null;
                this.handleMeasurementPointerCancel();
                this.emitInteraction("pointercancel", context);
            },
            onPointerLeave: (context) => {
                this.isDraggingYAxis = false;
                this.activeDragSlot = null;
                this.activePanPaneId = null;
                this.handleMeasurementPointerLeave();
                this.emitInteraction("pointerleave", context);
            },
            onClick: (context) => {
                this.handleMeasurementClick();
                this.emitInteraction("click", context);
            },
            onDoubleClick: (context) => {
                const slot = this.findScaleSlotAt(context.localX, context.localY);
                if (slot) {
                    this.customSlotDomains.delete(slot.scaleSlotId);
                    this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
                    this.emitOverlayStateIfChanged();
                    return;
                }
                this.emitInteraction("doubleclick", context);
            },
            onContextMenu: (context) => this.emitInteraction("contextmenu", context),
            onDragStart: (context) => {
                this.panRemainderPx = 0;
                this.emitInteraction("dragstart", context);
            },
            onDragMove: (context) => this.emitInteraction("dragmove", context),
            onDragEnd: (context) => this.emitInteraction("dragend", context),
        });
        this.emit("mount", { container });
    }
    setPaneSpecs(panes) {
        this.paneSpecs = [...panes];
        this.scheduleRender(DirtyFlag.FULL);
    }
    setDataSource(dataSource) {
        this.dataSource = dataSource;
        this.scheduleRender(DirtyFlag.FULL);
        this.emit("dataSource", { dataSource });
    }
    /**
     * Supply pre-computed indicator data from the app layer.
     * Data is type-erased (Record<string, unknown>[]) to avoid cross-layer coupling.
     * KernelEngine uses INDICATOR_ACCESSORS to extract scalar values per series type.
     */
    setEnrichedData(data) {
        if (this.enrichedData === data) {
            this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
            return;
        }
        const prevLength = this.enrichedData.length;
        this.candlestickLodWorkerLane.abortAll();
        this.enrichedData = data;
        this.rebuildDerivedCaches(prevLength);
        this.syncCameraAfterDataChange(prevLength);
        this.syncSnapshotsAndEmit();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
        // Emit updated visibleRange so React state stays in sync after data changes
        // (mirrors legacy: D3 chart always re-derives and emits range on every data update).
        this.emit("visibleRange", { range: this.getVisibleRange() });
    }
    /**
     * Push an immutable history snapshot from the widget chunk-store.
     * The engine does NOT need to know about the adapter, fetch strategy, or
     * pagination — it only receives immutable snapshots.
     *
     * `patch` may be used in the future to invalidate derived caches
     * incrementally.  For now the engine forwards the bars to enrichedData.
     *
     * NOTE: The snapshot's `bars` are type-erased at the engine boundary;
     * the engine casts them to `Record<string, unknown>[]` for `setEnrichedData`.
     */
    setHistorySnapshot(snapshot, _patch) {
        const prevLength = this.enrichedData.length;
        this.candlestickLodWorkerLane.abortAll();
        this.enrichedData = snapshot.bars;
        this.rebuildDerivedCaches(prevLength);
        this.syncCameraAfterDataChange(prevLength);
        this.syncSnapshotsAndEmit();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
    }
    /**
     * KF-12-T05: Query y-range for a visible index window using the derived cache.
     * O(k) where k = overlapping bucket count — avoids O(n) full scan on pan/zoom.
     *
     * Returns null if no cache exists for the field or no bars in range.
     */
    getYRangeFromCache(fieldKey, fromIndex, toIndex) {
        const cache = this.derivedCaches.get(fieldKey);
        if (!cache)
            return null;
        return queryYRange(cache, fromIndex, toIndex);
    }
    // ── KF-12-T05: Derived cache management ─────────────────────────────────
    rebuildDerivedCaches(prevLength) {
        const data = this.enrichedData;
        for (const field of KernelEngine.CACHED_FIELDS) {
            const existing = this.derivedCaches.get(field);
            if (!existing) {
                // Initial build
                this.derivedCaches.set(field, createDerivedCache(data, field));
            }
            else if (data.length === 0) {
                this.derivedCaches.set(field, createDerivedCache([], field));
            }
            else if (data.length > prevLength) {
                // Append-tail: only recompute tail bucket
                this.derivedCaches.set(field, appendTailCache(data, prevLength, existing));
            }
            else {
                // Replace-all (trim, full reload, etc.)
                this.derivedCaches.set(field, replaceAllCache(data, existing));
            }
        }
    }
    // ── KF-12-T06: Camera helpers ────────────────────────────────────────────
    /**
     * When followLatest=true, auto-advance the visible window to show the newest bars.
     * When followLatest=false, preserve the viewport's right-edge offset relative to live data.
     * If the preserved range falls completely outside the loaded data, re-anchor it to the nearest edge.
     */
    syncCameraAfterDataChange(prevLength) {
        const dataLen = this.enrichedData.length;
        if (dataLen === 0)
            return;
        const currentSpan = Math.max(1, this.visibleRange.to - this.visibleRange.from);
        // 1. If followLatest is active, auto-scroll to the live edge
        if (this.followLatest) {
            const minSpan = Math.max(1, Math.min(2, dataLen));
            const span = Math.max(minSpan, currentSpan);
            const newTo = dataLen;
            const newFrom = Math.max(0, newTo - span);
            this.visibleRange = { from: newFrom, to: newTo };
            this.syncCameraStateFromVisibleRange();
            return;
        }
        // 2. History mode (followLatest === false)
        // Span constraint: zoom to fit if dataLen is smaller than the current span.
        if (dataLen < currentSpan) {
            this.visibleRange = { from: 0, to: dataLen };
            this.syncCameraStateFromVisibleRange();
            return;
        }
        const targetTo = dataLen - this.rightOffsetBars;
        const targetFrom = targetTo - currentSpan;
        const overlapSpan = Math.max(1, Math.min(5, dataLen));
        if (targetTo <= 0) {
            const anchorSpan = Math.max(overlapSpan, Math.min(currentSpan, dataLen));
            this.visibleRange = { from: 0, to: anchorSpan };
        }
        else if (targetFrom >= dataLen) {
            const anchorSpan = Math.max(overlapSpan, Math.min(currentSpan, dataLen));
            this.visibleRange = { from: Math.max(0, dataLen - anchorSpan), to: dataLen };
        }
        else {
            this.visibleRange = { from: targetFrom, to: targetTo };
        }
        this.syncCameraStateFromVisibleRange();
    }
    resolveCameraEnvelopeMode() {
        const dataLen = this.enrichedData.length;
        if (dataLen > 0 && (this.visibleRange.from < 0 || this.visibleRange.to > dataLen)) {
            return "extended";
        }
        if (this.barSpacePx < SHARED_ENVELOPE_MIN_BAR_SPACE_PX || this.barSpacePx > SHARED_ENVELOPE_MAX_BAR_SPACE_PX) {
            return "extended";
        }
        return "shared";
    }
    normalizeVisibleRange(range) {
        const from = Number.isFinite(range.from)
            ? Math.max(-CAMERA_RANGE_MAX_ABS_INDEX, Math.min(CAMERA_RANGE_MAX_ABS_INDEX, range.from))
            : 0;
        const to = Number.isFinite(range.to)
            ? Math.max(-CAMERA_RANGE_MAX_ABS_INDEX, Math.min(CAMERA_RANGE_MAX_ABS_INDEX, range.to))
            : from;
        if (from <= to) {
            return { from, to };
        }
        return { from: to, to: from };
    }
    resolveXAxisViewport() {
        const primaryPane = this.paneSnapshots[0];
        if (primaryPane?.plotBounds && Number.isFinite(primaryPane.plotBounds.width) && primaryPane.plotBounds.width > 0) {
            return {
                left: primaryPane.plotBounds.left,
                width: primaryPane.plotBounds.width,
            };
        }
        return {
            left: 0,
            width: Math.max(1, this.canvas?.width || DEFAULT_WIDTH),
        };
    }
    syncCameraStateFromVisibleRange() {
        this.visibleRange = this.normalizeVisibleRange(this.visibleRange);
        const span = Math.max(1, this.visibleRange.to - this.visibleRange.from);
        const xViewport = this.resolveXAxisViewport();
        this.barSpacePx = xViewport.width / span;
        const dataLen = this.enrichedData.length;
        this.rightOffsetBars = dataLen - this.visibleRange.to;
        this.cameraEnvelopeMode = this.resolveCameraEnvelopeMode();
    }
    /**
     * KF-12-T06: Explicitly set camera parameters.
     * Allows host (EngineHost / widget) to set followLatest mode.
     */
    setCameraState(state) {
        if (state.followLatest !== undefined)
            this.followLatest = state.followLatest;
        if (state.rightOffsetBars !== undefined)
            this.rightOffsetBars = state.rightOffsetBars;
        // If following latest, scroll to edge
        if (this.followLatest) {
            this.syncCameraAfterDataChange();
        }
        else if (state.rightOffsetBars !== undefined) {
            const dataLen = this.enrichedData.length;
            const effectiveDataLen = dataLen || 1000;
            const minSpan = Math.max(1, Math.min(2, effectiveDataLen));
            const currentSpan = Math.max(minSpan, this.visibleRange.to - this.visibleRange.from);
            const targetTo = effectiveDataLen - this.rightOffsetBars;
            const targetFrom = targetTo - currentSpan;
            // Respect the soft limits
            const maxSpan = Math.min(MAX_VISIBLE_BARS, Math.max(effectiveDataLen * 2, 500));
            const clampedSpan = Math.max(minSpan, Math.min(maxSpan, currentSpan));
            const clampedFrom = Math.max(-clampedSpan, Math.min(effectiveDataLen, targetFrom));
            this.visibleRange = {
                from: clampedFrom,
                to: clampedFrom + clampedSpan,
            };
            this.syncCameraStateFromVisibleRange();
        }
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
    }
    setOverlayInputs(inputs) {
        const wasMeasurementEnabled = this.overlayInputs.measurementEnabled;
        this.overlayInputs = cloneOverlayInputs(inputs);
        if (wasMeasurementEnabled && !this.overlayInputs.measurementEnabled) {
            this.resetMeasurementState();
        }
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.OVERLAY);
    }
    /**
     * KF-12-T06: Read-only snapshot of current camera state.
     */
    getCameraState() {
        return {
            barSpacePx: this.barSpacePx,
            rightOffsetBars: this.rightOffsetBars,
            followLatest: this.followLatest,
            envelopeMode: this.cameraEnvelopeMode,
        };
    }
    findScaleSlotAt(localX, localY) {
        for (const snapshot of this.paneSnapshots) {
            for (const [slotId, bounds] of Object.entries(snapshot.scaleSlotBounds)) {
                const right = bounds.left + bounds.width;
                const bottom = bounds.top + bounds.height;
                if (localX >= bounds.left && localX <= right && localY >= bounds.top && localY <= bottom) {
                    const state = snapshot.scaleSlotStates[slotId];
                    if (state) {
                        return {
                            paneId: snapshot.paneId,
                            scaleSlotId: slotId,
                            side: state.side,
                            bounds,
                        };
                    }
                }
            }
        }
        return null;
    }
    handleZoom(delta, pivotX, pivotY) {
        if (pivotY !== undefined) {
            const slot = this.findScaleSlotAt(pivotX, pivotY);
            if (slot) {
                const paneSpec = this.paneSpecs.find((p) => p.id === slot.paneId);
                if (paneSpec) {
                    const slotDomains = this.computePaneScaleSlotDomains(paneSpec);
                    const currentDomain = this.customSlotDomains.get(slot.scaleSlotId) || slotDomains.get(slot.scaleSlotId);
                    if (currentDomain) {
                        const zoomMultiplier = 1.1;
                        const zoomDirection = delta > 0 ? -1 : 1; // delta > 0 means scroll up (zoom in)
                        const c = zoomDirection > 0 ? zoomMultiplier : 1 / zoomMultiplier;
                        const [min, max] = currentDomain;
                        const center = (min + max) / 2;
                        const newDomain = [
                            center + (min - center) * c,
                            center + (max - center) * c
                        ];
                        this.customSlotDomains.set(slot.scaleSlotId, newDomain);
                        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
                        this.emitOverlayStateIfChanged();
                    }
                }
                return;
            }
        }
        const dataLen = this.enrichedData.length || 1000;
        const minSpan = Math.max(1, Math.min(2, dataLen));
        const maxZoomSpan = Math.min(MAX_VISIBLE_BARS, Math.max(dataLen * 2, 500));
        const xViewport = this.resolveXAxisViewport();
        const { from, to } = this.visibleRange;
        const oldSpan = to - from;
        const scaledSpan = oldSpan * (1 - delta * 0.15);
        let nextSpan = Math.round(scaledSpan);
        if (nextSpan === oldSpan) {
            if (delta < 0 && oldSpan < maxZoomSpan) {
                nextSpan = oldSpan + 1;
            }
            else if (delta > 0 && oldSpan > minSpan) {
                nextSpan = oldSpan - 1;
            }
        }
        const newSpan = Math.max(minSpan, Math.min(maxZoomSpan, nextSpan));
        const pivotFraction = Math.max(0, Math.min(1, (pivotX - xViewport.left) / xViewport.width));
        const pivotIndex = from + Math.round(oldSpan * pivotFraction);
        const newFrom = pivotIndex - Math.round(newSpan * pivotFraction);
        // Cap to symmetric 1.0 span overflow
        const clampedFrom = Math.max(-newSpan, Math.min(dataLen, newFrom));
        this.visibleRange = { from: clampedFrom, to: clampedFrom + newSpan };
        // KF-12-T06: Update camera — zoom out of live edge disengages followLatest.
        this.syncCameraStateFromVisibleRange();
        this.followLatest = this.rightOffsetBars === 0;
        this.syncSnapshotsAndEmit();
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
        this.emit("visibleRange", { range: this.getVisibleRange() });
    }
    handlePan(deltaX, deltaY) {
        const dataLen = this.enrichedData.length || 1000;
        const minSpan = Math.max(1, Math.min(2, dataLen));
        const xViewport = this.resolveXAxisViewport();
        const { from, to } = this.visibleRange;
        const span = Math.max(minSpan, to - from);
        const pixelsPerBar = xViewport.width / Math.max(1, span);
        const totalDeltaPx = this.panRemainderPx + deltaX;
        const rawDeltaBars = totalDeltaPx / pixelsPerBar;
        const indexDelta = Math.round(rawDeltaBars);
        this.panRemainderPx = totalDeltaPx - indexDelta * pixelsPerBar;
        const newFrom = from - indexDelta;
        // Cap to symmetric 1.0 span overflow
        const clampedFrom = Math.max(-span, Math.min(dataLen, newFrom));
        this.visibleRange = { from: clampedFrom, to: clampedFrom + span };
        // KF-12-T06: Panning away from live edge disengages followLatest; panning back to edge re-engages
        this.syncCameraStateFromVisibleRange();
        this.followLatest = this.rightOffsetBars === 0;
        // Vertical panning logic for manual scaling mode (Mode B)
        if (deltaY !== undefined && deltaY !== 0 && this.activePanPaneId) {
            const snapshot = this.paneSnapshots.find(s => s.paneId === this.activePanPaneId);
            if (snapshot) {
                let hasManualScale = false;
                for (const slotId of Object.keys(snapshot.scaleSlotStates)) {
                    if (this.customSlotDomains.has(slotId)) {
                        hasManualScale = true;
                        break;
                    }
                }
                if (hasManualScale) {
                    const height = snapshot.plotBounds.height;
                    if (height > 0) {
                        for (const [slotId, slotState] of Object.entries(snapshot.scaleSlotStates)) {
                            const currentDomain = this.customSlotDomains.get(slotId) || slotState.domain;
                            if (currentDomain) {
                                const [min, max] = currentDomain;
                                const range = max - min;
                                if (range > 0 && Number.isFinite(range)) {
                                    const priceShift = (deltaY / height) * range;
                                    const newDomain = [min + priceShift, max + priceShift];
                                    this.customSlotDomains.set(slotId, newDomain);
                                }
                            }
                        }
                    }
                }
            }
        }
        this.syncSnapshotsAndEmit();
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
        this.emit("visibleRange", { range: this.getVisibleRange() });
    }
    setTheme(theme) {
        this.theme = theme;
        this.scheduleRender(DirtyFlag.FULL);
        this.emit("theme", { theme });
    }
    setLocale(locale) {
        this.locale = locale;
        this.scheduleRender(DirtyFlag.FULL);
        this.emit("locale", { locale });
    }
    getPaneSnapshots() {
        return this.paneSnapshots.map(clonePaneRuntimeSnapshot);
    }
    getVisibleRange() {
        return { ...this.visibleRange };
    }
    getOverlayState() {
        const nextOverlayState = this.computeOverlayState();
        this.overlayState = nextOverlayState;
        return cloneOverlayState(nextOverlayState);
    }
    hitTestDrawingPrimitive(localX, localY) {
        if (this.paneSnapshots.length === 0 || !this.overlayInputs.drawingPrimitives || this.overlayInputs.drawingPrimitives.length === 0) {
            return null;
        }
        const drawingPrimitives = this.computeDrawingPrimitivesState();
        for (let index = drawingPrimitives.length - 1; index >= 0; index -= 1) {
            const drawingPrimitive = drawingPrimitives[index];
            const snapshot = this.paneSnapshots.find((candidate) => candidate.paneId === drawingPrimitive.paneId);
            if (!snapshot) {
                continue;
            }
            const { plotBounds } = snapshot;
            if (drawingPrimitive.clipToPane !== false
                && (localX < plotBounds.left
                    || localX > plotBounds.left + plotBounds.width
                    || localY < plotBounds.top
                    || localY > plotBounds.top + plotBounds.height)) {
                continue;
            }
            const hit = hitTestOverlayPrimitive(drawingPrimitive.primitive, localX - plotBounds.left, localY - plotBounds.top, {
                chartWidth: plotBounds.width,
                chartHeight: plotBounds.height,
                tolerance: 6,
            });
            if (hit) {
                return cloneDrawingPrimitiveState(drawingPrimitive);
            }
        }
        return null;
    }
    scrollToDataIndex(index) {
        const span = Math.max(1, this.visibleRange.to - this.visibleRange.from);
        this.visibleRange = {
            from: Math.max(0, index - span),
            to: index,
        };
        this.syncCameraStateFromVisibleRange();
        this.syncSnapshotsAndEmit();
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
        this.emit("visibleRange", { range: this.getVisibleRange() });
    }
    zoomToRange(range) {
        this.visibleRange = this.normalizeVisibleRange(range);
        this.syncCameraStateFromVisibleRange();
        this.syncSnapshotsAndEmit();
        this.emitOverlayStateIfChanged();
        this.scheduleRender(DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.OVERLAY);
        this.emit("visibleRange", { range: this.getVisibleRange() });
    }
    subscribe(event, listener) {
        const current = this.listeners.get(event) ?? new Set();
        current.add(listener);
        this.listeners.set(event, current);
        return () => {
            current.delete(listener);
            if (current.size === 0) {
                this.listeners.delete(event);
            }
        };
    }
    dispose(reason = "manual") {
        this.interactionController?.dispose();
        this.interactionController = null;
        this.candlestickLodWorkerLane.abortAll();
        this.disposed = true;
        if (this.renderHandle !== null) {
            if (this.renderHandleKind === "raf" && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(this.renderHandle);
            }
            else {
                clearTimeout(this.renderHandle);
            }
        }
        this.pendingRender = false;
        this.renderHandle = null;
        this.renderHandleKind = null;
        this.axisGridCache.invalidate();
        this.surface?.remove();
        this.surface = null;
        this.canvas = null;
        this.overlayCanvas = null;
        this.container = null;
        this.paneSnapshots = [];
        this.lastPaneSnapshotsKey = null;
        this.overlayState = {
            crosshair: null,
            hoveredPaneId: null,
            hoveredDataIndex: null,
            xAxisTicks: [],
            measurement: null,
            drawingPriceLabels: null,
            drawingPrimitives: [],
        };
        this.overlayInputs = cloneOverlayInputs(DEFAULT_OVERLAY_INPUTS);
        this.resetMeasurementState();
        this.lastOverlayStateKey = null;
        this.emit("dispose", { reason });
    }
    /**
     * KF-12-T07: Schedule a render with a reason mask.
     * Flags accumulate across multiple callers within the same frame.
     * Renderer layers may use `pendingDirtyMask` to skip unchanged layers.
     */
    scheduleRender(flags = DirtyFlag.FULL) {
        this.pendingDirtyMask |= flags;
        if (!this.surface || !this.canvas || this.disposed || this.pendingRender) {
            return;
        }
        this.pendingRender = true;
        const flush = () => this.flushScheduledRender();
        if (typeof requestAnimationFrame === "function") {
            this.renderHandleKind = "raf";
            this.renderHandle = requestAnimationFrame(flush);
            return;
        }
        this.renderHandleKind = "timeout";
        this.renderHandle = setTimeout(flush, 16);
    }
    /** KF-12-T07: Read and clear the pending dirty mask (exposed for tests and T08/T09). */
    getDirtyMask() {
        return this.pendingDirtyMask;
    }
    /** KF-12-T09: Returns axis/grid renderer call count since last reset (for test introspection). */
    getAxisGridRendererCalls() {
        return this.axisGridCache.getRendererCalls();
    }
    /** KF-12-T09: Resets the axis/grid renderer call counter. */
    resetAxisGridRendererCalls() {
        this.axisGridCache.resetRendererCalls();
    }
    /** KF-12-T08: Read the last mask consumed in flushScheduledRender (for test introspection). */
    getLastFlushedMask() {
        return this.lastFlushedMask;
    }
    flushScheduledRender() {
        this.pendingRender = false;
        this.renderHandle = null;
        this.renderHandleKind = null;
        // KF-12-T07/T08: Consume and clear the dirty mask; branch per layer
        const mask = this.pendingDirtyMask;
        this.pendingDirtyMask = DirtyFlag.NONE;
        this.lastFlushedMask = mask;
        if (this.disposed) {
            return;
        }
        // Plot / axis / grid layers — repaint main canvas
        if (mask & (DirtyFlag.PLOT | DirtyFlag.AXIS | DirtyFlag.GRID)) {
            this.refreshSurface();
        }
        // Overlay layer — repaint crosshair canvas only (skip main canvas)
        if (mask & DirtyFlag.OVERLAY) {
            this.refreshOverlay();
        }
    }
    isMounted() {
        return this.surface !== null;
    }
    resize() {
        this.refreshSurface();
    }
    emit(event, payload) {
        const listeners = this.listeners.get(event);
        if (!listeners) {
            return;
        }
        listeners.forEach((listener) => {
            listener(payload);
        });
    }
    emitInteraction(phase, context) {
        this.emit("interaction", {
            phase,
            context: { ...context },
        });
    }
    emitOverlayStateIfChanged() {
        const nextOverlayState = this.computeOverlayState();
        const overlayStateKey = JSON.stringify(nextOverlayState);
        this.overlayState = nextOverlayState;
        if (overlayStateKey === this.lastOverlayStateKey) {
            return;
        }
        this.lastOverlayStateKey = overlayStateKey;
        this.emit("overlayState", { overlayState: this.getOverlayState() });
    }
    computeOverlayState() {
        const hoveredSnapshot = this.resolveCrosshairSnapshot();
        const hoveredDataIndex = hoveredSnapshot && this.crosshairPos
            ? resolvePaneDataIndexAtPixel(hoveredSnapshot, this.visibleRange, this.crosshairPos.x, this.enrichedData.length)
            : null;
        return {
            crosshair: this.crosshairPos
                ? {
                    x: this.crosshairPos.x,
                    y: this.crosshairPos.y,
                    paneId: hoveredSnapshot?.paneId ?? null,
                    dataIndex: hoveredDataIndex,
                }
                : null,
            hoveredPaneId: hoveredSnapshot?.paneId ?? null,
            hoveredDataIndex,
            xAxisTicks: this.computeOverlayXAxisTicks(),
            measurement: this.computeMeasurementOverlayState(),
            drawingPriceLabels: this.computeDrawingPriceLabelsState(),
            drawingPrimitives: this.computeDrawingPrimitivesState(),
        };
    }
    projectDrawingPrimitive(primitive, snapshot, scaleSlotId, actionHandle) {
        const projector = createPaneProjector(snapshot, this.visibleRange, scaleSlotId);
        const { left, top } = snapshot.plotBounds;
        const projectPoint = (point) => {
            const nextPoint = { ...point };
            if (typeof point.xIndexFloat === "number" && Number.isFinite(point.xIndexFloat)) {
                const px = projector.indexToPixelX(point.xIndexFloat + 0.5);
                if (px !== null) {
                    nextPoint.x = px - left;
                }
            }
            if (typeof point.yPrice === "number" && Number.isFinite(point.yPrice)) {
                const py = projector.valueToPixelY(point.yPrice);
                if (py !== null) {
                    nextPoint.y = py - top;
                }
            }
            return nextPoint;
        };
        const nextPoints = primitive.points.map(projectPoint);
        if (actionHandle && nextPoints.length >= 2 && nextPoints[0]) {
            nextPoints[1] = { x: nextPoints[0].x + 8, y: nextPoints[0].y };
        }
        const nextSegments = primitive.segments?.map((segment) => ({
            ...segment,
            start: projectPoint(segment.start),
            end: projectPoint(segment.end),
            labelPosition: segment.labelPosition ? projectPoint(segment.labelPosition) : undefined,
        }));
        const nextPaths = primitive.paths?.map((path) => ({
            ...path,
            points: path.points.map(projectPoint),
        }));
        const nextPointMarkers = primitive.pointMarkers?.map((marker) => ({
            ...marker,
            point: projectPoint(marker.point),
        }));
        const nextLabels = primitive.labels?.map((label) => {
            const position = projectPoint(label.position);
            return {
                ...label,
                position: actionHandle && nextPoints[0] ? nextPoints[0] : position,
            };
        });
        const nextPolygons = primitive.polygons?.map((polygon) => ({
            ...polygon,
            points: polygon.points.map(projectPoint),
        }));
        const nextSemanticBadges = primitive.semanticBadges?.map((badge) => ({
            ...badge,
            position: projectPoint(badge.position),
        }));
        const nextLevelLines = primitive.levelLines?.map((level) => {
            if (typeof level.yPrice === "number" && Number.isFinite(level.yPrice)) {
                const py = projector.valueToPixelY(level.yPrice);
                if (py !== null) {
                    return { ...level, y: py - top };
                }
            }
            return level;
        });
        const nextVerticalMarkers = primitive.verticalMarkers?.map((marker) => {
            if (typeof marker.xIndexFloat === "number" && Number.isFinite(marker.xIndexFloat)) {
                const px = projector.indexToPixelX(marker.xIndexFloat + 0.5);
                if (px !== null) {
                    return { ...marker, x: px - left };
                }
            }
            return marker;
        });
        let nextBaseRadius = 0;
        if (nextPoints.length >= 2 && nextPoints[0] && nextPoints[1]) {
            nextBaseRadius = Math.hypot(nextPoints[1].x - nextPoints[0].x, nextPoints[1].y - nextPoints[0].y);
        }
        const nextArcLevels = primitive.arcLevels?.map((level) => {
            let nextRadius = level.radius;
            if (typeof level.radiusRatio === "number" && Number.isFinite(level.radiusRatio) && nextBaseRadius > 0) {
                nextRadius = nextBaseRadius * level.radiusRatio;
            }
            let nextLabelPos = level.labelPosition;
            if (nextLabelPos && typeof nextLabelPos.xIndexFloat === "number" && typeof nextLabelPos.yPrice === "number") {
                nextLabelPos = projectPoint(nextLabelPos);
            }
            else if (nextLabelPos && nextPoints[0] && nextBaseRadius > 0 && typeof level.radiusRatio === "number") {
                nextLabelPos = {
                    x: nextPoints[0].x + nextRadius * 0.707,
                    y: nextPoints[0].y - nextRadius * 0.707,
                };
            }
            return {
                ...level,
                radius: nextRadius,
                labelPosition: nextLabelPos,
            };
        });
        return {
            ...primitive,
            points: nextPoints,
            segments: nextSegments,
            paths: nextPaths,
            pointMarkers: nextPointMarkers,
            labels: nextLabels,
            polygons: nextPolygons,
            semanticBadges: nextSemanticBadges,
            levelLines: nextLevelLines,
            verticalMarkers: nextVerticalMarkers,
            arcLevels: nextArcLevels,
        };
    }
    computeDrawingPrimitivesState() {
        if (this.paneSnapshots.length === 0 || !this.overlayInputs.drawingPrimitives || this.overlayInputs.drawingPrimitives.length === 0) {
            return [];
        }
        return this.overlayInputs.drawingPrimitives
            .filter((primitive) => primitive.primitive.visible !== false && this.paneSnapshots.some((snapshot) => snapshot.paneId === primitive.paneId))
            .map((primitive) => {
            const snapshot = this.paneSnapshots.find((s) => s.paneId === primitive.paneId);
            const scaleSlotId = primitive.scaleSlotId || Object.keys(snapshot.scaleSlotStates)[0];
            const projected = this.projectDrawingPrimitive(primitive.primitive, snapshot, scaleSlotId, primitive.actionHandle);
            return {
                key: primitive.key,
                paneId: primitive.paneId,
                scaleSlotId: primitive.scaleSlotId,
                primitive: projected,
                selected: primitive.selected,
                drawingId: primitive.drawingId,
                actionHandle: primitive.actionHandle,
                clipToPane: primitive.clipToPane,
            };
        });
    }
    resolveCrosshairSnapshot() {
        if (!this.crosshairPos) {
            return null;
        }
        return this.paneSnapshots.find((snapshot) => {
            const { plotBounds } = snapshot;
            return this.crosshairPos !== null
                && this.crosshairPos.x >= plotBounds.left
                && this.crosshairPos.x <= plotBounds.left + plotBounds.width
                && this.crosshairPos.y >= plotBounds.top
                && this.crosshairPos.y <= plotBounds.top + plotBounds.height;
        }) ?? null;
    }
    computeOverlayXAxisTicks() {
        if (this.paneSnapshots.length === 0 || this.enrichedData.length === 0) {
            return [];
        }
        const bottomSnapshot = this.paneSnapshots[this.paneSnapshots.length - 1];
        if (!bottomSnapshot) {
            return [];
        }
        const fromIndex = clampOverlayIndex(Math.min(this.visibleRange.from, this.visibleRange.to), this.enrichedData.length);
        const toIndex = clampOverlayIndex(Math.max(this.visibleRange.from, this.visibleRange.to), this.enrichedData.length);
        const tickCount = Math.max(2, Math.min(6, Math.floor(bottomSnapshot.plotBounds.width / 96)));
        const seenIndices = new Set();
        const ticks = [];
        for (let tickIndex = 0; tickIndex < tickCount; tickIndex += 1) {
            const ratio = tickCount === 1 ? 0 : tickIndex / (tickCount - 1);
            const dataIndex = clampOverlayIndex(Math.round(fromIndex + (toIndex - fromIndex) * ratio), this.enrichedData.length);
            if (seenIndices.has(dataIndex)) {
                continue;
            }
            seenIndices.add(dataIndex);
            const x = resolvePanePixelAtDataIndex(bottomSnapshot, this.visibleRange, dataIndex, this.enrichedData.length);
            if (x === null) {
                continue;
            }
            ticks.push({
                key: `${bottomSnapshot.paneId}-${dataIndex}`,
                x,
                dataIndex,
            });
        }
        return ticks;
    }
    resetMeasurementState() {
        this.measurementHoverPoint = null;
        this.measurementDraft = null;
        this.measurementCommitted = null;
    }
    handleMeasurementPointerDown(context) {
        if (!this.overlayInputs.measurementEnabled) {
            return;
        }
        const nextPoint = this.resolveMeasurementLogicalPoint(context.localX, context.localY);
        if (!nextPoint) {
            return;
        }
        this.measurementHoverPoint = cloneLogicalMeasurementPoint(nextPoint);
        this.measurementCommitted = null;
        this.measurementDraft = {
            paneId: nextPoint.paneId,
            scaleSlotId: nextPoint.scaleSlotId,
            start: cloneLogicalMeasurementPoint(nextPoint),
            end: cloneLogicalMeasurementPoint(nextPoint),
        };
        this.emitOverlayStateIfChanged();
    }
    handleMeasurementPointerMove(context) {
        if (!this.overlayInputs.measurementEnabled) {
            return;
        }
        if (this.measurementDraft) {
            const nextPoint = this.resolveMeasurementLogicalPoint(context.localX, context.localY, this.measurementDraft.paneId, this.measurementDraft.scaleSlotId);
            if (!nextPoint) {
                return;
            }
            this.measurementHoverPoint = cloneLogicalMeasurementPoint(nextPoint);
            this.measurementDraft = {
                paneId: this.measurementDraft.paneId,
                scaleSlotId: this.measurementDraft.scaleSlotId,
                start: cloneLogicalMeasurementPoint(this.measurementDraft.start),
                end: cloneLogicalMeasurementPoint(nextPoint),
            };
            this.emitOverlayStateIfChanged();
            return;
        }
        const hoverPoint = this.resolveMeasurementLogicalPoint(context.localX, context.localY);
        this.measurementHoverPoint = hoverPoint ? cloneLogicalMeasurementPoint(hoverPoint) : null;
        this.emitOverlayStateIfChanged();
    }
    handleMeasurementPointerCancel() {
        if (!this.overlayInputs.measurementEnabled) {
            return;
        }
        this.measurementHoverPoint = null;
        this.measurementDraft = null;
        this.emitOverlayStateIfChanged();
    }
    handleMeasurementPointerLeave() {
        if (!this.overlayInputs.measurementEnabled) {
            return;
        }
        this.measurementHoverPoint = null;
        this.commitMeasurementDraft();
    }
    handleMeasurementClick() {
        if (!this.overlayInputs.measurementEnabled) {
            return;
        }
        this.commitMeasurementDraft();
    }
    commitMeasurementDraft() {
        if (!this.measurementDraft) {
            this.emitOverlayStateIfChanged();
            return;
        }
        this.measurementCommitted = cloneLogicalMeasurementSelection(this.measurementDraft);
        this.measurementDraft = null;
        this.emitOverlayStateIfChanged();
    }
    resolveMeasurementSnapshot(localX, localY, activePaneId) {
        if (activePaneId) {
            return this.paneSnapshots.find((snapshot) => snapshot.paneId === activePaneId) ?? null;
        }
        return this.paneSnapshots.find((snapshot) => {
            const { plotBounds } = snapshot;
            return localX >= plotBounds.left
                && localX <= plotBounds.left + plotBounds.width
                && localY >= plotBounds.top
                && localY <= plotBounds.top + plotBounds.height;
        }) ?? null;
    }
    resolveMeasurementLogicalPoint(localX, localY, activePaneId, activeScaleSlotId) {
        const snapshot = this.resolveMeasurementSnapshot(localX, localY, activePaneId);
        if (!snapshot) {
            return undefined;
        }
        const scaleSlotId = resolvePreferredMeasurementScaleSlotId(snapshot, activeScaleSlotId);
        if (!scaleSlotId) {
            return undefined;
        }
        const index = resolvePaneDataIndexAtPixel(snapshot, this.visibleRange, localX, this.enrichedData.length);
        const price = resolvePaneValueAtPixel(snapshot, scaleSlotId, localY);
        if (index === null || price === null) {
            return undefined;
        }
        return {
            paneId: snapshot.paneId,
            scaleSlotId,
            index,
            price,
        };
    }
    resolveOverlayMeasurementPoint(point) {
        const snapshot = this.paneSnapshots.find((candidate) => candidate.paneId === point.paneId);
        if (!snapshot) {
            return null;
        }
        const scaleSlotId = resolvePreferredMeasurementScaleSlotId(snapshot, point.scaleSlotId);
        if (!scaleSlotId) {
            return null;
        }
        const x = resolvePanePixelAtDataIndex(snapshot, this.visibleRange, point.index, this.enrichedData.length);
        const y = resolvePanePixelAtValue(snapshot, scaleSlotId, point.price);
        if (x === null || y === null) {
            return null;
        }
        return {
            paneId: snapshot.paneId,
            scaleSlotId,
            index: point.index,
            price: point.price,
            x,
            y,
        };
    }
    resolveOverlayMeasurementSelection(selection) {
        const start = this.resolveOverlayMeasurementPoint(selection.start);
        const end = this.resolveOverlayMeasurementPoint(selection.end);
        if (!start || !end) {
            return null;
        }
        return {
            paneId: selection.paneId,
            scaleSlotId: selection.scaleSlotId,
            start,
            end,
        };
    }
    computeMeasurementOverlayState() {
        if (!this.overlayInputs.measurementEnabled) {
            return null;
        }
        return {
            enabled: true,
            hoverPoint: this.measurementHoverPoint ? this.resolveOverlayMeasurementPoint(this.measurementHoverPoint) : null,
            draft: this.measurementDraft ? this.resolveOverlayMeasurementSelection(this.measurementDraft) : null,
            committed: this.measurementCommitted ? this.resolveOverlayMeasurementSelection(this.measurementCommitted) : null,
        };
    }
    computeDrawingPriceLabelsState() {
        const selectedPriceLabels = this.overlayInputs.selectedPriceLabels;
        if (!selectedPriceLabels || selectedPriceLabels.visible === false) {
            return null;
        }
        const snapshot = this.paneSnapshots.find((candidate) => candidate.paneId === selectedPriceLabels.paneId);
        if (!snapshot) {
            return null;
        }
        const scaleSlotId = resolvePreferredPriceLabelScaleSlotId(snapshot, selectedPriceLabels.scaleSlotId);
        if (!scaleSlotId) {
            return null;
        }
        const side = snapshot.scaleSlotStates[scaleSlotId]?.side ?? "right";
        const labels = selectedPriceLabels.markers.flatMap((marker) => {
            const y = resolvePanePixelAtValue(snapshot, scaleSlotId, marker.price);
            if (y === null) {
                return [];
            }
            return [{
                    key: marker.key,
                    price: marker.price,
                    y,
                    side: side,
                    fill: selectedPriceLabels.fill,
                    stroke: selectedPriceLabels.stroke,
                    textColor: selectedPriceLabels.textColor,
                }];
        });
        if (labels.length === 0) {
            return null;
        }
        return {
            drawingId: selectedPriceLabels.drawingId,
            paneId: snapshot.paneId,
            scaleSlotId,
            highlighted: selectedPriceLabels.highlighted,
            labels,
        };
    }
    emitPaneSnapshotsIfChanged() {
        const paneSnapshotsKey = JSON.stringify(this.paneSnapshots);
        if (paneSnapshotsKey === this.lastPaneSnapshotsKey) {
            return;
        }
        this.lastPaneSnapshotsKey = paneSnapshotsKey;
        this.emit("panes", {
            paneCount: this.paneSnapshots.length,
            snapshots: this.getPaneSnapshots(),
        });
    }
    syncSnapshotsAndEmit() {
        if (this.paneSnapshots.length === 0) {
            return;
        }
        for (let paneIndex = 0; paneIndex < this.paneSnapshots.length; paneIndex += 1) {
            const snapshot = this.paneSnapshots[paneIndex];
            const paneSpec = this.paneSpecs[paneIndex];
            if (!snapshot || !paneSpec) {
                continue;
            }
            this.applyPaneScaleSlotDomains(paneSpec, snapshot);
        }
        this.emitPaneSnapshotsIfChanged();
    }
    refreshSurface() {
        if (!this.surface || !this.canvas) {
            return;
        }
        const width = Math.max(1, this.container?.clientWidth || DEFAULT_WIDTH);
        const height = Math.max(1, this.container?.clientHeight || DEFAULT_HEIGHT);
        this.canvas.width = width;
        this.canvas.height = height;
        // KF-12-T08: Keep overlay canvas dimensions in sync with main canvas
        if (this.overlayCanvas) {
            this.overlayCanvas.width = width;
            this.overlayCanvas.height = height;
        }
        this.surface.dataset.theme = this.theme.mode;
        this.surface.dataset.locale = this.locale;
        if (this.dataSource?.sourceId) {
            this.surface.dataset.sourceId = this.dataSource.sourceId;
        }
        else {
            delete this.surface.dataset.sourceId;
        }
        this.paneSnapshots = this.paneLayout.layout(this.paneSpecs, width, height - 28);
        for (let paneIndex = 0; paneIndex < this.paneSnapshots.length; paneIndex += 1) {
            const snapshot = this.paneSnapshots[paneIndex];
            const paneSpec = this.paneSpecs[paneIndex];
            if (!snapshot || !paneSpec) {
                continue;
            }
            this.applyPaneScaleSlotDomains(paneSpec, snapshot);
        }
        this.emitOverlayStateIfChanged();
        const context = this.canvas.getContext("2d");
        if (!context) {
            this.emitPaneSnapshotsIfChanged();
            return;
        }
        context.clearRect(0, 0, width, height);
        this.renderPaneSeries(context);
        this.emitPaneSnapshotsIfChanged();
        this.emitOverlayStateIfChanged();
    }
    renderPaneSeries(ctx) {
        for (let paneIndex = 0; paneIndex < this.paneSnapshots.length; paneIndex += 1) {
            const snapshot = this.paneSnapshots[paneIndex];
            const paneSpec = this.paneSpecs[paneIndex];
            if (!snapshot || !paneSpec) {
                continue;
            }
            const plotBounds = snapshot.plotBounds;
            const slotDomains = this.applyPaneScaleSlotDomains(paneSpec, snapshot);
            const leftSlot = paneSpec.scaleSlots.find((slot) => slot.side === "left" && slot.visible);
            const rightSlot = paneSpec.scaleSlots.find((slot) => slot.side === "right" && slot.visible);
            const leftAxis = snapshot.axisBounds.left
                ? {
                    bounds: snapshot.axisBounds.left,
                    domain: leftSlot ? slotDomains.get(leftSlot.id) : undefined,
                }
                : undefined;
            const rightAxis = snapshot.axisBounds.right
                ? {
                    bounds: snapshot.axisBounds.right,
                    domain: rightSlot ? slotDomains.get(rightSlot.id) : undefined,
                }
                : undefined;
            const axisCacheKey = buildAxisGridCacheKey({
                paneId: paneSpec.id,
                leftDomain: leftAxis?.domain,
                rightDomain: rightAxis?.domain,
                themeMode: this.theme.mode,
                width: plotBounds.width + (leftAxis?.bounds.width ?? 0) + (rightAxis?.bounds.width ?? 0),
                height: plotBounds.height,
            });
            this.axisGridCache.renderWithCache(ctx, {
                plotBounds,
                themeMode: this.theme.mode,
                leftAxis,
                rightAxis,
            }, axisCacheKey);
            ctx.save();
            ctx.beginPath();
            ctx.rect(plotBounds.left, plotBounds.top, plotBounds.width, plotBounds.height);
            ctx.clip();
            for (const series of paneSpec.series) {
                if (series.visible === false) {
                    continue;
                }
                if (series.type === "BollingerBand") {
                    this.renderBollingerBandFill(ctx, snapshot, paneSpec, series, plotBounds, slotDomains);
                }
                if (series.type === "RSI" || series.type === "MACD") {
                    this.renderSeriesReferenceLines(ctx, series, plotBounds, slotDomains);
                }
                const visibleBarCount = this.resolveVisibleBarCount();
                // Candlestick series: bypass scalar path, use CandlestickRenderer with OHLCV enrichedData
                if (this.isCandlestickSeries(series)) {
                    this.renderCandlestickSeriesIntoPane(ctx, snapshot, series, plotBounds, slotDomains);
                    continue;
                }
                for (const { spec: subSeries } of this.expandSeriesIntoSubLines(series)) {
                    const values = this.resolveSeriesValues(subSeries);
                    if (values.length === 0) {
                        continue;
                    }
                    const mode = this.resolveSeriesMode(subSeries);
                    const slotDomain = slotDomains.get(subSeries.scaleSlotId)
                        ?? this.createDomainFromSeriesValues(values, mode === "bar");
                    const yScale = this.createYScaleFromDomain(slotDomain, plotBounds.top, plotBounds.height);
                    const bucketProjector = createPaneProjector(snapshot, this.visibleRange, subSeries.scaleSlotId);
                    const { fromIndex } = this.resolveVisibleIndexWindow(this.enrichedData.length);
                    const overlayLodBucketSize = this.resolveScalarOverlayLodBucketSize(paneSpec, subSeries.scaleSlotId, plotBounds.width);
                    if (mode === "bar") {
                        const configuredBarFill = this.resolveConfiguredSeriesColor(subSeries, "fill");
                        const points = this.toBarPoints(values, bucketProjector, fromIndex, configuredBarFill ? undefined : this.resolveDefaultBarPalette(subSeries, values));
                        this.barRenderer.render(ctx, points, {
                            yScale,
                            baselineValue: 0,
                            barWidth: this.resolveBarWidth(visibleBarCount, plotBounds.width),
                            fill: configuredBarFill ?? ((datum) => datum.paletteColor ?? "#6BA583"),
                        });
                        continue;
                    }
                    const points = this.toLineAreaPoints(values, bucketProjector, fromIndex, overlayLodBucketSize);
                    this.lineAreaRenderer.render(ctx, points, {
                        mode,
                        useWebGL: this.options.useWebGL,
                        yScale,
                        baselineValue: undefined,
                        stroke: this.resolveSeriesStroke(subSeries),
                        fill: this.resolveSeriesFill(subSeries),
                        lineWidth: this.resolveSeriesLineWidth(subSeries, visibleBarCount, plotBounds.width),
                    });
                }
            }
            ctx.restore();
            // KF-12-T08: Crosshair moved to refreshOverlay() — no longer rendered on main canvas
        }
    }
    resolveBollingerFillMode(series) {
        const rawMode = series.params?.["fillMode"];
        if (rawMode === "solid" || rawMode === "fade" || rawMode === "none") {
            return rawMode;
        }
        if (rawMode === "gradient") {
            return "fade";
        }
        return "none";
    }
    resolveSeriesFillOpacity(series) {
        const rawOpacity = series.params?.["fillOpacity"];
        if (typeof rawOpacity !== "number") {
            return 0.15;
        }
        return clampUnit(rawOpacity, 0.15);
    }
    resolveSeriesFillBaseColor(series) {
        const rawFillColor = series.params?.["fillColor"];
        if (typeof rawFillColor === "string" && rawFillColor.length > 0) {
            return rawFillColor;
        }
        return this.resolveConfiguredSeriesColor(series, "fill")
            ?? this.resolveConfiguredSeriesColor(series, "stroke")
            ?? "#2962ff";
    }
    renderBollingerBandFill(ctx, snapshot, paneSpec, series, plotBounds, slotDomains) {
        const fillMode = this.resolveBollingerFillMode(series);
        if (fillMode === "none") {
            return;
        }
        const upperValues = this.resolveSeriesValues({ ...series, type: "BollingerBand.upper" });
        const lowerValues = this.resolveSeriesValues({ ...series, type: "BollingerBand.lower" });
        if (upperValues.length === 0 || lowerValues.length === 0) {
            return;
        }
        const combinedValues = [...upperValues, ...lowerValues].filter(Number.isFinite);
        if (combinedValues.length === 0) {
            return;
        }
        const slotDomain = slotDomains.get(series.scaleSlotId)
            ?? this.createDomainFromSeriesValues(combinedValues, false);
        const yScale = this.createYScaleFromDomain(slotDomain, plotBounds.top, plotBounds.height);
        const bucketProjector = createPaneProjector(snapshot, this.visibleRange, series.scaleSlotId);
        const { fromIndex } = this.resolveVisibleIndexWindow(this.enrichedData.length);
        const overlayLodBucketSize = this.resolveScalarOverlayLodBucketSize(paneSpec, series.scaleSlotId, plotBounds.width);
        const upperPoints = this.toLineAreaPoints(upperValues, bucketProjector, fromIndex, overlayLodBucketSize)
            .map((point) => ({ x: point.x, y: yScale(point.value) }));
        const lowerPoints = this.toLineAreaPoints(lowerValues, bucketProjector, fromIndex, overlayLodBucketSize)
            .map((point) => ({ x: point.x, y: yScale(point.value) }));
        if (upperPoints.length < 2 || lowerPoints.length < 2) {
            return;
        }
        const fillOpacity = this.resolveSeriesFillOpacity(series);
        const baseColor = this.resolveSeriesFillBaseColor(series);
        const fillStyle = fillMode === "fade"
            ? (() => {
                let minY = plotBounds.top;
                let maxY = plotBounds.top + plotBounds.height;
                if (upperPoints.length > 0 && lowerPoints.length > 0) {
                    minY = Math.min(...upperPoints.map((p) => p.y));
                    maxY = Math.max(...lowerPoints.map((p) => p.y));
                }
                const gradient = ctx.createLinearGradient(0, minY, 0, maxY);
                gradient.addColorStop(0, withAlpha(baseColor, 0));
                gradient.addColorStop(0.5, withAlpha(baseColor, fillOpacity));
                gradient.addColorStop(1, withAlpha(baseColor, 0));
                return gradient;
            })()
            : withAlpha(baseColor, fillOpacity);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(upperPoints[0].x, upperPoints[0].y);
        for (let index = 1; index < upperPoints.length; index += 1) {
            ctx.lineTo(upperPoints[index].x, upperPoints[index].y);
        }
        for (let index = lowerPoints.length - 1; index >= 0; index -= 1) {
            ctx.lineTo(lowerPoints[index].x, lowerPoints[index].y);
        }
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.restore();
    }
    renderSeriesReferenceLines(ctx, series, plotBounds, slotDomains) {
        const slotDomain = slotDomains.get(series.scaleSlotId);
        if (!slotDomain) {
            return;
        }
        const yScale = this.createYScaleFromDomain(slotDomain, plotBounds.top, plotBounds.height);
        if (series.type === "RSI") {
            const levels = [
                { value: 70, key: "overbought", defaultColor: "#f23645", dash: true },
                { value: 50, key: "middle", defaultColor: "#9ca3af", dash: true },
                { value: 30, key: "oversold", defaultColor: "#089981", dash: true },
            ];
            ctx.save();
            for (const level of levels) {
                const y = yScale(level.value);
                if (y >= plotBounds.top && y <= plotBounds.top + plotBounds.height) {
                    ctx.strokeStyle = series.style?.subColors?.[level.key] ?? level.defaultColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    if (level.dash) {
                        ctx.setLineDash([4, 4]);
                    }
                    else {
                        ctx.setLineDash([]);
                    }
                    ctx.moveTo(plotBounds.left, y);
                    ctx.lineTo(plotBounds.left + plotBounds.width, y);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        else if (series.type === "MACD") {
            const y = yScale(0);
            if (y >= plotBounds.top && y <= plotBounds.top + plotBounds.height) {
                ctx.save();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(plotBounds.left, y);
                ctx.lineTo(plotBounds.left + plotBounds.width, y);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    applyPaneScaleSlotDomains(pane, snapshot) {
        const slotDomains = this.computePaneScaleSlotDomains(pane);
        for (const slot of pane.scaleSlots) {
            const domain = slotDomains.get(slot.id);
            if (!domain) {
                continue;
            }
            snapshot.scaleSlotStates[slot.id] = {
                ...(snapshot.scaleSlotStates[slot.id] ?? {
                    side: slot.side,
                    mode: slot.mode,
                    visible: slot.visible,
                }),
                domain,
            };
        }
        return slotDomains;
    }
    /**
     * KF-12-T08: Repaint the overlay canvas (drawing primitives + crosshair).
     * Called when DirtyFlag.OVERLAY is set. Does NOT touch the main canvas.
     */
    refreshOverlay() {
        if (!this.overlayCanvas)
            return;
        const width = Math.max(1, this.container?.clientWidth || DEFAULT_WIDTH);
        const height = Math.max(1, this.container?.clientHeight || DEFAULT_HEIGHT);
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        const ctx = this.overlayCanvas.getContext("2d");
        if (!ctx)
            return;
        const overlayState = this.computeOverlayState();
        this.overlayState = overlayState;
        ctx.clearRect(0, 0, width, height);
        for (const snapshot of this.paneSnapshots) {
            const { plotBounds } = snapshot;
            const panePrimitives = overlayState.drawingPrimitives.filter((primitive) => primitive.paneId === snapshot.paneId);
            const clippedPrimitives = panePrimitives.filter((primitive) => primitive.clipToPane !== false);
            const unclippedPrimitives = panePrimitives.filter((primitive) => primitive.clipToPane === false);
            if (clippedPrimitives.length > 0) {
                ctx.save();
                ctx.translate(plotBounds.left, plotBounds.top);
                ctx.beginPath();
                ctx.rect(0, 0, plotBounds.width, plotBounds.height);
                ctx.clip();
                for (const primitive of clippedPrimitives) {
                    try {
                        renderOverlayPrimitiveToCanvas(ctx, primitive.primitive, {
                            chartWidth: plotBounds.width,
                            chartHeight: plotBounds.height,
                            isSelected: primitive.selected,
                        });
                    }
                    catch (e) {
                        console.error(`Failed to render clipped primitive of type ${primitive.primitive.type}:`, e);
                    }
                }
                ctx.restore();
            }
            if (unclippedPrimitives.length > 0) {
                ctx.save();
                ctx.translate(plotBounds.left, plotBounds.top);
                for (const primitive of unclippedPrimitives) {
                    try {
                        renderOverlayPrimitiveToCanvas(ctx, primitive.primitive, {
                            chartWidth: plotBounds.width,
                            chartHeight: plotBounds.height,
                            isSelected: primitive.selected,
                        });
                    }
                    catch (e) {
                        console.error(`Failed to render unclipped primitive of type ${primitive.primitive.type}:`, e);
                    }
                }
                ctx.restore();
            }
            const position = this.crosshairPos
                && this.crosshairPos.y >= plotBounds.top
                && this.crosshairPos.y <= plotBounds.top + plotBounds.height
                ? this.crosshairPos
                : null;
            this.crosshairRenderer.render(ctx, {
                plotBounds,
                position,
                themeMode: this.theme.mode,
            });
        }
        this.emitOverlayStateIfChanged();
    }
    computePaneScaleSlotDomains(pane) {
        const aggregates = new Map();
        for (const series of pane.series) {
            if (series.visible === false) {
                continue;
            }
            // Candlestick domain: use high/low values from enrichedData (not close scalar)
            if (this.isCandlestickSeries(series)) {
                const rawDomain = this.resolveCandlestickRawDomain(this.resolveCandlestickData());
                // Skip when enrichedData is empty — overlay indicators (EMA/BB) will drive the slot domain
                if (rawDomain !== null) {
                    const current = aggregates.get(series.scaleSlotId);
                    if (!current) {
                        aggregates.set(series.scaleSlotId, { min: rawDomain[0], max: rawDomain[1], hasBarSeries: false });
                    }
                    else {
                        current.min = Math.min(current.min, rawDomain[0]);
                        current.max = Math.max(current.max, rawDomain[1]);
                    }
                }
                continue;
            }
            for (const { spec: subSeries } of this.expandSeriesIntoSubLines(series)) {
                const values = this.resolveSeriesValues(subSeries);
                if (values.length === 0) {
                    continue;
                }
                const finiteValues = values.filter((value) => Number.isFinite(value));
                if (finiteValues.length === 0) {
                    continue;
                }
                const mode = this.resolveSeriesMode(subSeries);
                const domain = this.createDomainFromSeriesValues(finiteValues, mode === "bar");
                const current = aggregates.get(subSeries.scaleSlotId);
                if (!current) {
                    aggregates.set(subSeries.scaleSlotId, {
                        min: domain[0],
                        max: domain[1],
                        hasBarSeries: mode === "bar",
                    });
                    continue;
                }
                current.min = Math.min(current.min, domain[0]);
                current.max = Math.max(current.max, domain[1]);
                current.hasBarSeries = current.hasBarSeries || mode === "bar";
            }
        }
        const domains = new Map();
        for (const slot of pane.scaleSlots) {
            const customDomain = this.customSlotDomains.get(slot.id);
            if (customDomain) {
                domains.set(slot.id, customDomain);
                continue;
            }
            const aggregate = aggregates.get(slot.id);
            if (aggregate) {
                domains.set(slot.id, this.padDomain([aggregate.min, aggregate.max], aggregate.hasBarSeries));
                continue;
            }
            if (slot.domain) {
                domains.set(slot.id, [...slot.domain]);
            }
        }
        return domains;
    }
    createDomainFromSeriesValues(values, includeZeroFloor) {
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const min = includeZeroFloor ? Math.min(0, minValue) : minValue;
        return [min, maxValue];
    }
    padDomain(domain, includeZeroFloor) {
        const [rawMin, rawMax] = domain;
        const min = Math.min(rawMin, rawMax);
        const max = Math.max(rawMin, rawMax);
        const range = Math.max(1e-6, max - min);
        const paddedMin = includeZeroFloor ? min : min - range * 0.05;
        const paddedMax = max + range * 0.05;
        if (paddedMin === paddedMax) {
            const delta = Math.max(1, Math.abs(paddedMax) * 0.01);
            return [paddedMin - delta, paddedMax + delta];
        }
        return [paddedMin, paddedMax];
    }
    /** Returns true for series types rendered via CandlestickRenderer (not the scalar line/bar path) */
    isCandlestickSeries(series) {
        const t = series.type;
        return t === "Candlestick" || t === "HeikinAshi" || t === "HollowCandle" || t === "Hollow" || t === "OHLC";
    }
    /**
     * Extract OHLCV slice from enrichedData by visibleRange.
     * Returns CandlestickDatum[] with x = bar index within the slice.
     */
    resolveCandlestickData() {
        if (this.enrichedData.length === 0)
            return [];
        const { fromIndex, toIndexExclusive } = this.resolveVisibleIndexWindow(this.enrichedData.length);
        const sliced = this.enrichedData.slice(fromIndex, toIndexExclusive);
        const result = [];
        for (let i = 0; i < sliced.length; i++) {
            const d = sliced[i];
            const open = typeof d["open"] === "number" && Number.isFinite(d["open"]) ? d["open"] : null;
            const high = typeof d["high"] === "number" && Number.isFinite(d["high"]) ? d["high"] : null;
            const low = typeof d["low"] === "number" && Number.isFinite(d["low"]) ? d["low"] : null;
            const close = typeof d["close"] === "number" && Number.isFinite(d["close"]) ? d["close"] : null;
            if (open === null || high === null || low === null || close === null)
                continue;
            result.push({ x: fromIndex + i, open, high, low, close });
        }
        return result;
    }
    /** Returns raw [minLow, maxHigh] across provided OHLCV bars, or null when empty. */
    resolveCandlestickRawDomain(data) {
        if (data.length === 0)
            return null;
        let minLow = Infinity;
        let maxHigh = -Infinity;
        for (const d of data) {
            if (d.low < minLow)
                minLow = d.low;
            if (d.high > maxHigh)
                maxHigh = d.high;
        }
        return [minLow, maxHigh];
    }
    resolveCandlestickLodDomain(data) {
        const rawDomain = this.resolveCandlestickRawDomain(data);
        return rawDomain !== null ? this.padDomain(rawDomain, false) : null;
    }
    /**
     * Render a candlestick series. Called from renderPaneSeries when isCandlestickSeries is true.
     * Reads OHLCV from enrichedData (sliced by visibleRange) and delegates to CandlestickRenderer.
     */
    renderCandlestickSeriesIntoPane(ctx, snapshot, series, plotBounds, slotDomains) {
        const cacheKey = `${snapshot.paneId}:${series.id ?? series.type}:${series.scaleSlotId}`;
        const cached = this.lastCandlestickRenderCache.get(cacheKey);
        const data = this.resolveCandlestickData();
        const rawDomain = this.resolveCandlestickRawDomain(data);
        const domain = slotDomains.get(series.scaleSlotId) ?? (rawDomain !== null ? this.padDomain(rawDomain, false) : null) ?? cached?.domain ?? null;
        if (!domain)
            return;
        const yScale = this.createYScaleFromDomain(domain, plotBounds.top, plotBounds.height);
        const visibleCount = this.resolveVisibleBarCount();
        const barStep = plotBounds.width / visibleCount;
        const candleWidthRatio = this.resolveSeriesCandleWidthRatio(series);
        const maxBarWidth = Math.max(1, barStep * 0.95);
        const barWidth = Math.min(Math.max(1, barStep * candleWidthRatio), maxBarWidth);
        const strokeWidth = this.resolveSeriesLineWidth(series, visibleCount, plotBounds.width);
        let lodBucketSize = 1;
        let lodData = [];
        let lodRequestKey = null;
        let fromWorker = false;
        if (data.length > 0) {
            lodBucketSize = chooseLodBucketSize(plotBounds.width, data.length);
            const lodResolution = this.candlestickLodWorkerLane.resolve(this.lastCandlestickRenderCache, cacheKey, data, lodBucketSize);
            lodRequestKey = lodResolution.requestKey;
            fromWorker = lodResolution.fromWorker;
            lodData = lodResolution.lodData
                ?? (lodBucketSize > 1
                    ? toCandlestickLodData(aggregateOhlc(toCandlestickLodWorkerInput(data), lodBucketSize))
                    : data);
        }
        else if (cached) {
            lodBucketSize = cached.lodBucketSize;
            lodData = cached.lodData;
        }
        if (lodData.length === 0)
            return;
        const bucketProjector = createPaneProjector(snapshot, this.visibleRange, series.scaleSlotId);
        const lodBarWidth = lodBucketSize > 1 ? Math.min(Math.max(1, barStep * lodBucketSize * 0.95), plotBounds.width) : barWidth;
        const modeMap = { Hollow: "hollow", HollowCandle: "hollow", OHLC: "ohlc" };
        const mode = modeMap[series.type] ?? "candlestick";
        this.candlestickRenderer.render(ctx, lodData, {
            yScale,
            xAccessor: (datum) => bucketProjector.indexToPixelX(datum.x + lodBucketSize * 0.5) ?? plotBounds.left,
            barWidth: lodBarWidth,
            strokeWidth,
            mode,
        });
        this.lastCandlestickRenderCache.set(cacheKey, {
            lodData,
            lodBucketSize,
            domain,
            requestKey: lodRequestKey,
            lodSource: fromWorker ? "worker" : "sync",
        });
    }
    resolveSeriesMode(series) {
        const type = series.type.toLowerCase();
        if (type === "area") {
            return "area";
        }
        if (type.includes("volume")
            || type.includes("bar")
            || type.includes("histogram")
            || type === "macd"
            || type === "whale"
            || type.includes("cvd")) {
            return "bar";
        }
        const asArea = typeof series.style?.["asArea"] === "boolean"
            ? Boolean(series.style["asArea"])
            : false;
        return asArea ? "area" : "line";
    }
    /**
     * Expand a single SeriesSpec into one or more sub-series for multi-line indicators.
     * Each entry has a resolved spec (with type pointing to the sub-line key) and a subKey label.
     * For non-multi-line types, returns a single entry with the original spec.
     *
     * Handled types:
     *   BollingerBand ΓåÆ upper / middle / lower
     *   MACD          ΓåÆ divergence bars / signal line / MACD line
     *   KDJ           ΓåÆ K / D / J lines
     */
    expandSeriesIntoSubLines(series) {
        switch (series.type) {
            case "BollingerBand":
                return [
                    { spec: { ...series, type: "BollingerBand.upper" }, subKey: "upper" },
                    { spec: { ...series }, subKey: null }, // middle (main)
                    { spec: { ...series, type: "BollingerBand.lower" }, subKey: "lower" },
                ];
            case "MACD":
                return [
                    { spec: { ...series }, subKey: null }, // divergence bars
                    {
                        spec: { ...series, type: "MACD.signal", style: { ...series.style, asArea: false } },
                        subKey: "signal",
                    },
                    {
                        spec: { ...series, type: "MACD.macd", style: { ...series.style, asArea: false } },
                        subKey: "macd",
                    },
                ];
            case "KDJ":
                return [
                    { spec: { ...series }, subKey: null }, // K (main)
                    { spec: { ...series, type: "KDJ.D" }, subKey: "d" },
                    { spec: { ...series, type: "KDJ.J" }, subKey: "j" },
                ];
            default:
                return [{ spec: series, subKey: null }];
        }
    }
    resolveSeriesValues(series) {
        const missingValueFallback = this.resolveMissingSeriesValueFallback(series);
        const isDerivedSubSeries = series.type.includes(".");
        // Priority 1: runtime dataSource injection — highest precedence
        // Slice by visibleRange so pan/zoom changes what is rendered.
        // IMPORTANT: anchor runtime series to global candle indices so indicator X scale
        // cannot drift when runtime series length is shorter/sparser than enrichedData.
        const runtimeSeriesData = !isDerivedSubSeries ? this.dataSource?.seriesData?.[series.id] : undefined;
        if (Array.isArray(runtimeSeriesData) && runtimeSeriesData.length > 0) {
            const windowLength = this.enrichedData.length > 0
                ? this.enrichedData.length
                : runtimeSeriesData.length;
            const runtimeWindow = this.resolveVisibleIndexWindow(windowLength);
            const values = [];
            for (let globalIndex = runtimeWindow.fromIndex; globalIndex < runtimeWindow.toIndexExclusive; globalIndex += 1) {
                const value = runtimeSeriesData[globalIndex];
                if (typeof value === "number" && Number.isFinite(value)) {
                    values.push(value);
                    continue;
                }
                values.push(missingValueFallback);
            }
            if (values.some(Number.isFinite)) {
                return values;
            }
        }
        // Priority 2: enrichedData + params-aware accessor (KF-10) → INDICATOR_ACCESSORS fallback
        if (this.enrichedData.length > 0) {
            const window = this.resolveVisibleIndexWindow(this.enrichedData.length);
            const paramsAwareAccessor = getAccessorFor(series.type, series.params);
            const fallbackAccessor = INDICATOR_ACCESSORS[series.type];
            const accessors = [
                paramsAwareAccessor,
                paramsAwareAccessor !== fallbackAccessor ? fallbackAccessor : undefined,
            ].filter((accessor) => typeof accessor === "function");
            if (accessors.length > 0) {
                const slice = this.enrichedData.slice(window.fromIndex, window.toIndexExclusive);
                for (const accessor of accessors) {
                    const rawVals = slice.map(accessor);
                    if (rawVals.some((value) => typeof value === "number" && Number.isFinite(value))) {
                        return rawVals.map((value) => typeof value === "number" && Number.isFinite(value) ? value : missingValueFallback);
                    }
                }
            }
        }
        // Priority 3: sampleValues fallback (demo-only)
        const sampleValues = series.params?.["sampleValues"];
        if (Array.isArray(sampleValues)) {
            return sampleValues
                .map((value) => (typeof value === "number" ? value : Number.NaN))
                .filter(Number.isFinite);
        }
        return [];
    }
    resolveMissingSeriesValueFallback(series) {
        return this.resolveSeriesMode(series) === "bar" ? 0 : Number.NaN;
    }
    resolveScalarOverlayLodBucketSize(pane, scaleSlotId, plotWidth) {
        if (this.enrichedData.length === 0) {
            return 1;
        }
        const sharesCandlestickLane = pane.series.some((series) => (series.visible !== false
            && series.scaleSlotId === scaleSlotId
            && this.isCandlestickSeries(series)));
        if (!sharesCandlestickLane) {
            return 1;
        }
        const window = this.resolveVisibleIndexWindow(this.enrichedData.length);
        return chooseLodBucketSize(plotWidth, Math.max(1, window.toIndexExclusive - window.fromIndex));
    }
    resolveRepresentativeBucketValue(values, bucketStart, bucketEnd, bucketSize) {
        const bucketCenter = bucketStart + bucketSize / 2;
        let bestDistance = Number.POSITIVE_INFINITY;
        let matchedValueSum = 0;
        let matchedValueCount = 0;
        for (let index = bucketStart; index < bucketEnd; index += 1) {
            const value = values[index];
            if (!Number.isFinite(value)) {
                continue;
            }
            const distance = Math.abs(index + 0.5 - bucketCenter);
            if (distance < bestDistance - 1e-9) {
                bestDistance = distance;
                matchedValueSum = value;
                matchedValueCount = 1;
                continue;
            }
            if (Math.abs(distance - bestDistance) <= 1e-9) {
                matchedValueSum += value;
                matchedValueCount += 1;
            }
        }
        return matchedValueCount > 0
            ? matchedValueSum / matchedValueCount
            : Number.NaN;
    }
    toLineAreaPoints(values, bucketProjector, fromIndex, bucketSize = 1) {
        if (values.length === 0) {
            return [];
        }
        if (bucketSize > 1) {
            const points = [];
            for (let bucketStart = 0; bucketStart < values.length; bucketStart += bucketSize) {
                const bucketEnd = Math.min(values.length, bucketStart + bucketSize);
                const value = this.resolveRepresentativeBucketValue(values, bucketStart, bucketEnd, bucketSize);
                if (!Number.isFinite(value)) {
                    continue;
                }
                const x = bucketProjector.indexToPixelX(fromIndex + bucketStart + bucketSize / 2);
                if (x === null) {
                    continue;
                }
                points.push({
                    x,
                    value,
                });
            }
            return points;
        }
        if (values.length === 1) {
            const centerX = bucketProjector.indexToPixelX(fromIndex + 0.5);
            return Number.isFinite(values[0])
                ? [{ x: centerX ?? 0, value: values[0] }]
                : [];
        }
        const points = [];
        for (let index = 0; index < values.length; index += 1) {
            const value = values[index];
            if (!Number.isFinite(value)) {
                continue;
            }
            const x = bucketProjector.indexToPixelX(fromIndex + index + 0.5);
            if (x === null) {
                continue;
            }
            points.push({
                x,
                value,
            });
        }
        return points;
    }
    toBarPoints(values, bucketProjector, fromIndex, palette) {
        const points = [];
        for (let index = 0; index < values.length; index += 1) {
            const value = values[index];
            if (!Number.isFinite(value)) {
                continue;
            }
            const x = bucketProjector.indexToPixelX(fromIndex + index + 0.5);
            if (x === null) {
                continue;
            }
            points.push({
                x,
                value,
                paletteColor: palette?.[index],
            });
        }
        return points;
    }
    resolveBarWidth(count, width) {
        const step = width / Math.max(1, count);
        return Math.max(1, step * 0.8);
    }
    resolveVisibleBarCount() {
        const { from, to } = this.visibleRange;
        return Math.max(1, Math.ceil(Math.abs(to - from)));
    }
    resolveVisibleIndexWindow(maxLength = this.enrichedData.length) {
        const lower = Math.min(this.visibleRange.from, this.visibleRange.to);
        const upper = Math.max(this.visibleRange.from, this.visibleRange.to);
        const boundedLength = Math.max(0, maxLength);
        const fromIndex = Math.max(0, Math.min(boundedLength, Math.floor(lower)));
        let toIndexExclusive = Math.max(fromIndex, Math.min(boundedLength, Math.ceil(upper)));
        if (toIndexExclusive === fromIndex && boundedLength > fromIndex) {
            toIndexExclusive = Math.min(boundedLength, fromIndex + 1);
        }
        const span = Math.max(1, toIndexExclusive - fromIndex);
        return { fromIndex, toIndexExclusive, span };
    }
    createYScaleFromDomain(domain, top, height) {
        const [min, max] = domain;
        const normalizedMin = Math.min(min, max);
        const normalizedMax = Math.max(min, max);
        const span = Math.max(1e-6, normalizedMax - normalizedMin);
        return (value) => {
            const ratio = (value - normalizedMin) / span;
            return top + height - ratio * height;
        };
    }
    resolveSeriesStroke(series) {
        return this.resolveConfiguredSeriesColor(series, "stroke") ?? "#2962ff";
    }
    resolveSeriesFill(series) {
        const fill = this.resolveConfiguredSeriesColor(series, "fill");
        if (fill) {
            return fill;
        }
        return this.resolveSeriesMode(series) === "bar"
            ? "#6BA583"
            : "rgba(41,98,255,0.2)";
    }
    resolveSeriesLineWidth(series, visibleCount, plotWidth) {
        const style = this.resolveSeriesStyle(series);
        const lineWidth = style.lineWidth;
        const baseLineWidth = typeof lineWidth === "number" && Number.isFinite(lineWidth)
            ? Math.max(1, lineWidth)
            : 2;
        const zoomScale = this.resolveZoomLineWidthScale(visibleCount, plotWidth);
        return Math.max(1, baseLineWidth * zoomScale);
    }
    resolveZoomLineWidthScale(visibleCount, plotWidth) {
        const safeCount = Math.max(1, visibleCount);
        const stepPx = plotWidth / safeCount;
        if (!Number.isFinite(stepPx) || stepPx <= 0) {
            return 1;
        }
        const scaled = Math.sqrt(stepPx / 28);
        return Math.max(0.7, Math.min(1.6, scaled));
    }
    resolveSeriesCandleWidthRatio(series) {
        const raw = series.params?.["candleWidthRatio"];
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
            return 0.8;
        }
        return Math.max(0.2, Math.min(1.2, raw));
    }
    resolveConfiguredSeriesColor(series, channel) {
        const style = this.resolveSeriesStyle(series);
        const direct = style[channel];
        if (typeof direct === "string" && direct.length > 0) {
            return direct;
        }
        const subColorKey = this.resolveSeriesSubColorKey(series.type);
        const subColors = style.subColors;
        if (subColorKey && subColors && typeof subColors === "object") {
            const subColor = subColors[subColorKey];
            if (typeof subColor === "string" && subColor.length > 0) {
                return subColor;
            }
        }
        const color = style.color;
        if (typeof color === "string" && color.length > 0) {
            return color;
        }
        return this.resolveDefaultSeriesSubColor(series.type, channel);
    }
    resolveDefaultSeriesSubColor(seriesType, channel) {
        if (channel !== "stroke") {
            return undefined;
        }
        switch (seriesType) {
            case "MACD.signal":
                return "#f59e0b";
            case "MACD.macd":
                return "#2962ff";
            default:
                return undefined;
        }
    }
    resolveSeriesStyle(series) {
        return series.style && typeof series.style === "object"
            ? series.style
            : {};
    }
    resolveSeriesSubColorKey(seriesType) {
        switch (seriesType) {
            case "BollingerBand":
                return "middle";
            case "BollingerBand.upper":
                return "top";
            case "BollingerBand.lower":
                return "bottom";
            case "MACD":
                return "diverge";
            case "MACD.signal":
                return "signal";
            case "MACD.macd":
                return "macd";
            case "KDJ":
                return "k";
            case "KDJ.D":
                return "d";
            case "KDJ.J":
                return "j";
            default:
                return null;
        }
    }
    resolveDefaultBarPalette(series, values) {
        if (series.type === "Volume") {
            const { fromIndex, toIndexExclusive } = this.resolveVisibleIndexWindow(this.enrichedData.length);
            const visibleBars = this.enrichedData.slice(fromIndex, toIndexExclusive);
            return values.map((_, index) => {
                const datum = visibleBars[index];
                const open = typeof datum?.open === "number" ? datum.open : Number.NaN;
                const close = typeof datum?.close === "number" ? datum.close : Number.NaN;
                return Number.isFinite(open) && Number.isFinite(close) && close < open
                    ? "#FF0000"
                    : "#6BA583";
            });
        }
        if (this.resolveSeriesMode(series) === "bar") {
            return values.map((value) => value < 0 ? "#FF0000" : "#6BA583");
        }
        return undefined;
    }
}
