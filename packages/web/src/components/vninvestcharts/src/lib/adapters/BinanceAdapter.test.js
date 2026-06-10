import { describe, expect, it, vi, beforeEach } from "vitest";
import { BinanceAdapter } from "./BinanceAdapter";
const mockKlines = [
    [1_700_000_000_000, "40000.0", "41000.0", "39000.0", "40500.0", "150.5"],
    [1_700_003_600_000, "40500.0", "42000.0", "40200.0", "41800.0", "200.0"],
];
describe("CE20-02: BinanceAdapter", () => {
    let adapter;
    beforeEach(() => {
        adapter = new BinanceAdapter();
    });
    it("maps Binance kline response to KLineBar correctly", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockKlines),
        });
        const result = await adapter.getBars({
            type: "init",
            symbol: "BTCUSDT",
            interval: "1h",
            timestamp: null,
            limit: 2,
        });
        expect(result.bars).toHaveLength(2);
        expect(result.bars[0]).toMatchObject({
            timestamp: 1_700_000_000_000,
            open: 40000.0,
            high: 41000.0,
            low: 39000.0,
            close: 40500.0,
            volume: 150.5,
        });
        expect(result.bars[1].open).toBe(40500.0);
    });
    it("sets hasMore=true when returned bars equal limit", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockKlines),
        });
        const result = await adapter.getBars({
            type: "init",
            symbol: "BTCUSDT",
            interval: "1h",
            timestamp: null,
            limit: 2,
        });
        expect(result.hasMore).toBe(true);
    });
    it("sets hasMore=false when returned bars are fewer than limit", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockKlines),
        });
        const result = await adapter.getBars({
            type: "init",
            symbol: "BTCUSDT",
            interval: "1h",
            timestamp: null,
            limit: 10,
        });
        expect(result.hasMore).toBe(false);
    });
    it("adds endTime param for backward fetch", async () => {
        let capturedUrl = "";
        global.fetch = vi.fn().mockImplementation((url) => {
            capturedUrl = url;
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        });
        await adapter.getBars({
            type: "backward",
            symbol: "BTCUSDT",
            interval: "1h",
            timestamp: 1_700_000_000_000,
            limit: 100,
        });
        expect(capturedUrl).toContain("endTime=1699999999999");
    });
    it("fetches exact range with startTime and endTime params", async () => {
        let capturedUrl = "";
        global.fetch = vi.fn().mockImplementation((url) => {
            capturedUrl = url;
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockKlines) });
        });
        const result = await adapter.fetchBarsInRange("BTCUSDT", "1h", new Date(1_700_000_000_000), new Date(1_700_003_600_000));
        expect(capturedUrl).toContain("startTime=1700000000000");
        expect(capturedUrl).toContain("endTime=1700003600000");
        expect(result).toHaveLength(2);
    });
    it("paginates exact-range fetches beyond the 1000-bar page cap", async () => {
        const firstPage = Array.from({ length: 1000 }, (_, index) => [
            1_700_000_000_000 + index * 60_000,
            "100.0",
            "101.0",
            "99.0",
            "100.5",
            "10.0",
        ]);
        const secondPage = [
            [1_700_060_000_000, "101.0", "102.0", "100.0", "101.5", "11.0"],
            [1_700_060_060_000, "102.0", "103.0", "101.0", "102.5", "12.0"],
        ];
        const fetchSpy = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(firstPage) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(secondPage) });
        global.fetch = fetchSpy;
        const result = await adapter.fetchBarsInRange("BTCUSDT", "1m", new Date(1_700_000_000_000), new Date(1_700_060_060_000));
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("startTime=1700059940001");
        expect(result).toHaveLength(1002);
        expect(result[0]?.timestamp).toBe(1_700_000_000_000);
        expect(result[result.length - 1]?.timestamp).toBe(1_700_060_060_000);
    });
    it("rejects invalid symbol", async () => {
        await expect(adapter.getBars({ type: "init", symbol: "../../etc/passwd", interval: "1h", timestamp: null, limit: 10 })).rejects.toThrow("symbol không hợp lệ");
    });
    it("rejects invalid interval", async () => {
        await expect(adapter.getBars({ type: "init", symbol: "BTCUSDT", interval: "invalid", timestamp: null, limit: 10 })).rejects.toThrow("Interval không hợp lệ");
    });
    it("throws on non-ok HTTP response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: () => Promise.resolve({}),
        });
        await expect(adapter.getBars({ type: "init", symbol: "BTCUSDT", interval: "1h", timestamp: null, limit: 10 })).rejects.toThrow("429");
    });
});
