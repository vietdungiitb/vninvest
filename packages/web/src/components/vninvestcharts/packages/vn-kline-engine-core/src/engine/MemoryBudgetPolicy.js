/**
 * KF-12-T11: Memory Budget Policy — eviction hysteresis for the chunk store.
 *
 * Tracks the current resident candle count and provides eviction advice with
 * hysteresis to avoid oscillation (evict-then-refetch loops).
 *
 * Hysteresis rule:
 *   - Evict trigger: resident > highWatermark
 *   - Evict target : resident → lowWatermark  (evict oldest chunks first)
 *   - No eviction  : resident ≤ highWatermark
 *
 * "oldest" = lowest anchor timestamp (furthest from current view).
 */
export class MemoryBudgetPolicy {
    high;
    low;
    constructor(options) {
        if (options.lowWatermark >= options.highWatermark) {
            throw new Error("lowWatermark must be strictly less than highWatermark");
        }
        this.high = options.highWatermark;
        this.low = options.lowWatermark;
    }
    /**
     * Given the current set of resident chunks, return an eviction plan.
     * Returns an empty plan if no eviction is needed.
     *
     * Eviction is oldest-first (lowest anchorTime first) to keep recent data visible.
     */
    plan(chunks) {
        const total = chunks.reduce((sum, c) => sum + c.count, 0);
        if (total <= this.high) {
            return { keysToEvict: [], projectedCount: total };
        }
        // Sort ascending by anchorTime — oldest first
        const sorted = [...chunks].sort((a, b) => a.anchorTime - b.anchorTime);
        const keysToEvict = [];
        let remaining = total;
        for (const chunk of sorted) {
            if (remaining <= this.low)
                break;
            keysToEvict.push(chunk.key);
            remaining -= chunk.count;
        }
        return { keysToEvict, projectedCount: remaining };
    }
    get highWatermark() { return this.high; }
    get lowWatermark() { return this.low; }
}
