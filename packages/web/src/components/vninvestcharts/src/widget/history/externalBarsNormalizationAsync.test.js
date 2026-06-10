import { describe, expect, it } from "vitest";
import { normalizeExternalBars } from "./externalBarsNormalization";
import { EXTERNAL_BARS_WORKER_THRESHOLD, normalizeExternalBarsAsync, shouldUseExternalBarsWorker, } from "./externalBarsNormalizationAsync";
function createRawBar(index) {
    return {
        date: new Date(Date.UTC(2024, 0, 1, index)).toISOString(),
        open: 100 + index,
        high: 101 + index,
        low: 99 + index,
        close: 100.5 + index,
        volume: 10_000 + index,
    };
}
class MockNormalizationWorker {
    onmessage = null;
    onerror = null;
    lastRequest = null;
    terminated = false;
    postMessage(message) {
        this.lastRequest = message;
    }
    terminate() {
        this.terminated = true;
    }
}
describe("normalizeExternalBarsAsync", () => {
    it("stays on the main thread below the worker threshold", async () => {
        const data = [createRawBar(0), createRawBar(1)];
        const result = await normalizeExternalBarsAsync(data);
        expect(shouldUseExternalBarsWorker(data)).toBe(false);
        expect(result.bars).toHaveLength(2);
    });
    it("uses the worker path for wide datasets", async () => {
        const data = Array.from({ length: EXTERNAL_BARS_WORKER_THRESHOLD }, (_, index) => createRawBar(index));
        const worker = new MockNormalizationWorker();
        const promise = normalizeExternalBarsAsync(data, {
            useWorker: true,
            workerFactory: () => worker,
        });
        const requestId = worker.lastRequest?.requestId;
        worker.onmessage?.({
            data: {
                requestId: requestId ?? -1,
                result: normalizeExternalBars(data),
            },
        });
        const result = await promise;
        expect(worker.terminated).toBe(true);
        expect(result.bars).toHaveLength(EXTERNAL_BARS_WORKER_THRESHOLD);
    });
    it("aborts an in-flight worker request", async () => {
        const data = Array.from({ length: EXTERNAL_BARS_WORKER_THRESHOLD }, (_, index) => createRawBar(index));
        const worker = new MockNormalizationWorker();
        const controller = new AbortController();
        const promise = normalizeExternalBarsAsync(data, {
            useWorker: true,
            workerFactory: () => worker,
            signal: controller.signal,
        });
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: "AbortError" });
        expect(worker.terminated).toBe(true);
    });
});
