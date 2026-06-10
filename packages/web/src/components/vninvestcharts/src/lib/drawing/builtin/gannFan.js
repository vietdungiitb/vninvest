import { createDrawingObject, replacePoint } from "../shared.js";
const GannFan = {
    name: "gannFan",
    createDraft: (startPoint) => createDrawingObject("gannFan", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default GannFan;
/** Price / bar ratios for the 9 standard Gann Fan lines. */
const GANN_RATIOS = [
    { label: "1×8", ratio: 1 / 8, isPrincipal: false },
    { label: "1×4", ratio: 1 / 4, isPrincipal: false },
    { label: "1×3", ratio: 1 / 3, isPrincipal: false },
    { label: "1×2", ratio: 1 / 2, isPrincipal: false },
    { label: "1×1", ratio: 1, isPrincipal: true },
    { label: "2×1", ratio: 2, isPrincipal: false },
    { label: "3×1", ratio: 3, isPrincipal: false },
    { label: "4×1", ratio: 4, isPrincipal: false },
    { label: "8×1", ratio: 8, isPrincipal: false },
];
/**
 * Calculate the 9 Gann Fan lines given origin and end points in pixel space.
 *
 * @param ox - origin x pixel
 * @param oy - origin y pixel
 * @param ex - end x pixel
 * @param ey - end y pixel
 * @param chartWidth  - chart canvas width (for clipping)
 * @param chartHeight - chart canvas height (for clipping)
 * @returns GannFanGeometry with 9 lines
 */
export function calculateGannFanGeometry(ox, oy, ex, ey, chartWidth, chartHeight) {
    const dx = ex - ox;
    const dy = ey - oy; // positive = downward
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
        // degenerate — return lines all pointing right
        return {
            lines: GANN_RATIOS.map((r) => ({
                label: r.label,
                isPrincipal: r.isPrincipal,
                x1: ox,
                y1: oy,
                x2: ox + 100,
                y2: oy,
            })),
        };
    }
    // Unit vectors in pixel space for "1 bar" and "1 price unit"
    const unitBarX = dx; // horizontal component per 1 bar
    const unitPriceY = dy; // vertical component per 1 price unit (pixel, y-down)
    const lines = GANN_RATIOS.map((ratioEntry) => {
        // direction vector for this ratio (price/bar)
        const vx = unitBarX;
        const vy = unitPriceY * ratioEntry.ratio;
        // Find the t such that origin + t * (vx, vy) hits a boundary
        const t = clampToBoundary(ox, oy, vx, vy, chartWidth, chartHeight);
        const x2 = ox + t * vx;
        const y2 = oy + t * vy;
        return {
            label: ratioEntry.label,
            isPrincipal: ratioEntry.isPrincipal,
            x1: ox,
            y1: oy,
            x2,
            y2,
        };
    });
    return { lines };
}
/**
 * Returns the maximum scalar t ≥ 0 such that (ox + t*vx, oy + t*vy) remains
 * inside the chart rectangle [0, chartWidth] × [0, chartHeight].
 */
function clampToBoundary(ox, oy, vx, vy, chartWidth, chartHeight) {
    let tMax = 1e6; // large sentinel
    if (Math.abs(vx) > 1e-9) {
        const tx = vx > 0 ? (chartWidth - ox) / vx : -ox / vx;
        if (tx > 0) {
            tMax = Math.min(tMax, tx);
        }
    }
    if (Math.abs(vy) > 1e-9) {
        const ty = vy > 0 ? (chartHeight - oy) / vy : -oy / vy;
        if (ty > 0) {
            tMax = Math.min(tMax, ty);
        }
    }
    return tMax;
}
