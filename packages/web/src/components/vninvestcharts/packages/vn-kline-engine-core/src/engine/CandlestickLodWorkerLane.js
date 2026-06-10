import { aggregateOhlcAsync, shouldUseLodWorker } from "./LodBucketizerAsync.js";
export function toCandlestickLodWorkerInput(data) {
    return data.map((datum) => ({
        time: datum.x,
        open: datum.open,
        high: datum.high,
        low: datum.low,
        close: datum.close,
        volume: 0,
    }));
}
export function toCandlestickLodData(buckets) {
    return buckets.map((bucket) => ({
        x: bucket.time,
        open: bucket.open,
        high: bucket.high,
        low: bucket.low,
        close: bucket.close,
    }));
}
export class CandlestickLodWorkerLane {
    isDisposed;
    resolveDomain;
    schedulePlotRender;
    pendingRequests = new Map();
    constructor(isDisposed, resolveDomain, schedulePlotRender) {
        this.isDisposed = isDisposed;
        this.resolveDomain = resolveDomain;
        this.schedulePlotRender = schedulePlotRender;
    }
    resolve(cache, cacheKey, data, lodBucketSize) {
        if (lodBucketSize <= 1 || data.length === 0) {
            return { requestKey: null, lodData: null, fromWorker: false };
        }
        const requestKey = this.buildRequestKey(cacheKey, data, lodBucketSize);
        const cached = cache.get(cacheKey);
        if (cached
            && cached.requestKey === requestKey
            && cached.lodBucketSize === lodBucketSize
            && cached.lodSource === "worker") {
            return { requestKey, lodData: cached.lodData, fromWorker: true };
        }
        const pending = this.pendingRequests.get(cacheKey);
        if (pending?.requestKey === requestKey) {
            return { requestKey, lodData: null, fromWorker: false };
        }
        pending?.abortController.abort();
        this.pendingRequests.delete(cacheKey);
        const workerInput = toCandlestickLodWorkerInput(data);
        if (!shouldUseLodWorker(workerInput, lodBucketSize)) {
            return { requestKey, lodData: null, fromWorker: false };
        }
        const abortController = new AbortController();
        this.pendingRequests.set(cacheKey, { requestKey, abortController });
        void aggregateOhlcAsync(workerInput, lodBucketSize, {
            useWorker: true,
            signal: abortController.signal,
        }).then((buckets) => {
            const activeRequest = this.pendingRequests.get(cacheKey);
            if (this.isDisposed()
                || activeRequest?.requestKey !== requestKey
                || abortController.signal.aborted) {
                return;
            }
            this.pendingRequests.delete(cacheKey);
            const lodData = toCandlestickLodData(buckets);
            const domain = this.resolveDomain(lodData);
            if (!domain) {
                return;
            }
            cache.set(cacheKey, {
                lodData,
                lodBucketSize,
                domain,
                requestKey,
                lodSource: "worker",
            });
            this.schedulePlotRender();
        }).catch((error) => {
            if (error?.name === "AbortError") {
                return;
            }
            const activeRequest = this.pendingRequests.get(cacheKey);
            if (activeRequest?.requestKey === requestKey) {
                this.pendingRequests.delete(cacheKey);
            }
        });
        return { requestKey, lodData: null, fromWorker: false };
    }
    abortAll() {
        for (const pending of this.pendingRequests.values()) {
            pending.abortController.abort();
        }
        this.pendingRequests.clear();
    }
    buildRequestKey(cacheKey, data, lodBucketSize) {
        const firstX = data[0]?.x ?? -1;
        const lastX = data[data.length - 1]?.x ?? -1;
        return `${cacheKey}:${lodBucketSize}:${data.length}:${firstX}:${lastX}`;
    }
}
