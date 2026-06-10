/**
 * multiSelectBatch.test.ts — Unit tests for batch multi-select drawing operations.
 * GAP-4 / TASK-12
 */
import { describe, expect, it } from "vitest";
import { applyBatchColor, applyBatchDelete, applyBatchLock, applyBatchVisible, resolveNextLockState, resolveNextVisibleState, } from "./multiSelectBatch";
function makeDrawing(id, overrides = {}) {
    return {
        id,
        type: "trendLine",
        points: [
            { x: 0, y: 100 },
            { x: 100, y: 200 },
        ],
        style: { stroke: "#2962ff", strokeWidth: 1, opacity: 1 },
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}
const drawingA = makeDrawing("A");
const drawingB = makeDrawing("B", { locked: true });
const drawingC = makeDrawing("C", { visible: false });
const drawings = [drawingA, drawingB, drawingC];
// ──────────────────────────────────────────────────────────────────────────────
// applyBatchDelete
// ──────────────────────────────────────────────────────────────────────────────
describe("applyBatchDelete", () => {
    it("MSB-T01: removes unlocked selected drawings", () => {
        const result = applyBatchDelete(drawings, ["A", "C"]);
        expect(result.map((d) => d.id)).toEqual(["B"]); // A and C are unlocked → removed. B is locked → preserved.
    });
    it("MSB-T02: preserves locked drawings even when selected", () => {
        const result = applyBatchDelete(drawings, ["B"]); // B is locked
        expect(result.map((d) => d.id)).toEqual(["A", "B", "C"]);
    });
    it("MSB-T03: returns original array when no matching IDs", () => {
        const result = applyBatchDelete(drawings, ["X", "Y"]);
        expect(result).toHaveLength(3);
    });
    it("MSB-T04: returns empty array when all unlocked selected", () => {
        const unlocked = [makeDrawing("X"), makeDrawing("Y")];
        const result = applyBatchDelete(unlocked, ["X", "Y"]);
        expect(result).toHaveLength(0);
    });
});
// Re-verify MSB-T01 logic: C is NOT locked so it IS deleted
describe("applyBatchDelete edge cases", () => {
    it("MSB-T01b: C (visible:false but unlocked) is deleted", () => {
        const result = applyBatchDelete(drawings, ["A", "C"]);
        const ids = result.map((d) => d.id);
        expect(ids).not.toContain("A");
        expect(ids).toContain("B"); // locked → preserved
        expect(ids).not.toContain("C");
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// applyBatchLock
// ──────────────────────────────────────────────────────────────────────────────
describe("applyBatchLock", () => {
    it("MSB-T05: locks all selected drawings", () => {
        const result = applyBatchLock(drawings, ["A", "C"], true);
        expect(result.find((d) => d.id === "A")?.locked).toBe(true);
        expect(result.find((d) => d.id === "C")?.locked).toBe(true);
        expect(result.find((d) => d.id === "B")?.locked).toBe(true); // unchanged
    });
    it("MSB-T06: unlocks selected drawings", () => {
        const result = applyBatchLock(drawings, ["B"], false);
        expect(result.find((d) => d.id === "B")?.locked).toBe(false);
    });
    it("MSB-T07: does not mutate original drawings", () => {
        applyBatchLock(drawings, ["A"], true);
        expect(drawingA.locked).toBeUndefined(); // original unchanged
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// applyBatchVisible
// ──────────────────────────────────────────────────────────────────────────────
describe("applyBatchVisible", () => {
    it("MSB-T08: hides all selected drawings", () => {
        const result = applyBatchVisible(drawings, ["A", "B"], false);
        expect(result.find((d) => d.id === "A")?.visible).toBe(false);
        expect(result.find((d) => d.id === "B")?.visible).toBe(false);
        expect(result.find((d) => d.id === "C")?.visible).toBe(false); // unchanged
    });
    it("MSB-T09: shows all selected drawings", () => {
        const result = applyBatchVisible(drawings, ["C"], true);
        expect(result.find((d) => d.id === "C")?.visible).toBe(true);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// applyBatchColor
// ──────────────────────────────────────────────────────────────────────────────
describe("applyBatchColor", () => {
    it("MSB-T10: applies stroke color to selected drawings", () => {
        const result = applyBatchColor(drawings, ["A", "B"], "#ff0000");
        expect(result.find((d) => d.id === "A")?.style.stroke).toBe("#ff0000");
        expect(result.find((d) => d.id === "B")?.style.stroke).toBe("#ff0000");
        expect(result.find((d) => d.id === "C")?.style.stroke).toBe("#2962ff"); // unchanged
    });
    it("MSB-T11: preserves other style properties", () => {
        const result = applyBatchColor(drawings, ["A"], "#00ff00");
        const a = result.find((d) => d.id === "A");
        expect(a.style.strokeWidth).toBe(1);
        expect(a.style.opacity).toBe(1);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// resolveNextLockState
// ──────────────────────────────────────────────────────────────────────────────
describe("resolveNextLockState", () => {
    it("MSB-T12: returns true (lock all) when any is unlocked", () => {
        expect(resolveNextLockState(drawings, ["A", "B"])).toBe(true); // A unlocked → lock all
    });
    it("MSB-T13: returns false (unlock all) when all are locked", () => {
        const allLocked = [makeDrawing("X", { locked: true }), makeDrawing("Y", { locked: true })];
        expect(resolveNextLockState(allLocked, ["X", "Y"])).toBe(false);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// resolveNextVisibleState
// ──────────────────────────────────────────────────────────────────────────────
describe("resolveNextVisibleState", () => {
    it("MSB-T14: returns true (show all) when all are hidden", () => {
        const allHidden = [makeDrawing("X", { visible: false }), makeDrawing("Y", { visible: false })];
        expect(resolveNextVisibleState(allHidden, ["X", "Y"])).toBe(true);
    });
    it("MSB-T15: returns false (hide all) when any is visible", () => {
        expect(resolveNextVisibleState(drawings, ["A", "C"])).toBe(false); // A is visible → hide all
    });
});
