/**
 * KF-12-T07: Dirty-reason scheduler
 *
 * Invalidation flags for the layered render pipeline.
 * A set bit indicates that layer needs to be redrawn in the next frame.
 *
 * Bit layout:
 *   bit 0 — OVERLAY : crosshair and hover labels
 *   bit 1 — PLOT    : candles, volume, indicator series
 *   bit 2 — AXIS    : x/y axis labels and tick marks
 *   bit 3 — GRID    : background grid lines (changes only on layout/theme/resize)
 */
// eslint-disable-next-line no-restricted-syntax
export var DirtyFlag;
(function (DirtyFlag) {
    DirtyFlag[DirtyFlag["NONE"] = 0] = "NONE";
    DirtyFlag[DirtyFlag["OVERLAY"] = 1] = "OVERLAY";
    DirtyFlag[DirtyFlag["PLOT"] = 2] = "PLOT";
    DirtyFlag[DirtyFlag["AXIS"] = 4] = "AXIS";
    DirtyFlag[DirtyFlag["GRID"] = 8] = "GRID";
    DirtyFlag[DirtyFlag["FULL"] = 15] = "FULL";
})(DirtyFlag || (DirtyFlag = {}));
