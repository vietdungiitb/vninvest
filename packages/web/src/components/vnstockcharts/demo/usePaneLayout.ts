/**
 * usePaneLayout
 * Manages resizable pane heights as ratios (0–1) with clamp + local-storage persistence.
 *
 * Usage
 *   const { priceH, volumeH, momentumH, onSplitterDrag, resetLayout } = usePaneLayout(chartHeight);
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

export const PANE_MARGIN_V = 36; // ChartCanvas margin: top(8) + bottom(28)

const DEFAULT_RATIO = { price: 0.50, volume: 0.27, momentum: 0.23 };
const MIN_PX = { price: 100, volume: 36, momentum: 36 };
const LS_KEY = "gc-pane-layout-v6";

type PaneRatio = { price: number; volume: number; momentum: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(raw: unknown): PaneRatio {
	if (
		raw !== null &&
		typeof raw === "object" &&
		"price" in raw && typeof (raw as any).price === "number" &&
		"volume" in raw && typeof (raw as any).volume === "number" &&
		"momentum" in raw && typeof (raw as any).momentum === "number"
	) {
		const r = raw as PaneRatio;
		const sum = r.price + r.volume + r.momentum;
		// values must be positive and roughly sum to 1
		if (r.price > 0 && r.volume > 0 && r.momentum > 0 && sum > 0.95 && sum < 1.05) {
			const k = 1 / sum;
			return { price: r.price * k, volume: r.volume * k, momentum: r.momentum * k };
		}
	}
	return { ...DEFAULT_RATIO };
}

function loadRatio(): PaneRatio {
	try {
		const stored = localStorage.getItem(LS_KEY);
		if (stored) return sanitize(JSON.parse(stored));
	} catch {
		// ignore JSON parse or security errors
	}
	return { ...DEFAULT_RATIO };
}

function saveRatio(r: PaneRatio) {
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(r));
	} catch {
		// ignore quota / security errors
	}
}

/**
 * Convert ratio to pixel heights from a total available space.
 * Clamps each pane to its minHeight; distributes any remainder to price pane.
 */
function ratioToPx(ratio: PaneRatio, available: number) {
	// Compute raw pixel heights
	let priceH    = Math.round(ratio.price    * available);
	let volumeH   = Math.round(ratio.volume   * available);
	let momentumH = Math.round(ratio.momentum * available);

	// Enforce minimums bottom-up (price is the flexible one)
	volumeH   = Math.max(volumeH,   MIN_PX.volume);
	momentumH = Math.max(momentumH, MIN_PX.momentum);
	priceH    = Math.max(available - volumeH - momentumH, MIN_PX.price);

	return { priceH, volumeH, momentumH };
}

/** Convert pixel heights back to ratio after a splitter drag commit. */
function pxToRatio(priceH: number, volumeH: number, momentumH: number): PaneRatio {
	const total = priceH + volumeH + momentumH;
	return {
		price:    priceH    / total,
		volume:   volumeH   / total,
		momentum: momentumH / total,
	};
}

// ── Splitter drag delta helpers ───────────────────────────────────────────────

/**
 * Apply a Y-drag delta to the splitter between paneA (above) and paneB (below).
 * Returns new clamped heights for both panes.
 */
function applyDelta(
	paneAHeight: number,
	paneBHeight: number,
	delta: number,
	minA: number,
	minB: number,
): [number, number] {
	let newA = paneAHeight + delta;
	let newB = paneBHeight - delta;

	// Clamp both to their minimums
	if (newA < minA) {
		const overflow = minA - newA;
		newA = minA;
		newB -= overflow;
	}
	if (newB < minB) {
		const overflow = minB - newB;
		newB = minB;
		newA -= overflow;
	}

	// Final hard clamp (safety guard)
	newA = Math.max(newA, minA);
	newB = Math.max(newB, minB);

	return [Math.round(newA), Math.round(newB)];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePaneLayout(chartHeight: number) {
	const [ratio, setRatio] = useState<PaneRatio>(loadRatio);

	// Derived pixel heights from ratio × available space
	const available = Math.max(chartHeight - PANE_MARGIN_V, MIN_PX.price + MIN_PX.volume + MIN_PX.momentum);
	const { priceH, volumeH, momentumH } = ratioToPx(ratio, available);

	// Persist whenever ratio changes
	useEffect(() => {
		saveRatio(ratio);
	}, [ratio]);

	// Reset to defaults
	const resetLayout = useCallback(() => {
		setRatio({ ...DEFAULT_RATIO });
	}, []);

	/**
	 * Called by splitter onPointerMove.
	 * splitterIndex: 0 = between price and volume, 1 = between volume and momentum.
	 */
	const applyDragDelta = useCallback((splitterIndex: 0 | 1, deltaY: number, currentAvailable: number) => {
		setRatio((prev) => {
			const px = ratioToPx(prev, currentAvailable);
			let newPriceH    = px.priceH;
			let newVolumeH   = px.volumeH;
			let newMomentumH = px.momentumH;

			if (splitterIndex === 0) {
				[newPriceH, newVolumeH] = applyDelta(px.priceH, px.volumeH, deltaY, MIN_PX.price, MIN_PX.volume);
			} else {
				[newVolumeH, newMomentumH] = applyDelta(px.volumeH, px.momentumH, deltaY, MIN_PX.volume, MIN_PX.momentum);
			}

			return pxToRatio(newPriceH, newVolumeH, newMomentumH);
		});
	}, []);

	return {
		priceH,
		volumeH,
		momentumH,
		applyDragDelta,
		resetLayout,
		available,
	};
}
