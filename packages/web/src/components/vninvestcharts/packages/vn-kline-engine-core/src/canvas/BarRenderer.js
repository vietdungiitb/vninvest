function resolveColor(accessor, datum, index, value, fallback) {
    if (typeof accessor === "function") {
        return accessor(datum, index, value);
    }
    if (typeof accessor === "string") {
        return accessor;
    }
    return fallback;
}
function toRoundedPixel(value) {
    return Math.round(value);
}
export class BarRenderer {
    render(ctx, data, options) {
        if (data.length === 0) {
            return;
        }
        const xAccessor = options.xAccessor ?? ((datum) => datum.x);
        const valueAccessor = options.valueAccessor ?? ((datum) => datum.value);
        const barWidth = Math.max(1, Math.round(options.barWidth ?? 6));
        const halfBarWidth = Math.floor(barWidth / 2);
        const baselineY = toRoundedPixel(options.yScale(options.baselineValue ?? 0));
        const opacity = options.opacity ?? 1;
        const positiveColor = options.positiveColor ?? "#26A69A";
        const negativeColor = options.negativeColor ?? "#EF5350";
        ctx.save();
        ctx.globalAlpha = opacity;
        for (let index = 0; index < data.length; index += 1) {
            const datum = data[index];
            if (datum.visible === false) {
                continue;
            }
            const x = xAccessor(datum, index);
            const value = valueAccessor(datum, index);
            if (!Number.isFinite(x) || !Number.isFinite(value)) {
                continue;
            }
            const y = options.yScale(value);
            if (!Number.isFinite(y)) {
                continue;
            }
            const roundedX = toRoundedPixel(x);
            const roundedY = toRoundedPixel(y);
            const top = Math.min(roundedY, baselineY);
            const rawHeight = Math.abs(roundedY - baselineY);
            if (rawHeight === 0) {
                continue;
            }
            const height = Math.max(1, rawHeight);
            const left = roundedX - halfBarWidth;
            const fallback = value >= 0 ? positiveColor : negativeColor;
            ctx.fillStyle = resolveColor(options.fill, datum, index, value, fallback);
            ctx.fillRect(left, top, barWidth, height);
        }
        ctx.restore();
    }
}
