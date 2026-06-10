const DEFAULT_UP_COLOR = "#6BA583";
const DEFAULT_DOWN_COLOR = "#FF0000";
function resolveColor(accessor, datum, isUp, index, fallback) {
    if (typeof accessor === "function") {
        return accessor(datum, isUp, index);
    }
    if (typeof accessor === "string") {
        return accessor;
    }
    return fallback;
}
function toRoundedPixel(value) {
    return Math.round(value);
}
export class CandlestickRenderer {
    render(ctx, data, options) {
        if (data.length === 0) {
            return;
        }
        const mode = options.mode ?? "candlestick";
        const barWidth = Math.max(1, Math.round(options.barWidth ?? 6));
        const halfWidth = Math.max(0, Math.floor(barWidth / 2));
        const strokeWidth = Math.max(1, options.strokeWidth ?? 1);
        const opacity = options.opacity ?? 1;
        const xAccessor = options.xAccessor ?? ((datum) => datum.x);
        const openAccessor = options.openAccessor ?? ((datum) => datum.open);
        const highAccessor = options.highAccessor ?? ((datum) => datum.high);
        const lowAccessor = options.lowAccessor ?? ((datum) => datum.low);
        const closeAccessor = options.closeAccessor ?? ((datum) => datum.close);
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.lineWidth = strokeWidth;
        ctx.setLineDash([]);
        for (let index = 0; index < data.length; index += 1) {
            const datum = data[index];
            if (datum.visible === false) {
                continue;
            }
            const x = toRoundedPixel(xAccessor(datum, index));
            const open = openAccessor(datum, index);
            const high = highAccessor(datum, index);
            const low = lowAccessor(datum, index);
            const close = closeAccessor(datum, index);
            if (![x, open, high, low, close].every(Number.isFinite)) {
                continue;
            }
            const isUp = close >= open;
            const directionColor = isUp
                ? (options.upColor ?? DEFAULT_UP_COLOR)
                : (options.downColor ?? DEFAULT_DOWN_COLOR);
            const wickColor = resolveColor(options.wickStroke, datum, isUp, index, directionColor);
            const strokeColor = resolveColor(options.stroke, datum, isUp, index, directionColor);
            const fillColor = resolveColor(options.fill, datum, isUp, index, directionColor);
            const openY = options.yScale(open);
            const highY = options.yScale(high);
            const lowY = options.yScale(low);
            const closeY = options.yScale(close);
            if (![openY, highY, lowY, closeY].every(Number.isFinite)) {
                continue;
            }
            const bodyTop = toRoundedPixel(Math.min(openY, closeY));
            const bodyBottom = toRoundedPixel(Math.max(openY, closeY));
            const wickTop = toRoundedPixel(Math.min(highY, lowY));
            const wickBottom = toRoundedPixel(Math.max(highY, lowY));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            const left = x - halfWidth;
            ctx.strokeStyle = wickColor;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, wickTop);
            ctx.lineTo(x + 0.5, wickBottom);
            ctx.stroke();
            if (mode === "ohlc") {
                ctx.strokeStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(left, toRoundedPixel(openY));
                ctx.lineTo(x, toRoundedPixel(openY));
                ctx.moveTo(x, toRoundedPixel(closeY));
                ctx.lineTo(x + halfWidth, toRoundedPixel(closeY));
                ctx.stroke();
                continue;
            }
            ctx.strokeStyle = strokeColor;
            if (mode === "hollow" && isUp) {
                ctx.strokeRect(left, bodyTop, barWidth, bodyHeight);
                continue;
            }
            ctx.fillStyle = fillColor;
            ctx.fillRect(left, bodyTop, barWidth, bodyHeight);
            ctx.strokeRect(left, bodyTop, barWidth, bodyHeight);
        }
        ctx.restore();
    }
}
