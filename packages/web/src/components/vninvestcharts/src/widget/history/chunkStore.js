// ------------------------------------------------------------
// Factory
// ------------------------------------------------------------
/**
 * Create a new, empty HistoryChunkStore.
 * Call once per widget history session; reset via `replaceAll([])`.
 */
export function createHistoryChunkStore() {
    let bars = [];
    let revision = 0;
    // Internal helpers ---------------------------------------------------
    function currentSnapshot() {
        return { bars, revision };
    }
    function makePatch(kind, prependedCount, appendedCount, trimmedFromHead, trimmedFromTail) {
        return {
            kind,
            snapshot: currentSnapshot(),
            prependedCount,
            appendedCount,
            trimmedFromHead,
            trimmedFromTail,
        };
    }
    function sortAndDedup(input) {
        const sorted = [...input].sort((a, b) => a.date.getTime() - b.date.getTime());
        // Remove duplicate timestamps (keep last occurrence after sort)
        const out = [];
        for (const bar of sorted) {
            if (out.length > 0 && out[out.length - 1].date.getTime() === bar.date.getTime()) {
                out[out.length - 1] = bar;
            }
            else {
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
        trimToWindow(window, maxBars, trimLeft = true, trimRight = true) {
            if (bars.length === 0) {
                return null;
            }
            // Count how many bars fall before the window start (head trim).
            let headCount = 0;
            if (trimLeft !== false) {
                while (headCount < bars.length && bars[headCount].date.getTime() < window.startMs) {
                    headCount += 1;
                }
            }
            // Count how many bars fall after the window end (tail trim).
            let tailCount = 0;
            if (trimRight !== false) {
                let tailIdx = bars.length - 1;
                while (tailIdx >= headCount && bars[tailIdx].date.getTime() > window.endMs) {
                    tailCount += 1;
                    tailIdx -= 1;
                }
            }
            let nextBars = bars.slice(headCount, tailCount > 0 ? bars.length - tailCount : undefined);
            // Overfetch / memory protection: hard cap on maximum resident bars (Invariant 4)
            let additionalTrimFromHead = 0;
            if (maxBars !== undefined && nextBars.length > maxBars) {
                additionalTrimFromHead = nextBars.length - maxBars;
                nextBars = nextBars.slice(additionalTrimFromHead);
            }
            const totalTrimmedFromHead = headCount + additionalTrimFromHead;
            if (totalTrimmedFromHead === 0 && tailCount === 0) {
                return null;
            }
            bars = nextBars;
            revision += 1;
            return makePatch("trim", 0, 0, totalTrimmedFromHead, tailCount);
        },
        toSnapshot() {
            return currentSnapshot();
        },
    };
}
