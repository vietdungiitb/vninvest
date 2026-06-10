import { getToolCapabilityDescriptor } from "./forkDrawingSupport.js";
export function evaluateRuntimePolicy(input) {
    const requestedRuntime = input.engineRuntime ?? "fork";
    if (requestedRuntime !== "auto") {
        const reasonCode = input.engineRuntime === undefined
            ? "DEFAULT_FORK_RUNTIME"
            : (requestedRuntime === "legacy" ? "EXPLICIT_LEGACY_REQUEST" : "EXPLICIT_FORK_REQUEST");
        return {
            resolvedRuntime: requestedRuntime,
            reasonCode,
        };
    }
    if (input.drawingUiEnabled !== true) {
        return {
            resolvedRuntime: "fork",
            reasonCode: "DRAWING_UI_DISABLED",
        };
    }
    // 1. Authoring check:
    if (input.drawingActiveTool && input.drawingActiveTool !== "cursor" && input.drawingActiveTool !== "crosshair") {
        const desc = getToolCapabilityDescriptor(input.drawingActiveTool);
        if (!desc) {
            return {
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_NOT_REGISTERED",
            };
        }
        if (desc.status === "disabled") {
            return {
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_STATUS_DISABLED",
            };
        }
        if (desc.status === "renderOnly") {
            return {
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_AUTHORING_UNSUPPORTED",
            };
        }
        if (!desc.capabilities.canAuthor) {
            return {
                resolvedRuntime: "legacy",
                reasonCode: "TOOL_AUTHORING_UNSUPPORTED",
            };
        }
        return {
            resolvedRuntime: "fork",
            reasonCode: "FORK_CAPABILITY_OK",
        };
    }
    // 2. Manipulation check:
    if (input.drawingActiveTool === "cursor") {
        if (input.selectedDrawingType) {
            const desc = getToolCapabilityDescriptor(input.selectedDrawingType);
            if (!desc) {
                return {
                    resolvedRuntime: "legacy",
                    reasonCode: "TOOL_NOT_REGISTERED",
                };
            }
            if (desc.status !== "parityReady" || !desc.capabilities.canManipulate) {
                return {
                    resolvedRuntime: "legacy",
                    reasonCode: "SELECTED_TOOL_MANIPULATION_UNSUPPORTED",
                };
            }
            return {
                resolvedRuntime: "fork",
                reasonCode: "FORK_CAPABILITY_OK",
            };
        }
        return {
            resolvedRuntime: "fork",
            reasonCode: "AUTO_DEFAULT_FORK_RUNTIME",
        };
    }
    return {
        resolvedRuntime: "fork",
        reasonCode: "AUTO_DEFAULT_FORK_RUNTIME",
    };
}
export function shouldForceLegacyRuntime(input) {
    const output = evaluateRuntimePolicy({
        engineRuntime: "auto",
        drawingUiEnabled: input.drawingUiEnabled,
        drawingActiveTool: input.drawingActiveTool,
        selectedDrawingType: input.selectedDrawingType,
    });
    return output.resolvedRuntime === "legacy";
}
export function resolveRequestedRuntime(input) {
    return evaluateRuntimePolicy(input).resolvedRuntime;
}
