import { describe, expect, it } from "vitest";
import { MemoryBudgetPolicy } from "./MemoryBudgetPolicy";
function makeChunk(key, anchorTime, count) {
    return { key, anchorTime, count };
}
describe("MemoryBudgetPolicy", () => {
    it("KF12-T11-11: throws when lowWatermark >= highWatermark", () => {
        expect(() => new MemoryBudgetPolicy({ highWatermark: 100, lowWatermark: 100 })).toThrow();
        expect(() => new MemoryBudgetPolicy({ highWatermark: 100, lowWatermark: 150 })).toThrow();
    });
    it("KF12-T11-12: returns empty plan when resident <= highWatermark", () => {
        const policy = new MemoryBudgetPolicy({ highWatermark: 1000, lowWatermark: 600 });
        const chunks = [makeChunk("a", 1000, 300), makeChunk("b", 2000, 400)];
        const plan = policy.plan(chunks);
        expect(plan.keysToEvict).toHaveLength(0);
        expect(plan.projectedCount).toBe(700);
    });
    it("KF12-T11-13: evicts oldest chunks first when over highWatermark", () => {
        const policy = new MemoryBudgetPolicy({ highWatermark: 1000, lowWatermark: 600 });
        const chunks = [
            makeChunk("new", 3000, 400), // most recent
            makeChunk("old", 1000, 400), // oldest
            makeChunk("mid", 2000, 400), // middle
        ];
        const plan = policy.plan(chunks); // total=1200 > 1000
        // Must evict oldest first: "old" (time=1000). After evict: 1200-400=800 > 600, next oldest: "mid" (time=2000). After: 800-400=400 <= 600
        expect(plan.keysToEvict).toContain("old");
        expect(plan.keysToEvict).toContain("mid");
        expect(plan.keysToEvict).not.toContain("new");
        expect(plan.projectedCount).toBe(400);
    });
    it("KF12-T11-14: stops evicting as soon as resident drops to lowWatermark", () => {
        const policy = new MemoryBudgetPolicy({ highWatermark: 1000, lowWatermark: 600 });
        const chunks = [
            makeChunk("a", 1000, 500), // oldest — 500 candles
            makeChunk("b", 2000, 500), // newest — 500 candles
        ];
        // total = 1000, NOT > 1000 → no eviction
        const plan = policy.plan(chunks);
        expect(plan.keysToEvict).toHaveLength(0);
    });
    it("KF12-T11-15: evicts only enough to reach lowWatermark (hysteresis)", () => {
        const policy = new MemoryBudgetPolicy({ highWatermark: 900, lowWatermark: 600 });
        const chunks = [
            makeChunk("oldest", 1000, 300), // 300 candles
            makeChunk("middle", 2000, 300),
            makeChunk("newest", 3000, 300),
        ]; // total = 900 = highWatermark → no eviction needed
        const planA = policy.plan(chunks);
        expect(planA.keysToEvict).toHaveLength(0);
        // Add one more to push over
        const chunks2 = [...chunks, makeChunk("extra", 4000, 100)]; // total=1000 > 900
        const planB = policy.plan(chunks2);
        // After evicting "oldest" (300): 700 > 600 → evict "middle" (300): 400 <= 600 → stop
        expect(planB.keysToEvict).toContain("oldest");
        expect(planB.keysToEvict).toContain("middle");
        expect(planB.keysToEvict).not.toContain("newest");
        expect(planB.keysToEvict).not.toContain("extra");
        expect(planB.projectedCount).toBe(400);
    });
    it("KF12-T11-16: handles empty chunk list", () => {
        const policy = new MemoryBudgetPolicy({ highWatermark: 1000, lowWatermark: 600 });
        const plan = policy.plan([]);
        expect(plan.keysToEvict).toHaveLength(0);
        expect(plan.projectedCount).toBe(0);
    });
});
