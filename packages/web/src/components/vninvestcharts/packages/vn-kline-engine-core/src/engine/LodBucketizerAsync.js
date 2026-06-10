import { aggregateOhlc } from "./LodBucketizer.js";
export const LOD_WORKER_THRESHOLD = 4_000;
let nextLodWorkerRequestId = 1;
export function shouldUseLodWorker(candles, bucketSize) {
    return bucketSize > 1 && candles.length >= LOD_WORKER_THRESHOLD;
}
function createAbortError() {
    if (typeof DOMException !== "undefined") {
        return new DOMException("LOD aggregation aborted", "AbortError");
    }
    const error = new Error("LOD aggregation aborted");
    error.name = "AbortError";
    return error;
}
function createLodBucketizerWorker() {
    return new Worker(new URL("./LodBucketizer.worker.ts", import.meta.url), { type: "module" });
}
function resolveWorkerError(event) {
    if (event.error instanceof Error) {
        return event.error;
    }
    if (typeof event.message === "string" && event.message.trim().length > 0) {
        return new Error(event.message);
    }
    return new Error("LOD aggregation worker failed");
}
function runWorkerAggregation(candles, bucketSize, options) {
    const worker = (options.workerFactory ?? createLodBucketizerWorker)();
    const requestId = nextLodWorkerRequestId;
    nextLodWorkerRequestId += 1;
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
            settle(() => resolve(event.data.buckets ?? []));
        };
        worker.onerror = (event) => {
            settle(() => reject(resolveWorkerError(event)));
        };
        options.signal?.addEventListener("abort", handleAbort, { once: true });
        worker.postMessage({ requestId, candles, bucketSize });
    });
}
export async function aggregateOhlcAsync(candles, bucketSize, options = {}) {
    const useWorker = options.useWorker ?? (typeof Worker !== "undefined" && shouldUseLodWorker(candles, bucketSize));
    if (!useWorker) {
        return aggregateOhlc(candles, bucketSize);
    }
    try {
        return await runWorkerAggregation(candles, bucketSize, options);
    }
    catch (error) {
        if (options.signal?.aborted) {
            throw error;
        }
        return aggregateOhlc(candles, bucketSize);
    }
}
