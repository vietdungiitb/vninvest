/**
 * historyWindowPlanner.ts
 *
 * Resident 3x window planner for VNStockChart history management.
 *
 * Computes the resident target window (3x visible span) and plans only the
 * missing segments that need to be fetched, preventing request storms when
 * data is already loaded.
 */

import type { ResidentWindow } from "./chunkStore";

export type { ResidentWindow };

export interface VisibleWindow {
	/** Inclusive start of visible domain, ms since epoch */
	startMs: number;
	/** Inclusive end of visible domain, ms since epoch */
	endMs: number;
}

export interface MissingSegment {
	/** Which side of the loaded range is missing */
	side: "left" | "right";
	/** Start of missing range, ms since epoch (undefined = fetch from beginning) */
	from?: number;
	/** End of missing range, ms since epoch (undefined = fetch to now) */
	to?: number;
}

/**
 * Computes the resident target window as 3x the visible span:
 * [visibleStart - 1xSpan, visibleEnd + 1xSpan]
 *
 * Uses `minSpanMs` as the floor for the visible span (one bar width).
 * Ensures the resident window is always at least 3× the minimum span even
 * when the visible window is very narrow.
 */
export function computeResidentTarget(visible: VisibleWindow, minSpanMs = 0): ResidentWindow {
	const rawSpan = visible.endMs - visible.startMs;
	const span = Math.max(rawSpan, minSpanMs);

	return {
		startMs: visible.startMs - span,
		endMs: visible.endMs + span,
	};
}

/**
 * Computes which segments of the resident target are not covered by the
 * loaded window.
 *
 * Rules:
 * - If `loaded` covers the full `resident` range: returns empty array.
 * - If `loaded` starts after `resident.startMs`: returns a left-segment.
 * - If `loaded` ends before `resident.endMs`: returns a right-segment.
 * - Both can be returned simultaneously (initial empty state, large pan).
 * - When loaded is null/empty (no data yet): returns both sides.
 */
export function computeMissingSegments(
	resident: ResidentWindow,
	loaded: ResidentWindow | null,
): readonly MissingSegment[] {
	if (!loaded) {
		// No data loaded at all: need both sides (full resident range)
		return [
			{ side: "left", from: resident.startMs, to: resident.endMs },
		];
	}

	const segments: MissingSegment[] = [];

	if (loaded.startMs > resident.startMs) {
		// Left side is missing: from resident start to current loaded head
		segments.push({
			side: "left",
			from: resident.startMs,
			to: loaded.startMs,
		});
	}

	if (loaded.endMs < resident.endMs) {
		// Right side is missing: from current loaded tail to resident end
		segments.push({
			side: "right",
			from: loaded.endMs,
			to: resident.endMs,
		});
	}

	return segments;
}

/**
 * Computes a hysteresis-aware trim window.
 *
 * Returns a trim window slightly wider than the resident target to avoid
 * thrashing: bars are only evicted when they fall outside the trim window,
 * which is `hysteresisRatio × span` wider on each side than the resident
 * target.
 *
 * Default `hysteresisRatio = 0.5` means bars within 0.5× span outside the
 * resident target are retained. This prevents evicting bars that would be
 * needed again if the user pans back slightly.
 */
export function computeTrimWindow(resident: ResidentWindow, hysteresisRatio = 0.5): ResidentWindow {
	const span = resident.endMs - resident.startMs;
	const hysteresisPadMs = Math.round(span * hysteresisRatio);

	return {
		startMs: resident.startMs - hysteresisPadMs,
		endMs: resident.endMs + hysteresisPadMs,
	};
}
