import { describe, expect, it } from "vitest";
import { aggregateOhlc } from "./LodBucketizer";
import { aggregateOhlcAsync, LOD_WORKER_THRESHOLD, shouldUseLodWorker, } from "./LodBucketizerAsync";
function createCandle(index) {
    return {
        time: index,
        open: 100 + index,
        high: 101 + index,
        low: 99 + index,
        close: 100.5 + index,
        volume: 1_000 + index,
    };
}
class MockLodWorker {
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
describe("aggregateOhlcAsync", () => {
    it("stays on the main thread below the worker threshold", async () => {
        const candles = Array.from({ length: 32 }, (_, index) => createCandle(index));
        const result = await aggregateOhlcAsync(candles, 4);
        expect(shouldUseLodWorker(candles, 4)).toBe(false);
        expect(result).toEqual(aggregateOhlc(candles, 4));
    });
    it("uses the worker path for wide visible slices", async () => {
        const candles = Array.from({ length: LOD_WORKER_THRESHOLD }, (_, index) => createCandle(index));
        const worker = new MockLodWorker();
        const promise = aggregateOhlcAsync(candles, 8, {
            useWorker: true,
            workerFactory: () => worker,
        });
        const requestId = worker.lastRequest?.requestId;
        worker.onmessage?.({
            data: {
                requestId: requestId ?? -1,
                buckets: aggregateOhlc(candles, 8),
            },
        });
        const result = await promise;
        expect(worker.terminated).toBe(true);
        expect(result).toEqual(aggregateOhlc(candles, 8));
    });
    it("aborts an in-flight worker request", async () => {
        const candles = Array.from({ length: LOD_WORKER_THRESHOLD }, (_, index) => createCandle(index));
        const worker = new MockLodWorker();
        const controller = new AbortController();
        const promise = aggregateOhlcAsync(candles, 8, {
            useWorker: true,
            workerFactory: () => worker,
            signal: controller.signal,
        });
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: "AbortError" });
        expect(worker.terminated).toBe(true);
    });
});
