/**
 * harmonicRatioValidation.ts — Pure utility for computing harmonic pattern ratio labels
 * with visual validation (color coding based on deviation from target).
 *
 * GAP-11: Harmonic ratio visual validation (Sprint 3 — TASK-13)
 */
import type { DrawingObject } from "./types";

/**
 * A single ratio label with validation data.
 * `deviationPct` is |actual - target| / target * 100.
 * `color` is auto-assigned per deviation thresholds.
 */
export interface HarmonicRatioLabel {
	/** Segment name, e.g. "BC/AB" */
	segment: string;
	/** Actual computed ratio from drawing point prices */
	actual: number;
	/** Target ratio: midpoint of [min, max] from targetRatios, or null if absent */
	target: number | null;
	/** Deviation from target in percent; 0 when target is null */
	deviationPct: number;
	/**
	 * Color based on deviation:
	 *   ≤ ±5%  → #26a69a (green — within target)
	 *   ≤ ±15% → #ffb300 (yellow — acceptable)
	 *   > ±15% → #ef5350 (red — outside range)
	 *   no target → #888888 (neutral grey)
	 */
	color: string;
}

const COLOR_WITHIN = "#26a69a";
const COLOR_ACCEPTABLE = "#ffb300";
const COLOR_OUTSIDE = "#ef5350";
const COLOR_NEUTRAL = "#888888";

/**
 * Returns the validation color for a given deviation percentage.
 * When target is null, returns neutral grey.
 */
export function classifyHarmonicDeviation(deviationPct: number, hasTarget: boolean): string {
	if (!hasTarget) return COLOR_NEUTRAL;
	if (deviationPct <= 5) return COLOR_WITHIN;
	if (deviationPct <= 15) return COLOR_ACCEPTABLE;
	return COLOR_OUTSIDE;
}

/**
 * Computes the list of harmonic ratio labels for a drawing.
 *
 * Behaviour:
 *  - Returns [] if drawing.harmonicRatios is undefined.
 *  - Computes consecutive leg price-distance ratios from drawing.points[i].y.
 *    Leg 0 = |points[1].y - points[0].y|, Leg 1 = |points[2].y - points[1].y|, etc.
 *    Ratio i = Leg(i+1) / Leg(i)   (length of next leg divided by current).
 *  - ratioLabels[i] names ratio i (e.g. "BC/AB" means leg1/leg0).
 *  - targetRatios[i] is [min, max]; target = (min+max)/2 when present.
 */
export function computeHarmonicRatioLabels(drawing: DrawingObject): HarmonicRatioLabel[] {
	const hr = drawing.harmonicRatios;
	if (!hr || !hr.ratioLabels || hr.ratioLabels.length === 0) {
		return [];
	}

	const pts = drawing.points;
	if (pts.length < 2) {
		return [];
	}

	// Compute leg lengths from price (y) values
	const legs: number[] = [];
	for (let i = 0; i + 1 < pts.length; i++) {
		const p0 = pts[i];
		const p1 = pts[i + 1];
		if (p0 !== undefined && p1 !== undefined) {
			legs.push(Math.abs(p1.y - p0.y));
		}
	}

	const result: HarmonicRatioLabel[] = [];
	const labels = hr.ratioLabels;
	const targetRatios = hr.targetRatios;

	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (label === undefined) continue;

		// Ratio i = legs[i+1] / legs[i]
		const numerator = legs[i + 1];
		const denominator = legs[i];

		if (numerator === undefined || denominator === undefined || denominator === 0) {
			continue;
		}

		const actual = numerator / denominator;

		let target: number | null = null;
		let deviationPct = 0;

		if (targetRatios && targetRatios[i]) {
			const range = targetRatios[i]!;
			if (range.length >= 2) {
				const min = range[0]!;
				const max = range[1]!;
				target = (min + max) / 2;
				if (target !== 0) {
					deviationPct = (Math.abs(actual - target) / Math.abs(target)) * 100;
				}
			}
		}

		const color = classifyHarmonicDeviation(deviationPct, target !== null);

		result.push({ segment: label, actual, target, deviationPct, color });
	}

	return result;
}

/**
 * Formats a HarmonicRatioLabel into the canonical display string.
 * Format: `{segment}: {actual:.3f} ({sign}{deviationPct:.1f}%)`
 * When target is null, format: `{segment}: {actual:.3f}`
 */
export function formatHarmonicRatioLabel(label: HarmonicRatioLabel): string {
	if (label.target === null) {
		return `${label.segment}: ${label.actual.toFixed(3)}`;
	}
	const sign = label.actual >= label.target ? "+" : "";
	const deviation = (label.actual - label.target) / Math.abs(label.target) * 100;
	return `${label.segment}: ${label.actual.toFixed(3)} (${sign}${deviation.toFixed(1)}%)`;
}
