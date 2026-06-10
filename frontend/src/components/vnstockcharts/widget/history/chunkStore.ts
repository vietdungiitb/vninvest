import type { OHLCVBar } from "../../lib/types/ohlcv";

// ------------------------------------------------------------
// Domain types
// ------------------------------------------------------------

/** A time window defined by inclusive epoch-millisecond bounds. */
export interface ResidentWindow {
	readonly startMs: number;
	readonly endMs: number;
}

/** The kind of mutation that produced a HistoryPatch. */
export type HistoryPatchKind = "replace" | "prepend" | "append" | "trim";

/**
 * An immutable snapshot of the full resident bar set at a given revision.
 * Consumers may hold onto this without worrying about the store mutating it.
 */
export interface HistorySnapshot {
	readonly bars: readonly OHLCVBar[];
	readonly revision: number;
}

/**
 * A description of one mutation applied to a HistoryChunkStore.
 * `snapshot` reflects the store state AFTER the mutation.
 */
export interface HistoryPatch {
	readonly kind: HistoryPatchKind;
	readonly snapshot: HistorySnapshot;
	/** Number of bars added at the head (prepend / replace that extends head). */
	readonly prependedCount: number;
	/** Number of bars added at the tail (append / replace that extends tail). */
	readonly appendedCount: number;
	/** Number of bars removed from the head (trim). */
	readonly trimmedFromHead: number;
	/** Number of bars removed from the tail (trim). */
	readonly trimmedFromTail: number;
}

// ------------------------------------------------------------
// Store interface
// ------------------------------------------------------------

/**
 * HistoryChunkStore manages the resident OHLCV bar set for a single
 * symbol/timeframe session.  It enforces:
 *   - Chronological sort order (by `date` ascending)
 *   - No duplicate timestamps
 *   - Stable logical timeline: prepend/trim never shift existing bar positions
 *
 * The store is intentionally synchronous and mutation-safe.  All mutating
 * methods return the resulting HistorySnapshot or HistoryPatch so callers
 * can decide when to flush the change into React state.
 */
export interface HistoryChunkStore {
	/**
	 * Replace the entire resident set with `bars`.  Bars are sorted by date;
	 * duplicates are deduplicated (last occurrence wins).
	 * Returns the new snapshot.
	 */
	replaceAll(bars: readonly OHLCVBar[]): HistorySnapshot;

	/**
	 * Prepend bars that are OLDER than the current head.
	 * Bars with timestamps >= current head are silently dropped to preserve
	 * logical timeline stability (no re-ordering of existing bars).
	 * Returns a HistoryPatch describing what changed.
	 */
	prepend(bars: readonly OHLCVBar[]): HistoryPatch;

	/**
	 * Append one or more bars newer than the current tail, or update/insert
	 * a single bar at any position (for live tick updates).
	 * Returns a HistoryPatch describing what changed.
	 */
	append(bars: readonly OHLCVBar[]): HistoryPatch;

	/**
	 * Remove bars outside `window`.  Returns null when nothing was trimmed,
	 * or a HistoryPatch with trimmedFromHead / trimmedFromTail counts.
	 */
	trimToWindow(window: ResidentWindow): HistoryPatch | null;

	/** Return the current snapshot without mutating the store. */
	toSnapshot(): HistorySnapshot;
}

// ------------------------------------------------------------
// Factory
// ------------------------------------------------------------

/**
 * Create a new, empty HistoryChunkStore.
 * Call once per widget history session; reset via `replaceAll([])`.
 */
export function createHistoryChunkStore(): HistoryChunkStore {
	let bars: readonly OHLCVBar[] = [];
	let revision = 0;

	// Internal helpers ---------------------------------------------------

	function currentSnapshot(): HistorySnapshot {
		return { bars, revision };
	}

	function makePatch(
		kind: HistoryPatchKind,
		prependedCount: number,
		appendedCount: number,
		trimmedFromHead: number,
		trimmedFromTail: number,
	): HistoryPatch {
		return {
			kind,
			snapshot: currentSnapshot(),
			prependedCount,
			appendedCount,
			trimmedFromHead,
			trimmedFromTail,
		};
	}

	function sortAndDedup(input: readonly OHLCVBar[]): OHLCVBar[] {
		const sorted = [...input].sort((a, b) => a.date.getTime() - b.date.getTime());
		// Remove duplicate timestamps (keep last occurrence after sort)
		const out: OHLCVBar[] = [];
		for (const bar of sorted) {
			if (out.length > 0 && out[out.length - 1].date.getTime() === bar.date.getTime()) {
				out[out.length - 1] = bar;
			} else {
				out.push(bar);
			}
		}
		return out;
	}

	// Public interface ---------------------------------------------------

	return {
		replaceAll(incoming) {
			bars = sortAndDedup(incoming);
			revision += 1;
			return currentSnapshot();
		},

		prepend(incoming) {
			if (incoming.length === 0) {
				return makePatch("prepend", 0, 0, 0, 0);
			}

			// Only accept bars strictly older than the current head to preserve
			// logical timeline stability (no re-ordering of existing bars).
			const headMs = bars.length > 0 ? bars[0].date.getTime() : Infinity;
			const newBars = incoming.filter((b) => b.date.getTime() < headMs);

			if (newBars.length === 0) {
				return makePatch("prepend", 0, 0, 0, 0);
			}

			const sorted = sortAndDedup(newBars);
			bars = [...sorted, ...bars];
			revision += 1;
			return makePatch("prepend", sorted.length, 0, 0, 0);
		},

		append(incoming) {
			if (incoming.length === 0) {
				return makePatch("append", 0, 0, 0, 0);
			}

			// Single-bar path: handles live tick updates (update-in-place or append).
			if (incoming.length === 1) {
				const bar = incoming[0];
				const barMs = bar.date.getTime();
				const tailMs = bars.length > 0 ? bars[bars.length - 1].date.getTime() : -Infinity;

				if (barMs === tailMs) {
					// Update tail bar in-place (common live tick case).
					bars = [...bars.slice(0, -1), bar];
					revision += 1;
					return makePatch("append", 0, 1, 0, 0);
				}

				if (barMs > tailMs) {
					bars = [...bars, bar];
					revision += 1;
					return makePatch("append", 0, 1, 0, 0);
				}

				// Bar is older than current tail — find and update, or sort-insert.
				const existingIdx = bars.findIndex((b) => b.date.getTime() === barMs);
				if (existingIdx >= 0) {
					const next = [...bars];
					next[existingIdx] = bar;
					bars = next;
					revision += 1;
					return makePatch("append", 0, 1, 0, 0);
				}
				// Sort-insert (rare: out-of-order delivery).
				bars = [...bars, bar].sort((a, b) => a.date.getTime() - b.date.getTime());
				revision += 1;
				return makePatch("append", 0, 1, 0, 0);
			}

			// Bulk path: forward-fill pages — only keep bars newer than current tail.
			const tailMs = bars.length > 0 ? bars[bars.length - 1].date.getTime() : -Infinity;
			const newBars = incoming.filter((b) => b.date.getTime() > tailMs);

			if (newBars.length === 0) {
				return makePatch("append", 0, 0, 0, 0);
			}

			const sorted = sortAndDedup(newBars);
			bars = [...bars, ...sorted];
			revision += 1;
			return makePatch("append", 0, sorted.length, 0, 0);
		},

		trimToWindow(window) {
			if (bars.length === 0) {
				return null;
			}

			// Count how many bars fall before the window start (head trim).
			let headCount = 0;
			while (headCount < bars.length && bars[headCount].date.getTime() < window.startMs) {
				headCount += 1;
			}

			// Count how many bars fall after the window end (tail trim).
			let tailCount = 0;
			let tailIdx = bars.length - 1;
			while (tailIdx >= headCount && bars[tailIdx].date.getTime() > window.endMs) {
				tailCount += 1;
				tailIdx -= 1;
			}

			if (headCount === 0 && tailCount === 0) {
				return null;
			}

			const end = tailCount > 0 ? bars.length - tailCount : undefined;
			bars = bars.slice(headCount, end);
			revision += 1;
			return makePatch("trim", 0, 0, headCount, tailCount);
		},

		toSnapshot() {
			return currentSnapshot();
		},
	};
}
