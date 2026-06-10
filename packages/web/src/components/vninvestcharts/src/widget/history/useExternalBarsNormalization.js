import { useEffect, useState } from "react";
import { normalizeExternalBars } from "./externalBarsNormalization.js";
import { EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT, normalizeExternalBarsAsync, shouldUseExternalBarsWorker, } from "./externalBarsNormalizationAsync.js";
function isExternalBarsNormalizationTestEnv() {
    return typeof globalThis.vi !== "undefined"
        || typeof globalThis.describe !== "undefined"
        || (typeof process !== "undefined" && process.env.NODE_ENV === "test");
}
function resolveInitialExternalBarsNormalization(data, enabled, useWorker = true) {
    if (!enabled) {
        return {
            result: EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT,
            pending: false,
        };
    }
    if (isExternalBarsNormalizationTestEnv() || (!useWorker || !shouldUseExternalBarsWorker(data))) {
        return {
            result: normalizeExternalBars(data),
            pending: false,
        };
    }
    return {
        result: EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT,
        pending: true,
    };
}
export function useExternalBarsNormalization(data, enabled, useWorker = true) {
    const initialState = resolveInitialExternalBarsNormalization(data, enabled, useWorker);
    const [result, setResult] = useState(initialState.result);
    const [pending, setPending] = useState(initialState.pending);
    useEffect(() => {
        if (!enabled) {
            setResult(EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT);
            setPending(false);
            return undefined;
        }
        if (isExternalBarsNormalizationTestEnv() || (!useWorker || !shouldUseExternalBarsWorker(data))) {
            setResult(normalizeExternalBars(data));
            setPending(false);
            return undefined;
        }
        const controller = new AbortController();
        let disposed = false;
        setPending(true);
        void normalizeExternalBarsAsync(data, { signal: controller.signal, useWorker }).then((nextResult) => {
            if (disposed || controller.signal.aborted) {
                return;
            }
            setResult(nextResult);
            setPending(false);
        }).catch((error) => {
            if (disposed || controller.signal.aborted) {
                return;
            }
            setResult(normalizeExternalBars(data));
            setPending(false);
            console.warn("Falling back to main-thread external bars normalization", error);
        });
        return () => {
            disposed = true;
            controller.abort();
        };
    }, [data, enabled, useWorker]);
    return { result, pending };
}
