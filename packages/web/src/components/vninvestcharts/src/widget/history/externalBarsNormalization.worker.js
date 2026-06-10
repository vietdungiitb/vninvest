import { normalizeExternalBars } from "./externalBarsNormalization.js";
self.onmessage = (event) => {
    const { requestId, data } = event.data;
    try {
        const response = {
            requestId,
            result: normalizeExternalBars(data),
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
