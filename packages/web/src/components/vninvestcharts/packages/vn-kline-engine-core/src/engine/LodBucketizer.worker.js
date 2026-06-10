import { aggregateOhlc } from "./LodBucketizer.js";
self.onmessage = (event) => {
    const { requestId, candles, bucketSize } = event.data;
    try {
        const response = {
            requestId,
            buckets: aggregateOhlc(candles, bucketSize),
        };
        self.postMessage(response);
    }
    catch (error) {
        const response = {
            requestId,
            error: error instanceof Error ? error.message : String(error),
        };
        self.postMessage(response);
    }
};
