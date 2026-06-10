import { AxisGridRenderer } from "./AxisGridRenderer.js";
function safeDomain(domain) {
    if (!domain) {
        return "na:na";
    }
    return `${domain[0].toFixed(3)}:${domain[1].toFixed(3)}`;
}
function cacheDimensions(options) {
    const leftWidth = options.leftAxis?.bounds.width ?? 0;
    const rightWidth = options.rightAxis?.bounds.width ?? 0;
    return {
        width: Math.max(1, Math.round(options.plotBounds.width + leftWidth + rightWidth)),
        height: Math.max(1, Math.round(options.plotBounds.height)),
        originX: Math.round(options.plotBounds.left - leftWidth),
    };
}
export function buildAxisGridCacheKey(input) {
    return [
        input.paneId,
        safeDomain(input.leftDomain),
        safeDomain(input.rightDomain),
        input.themeMode,
        `${Math.round(input.width)}x${Math.round(input.height)}`,
    ].join(":");
}
export class AxisGridRenderCache {
    renderer;
    cache = new Map();
    /** KF-12-T09: Counts actual renderer.render() calls (cache misses) for test introspection. */
    rendererCallCount = 0;
    constructor(renderer = new AxisGridRenderer()) {
        this.renderer = renderer;
    }
    renderWithCache(ctx, options, cacheKey) {
        if (typeof OffscreenCanvas === "undefined") {
            this.renderer.render(ctx, options);
            this.rendererCallCount += 1;
            return true;
        }
        const { width, height, originX } = cacheDimensions(options);
        const existing = this.cache.get(cacheKey);
        if (existing && existing.width === width && existing.height === height) {
            ctx.drawImage(existing.offscreen, originX, Math.round(options.plotBounds.top));
            return false;
        }
        const offscreen = new OffscreenCanvas(width, height);
        const offscreenCtx = offscreen.getContext("2d");
        if (!offscreenCtx) {
            this.renderer.render(ctx, options);
            this.rendererCallCount += 1;
            return true;
        }
        this.renderer.render(offscreenCtx, {
            ...options,
            plotBounds: {
                ...options.plotBounds,
                left: options.leftAxis?.bounds.width ?? 0,
                top: 0,
            },
            leftAxis: options.leftAxis
                ? {
                    ...options.leftAxis,
                    bounds: {
                        ...options.leftAxis.bounds,
                        left: 0,
                        top: 0,
                    },
                }
                : undefined,
            rightAxis: options.rightAxis
                ? {
                    ...options.rightAxis,
                    bounds: {
                        ...options.rightAxis.bounds,
                        left: (options.leftAxis?.bounds.width ?? 0) + options.plotBounds.width,
                        top: 0,
                    },
                }
                : undefined,
        });
        this.cache.set(cacheKey, { offscreen, width, height });
        ctx.drawImage(offscreen, originX, Math.round(options.plotBounds.top));
        this.rendererCallCount += 1;
        return true;
    }
    /** KF-12-T09: Returns number of actual renderer.render() calls since last reset. */
    getRendererCalls() {
        return this.rendererCallCount;
    }
    /** KF-12-T09: Resets the renderer call counter to 0. */
    resetRendererCalls() {
        this.rendererCallCount = 0;
    }
    invalidate(key) {
        if (key) {
            this.cache.delete(key);
            return;
        }
        this.cache.clear();
    }
}
