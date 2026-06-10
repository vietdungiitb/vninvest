import { describe, expect, it } from "vitest";
import { PerfHarness } from "./PerfHarness";
function makeFrame(frameIndex, durationMs, dirtyMask, axisGridCalls) {
    return { frameIndex, durationMs, dirtyMask, axisGridCalls };
}
// DirtyFlag values (from dirtyMask.ts)
const OVERLAY = 0b0001;
const PLOT = 0b0010;
const AXIS = 0b0100;
const FULL = 0b1111;
describe("PerfHarness", () => {
    it("KF12-T12-01: startSession + recordFrame + finishSession returns report with correct stats", () => {
        const harness = new PerfHarness();
        harness.startSession("test");
        harness.recordFrame(makeFrame(0, 10, FULL, 2));
        harness.recordFrame(makeFrame(1, 20, FULL, 2));
        harness.recordFrame(makeFrame(2, 5, FULL, 2));
        const report = harness.finishSession();
        expect(report.label).toBe("test");
        expect(report.frames).toHaveLength(3);
        expect(report.stats.frameCount).toBe(3);
        expect(report.stats.totalDurationMs).toBe(35);
        expect(report.stats.avgDurationMs).toBeCloseTo(35 / 3);
        expect(report.stats.maxDurationMs).toBe(20);
        expect(report.stats.totalAxisGridCalls).toBe(6);
    });
    it("KF12-T12-02: overlayOnlyFrames counts only OVERLAY-only dirty masks", () => {
        const harness = new PerfHarness();
        harness.startSession("overlay-test");
        harness.recordFrame(makeFrame(0, 5, OVERLAY, 0)); // overlay only → counted
        harness.recordFrame(makeFrame(1, 5, PLOT | OVERLAY, 1)); // plot+overlay → not counted
        harness.recordFrame(makeFrame(2, 5, OVERLAY, 0)); // overlay only → counted
        harness.recordFrame(makeFrame(3, 5, FULL, 2)); // full → not counted
        harness.recordFrame(makeFrame(4, 5, AXIS | OVERLAY, 1)); // axis+overlay → not counted
        const report = harness.finishSession();
        expect(report.stats.overlayOnlyFrames).toBe(2);
    });
    it("KF12-T12-03: finishSession stores report in getReports()", () => {
        const harness = new PerfHarness();
        harness.startSession("s1");
        harness.recordFrame(makeFrame(0, 8, FULL, 1));
        harness.finishSession();
        harness.startSession("s2");
        harness.recordFrame(makeFrame(0, 12, FULL, 1));
        harness.finishSession();
        const reports = harness.getReports();
        expect(reports).toHaveLength(2);
        expect(reports[0].label).toBe("s1");
        expect(reports[1].label).toBe("s2");
    });
    it("KF12-T12-04: throws when recordFrame called without active session", () => {
        const harness = new PerfHarness();
        expect(() => harness.recordFrame(makeFrame(0, 5, FULL, 1))).toThrow();
    });
    it("KF12-T12-05: throws when finishSession called without active session", () => {
        const harness = new PerfHarness();
        expect(() => harness.finishSession()).toThrow();
    });
    it("KF12-T12-06: p95 and p50 computed from sorted durations", () => {
        const harness = new PerfHarness();
        harness.startSession("percentiles");
        // 20 frames: durations 1..20
        for (let i = 0; i < 20; i++) {
            harness.recordFrame(makeFrame(i, i + 1, FULL, 0));
        }
        const report = harness.finishSession();
        // Sorted [1,2,...,20]: p50 = index 10 = 11ms; p95 = index 19 = 20ms
        expect(report.stats.p50Ms).toBe(11);
        expect(report.stats.p95Ms).toBe(20);
    });
    it("KF12-T12-07: empty session returns zeroed stats", () => {
        const harness = new PerfHarness();
        harness.startSession("empty");
        const report = harness.finishSession();
        expect(report.stats.frameCount).toBe(0);
        expect(report.stats.avgDurationMs).toBe(0);
    });
    it("KF12-T12-08: report is serialisable to JSON (replay evidence output)", () => {
        const harness = new PerfHarness();
        harness.startSession("json-test");
        harness.recordFrame(makeFrame(0, 16, FULL, 2));
        const report = harness.finishSession();
        const json = JSON.stringify(report);
        const parsed = JSON.parse(json);
        expect(parsed.label).toBe("json-test");
        expect(parsed.stats.frameCount).toBe(1);
    });
    it("KF12-T12-09: clearReports removes all stored reports", () => {
        const harness = new PerfHarness();
        harness.startSession("a");
        harness.finishSession();
        expect(harness.getReports()).toHaveLength(1);
        harness.clearReports();
        expect(harness.getReports()).toHaveLength(0);
    });
    it("KF12-T12-10: isActive reflects session state correctly", () => {
        const harness = new PerfHarness();
        expect(harness.isActive).toBe(false);
        harness.startSession("x");
        expect(harness.isActive).toBe(true);
        harness.finishSession();
        expect(harness.isActive).toBe(false);
    });
});
