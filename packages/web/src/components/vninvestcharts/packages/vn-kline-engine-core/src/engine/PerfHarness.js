/**
 * KF-12-T12: PerfHarness — Quantitative render performance measurement.
 *
 * Collects per-frame timing and render counter snapshots. Results are
 * serialisable to JSON so replay sessions can compare runs.
 *
 * Usage:
 *   const harness = new PerfHarness();
 *   harness.startSession("baseline");
 *   for each frame:
 *     harness.recordFrame({ durationMs, dirtyMask, axisGridCalls, frameIndex });
 *   const report = harness.finishSession();
 *   console.log(JSON.stringify(report, null, 2));
 */
const PLOT_AXIS_GRID_MASK = 0b1110; // PLOT|AXIS|GRID = 2|4|8
const OVERLAY_MASK = 0b0001;
function computeStats(frames) {
    if (frames.length === 0) {
        return {
            frameCount: 0,
            totalDurationMs: 0,
            avgDurationMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            maxDurationMs: 0,
            totalAxisGridCalls: 0,
            overlayOnlyFrames: 0,
        };
    }
    const durations = [...frames].map((f) => f.durationMs).sort((a, b) => a - b);
    const total = durations.reduce((s, d) => s + d, 0);
    const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    const max = durations[durations.length - 1] ?? 0;
    const totalAxisGridCalls = frames.reduce((s, f) => s + f.axisGridCalls, 0);
    const overlayOnlyFrames = frames.filter((f) => (f.dirtyMask & OVERLAY_MASK) !== 0 && (f.dirtyMask & PLOT_AXIS_GRID_MASK) === 0).length;
    return {
        frameCount: frames.length,
        totalDurationMs: total,
        avgDurationMs: total / frames.length,
        p50Ms: p50,
        p95Ms: p95,
        maxDurationMs: max,
        totalAxisGridCalls,
        overlayOnlyFrames,
    };
}
export class PerfHarness {
    sessionLabel = null;
    sessionStartedAt = 0;
    frames = [];
    reports = [];
    /** Begin a new measurement session. Clears any in-progress session. */
    startSession(label) {
        this.sessionLabel = label;
        this.sessionStartedAt = Date.now();
        this.frames = [];
    }
    /** Record a single frame measurement. Must be called inside an active session. */
    recordFrame(record) {
        if (this.sessionLabel === null) {
            throw new Error("PerfHarness: no active session — call startSession() first");
        }
        this.frames.push(record);
    }
    /**
     * Finish the active session and return the report.
     * The report is also stored and accessible via getReports().
     */
    finishSession() {
        if (this.sessionLabel === null) {
            throw new Error("PerfHarness: no active session to finish");
        }
        const report = {
            label: this.sessionLabel,
            startedAt: this.sessionStartedAt,
            finishedAt: Date.now(),
            frames: [...this.frames],
            stats: computeStats(this.frames),
        };
        this.reports.push(report);
        this.sessionLabel = null;
        this.frames = [];
        return report;
    }
    /** Returns all completed session reports (ordered oldest-first). */
    getReports() {
        return this.reports;
    }
    /** Whether a session is currently active. */
    get isActive() {
        return this.sessionLabel !== null;
    }
    /** Resets all stored reports. Does not affect the active session. */
    clearReports() {
        this.reports = [];
    }
}
