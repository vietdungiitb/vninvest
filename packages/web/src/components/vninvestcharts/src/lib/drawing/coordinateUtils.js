import { resolvePointAnchor } from "./shared.js";
export function pixelToChartPoint(clientX, clientY, containerRect, scales) {
    const localX = clientX - containerRect.left;
    const localY = clientY - containerRect.top;
    return {
        x: scales.xScaleInvert(localX).getTime(),
        y: scales.yScaleInvert(localY),
    };
}
export function chartPointToPixel(point, scales) {
    const anchor = resolvePointAnchor(point);
    const x = typeof anchor.xIndexFloat === "number" && Number.isFinite(anchor.xIndexFloat) && scales.xScaleByIndex
        ? scales.xScaleByIndex(anchor.xIndexFloat)
        : scales.xScale(new Date(anchor.timeMsHint));
    return {
        x,
        y: scales.yScale(anchor.yPrice),
        xIndexFloat: anchor.xIndexFloat ?? undefined,
        yPrice: anchor.yPrice,
    };
}
