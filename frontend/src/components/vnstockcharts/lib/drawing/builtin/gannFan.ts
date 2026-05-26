import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const GannFan: DrawingToolDefinition = {
	name: "gannFan",
	createDraft: (startPoint) => createDrawingObject("gannFan", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default GannFan;

// ─── Gann Fan geometry ────────────────────────────────────────────────────────
//
// A Gann Fan radiates 9 lines from an origin (anchor) through an end point.
// Each line has a slope angle expressed as a ratio (price units / bar units):
//   1×8, 1×4, 1×3, 1×2, 1×1 (bold), 2×1, 3×1, 4×1, 8×1
//
// Geometry derivation:
//   Given origin pixel (ox, oy) and end pixel (ex, ey):
//     dx = ex - ox  (bars in pixel space)
//     dy = oy - ey  (price in pixel space, flipped because y increases downward)
//   We define the "unit bar" as |dx| and "unit price" as |dy|.
//   For each ratio r = priceUnits/barUnits the direction is:
//     vecY = -r * unitPrice  (negative because screen-y is flipped)
//     vecX = +unitBar        (always in the same x direction as end point)
//   We extend each ray to the nearest chart boundary.
//
// The fan is drawn extending in the direction from origin to end point.

export interface GannFanLine {
	/** slope ratio label e.g. "1×1", "2×1" */
	label: string;
	/** whether this is the principal 1×1 line (rendered bold) */
	isPrincipal: boolean;
	/** pixel start point (same as origin) */
	x1: number;
	y1: number;
	/** pixel end point (clipped to chart boundary) */
	x2: number;
	y2: number;
}

export interface GannFanGeometry {
	lines: GannFanLine[];
}

/** Price / bar ratios for the 9 standard Gann Fan lines. */
const GANN_RATIOS: ReadonlyArray<{ label: string; ratio: number; isPrincipal: boolean }> = [
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
export function calculateGannFanGeometry(
	ox: number,
	oy: number,
	ex: number,
	ey: number,
	chartWidth: number,
	chartHeight: number,
): GannFanGeometry {
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
	const unitBarX = dx;        // horizontal component per 1 bar
	const unitPriceY = dy;      // vertical component per 1 price unit (pixel, y-down)

	const lines: GannFanLine[] = GANN_RATIOS.map((ratioEntry) => {
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
function clampToBoundary(
	ox: number,
	oy: number,
	vx: number,
	vy: number,
	chartWidth: number,
	chartHeight: number,
): number {
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
