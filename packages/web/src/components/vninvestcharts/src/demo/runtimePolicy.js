import { resolveRequestedRuntime } from "../widget/runtimePolicy.js";
function isDrawingIntentActive(activeTool) {
    return activeTool !== "cursor" && activeTool !== "crosshair";
}
export function resolveDemoRuntimePolicy(input) {
    if (input.runtimeLane === "legacy") {
        return {
            predictedRuntime: "legacy",
            drawingUiEnabled: true,
        };
    }
    if (input.runtimeLane === "fork") {
        return {
            predictedRuntime: "fork",
            drawingUiEnabled: true,
        };
    }
    const drawingRuntimeRequested = isDrawingIntentActive(input.activeTool)
        || input.drawingDockRequested === true
        || typeof input.selectedDrawingType === "string";
    const drawingUiEnabled = drawingRuntimeRequested;
    return {
        predictedRuntime: resolveRequestedRuntime({
            engineRuntime: input.runtimeLane,
            drawingUiEnabled,
            drawingActiveTool: input.activeTool,
            selectedDrawingType: input.selectedDrawingType,
        }),
        drawingUiEnabled,
    };
}
