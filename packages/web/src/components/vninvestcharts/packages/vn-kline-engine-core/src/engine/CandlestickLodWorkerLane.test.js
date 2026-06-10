import { describe, expect, it, vi } from "vitest";
import * as lodBucketizerAsyncModule from "./LodBucketizerAsync";
import { CandlestickLodWorkerLane } from "./CandlestickLodWorkerLane";
function createCandles(length) {
    return Array.from({ length }, (_, index) => ({
        x: index,
        open: 100 + index,
        high: 102 + index,
        low: 99 + index,
        close: 101 + index,
    }));
}
describe("CandlestickLodWorkerLane", () => {
    it("stores worker LOD output and schedules a plot repaint after async completion", async () => {
        const aggregateSpy = vi.spyOn(lodBucketizerAsyncModule, "aggregateOhlcAsync").mockResolvedValue([
            { time: 0, open: 100, high: 110, low: 95, close: 108, volume: 0, sourceCount: 8 },
            { time: 8, open: 108, high: 118, low: 104, close: 115, volume: 0, sourceCount: 8 },
        ]);
        const schedulePlotRender = vi.fn();
        const lane = new CandlestickLodWorkerLane(() => false, (lodData) => [Math.min(...lodData.map((datum) => datum.low)), Math.max(...lodData.map((datum) => datum.high))], schedulePlotRender);
        const cache = new Map();
        const data = createCandles(lodBucketizerAsyncModule.LOD_WORKER_THRESHOLD);
        const resolution = lane.resolve(cache, "price:candle-main:price-right", data, 8);
        expect(resolution.lodData).toBeNull();
        expect(resolution.fromWorker).toBe(false);
        expect(aggregateSpy).toHaveBeenCalledTimes(1);
        await aggregateSpy.mock.results[0]?.value;
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(schedulePlotRender).toHaveBeenCalledTimes(1);
        expect(cache.get("price:candle-main:price-right")).toMatchObject({
            lodBucketSize: 8,
            requestKey: resolution.requestKey,
            lodSource: "worker",
            lodData: [
                { x: 0, open: 100, high: 110, low: 95, close: 108 },
                { x: 8, open: 108, high: 118, low: 104, close: 115 },
            ],
        });
        aggregateSpy.mockRestore();
    });
});
