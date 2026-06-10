export const MAGNET_TOLERANCE = {
    off: 0,
    weak: 5,
    normal: 10,
    strong: 20,
};
export function findNearestOverlayEndpointSnap(mouseX, mouseY, points, tolerance) {
    let best = null;
    for (const point of points) {
        const distance = Math.hypot(mouseX - point.pixelPoint.x, mouseY - point.pixelPoint.y);
        if (distance <= tolerance && (!best || distance < best.distance)) {
            best = {
                ...point,
                distance,
                snapType: "endpoint",
            };
        }
    }
    return best;
}
