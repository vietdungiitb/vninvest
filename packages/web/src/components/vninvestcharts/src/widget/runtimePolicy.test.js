import { describe, expect, it } from "vitest";
import { evaluateRuntimePolicy, resolveRequestedRuntime, shouldForceLegacyRuntime } from "./runtimePolicy";
describe("widget runtime policy", () => {
    it("returns deterministic reason codes for explicit runtime requests", () => {
        expect(evaluateRuntimePolicy({})).toEqual({
            resolvedRuntime: "fork",
            reasonCode: "DEFAULT_FORK_RUNTIME",
        });
        expect(evaluateRuntimePolicy({ engineRuntime: "legacy" })).toEqual({
            resolvedRuntime: "legacy",
            reasonCode: "EXPLICIT_LEGACY_REQUEST",
        });
        expect(evaluateRuntimePolicy({ engineRuntime: "fork" })).toEqual({
            resolvedRuntime: "fork",
            reasonCode: "EXPLICIT_FORK_REQUEST",
        });
    });
    it("keeps explicit runtime requests unchanged", () => {
        expect(resolveRequestedRuntime({ engineRuntime: "legacy", drawingUiEnabled: false })).toBe("legacy");
        expect(resolveRequestedRuntime({ engineRuntime: "fork", drawingUiEnabled: true })).toBe("fork");
        expect(resolveRequestedRuntime({ drawingUiEnabled: true })).toBe("fork");
    });
    it("routes auto to fork for supported drawing surfaces and legacy for unsupported ones", () => {
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "trendLine",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "hLine",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "vLine",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "arrow",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "text",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "priceLabel",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "callout",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "rectangle",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "circle",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "ellipse",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "cursor",
            selectedDrawingType: "rectangle",
        })).toBe("fork");
        expect(resolveRequestedRuntime({
            engineRuntime: "auto",
            drawingUiEnabled: true,
            drawingActiveTool: "unregisteredTool",
        })).toBe("legacy");
        expect(resolveRequestedRuntime({ engineRuntime: "auto", drawingUiEnabled: true })).toBe("fork");
        expect(resolveRequestedRuntime({ engineRuntime: "auto", drawingUiEnabled: false })).toBe("fork");
        expect(resolveRequestedRuntime({ engineRuntime: "auto" })).toBe("fork");
    });
    it("reports the forced-legacy predicate from drawing support", () => {
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "trendLine" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "hLine" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "vLine" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "arrow" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "text" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "priceLabel" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "callout" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "rectangle" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "circle" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "ellipse" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "cursor", selectedDrawingType: "rectangle" })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true, drawingActiveTool: "unregisteredTool" })).toBe(true);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: true })).toBe(false);
        expect(shouldForceLegacyRuntime({ drawingUiEnabled: false })).toBe(false);
        expect(shouldForceLegacyRuntime({})).toBe(false);
    });
    describe("evaluateRuntimePolicy details", () => {
        it("M2-T02 & M2-T03: evaluates authoring lane with precise reason codes", () => {
            // Supported authoring tool
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "trendLine",
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "FORK_CAPABILITY_OK",
            });
            // Supported active tool (pitchfork)
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "pitchfork",
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "FORK_CAPABILITY_OK",
            });
            // Unregistered active tool
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "unknownSuperTool",
            })).toEqual({
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_NOT_REGISTERED",
            });
        });
        it("M2-T02 & M2-T04: evaluates manipulation lane with precise reason codes", () => {
            // Cursor mode with supported selected drawing
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "cursor",
                selectedDrawingType: "rectangle",
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "FORK_CAPABILITY_OK",
            });
            // Cursor mode with supported selected drawing (pitchfork)
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "cursor",
                selectedDrawingType: "pitchfork",
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "FORK_CAPABILITY_OK",
            });
            // Cursor mode with unregistered selected drawing
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "cursor",
                selectedDrawingType: "mythicalDrawingShape",
            })).toEqual({
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_NOT_REGISTERED",
            });
            // Cursor mode with nothing selected
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
                drawingActiveTool: "cursor",
                selectedDrawingType: null,
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "AUTO_DEFAULT_FORK_RUNTIME",
            });
        });
        it("M2-T02 & M2-T05: evaluates unsupported and disabled UI fallback lanes", () => {
            // Drawing UI disabled
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: false,
                drawingActiveTool: "trendLine",
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "DRAWING_UI_DISABLED",
            });
            // No active tool specified (fallback to legacy)
            expect(evaluateRuntimePolicy({
                engineRuntime: "auto",
                drawingUiEnabled: true,
            })).toEqual({
                resolvedRuntime: "fork",
                reasonCode: "AUTO_DEFAULT_FORK_RUNTIME",
            });
        });
    });
});
