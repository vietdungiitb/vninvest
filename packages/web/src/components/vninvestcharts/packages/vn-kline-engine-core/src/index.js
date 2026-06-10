import { KernelEngine } from "./engine/KernelEngine.js";
// ── KF-03: Indicator kernel ───────────────────────────────────────────────────
export { buildIndicatorSeriesKey, buildIndicatorSeriesKeyString, indicatorSeriesKeysEqual, indicatorSeriesKeyToString, normalizeIndicatorParams, } from "./indicator/indicatorSeriesKey.js";
export { _clearCatalogForTests, getDefaultIndicatorParams, listIndicators, lookupIndicator, registerIndicator, registerIndicators, resolveIndicatorParams, } from "./indicator/indicatorCatalog.js";
export { CanonicalSeriesStore, createCanonicalSeriesStore, globalCanonicalSeriesStore, } from "./indicator/canonicalSeriesStore.js";
// ── Pane kernel ───────────────────────────────────────────────────────────────
export { clonePaneRuntimeSnapshot, PaneLayoutEngine, } from "./pane/PaneLayoutEngine.js";
export { resolvePaneDataIndexAtPixel, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, resolvePaneValueAtPixel, } from "./coordinates/coordinateBridge.js";
export { createPaneProjector } from "./coordinates/paneProjector.js";
export { createDateTimeIndexMap, createTimeIndexMap, } from "./coordinates/timeIndexMap.js";
export { renderOverlayPrimitiveToCanvas, } from "./overlay/canvasOverlayRenderer.js";
export { hitTestOverlayPrimitive, isOverlayPrimitiveHitTestSupported, } from "./overlay/canvasOverlayHitTest.js";
export { findNearestOverlayEndpointSnap, MAGNET_TOLERANCE, } from "./overlay/canvasOverlaySnap.js";
export { measurementPointToPixelFromScales, resolveMeasurementPointFromValues, summarizeMeasurement, } from "./overlay/canvasMeasurement.js";
export { deleteDrawingGroup, resolveDrawingGroupMemberIds, } from "./overlay/canvasGroupOps.js";
export { createPaneSpecFromDescriptor, createPaneSpecsFromDescriptors, } from "./bridge/paneDescriptorBridge.js";
export { CandlestickRenderer, } from "./canvas/CandlestickRenderer.js";
export { LineAreaRenderer, } from "./canvas/LineAreaRenderer.js";
export { BarRenderer, } from "./canvas/BarRenderer.js";
export { WebGLLineRenderer, } from "./canvas/WebGLLineRenderer.js";
export { AxisGridRenderer, } from "./canvas/AxisGridRenderer.js";
export { KernelEngine } from "./engine/KernelEngine.js";
export { UPSTREAM_BASELINE } from "./upstream.js";
// ── KF-SSOT: Indicator accessor map ──────────────────────────────────────────
export { INDICATOR_ACCESSORS, buildIndicatorValuesKey, getAccessorFor } from "./engine/indicatorAccessors.js";
// ── KF-08: Interactive features ───────────────────────────────────────────────
export { InteractionController, createInteractionCommand } from "./interaction/InteractionController.js";
export { CrosshairRenderer } from "./canvas/CrosshairRenderer.js";
export { AxisGridRenderCache, buildAxisGridCacheKey } from "./canvas/AxisGridRenderCache.js";
export function createEngine(options) {
    return new KernelEngine(options);
}
export const version = "0.0.1-kf.1";
