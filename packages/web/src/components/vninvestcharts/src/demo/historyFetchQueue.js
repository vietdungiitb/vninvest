/**
 * OB-M01 — HistoryFetchQueue
 * Priority queue for managing history backfill jobs.
 * Pure class — no React dependency.
 */
function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export class HistoryFetchQueue {
    _pending = [];
    _inflight = null;
    /**
     * Enqueue a job. If a job with the same key+side+generation already exists,
     * merges targetTs (min for left, max for right) and takes the higher priority.
     */
    enqueue(input) {
        const existing = this._pending.find((j) => j.key === input.key &&
            j.side === input.side &&
            j.generation === input.generation);
        if (existing) {
            existing.targetTs =
                input.side === "left"
                    ? Math.min(existing.targetTs, input.targetTs)
                    : Math.max(existing.targetTs, input.targetTs);
            existing.priority = Math.max(existing.priority, input.priority);
            return existing;
        }
        const job = {
            ...input,
            id: makeId(),
            createdAt: Date.now(),
        };
        this._pending.push(job);
        return job;
    }
    /**
     * Dequeue the highest-priority job for the given generation.
     * Returns null if there is already an inflight job.
     */
    dequeue(generation) {
        if (this._inflight !== null) {
            return null;
        }
        const candidates = this._pending.filter((j) => j.generation === generation);
        if (candidates.length === 0) {
            return null;
        }
        // Sort: priority desc, createdAt asc
        candidates.sort((a, b) => {
            if (b.priority !== a.priority)
                return b.priority - a.priority;
            return a.createdAt - b.createdAt;
        });
        const job = candidates[0];
        this._pending = this._pending.filter((j) => j.id !== job.id);
        this._inflight = job;
        return job;
    }
    /** Mark a job as completed, clearing the inflight slot. */
    complete(id) {
        if (this._inflight?.id === id) {
            this._inflight = null;
        }
    }
    /** Whether there are pending jobs (optionally filtered by generation). */
    hasPending(generation) {
        if (generation === undefined) {
            return this._pending.length > 0;
        }
        return this._pending.some((j) => j.generation === generation);
    }
    /** Remove all pending jobs for a specific generation. */
    clearGeneration(generation) {
        this._pending = this._pending.filter((j) => j.generation !== generation);
        if (this._inflight?.generation === generation) {
            this._inflight = null;
        }
    }
    /** Remove all pending jobs and clear inflight. */
    clearAll() {
        this._pending = [];
        this._inflight = null;
    }
    /** Snapshot of current queue state for debugging. */
    snapshot() {
        return {
            pending: this._pending.length,
            inflight: this._inflight,
        };
    }
}
