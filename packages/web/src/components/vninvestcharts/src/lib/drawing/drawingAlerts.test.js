import { describe, expect, it } from "vitest";
import { evaluateDrawingAlerts, detectPriceCross, isCooldownElapsed, resolveReferencePriceForAlert, } from "./evaluateDrawingAlerts";
function makeHLine(price, overrides = {}) {
    return {
        id: "test-hline",
        type: "hLine",
        points: [{ x: 100, y: price }],
        style: { stroke: "#333", strokeWidth: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        alertCondition: { enabled: true, direction: "either" },
        ...overrides,
    };
}
describe("DT-10 – Drawing Alerts Integration", () => {
    describe("DT10-T03: detectPriceCross()", () => {
        it("DT10-T03-01: crossAbove — prev ≤ ref and curr > ref", () => {
            expect(detectPriceCross(100, 101, 100, "crossAbove")).toBe(true);
        });
        it("DT10-T03-02: crossAbove — exactly on reference does not trigger crossAbove", () => {
            expect(detectPriceCross(100, 100, 100, "crossAbove")).toBe(false);
        });
        it("DT10-T03-03: crossBelow — prev ≥ ref and curr < ref", () => {
            expect(detectPriceCross(100, 99, 100, "crossBelow")).toBe(true);
        });
        it("DT10-T03-04: crossBelow — price stays above ref, no trigger", () => {
            expect(detectPriceCross(101, 102, 100, "crossBelow")).toBe(false);
        });
        it("DT10-T03-05: either — crossAbove triggers", () => {
            expect(detectPriceCross(99, 101, 100, "either")).toBe(true);
        });
        it("DT10-T03-06: either — crossBelow triggers", () => {
            expect(detectPriceCross(101, 99, 100, "either")).toBe(true);
        });
        it("DT10-T03-07: either — no cross, stays same side", () => {
            expect(detectPriceCross(101, 102, 100, "either")).toBe(false);
        });
    });
    describe("DT10-T04: isCooldownElapsed()", () => {
        it("DT10-T04-01: no triggeredAt = cooldown elapsed", () => {
            expect(isCooldownElapsed({ enabled: true, direction: "either" }, Date.now())).toBe(true);
        });
        it("DT10-T04-02: triggered just now = NOT elapsed (default 60s cooldown)", () => {
            const now = Date.now();
            expect(isCooldownElapsed({ enabled: true, direction: "either", triggeredAt: now }, now)).toBe(false);
        });
        it("DT10-T04-03: triggered 61s ago with default cooldown = elapsed", () => {
            const now = Date.now();
            expect(isCooldownElapsed({ enabled: true, direction: "either", triggeredAt: now - 61_000 }, now)).toBe(true);
        });
        it("DT10-T04-04: custom 5s cooldown elapsed after 6s", () => {
            const now = Date.now();
            expect(isCooldownElapsed({ enabled: true, direction: "either", cooldownMs: 5_000, triggeredAt: now - 6_000 }, now)).toBe(true);
        });
        it("DT10-T04-05: custom 5s cooldown NOT elapsed after 4s", () => {
            const now = Date.now();
            expect(isCooldownElapsed({ enabled: true, direction: "either", cooldownMs: 5_000, triggeredAt: now - 4_000 }, now)).toBe(false);
        });
    });
    describe("DT10-T01/T02: resolveReferencePriceForAlert()", () => {
        it("DT10-T02-01: hLine returns first point y", () => {
            expect(resolveReferencePriceForAlert(makeHLine(150))).toBe(150);
        });
        it("DT10-T02-02: trendLine returns linear interpolation at nowMs", () => {
            const drawing = makeHLine(100, {
                type: "trendLine",
                points: [{ x: 0, y: 100 }, { x: 100, y: 200 }],
            });
            // Midpoint
            expect(resolveReferencePriceForAlert(drawing, 50)).toBe(150);
            // Start point
            expect(resolveReferencePriceForAlert(drawing, 0)).toBe(100);
            // End point
            expect(resolveReferencePriceForAlert(drawing, 100)).toBe(200);
            // Extrapolation
            expect(resolveReferencePriceForAlert(drawing, 200)).toBe(300);
        });
        it("DT10-T02-03: empty points returns null", () => {
            const drawing = makeHLine(100, { points: [] });
            expect(resolveReferencePriceForAlert(drawing)).toBeNull();
        });
    });
    describe("DT10-T03/T04: evaluateDrawingAlerts()", () => {
        it("DT10-T03-08: fires when price crosses above hLine reference", () => {
            const drawing = makeHLine(100);
            const events = evaluateDrawingAlerts([drawing], 99, 101, Date.now());
            expect(events).toHaveLength(1);
            expect(events[0].direction).toBe("crossAbove");
            expect(events[0].referencePrice).toBe(100);
        });
        it("DT10-T03-09: fires when price crosses below hLine reference", () => {
            const drawing = makeHLine(100, { alertCondition: { enabled: true, direction: "crossBelow" } });
            const events = evaluateDrawingAlerts([drawing], 101, 99, Date.now());
            expect(events).toHaveLength(1);
            expect(events[0].direction).toBe("crossBelow");
        });
        it("DT10-T03-10: does not fire when no cross occurs", () => {
            const drawing = makeHLine(100);
            const events = evaluateDrawingAlerts([drawing], 101, 102, Date.now());
            expect(events).toHaveLength(0);
        });
        it("DT10-T03-11: does not fire when alert is disabled", () => {
            const drawing = makeHLine(100, { alertCondition: { enabled: false, direction: "either" } });
            const events = evaluateDrawingAlerts([drawing], 99, 101, Date.now());
            expect(events).toHaveLength(0);
        });
        it("DT10-T04-06: does not fire during cooldown", () => {
            const now = Date.now();
            const drawing = makeHLine(100, {
                alertCondition: { enabled: true, direction: "either", cooldownMs: 60_000, triggeredAt: now - 1_000 },
            });
            const events = evaluateDrawingAlerts([drawing], 99, 101, now);
            expect(events).toHaveLength(0);
        });
        it("DT10-T04-07: fires after cooldown expires", () => {
            const now = Date.now();
            const drawing = makeHLine(100, {
                alertCondition: { enabled: true, direction: "either", cooldownMs: 5_000, triggeredAt: now - 6_000 },
            });
            const events = evaluateDrawingAlerts([drawing], 99, 101, now);
            expect(events).toHaveLength(1);
        });
        it("DT10-T03-12: mutates triggeredAt on fired condition", () => {
            const now = Date.now();
            const drawing = makeHLine(100);
            evaluateDrawingAlerts([drawing], 99, 101, now);
            expect(drawing.alertCondition?.triggeredAt).toBe(now);
        });
        it("DT10-T03-13: supports and evaluates multiple alertConditions", () => {
            const now = Date.now();
            const drawing = makeHLine(100, {
                alertCondition: undefined,
                alertConditions: [
                    { enabled: true, direction: "crossAbove" },
                    { enabled: true, direction: "crossBelow" },
                    { enabled: false, direction: "either" }
                ]
            });
            // Price crosses above: fires the first one
            const events1 = evaluateDrawingAlerts([drawing], 99, 101, now);
            expect(events1).toHaveLength(1);
            expect(events1[0].condition).toBe(drawing.alertConditions[0]);
            expect(drawing.alertConditions[0].triggeredAt).toBe(now);
            // Price crosses below: fires the second one
            const events2 = evaluateDrawingAlerts([drawing], 101, 99, now + 100);
            expect(events2).toHaveLength(1);
            expect(events2[0].condition).toBe(drawing.alertConditions[1]);
            expect(drawing.alertConditions[1].triggeredAt).toBe(now + 100);
        });
    });
});
