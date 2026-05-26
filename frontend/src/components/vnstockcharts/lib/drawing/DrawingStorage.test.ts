import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { createLocalStorageAdapter, DrawingImportError } from "./DrawingStorage";

function createStorageMock() {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
	};
}

describe("DrawingStorage adapter", () => {
	const drawing = createDrawingObject("trendLine", [
		{ x: 100_000, y: 20 },
		{ x: 160_000, y: 40 },
	], { id: "drawing-1", paneId: "momentum", yScaleId: "right" });

	beforeEach(() => {
		vi.stubGlobal("localStorage", createStorageMock());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("round-trips drawings by symbol and timeframe", () => {
		const adapter = createLocalStorageAdapter();
		adapter.save("BTCUSD", "1h", [drawing]);

		expect(adapter.load("BTCUSD", "1h")).toEqual([drawing]);
		expect(adapter.load("BTCUSD", "5m")).toEqual([]);

		adapter.clear("BTCUSD", "1h");
		expect(adapter.load("BTCUSD", "1h")).toEqual([]);
	});

	it("exports and imports JSON payloads", () => {
		const adapter = createLocalStorageAdapter();
		const payload = adapter.exportJSON([drawing]);
		expect(adapter.importJSON(payload)).toEqual([drawing]);
	});

	it("rejects invalid payloads", () => {
		const adapter = createLocalStorageAdapter();
		expect(() => adapter.importJSON("{}" )).toThrow(DrawingImportError);
	});

	it("ignores and clears invalid cached drawings on load", () => {
		const adapter = createLocalStorageAdapter();
		globalThis.localStorage.setItem("rsc-drawings-v1-BTCUSD-1h", JSON.stringify([
			{
				id: "drawing-legacy",
				type: "legacyTool",
				points: [{ x: 100_000, y: 20 }],
				style: { stroke: "#fff", strokeWidth: 1 },
			},
		]));

		expect(adapter.load("BTCUSD", "1h")).toEqual([]);
		expect(globalThis.localStorage.getItem("rsc-drawings-v1-BTCUSD-1h")).toBeNull();
	});
});
