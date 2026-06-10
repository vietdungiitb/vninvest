import { afterEach, describe, expect, it, vi } from "vitest";
import { AxisGridRenderCache } from "./AxisGridRenderCache";
function createContextMock() {
    return {
        drawImage: vi.fn(),
    };
}
function makeOptions() {
    return {
        themeMode: "light",
        plotBounds: { left: 100, top: 20, width: 300, height: 120 },
        leftAxis: {
            bounds: { left: 60, top: 20, width: 40, height: 120 },
            domain: [10, 50],
        },
        rightAxis: {
            bounds: { left: 400, top: 20, width: 40, height: 120 },
            domain: [10, 50],
        },
    };
}
class FakeOffscreenCanvas {
    width;
    height;
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    getContext(_kind) {
        return {};
    }
}
const originalOffscreenCanvas = globalThis.OffscreenCanvas;
afterEach(() => {
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
});
describe("AxisGridRenderCache", () => {
    it("T02-01: falls back to direct renderer when OffscreenCanvas is unavailable", () => {
        globalThis.OffscreenCanvas = undefined;
        const renderer = { render: vi.fn() };
        const cache = new AxisGridRenderCache(renderer);
        const ctx = createContextMock();
        const isMiss = cache.renderWithCache(ctx, makeOptions(), "pane-a:key");
        expect(isMiss).toBe(true);
        expect(renderer.render).toHaveBeenCalledTimes(1);
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
    it("T02-02: cache hit draws from offscreen and skips renderer", () => {
        globalThis.OffscreenCanvas = FakeOffscreenCanvas;
        const renderer = { render: vi.fn() };
        const cache = new AxisGridRenderCache(renderer);
        const ctx = createContextMock();
        const options = makeOptions();
        const first = cache.renderWithCache(ctx, options, "pane-a:key");
        const second = cache.renderWithCache(ctx, options, "pane-a:key");
        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(renderer.render).toHaveBeenCalledTimes(1);
        expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    });
    it("T02-03: invalidate(key) clears entry and forces re-render", () => {
        globalThis.OffscreenCanvas = FakeOffscreenCanvas;
        const renderer = { render: vi.fn() };
        const cache = new AxisGridRenderCache(renderer);
        const ctx = createContextMock();
        const options = makeOptions();
        cache.renderWithCache(ctx, options, "pane-a:key");
        cache.invalidate("pane-a:key");
        const third = cache.renderWithCache(ctx, options, "pane-a:key");
        expect(third).toBe(true);
        expect(renderer.render).toHaveBeenCalledTimes(2);
    });
    // ── KF-12-T09: renderer call counter ─────────────────────────────────────
    it("KF12-T09: getRendererCalls increments on cache miss, not on hit", () => {
        globalThis.OffscreenCanvas = FakeOffscreenCanvas;
        const renderer = { render: vi.fn() };
        const cache = new AxisGridRenderCache(renderer);
        const ctx = createContextMock();
        const options = makeOptions();
        expect(cache.getRendererCalls()).toBe(0);
        cache.renderWithCache(ctx, options, "pane-a:key"); // cache miss → renderer called
        expect(cache.getRendererCalls()).toBe(1);
        cache.renderWithCache(ctx, options, "pane-a:key"); // cache hit → renderer NOT called
        expect(cache.getRendererCalls()).toBe(1);
        cache.resetRendererCalls();
        expect(cache.getRendererCalls()).toBe(0);
    });
});
