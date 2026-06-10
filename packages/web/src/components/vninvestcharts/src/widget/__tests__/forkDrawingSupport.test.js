import { describe, expect, it } from "vitest";
import { buildToolCoverageMatrix, getToolCapabilityDescriptor, isForkMultiStepTool, isForkSinglePointTool, isForkSupportedDrawingAuthoringTool, isForkSupportedDrawingManipulationType, } from "../forkDrawingSupport";
describe("forkDrawingSupport", () => {
    describe("getToolCapabilityDescriptor", () => {
        it("returns undefined for empty/null inputs", () => {
            expect(getToolCapabilityDescriptor(undefined)).toBeUndefined();
            expect(getToolCapabilityDescriptor("")).toBeUndefined();
        });
        it("returns the correct descriptor for trendLine (parityReady)", () => {
            const desc = getToolCapabilityDescriptor("trendLine");
            expect(desc).toBeDefined();
            expect(desc?.phase).toBe("A");
            expect(desc?.status).toBe("parityReady");
            expect(desc?.capabilities.canAuthor).toBe(true);
            expect(desc?.capabilities.canManipulate).toBe(true);
        });
        it("returns the correct descriptor for polyline (parityReady)", () => {
            const desc = getToolCapabilityDescriptor("polyline");
            expect(desc).toBeDefined();
            expect(desc?.phase).toBe("A");
            expect(desc?.status).toBe("parityReady");
            expect(desc?.capabilities.canMultiStep).toBe(true);
        });
        it("returns the correct descriptor for fibonacci (parityReady)", () => {
            const desc = getToolCapabilityDescriptor("fibonacci");
            expect(desc).toBeDefined();
            expect(desc?.phase).toBe("B");
            expect(desc?.status).toBe("parityReady");
        });
    });
    describe("buildToolCoverageMatrix", () => {
        it("generates a stable matrix and summary from the registry", () => {
            const matrix = buildToolCoverageMatrix();
            expect(matrix.summary.total).toBe(54);
            expect(matrix.rows).toHaveLength(54);
            expect(matrix.byStatus.parityReady.length).toBeGreaterThan(0);
            expect(matrix.byPhase.A.length).toBeGreaterThan(0);
            expect(matrix.byPhase.B.length).toBeGreaterThan(0);
            expect(matrix.byPhase.C.length).toBeGreaterThan(0);
            expect(matrix.rows[0]?.tool).toBe("abcdPattern");
            expect(matrix.rows.at(-1)?.tool).toBe("xabcdPattern");
            expect(matrix.byStatus.parityReady.map((row) => row.tool)).toContain("trendLine");
            expect(matrix.byStatus.parityReady.map((row) => row.tool)).toContain("polyline");
        });
    });
    describe("isForkSupportedDrawingAuthoringTool", () => {
        it("returns true for enabled Phase A tools like trendLine", () => {
            expect(isForkSupportedDrawingAuthoringTool("trendLine")).toBe(true);
            expect(isForkSupportedDrawingAuthoringTool("hLine")).toBe(true);
        });
        it("returns true for tools like polyline", () => {
            expect(isForkSupportedDrawingAuthoringTool("polyline")).toBe(true);
        });
        it("returns true for supported tools like fibonacci", () => {
            expect(isForkSupportedDrawingAuthoringTool("fibonacci")).toBe(true);
        });
        it("returns false for invalid inputs", () => {
            expect(isForkSupportedDrawingAuthoringTool(undefined)).toBe(false);
            expect(isForkSupportedDrawingAuthoringTool("invalidToolName")).toBe(false);
        });
    });
    describe("isForkSupportedDrawingManipulationType", () => {
        it("returns true for parityReady tools", () => {
            expect(isForkSupportedDrawingManipulationType("trendLine")).toBe(true);
            expect(isForkSupportedDrawingManipulationType("rectangle")).toBe(true);
        });
        it("returns true for polyline and fibonacci since they are parityReady", () => {
            expect(isForkSupportedDrawingManipulationType("polyline")).toBe(true);
            expect(isForkSupportedDrawingManipulationType("fibonacci")).toBe(true);
        });
    });
    describe("isForkMultiStepTool", () => {
        it("returns true for polyline and other multistep tools", () => {
            expect(isForkMultiStepTool("polyline")).toBe(true);
            expect(isForkMultiStepTool("elliottImpulse")).toBe(true);
        });
        it("returns false for single-segment or simple tools", () => {
            expect(isForkMultiStepTool("trendLine")).toBe(false);
            expect(isForkMultiStepTool("hLine")).toBe(false);
        });
    });
    describe("isForkSinglePointTool", () => {
        it("returns true for hLine, vLine, text, priceLabel", () => {
            expect(isForkSinglePointTool("hLine")).toBe(true);
            expect(isForkSinglePointTool("vLine")).toBe(true);
            expect(isForkSinglePointTool("text")).toBe(true);
            expect(isForkSinglePointTool("priceLabel")).toBe(true);
        });
        it("returns false for multi-point tools", () => {
            expect(isForkSinglePointTool("trendLine")).toBe(false);
            expect(isForkSinglePointTool("rectangle")).toBe(false);
        });
    });
});
