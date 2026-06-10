import { useCallback, useEffect, useMemo, useRef } from "react";
import { createLocalStorageAdapter } from "./DrawingStorage.js";
export function useDrawingStorage(symbol, timeframe, drawings, onLoad, adapter, options) {
    const storage = useMemo(() => adapter ?? createLocalStorageAdapter(), [adapter]);
    const hydratedRef = useRef(false);
    const isEnabled = options?.enabled ?? true;
    useEffect(() => {
        if (!isEnabled) {
            hydratedRef.current = false;
            return;
        }
        hydratedRef.current = false;
        const loaded = storage.load(symbol, timeframe);
        if (loaded instanceof Promise) {
            loaded.then((drawings) => {
                onLoad(drawings);
                hydratedRef.current = true;
            }).catch((err) => {
                console.error("Failed to load drawings:", err);
                onLoad([]);
                hydratedRef.current = true;
            });
        }
        else {
            onLoad(loaded);
            hydratedRef.current = true;
        }
    }, [isEnabled, onLoad, storage, symbol, timeframe]);
    useEffect(() => {
        if (!isEnabled) {
            return;
        }
        if (!hydratedRef.current) {
            return;
        }
        const timeoutId = globalThis.setTimeout(() => {
            const p = storage.save(symbol, timeframe, drawings);
            if (p instanceof Promise) {
                p.catch((err) => {
                    console.error("Failed to save drawings:", err);
                });
            }
        }, 300);
        return () => {
            globalThis.clearTimeout(timeoutId);
        };
    }, [drawings, isEnabled, storage, symbol, timeframe]);
    const exportJSON = useCallback(() => {
        const payload = storage.exportJSON(drawings);
        if (typeof document === "undefined") {
            return payload;
        }
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "drawings.json";
        anchor.click();
        URL.revokeObjectURL(url);
        return payload;
    }, [drawings, storage]);
    const importJSON = useCallback(async (file) => {
        const payload = await file.text();
        const imported = storage.importJSON(payload);
        if (imported instanceof Promise) {
            try {
                const resolved = await imported;
                onLoad(resolved);
            }
            catch (err) {
                console.error("Failed to import drawings:", err);
            }
        }
        else {
            onLoad(imported);
        }
    }, [onLoad, storage]);
    const clearAll = useCallback(() => {
        const p = storage.clear(symbol, timeframe);
        if (p instanceof Promise) {
            p.catch((err) => {
                console.error("Failed to clear drawings:", err);
            });
        }
        onLoad([]);
    }, [onLoad, storage, symbol, timeframe]);
    return useMemo(() => ({ exportJSON, importJSON, clearAll }), [clearAll, exportJSON, importJSON]);
}
