import { useCallback, useEffect, useMemo, useRef } from "react";
import { createLocalStorageAdapter } from "./DrawingStorage.js";
export function useDrawingStorage(symbol, timeframe, drawings, onLoad, adapter) {
    const storage = useMemo(() => adapter ?? createLocalStorageAdapter(), [adapter]);
    const hydratedRef = useRef(false);
    useEffect(() => {
        hydratedRef.current = false;
        const loaded = storage.load(symbol, timeframe);
        onLoad(loaded);
        hydratedRef.current = true;
    }, [onLoad, storage, symbol, timeframe]);
    useEffect(() => {
        if (!hydratedRef.current) {
            return;
        }
        const timeoutId = globalThis.setTimeout(() => {
            storage.save(symbol, timeframe, drawings);
        }, 300);
        return () => {
            globalThis.clearTimeout(timeoutId);
        };
    }, [drawings, storage, symbol, timeframe]);
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
        onLoad(imported);
    }, [onLoad, storage]);
    const clearAll = useCallback(() => {
        storage.clear(symbol, timeframe);
        onLoad([]);
    }, [onLoad, storage, symbol, timeframe]);
    return useMemo(() => ({ exportJSON, importJSON, clearAll }), [clearAll, exportJSON, importJSON]);
}
