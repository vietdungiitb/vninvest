/**
 * CE21-DT1 — Action Handles: unit tests DTP-01 → DTP-08
 *
 * Covers: hitTestActionHandles, getDrawingBoundingBox, renderDrawingActionHandles
 */
import { describe, expect, it, vi } from "vitest";
import { hitTestActionHandles, getDrawingBoundingBox, ACTION_HANDLE_RADIUS, } from "./hitTest";
import { renderDrawingActionHandles } from "./renderCanvas";
// ── helpers ────────────────────────────────────────────────────────────────────
/** Minimal ChartScales where x is identity via timestamp (ms) and y is identity. */
function makeScales() {
    return {
        xScale: (d) => d.getTime(),
        xScaleInvert: (px) => new Date(px),
        yScale: (y) => y,
        yScaleInvert: (px) => px,
        plotData: [],
    };
}
function makeTrendLine(x0, y0, x1, y1) {
    const now = Date.now();
    return {
        id: "test-line",
        type: "trendLine",
        points: [{ x: x0, y: y0 }, { x: x1, y: y1 }],
        style: { stroke: "#ff0000", strokeWidth: 1 },
        createdAt: now,
        updatedAt: now,
    };
}
function makeHLine(y) {
    const now = Date.now();
    return {
        id: "test-hline",
        type: "hLine",
        points: [{ x: 0, y }],
        style: { stroke: "#ff0000", strokeWidth: 1 },
        createdAt: now,
        updatedAt: now,
    };
}
function makeVLine(x) {
    const now = Date.now();
    return {
        id: "test-vline",
        type: "vLine",
        points: [{ x, y: 0 }],
        style: { stroke: "#ff0000", strokeWidth: 1 },
        createdAt: now,
        updatedAt: now,
    };
}
function makeCircle(centerX, centerY, edgeX, edgeY) {
    const now = Date.now();
    return {
        id: "test-circle",
        type: "circle",
        points: [{ x: centerX, y: centerY }, { x: edgeX, y: edgeY }],
        style: { stroke: "#3b82f6", strokeWidth: 1 },
        createdAt: now,
        updatedAt: now,
    };
}
// ── DTP-01: delete handle hit within mouse tolerance ──────────────────────────
describe("DTP-01 — hitTestActionHandles: mouse click on delete handle returns 'delete'", () => {
    it("returns 'delete' when mouse is within radius of delete handle", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        // bounding box: minX=50, maxX=200, minY=100, maxY=200
        // delete handle at (200+14, 100-14) = (214, 86)
        const result = hitTestActionHandles(214, 86, drawing, scales, "mouse");
        expect(result).toBe("delete");
    });
    it("returns 'delete' when pointer is at edge of hit radius for mouse", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        const deleteX = 200 + 14;
        const deleteY = 100 - 14;
        // hit radius = ACTION_HANDLE_RADIUS.mouse + 4 = 8 + 4 = 12
        const hitRadius = ACTION_HANDLE_RADIUS.mouse + 4;
        const result = hitTestActionHandles(deleteX + hitRadius, deleteY, drawing, scales, "mouse");
        expect(result).toBe("delete");
    });
});
// ── DTP-02: delete handle hit within touch tolerance ─────────────────────────
describe("DTP-02 — hitTestActionHandles: touch tap on delete handle within touch tolerance", () => {
    it("returns 'delete' for touch device with larger radius", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        const deleteX = 200 + 14;
        const deleteY = 100 - 14;
        // touch hit radius = 12 + 4 = 16, test at 14px away (within touch, outside mouse)
        const result = hitTestActionHandles(deleteX + 14, deleteY, drawing, scales, "touch");
        expect(result).toBe("delete");
    });
});
// ── DTP-03: miss case — pointer too far away returns null ─────────────────────
describe("DTP-03 — hitTestActionHandles: pointer too far returns null", () => {
    it("returns null when pointer is 30px away from all handles", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        // far away from all handle positions
        const result = hitTestActionHandles(0, 0, drawing, scales, "mouse");
        expect(result).toBeNull();
    });
    it("returns null for empty drawing", () => {
        const drawing = {
            ...makeTrendLine(50, 100, 200, 200),
            points: [],
        };
        const scales = makeScales();
        const result = hitTestActionHandles(0, 0, drawing, scales, "mouse");
        expect(result).toBeNull();
    });
});
// ── DTP-04: clone handle ──────────────────────────────────────────────────────
describe("DTP-04 — hitTestActionHandles: clone handle", () => {
    it("returns 'clone' when mouse is over clone handle", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        // clone handle at (200+32, 100-14) = (232, 86)
        const result = hitTestActionHandles(232, 86, drawing, scales, "mouse");
        expect(result).toBe("clone");
    });
});
// ── DTP-05: lock handle ───────────────────────────────────────────────────────
describe("DTP-05 — hitTestActionHandles: lock handle", () => {
    it("returns 'lock' when mouse is over lock handle", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        // lock handle at (50-14, 100-14) = (36, 86)
        const result = hitTestActionHandles(36, 86, drawing, scales, "mouse");
        expect(result).toBe("lock");
    });
});
// ── DTP-06: getDrawingBoundingBox covers both endpoints ───────────────────────
describe("DTP-06 — getDrawingBoundingBox", () => {
    it("covers both anchor points of a trendLine", () => {
        const drawing = makeTrendLine(50, 100, 200, 300);
        const scales = makeScales();
        const bbox = getDrawingBoundingBox(drawing, scales);
        expect(bbox).toEqual({ minX: 50, maxX: 200, minY: 100, maxY: 300 });
    });
    it("returns null for empty points", () => {
        const drawing = { ...makeTrendLine(0, 0, 0, 0), points: [] };
        const bbox = getDrawingBoundingBox(drawing, makeScales());
        expect(bbox).toBeNull();
    });
    it("hLine spans full chart width", () => {
        const drawing = makeHLine(150);
        const bbox = getDrawingBoundingBox(drawing, makeScales(), 800, 600);
        expect(bbox).toEqual({ minX: 0, maxX: 800, minY: 150, maxY: 150 });
    });
    it("vLine spans full chart height", () => {
        const drawing = makeVLine(120);
        const bbox = getDrawingBoundingBox(drawing, makeScales(), 800, 600);
        expect(bbox).toEqual({ minX: 120, maxX: 120, minY: 0, maxY: 600 });
    });
    it("circle uses center-radius extents instead of raw anchor min/max", () => {
        const drawing = makeCircle(300, 220, 360, 220);
        const bbox = getDrawingBoundingBox(drawing, makeScales(), 800, 600);
        expect(bbox).toEqual({ minX: 240, maxX: 360, minY: 160, maxY: 280 });
    });
});
describe("DTP-06B — hitTestActionHandles: circle placement", () => {
    it("hits delete handle from circle true bounds", () => {
        const drawing = makeCircle(300, 220, 360, 220);
        const scales = makeScales();
        const result = hitTestActionHandles(374, 146, drawing, scales, "mouse");
        expect(result).toBe("delete");
    });
});
// ── DTP-07: renderDrawingActionHandles does not throw ─────────────────────────
describe("DTP-07 — renderDrawingActionHandles: smoke test canvas rendering", () => {
    it("renders without throwing for a standard drawing", () => {
        const drawing = makeTrendLine(50, 100, 200, 200);
        const scales = makeScales();
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            fillText: vi.fn(),
            setLineDash: vi.fn(),
        };
        Object.defineProperty(ctx, "globalAlpha", { set: vi.fn(), get: () => 1, configurable: true });
        Object.defineProperty(ctx, "fillStyle", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "strokeStyle", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "lineWidth", { set: vi.fn(), get: () => 1, configurable: true });
        Object.defineProperty(ctx, "font", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "textAlign", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "textBaseline", { set: vi.fn(), get: () => "", configurable: true });
        expect(() => renderDrawingActionHandles(ctx, drawing, scales, 800, 600)).not.toThrow();
        expect(ctx.arc.mock.calls.length).toBe(3); // 3 handles
    });
    it("renders nothing for drawing with empty points", () => {
        const drawing = { ...makeTrendLine(0, 0, 0, 0), points: [] };
        const scales = makeScales();
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            arc: vi.fn(),
        };
        renderDrawingActionHandles(ctx, drawing, scales, 800, 600);
        expect(ctx.arc.mock.calls.length).toBe(0);
    });
});
// ── DTP-08: locked drawing renders with yellow lock handle ────────────────────
describe("DTP-08 — renderDrawingActionHandles: locked drawing shows correct indicator", () => {
    it("still renders 3 handles for a locked drawing", () => {
        const drawing = { ...makeTrendLine(50, 100, 200, 200), locked: true };
        const scales = makeScales();
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            fillText: vi.fn(),
            setLineDash: vi.fn(),
        };
        Object.defineProperty(ctx, "globalAlpha", { set: vi.fn(), get: () => 1, configurable: true });
        Object.defineProperty(ctx, "fillStyle", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "strokeStyle", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "lineWidth", { set: vi.fn(), get: () => 1, configurable: true });
        Object.defineProperty(ctx, "font", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "textAlign", { set: vi.fn(), get: () => "", configurable: true });
        Object.defineProperty(ctx, "textBaseline", { set: vi.fn(), get: () => "", configurable: true });
        expect(() => renderDrawingActionHandles(ctx, drawing, scales, 800, 600)).not.toThrow();
        expect(ctx.arc.mock.calls.length).toBe(3);
    });
});
