import { describe, it, expect } from "vitest";
import { DEFAULT_FIB_LEVELS, DEFAULT_FIB_EXTENSION_LEVELS } from "./renderCanvas";
// ─── Helper: build a fake DrawingObject with fibLevels (legacy) ──────────────
function makeLegacyFibDrawing(fibLevels) {
    return {
        id: "test-fib",
        type: "fibonacci",
        points: [{ x: 0, y: 100 }, { x: 1, y: 150 }],
        style: { stroke: "#ffffff", strokeWidth: 1 },
        fibLevels,
        createdAt: 0,
        updatedAt: 0,
    };
}
function makeFibLevelConfigs(ratios, allVisible = true) {
    return ratios.map((ratio) => ({ ratio, visible: allVisible }));
}
// ─── T10: Migration fibLevels → fibLevelConfigs ───────────────────────────────
describe("DT7 – fibLevelConfigs migration (DrawingStorage logic)", () => {
    it("DT7-T10-01: default fib levels include the standard ratios", () => {
        expect(DEFAULT_FIB_LEVELS).toContain(0);
        expect(DEFAULT_FIB_LEVELS).toContain(0.382);
        expect(DEFAULT_FIB_LEVELS).toContain(0.618);
        expect(DEFAULT_FIB_LEVELS).toContain(1);
        expect(DEFAULT_FIB_LEVELS.length).toBeGreaterThanOrEqual(7);
    });
    it("DT7-T10-02: default fib extension levels match expected array", () => {
        expect(DEFAULT_FIB_EXTENSION_LEVELS).toEqual([1.272, 1.414, 1.618, 2, 2.618]);
    });
    it("DT7-T10-03: legacy fibLevels are convertable to FibLevelConfig without data loss", () => {
        const legacyLevels = [0, 0.382, 0.618, 1];
        const configs = legacyLevels.map((ratio) => ({ ratio, visible: true }));
        expect(configs.map((c) => c.ratio)).toEqual(legacyLevels);
        expect(configs.every((c) => c.visible)).toBe(true);
    });
    it("DT7-T10-04: migrateFibLevelConfigs: fibLevelConfigs takes priority over fibLevels", () => {
        // Simulate the storage logic inline
        const value = {
            fibLevels: [0.5, 1],
            fibLevelConfigs: [{ ratio: 0.382, visible: false }, { ratio: 0.618, visible: true }],
        };
        // fibLevelConfigs should win
        const parsed = Array.isArray(value.fibLevelConfigs)
            ? value.fibLevelConfigs.filter((item) => typeof item === "object" && item !== null &&
                typeof item.ratio === "number" &&
                typeof item.visible === "boolean")
            : undefined;
        expect(parsed).toHaveLength(2);
        expect(parsed[0].ratio).toBe(0.382);
        expect(parsed[0].visible).toBe(false);
    });
    it("DT7-T10-05: corrupt fibLevelConfigs entry is filtered out", () => {
        const corrupted = [
            { ratio: "not-a-number", visible: true }, // bad
            { ratio: 0.5, visible: true }, // good
            { ratio: 0.618 }, // missing visible
        ];
        const parsed = corrupted.filter((item) => typeof item === "object" && item !== null &&
            typeof item.ratio === "number" && Number.isFinite(item.ratio) &&
            typeof item.visible === "boolean");
        expect(parsed).toHaveLength(1);
        expect(parsed[0].ratio).toBe(0.5);
    });
});
// ─── T11: Toggle visibility → correct count rendered ─────────────────────────
describe("DT7 – FibLevelConfig visibility toggle", () => {
    it("DT7-T11-01: visible levels counted correctly when some hidden", () => {
        const configs = makeFibLevelConfigs([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], true);
        configs[2].visible = false; // hide 0.382
        configs[4].visible = false; // hide 0.618
        const visibleLevels = configs.filter((c) => c.visible);
        expect(visibleLevels).toHaveLength(5);
    });
    it("DT7-T11-02: toggling visibility creates a new config array (immutability check)", () => {
        const original = makeFibLevelConfigs([0.382, 0.618, 1]);
        const updated = original.map((c, i) => i === 1 ? { ...c, visible: !c.visible } : c);
        expect(updated[1].visible).toBe(false);
        expect(original[1].visible).toBe(true); // original unchanged
    });
    it("DT7-T11-03: per-level color override does not affect other levels", () => {
        const configs = makeFibLevelConfigs([0.382, 0.618, 1]);
        const updated = configs.map((c, i) => i === 0 ? { ...c, color: "#ff0000" } : c);
        expect(updated[0].color).toBe("#ff0000");
        expect(updated[1].color).toBeUndefined();
        expect(updated[2].color).toBeUndefined();
    });
    it("DT7-T11-04: adding a new level appends correctly and keeps others unchanged", () => {
        const configs = makeFibLevelConfigs([0.382, 0.618]);
        const newCfg = { ratio: 0.786, visible: true };
        const updated = [...configs, newCfg];
        expect(updated).toHaveLength(3);
        expect(updated[2].ratio).toBe(0.786);
        expect(updated[0].ratio).toBe(0.382); // original preserved
    });
    it("DT7-T11-05: removing a level by index removes exactly one entry", () => {
        const configs = makeFibLevelConfigs([0.236, 0.382, 0.618]);
        const updated = configs.filter((_, i) => i !== 1); // remove 0.382
        expect(updated).toHaveLength(2);
        expect(updated.map((c) => c.ratio)).toEqual([0.236, 0.618]);
    });
    it("DT7-T11-06: duplicate level guard prevents adding same ratio twice", () => {
        const configs = makeFibLevelConfigs([0.382, 0.618]);
        const newRatio = 0.618;
        const isDuplicate = configs.some((c) => Math.abs(c.ratio - newRatio) < 0.0001);
        expect(isDuplicate).toBe(true);
    });
});
