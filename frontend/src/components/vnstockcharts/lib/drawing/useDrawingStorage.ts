import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DrawingObject } from "./types";
import { createLocalStorageAdapter, type DrawingStorageAdapter } from "./DrawingStorage";

export interface UseDrawingStorageReturn {
	exportJSON: () => string;
	importJSON: (file: File) => Promise<void>;
	clearAll: () => void;
}

export interface UseDrawingStorageOptions {
	enabled?: boolean;
}

export function useDrawingStorage(
	symbol: string,
	timeframe: string,
	drawings: readonly DrawingObject[],
	onLoad: (drawings: DrawingObject[]) => void,
	adapter?: DrawingStorageAdapter,
	options?: UseDrawingStorageOptions,
): UseDrawingStorageReturn {
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
		onLoad(loaded);
		hydratedRef.current = true;
	}, [isEnabled, onLoad, storage, symbol, timeframe]);

	useEffect(() => {
		if (!isEnabled) {
			return;
		}
		if (!hydratedRef.current) {
			return;
		}

		const timeoutId = globalThis.setTimeout(() => {
			storage.save(symbol, timeframe, drawings as DrawingObject[]);
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

	const importJSON = useCallback(async (file: File) => {
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
