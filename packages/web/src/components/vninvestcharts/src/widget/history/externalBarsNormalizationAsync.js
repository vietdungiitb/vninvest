import { normalizeExternalBars } from "./externalBarsNormalization.js";
export const EXTERNAL_BARS_WORKER_THRESHOLD = 10_000;
export const EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT = {
    bars: [],
    invalidCount: 0,
    firstError: null,
};
let nextNormalizationWorkerRequestId = 1;
export function shouldUseExternalBarsWorker(data) {
    return Array.isArray(data) && data.length >= EXTERNAL_BARS_WORKER_THRESHOLD;
}
function createAbortError() {
    if (typeof DOMException !== "undefined") {
        return new DOMException("External bars normalization aborted", "AbortError");
    }
    const error = new Error("External bars normalization aborted");
    error.name = "AbortError";
    return error;
}
function createExternalBarsNormalizationWorker() {
    return new Worker(new URL("./externalBarsNormalization.worker.js", import.meta.url), { type: "module" });
}
function resolveWorkerError(event) {
    if (event.error instanceof Error) {
        return event.error;
    }
    if (typeof event.message === "string" && event.message.trim().length > 0) {
        return new Error(event.message);
    }
    return new Error("External bars normalization worker failed");
}
function runWorkerNormalization(data, options) {
    const worker = (options.workerFactory ?? createExternalBarsNormalizationWorker)();
    const requestId = nextNormalizationWorkerRequestId;
    nextNormalizationWorkerRequestId += 1;
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            worker.onmessage = null;
            worker.onerror = null;
            worker.terminate();
            options.signal?.removeEventListener("abort", handleAbort);
        };
        const settle = (callback) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            callback();
        };
        const handleAbort = () => {
            settle(() => reject(createAbortError()));
        };
        if (options.signal?.aborted) {
            handleAbort();
            return;
        }
        worker.onmessage = (event) => {
            if (event.data.requestId !== requestId) {
                return;
            }
            if (event.data.error) {
                settle(() => reject(new Error(event.data.error)));
                return;
            }
            settle(() => resolve(event.data.result ?? EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT));
        };
        worker.onerror = (event) => {
            settle(() => reject(resolveWorkerError(event)));
        };
        options.signal?.addEventListener("abort", handleAbort, { once: true });
        worker.postMessage({ requestId, data });
    });
}
export async function normalizeExternalBarsAsync(data, options = {}) {
    const useWorker = options.useWorker ?? (typeof Worker !== "undefined" && shouldUseExternalBarsWorker(data));
    if (!useWorker) {
        return normalizeExternalBars(data);
    }
    try {
        return await runWorkerNormalization(data, options);
    }
    catch (error) {
        if (options.signal?.aborted) {
            throw error;
        }
        return normalizeExternalBars(data);
    }
}
