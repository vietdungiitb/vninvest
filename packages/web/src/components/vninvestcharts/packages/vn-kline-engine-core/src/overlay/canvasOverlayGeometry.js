export function clipOverlaySegmentToBox(start, end, chartWidth, chartHeight) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let t0 = 0;
    let t1 = 1;
    const edges = [
        [-dx, start.x],
        [dx, chartWidth - start.x],
        [-dy, start.y],
        [dy, chartHeight - start.y],
    ];
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) {
                return null;
            }
            continue;
        }
        const r = q / p;
        if (p < 0) {
            if (r > t1) {
                return null;
            }
            if (r > t0) {
                t0 = r;
            }
        }
        else {
            if (r < t0) {
                return null;
            }
            if (r < t1) {
                t1 = r;
            }
        }
    }
    if (t1 < t0) {
        return null;
    }
    return [
        { x: start.x + dx * t0, y: start.y + dy * t0 },
        { x: start.x + dx * t1, y: start.y + dy * t1 },
    ];
}
export function measureOverlayCalloutBox(anchor, text, fontSize = 12) {
    const label = text?.trim().length ? text : "Text";
    const paddingX = 8;
    const paddingY = 6;
    const width = Math.max(fontSize * 2.6, label.length * fontSize * 0.58 + paddingX * 2);
    const height = fontSize + paddingY * 2;
    return {
        x: anchor.x - width / 2,
        y: anchor.y - height / 2,
        width,
        height,
        text: label,
    };
}
function triangleSign(point, a, b) {
    return (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
}
export function pointInOverlayTriangle(point, a, b, c) {
    const d1 = triangleSign(point, a, b);
    const d2 = triangleSign(point, b, c);
    const d3 = triangleSign(point, c, a);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
}
export function measureOverlayPriceLabelTag(chartWidth, text, fontSize = 11) {
    const label = text?.trim().length ? text : "Price";
    const paddingX = 6;
    const paddingY = 4;
    const width = Math.max(fontSize * 3, label.length * fontSize * 0.58 + paddingX * 2);
    const height = fontSize + paddingY * 2;
    return {
        x: chartWidth - width - 2,
        width,
        height,
        text: label,
    };
}
