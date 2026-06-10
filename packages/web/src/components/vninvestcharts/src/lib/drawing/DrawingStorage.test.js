import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { createLocalStorageAdapter, createRESTStorageAdapter, DrawingImportError } from "./DrawingStorage";
function createStorageMock() {
    const store = new Map();
    return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => {
            store.set(key, value);
        },
        removeItem: (key) => {
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
    it("preserves optional point anchor metadata when importing", () => {
        const adapter = createLocalStorageAdapter();
        const payload = JSON.stringify([
            {
                id: "drawing-anchor-meta",
                type: "trendLine",
                points: [
                    { x: 100_000, y: 20, xIndexFloat: 10.5, timeMsHint: 100_000, yPrice: 20 },
                    { x: 160_000, y: 40, xIndexFloat: 11.5, timeMsHint: 160_000, yPrice: 40 },
                ],
                style: { stroke: "#fff", strokeWidth: 1 },
                createdAt: 1_700_000_000_000,
                updatedAt: 1_700_000_000_000,
            },
        ]);
        const drawings = adapter.importJSON(payload);
        expect(drawings[0]?.points).toEqual([
            { x: 100_000, y: 20, xIndexFloat: 10.5, timeMsHint: 100_000, yPrice: 20 },
            { x: 160_000, y: 40, xIndexFloat: 11.5, timeMsHint: 160_000, yPrice: 40 },
        ]);
    });
    it("rejects invalid payloads", () => {
        const adapter = createLocalStorageAdapter();
        expect(() => adapter.importJSON("{}")).toThrow(DrawingImportError);
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
    describe("RESTDrawingStorage adapter", () => {
        const restAdapter = createRESTStorageAdapter("http://mock-drawing-api.local", { authToken: "secret-token" });
        beforeEach(() => {
            vi.stubGlobal("fetch", vi.fn());
        });
        it("loads drawings from REST endpoint", async () => {
            const mockResponse = {
                drawings: [
                    {
                        id: "drawing-1",
                        type: "trendLine",
                        points: [
                            { x: 100000, y: 20 },
                            { x: 160000, y: 40 },
                        ],
                        style: { stroke: "#fff", strokeWidth: 1 },
                        createdAt: 1700000000000,
                        updatedAt: 1700000000000,
                    },
                ],
            };
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const loaded = await restAdapter.load("BTCUSD", "1h");
            expect(fetch).toHaveBeenCalledWith("http://mock-drawing-api.local/api/drawings?symbol=BTCUSD&timeframe=1h", expect.objectContaining({
                headers: { Authorization: "Bearer secret-token" },
            }));
            expect(loaded).toHaveLength(1);
            expect(loaded[0].id).toBe("drawing-1");
        });
        it("saves drawings to REST endpoint", async () => {
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
            });
            await restAdapter.save("BTCUSD", "1h", [drawing]);
            expect(fetch).toHaveBeenCalledWith("http://mock-drawing-api.local/api/drawings", expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ symbol: "BTCUSD", timeframe: "1h", drawings: [drawing] }),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer secret-token",
                },
            }));
        });
        it("clears drawings on REST endpoint", async () => {
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
            });
            await restAdapter.clear("BTCUSD", "1h");
            expect(fetch).toHaveBeenCalledWith("http://mock-drawing-api.local/api/drawings?symbol=BTCUSD&timeframe=1h", expect.objectContaining({
                method: "DELETE",
                headers: { Authorization: "Bearer secret-token" },
            }));
        });
    });
});
