import { describe, expect, it } from "vitest";
import { resolveDemoRuntimePolicy } from "../runtimePolicy";
describe("resolveDemoRuntimePolicy", () => {
    it("keeps legacy lane on the legacy runtime with drawing enabled", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "legacy",
            activeTool: "cursor",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "legacy",
            drawingUiEnabled: true,
        });
    });
    it("keeps fork lane on the fork runtime with drawing enabled", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "fork",
            activeTool: "hLine",
            drawingCount: 4,
            drawingDockRequested: true,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
    });
    it("routes auto to fork for a series-only surface", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "cursor",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: false,
        });
    });
    it("routes auto to fork when a supported drawing tool is active", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "trendLine",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "rectangle",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "circle",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "ellipse",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
    });
    it("routes auto to fork when cursor edits a supported selected drawing", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "cursor",
            drawingCount: 1,
            selectedDrawingType: "rectangle",
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
    });
    it("routes auto to legacy when an unsupported drawing tool is active", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "unregisteredTool",
            drawingCount: 0,
        })).toEqual({
            predictedRuntime: "legacy",
            drawingUiEnabled: true,
        });
    });
    it("keeps auto on fork when drawings already exist but no drawing ui is requested", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "cursor",
            drawingCount: 2,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: false,
        });
    });
    it("routes auto to fork when the drawing dock is requested", () => {
        expect(resolveDemoRuntimePolicy({
            runtimeLane: "auto",
            activeTool: "cursor",
            drawingCount: 0,
            drawingDockRequested: true,
        })).toEqual({
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        });
    });
});
