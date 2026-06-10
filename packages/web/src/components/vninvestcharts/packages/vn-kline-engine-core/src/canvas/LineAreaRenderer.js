import { WebGLLineRenderer } from "./WebGLLineRenderer.js";
function resolveColor(accessor, datum, index, fallback) {
    if (typeof accessor === "function") {
        return accessor(datum, index);
    }
    if (typeof accessor === "string") {
        return accessor;
    }
    return fallback;
}
function toRoundedPixel(value) {
    return Math.round(value);
}
export class LineAreaRenderer {
    webglByCanvas = new WeakMap();
    render(ctx, data, options) {
        if (data.length === 0) {
            return;
        }
        const mode = options.mode ?? "line";
        const xAccessor = options.xAccessor ?? ((datum) => datum.x);
        const valueAccessor = options.valueAccessor ?? ((datum) => datum.value);
        const opacity = options.opacity ?? 1;
        const lineWidth = Math.max(1, options.lineWidth ?? 2);
        const rawPoints = new Array(data.length);
        let pointCount = 0;
        for (let i = 0; i < data.length; i++) {
            const datum = data[i];
            if (datum.visible === false) {
                continue;
            }
            const x = xAccessor(datum, i);
            const value = valueAccessor(datum, i);
            if (!Number.isFinite(x) || !Number.isFinite(value)) {
                continue;
            }
            const y = options.yScale(value);
            if (!Number.isFinite(y)) {
                continue;
            }
            rawPoints[pointCount++] = { datum, index: i, x: toRoundedPixel(x), y: toRoundedPixel(y), value };
        }
        if (pointCount === 0) {
            return;
        }
        const points = rawPoints.slice(0, pointCount);
        const shouldUseWebGL = options.useWebGL === true && mode === "line";
        if (shouldUseWebGL) {
            const webglRenderer = this.resolveWebGLRenderer(ctx.canvas);
            if (webglRenderer?.isAvailable) {
                const firstPoint = points[0];
                // KF-12-T10: build xy array without extra .map() allocation when possible
                const xyPoints = new Array(points.length);
                for (let i = 0; i < points.length; i++) {
                    xyPoints[i] = { x: points[i].x, y: points[i].y };
                }
                webglRenderer.drawLine(xyPoints, {
                    color: resolveColor(options.stroke, firstPoint.datum, firstPoint.index, "#2962ff"),
                    width: lineWidth,
                });
                webglRenderer.flush();
                return;
            }
        }
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);
        if (mode === "volume") {
            const barWidth = Math.max(1, Math.round(options.barWidth ?? 6));
            const halfBarWidth = Math.floor(barWidth / 2);
            const baselineY = toRoundedPixel(options.yScale(options.baselineValue ?? 0));
            for (const point of points) {
                const left = point.x - halfBarWidth;
                const top = Math.min(point.y, baselineY);
                const height = Math.max(1, Math.abs(point.y - baselineY));
                ctx.fillStyle = resolveColor(options.fill, point.datum, point.index, "#6BA583");
                ctx.fillRect(left, top, barWidth, height);
            }
            ctx.restore();
            return;
        }
        const firstPoint = points[0];
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < points.length; index += 1) {
            ctx.lineTo(points[index].x, points[index].y);
        }
        if (mode === "area") {
            const baselineY = toRoundedPixel(options.yScale(options.baselineValue ?? points[points.length - 1].value));
            ctx.lineTo(points[points.length - 1].x, baselineY);
            ctx.lineTo(firstPoint.x, baselineY);
            ctx.closePath();
            ctx.fillStyle = resolveColor(options.fill, firstPoint.datum, firstPoint.index, "rgba(41,98,255,0.2)");
            ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < points.length; index += 1) {
            ctx.lineTo(points[index].x, points[index].y);
        }
        ctx.strokeStyle = resolveColor(options.stroke, firstPoint.datum, firstPoint.index, "#2962ff");
        ctx.stroke();
        ctx.restore();
    }
    resolveWebGLRenderer(canvas) {
        const existing = this.webglByCanvas.get(canvas);
        if (existing) {
            return existing;
        }
        const next = new WebGLLineRenderer(canvas);
        this.webglByCanvas.set(canvas, next);
        return next;
    }
}
