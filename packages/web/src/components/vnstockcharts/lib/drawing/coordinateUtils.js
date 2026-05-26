export function pixelToChartPoint(clientX, clientY, containerRect, scales) {
    const localX = clientX - containerRect.left;
    const localY = clientY - containerRect.top;
    return {
        x: scales.xScaleInvert(localX).getTime(),
        y: scales.yScaleInvert(localY),
    };
}
export function chartPointToPixel(point, scales) {
    return {
        x: scales.xScale(new Date(point.x)),
        y: scales.yScale(point.y),
    };
}
