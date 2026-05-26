import { describe, expect, it, vi, beforeEach } from "vitest";
import { BinanceAdapter } from "./BinanceAdapter";

const mockKlines = [
	[1_700_000_000_000, "40000.0", "41000.0", "39000.0", "40500.0", "150.5"],
	[1_700_003_600_000, "40500.0", "42000.0", "40200.0", "41800.0", "200.0"],
];

describe("CE20-02: BinanceAdapter", () => {
	let adapter: BinanceAdapter;

	beforeEach(() => {
		adapter = new BinanceAdapter();
	});

	it("maps Binance kline response to KLineBar correctly", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockKlines),
		} as Response);

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
		} as Response);

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
		} as Response);

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
		global.fetch = vi.fn().mockImplementation((url: string) => {
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

	it("rejects invalid symbol", async () => {
		await expect(
			adapter.getBars({ type: "init", symbol: "../../etc/passwd", interval: "1h", timestamp: null, limit: 10 }),
		).rejects.toThrow("symbol không hợp lệ");
	});

	it("rejects invalid interval", async () => {
		await expect(
			adapter.getBars({ type: "init", symbol: "BTCUSDT", interval: "invalid", timestamp: null, limit: 10 }),
		).rejects.toThrow("Interval không hợp lệ");
	});

	it("throws on non-ok HTTP response", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 429,
			json: () => Promise.resolve({}),
		} as Response);

		await expect(
			adapter.getBars({ type: "init", symbol: "BTCUSDT", interval: "1h", timestamp: null, limit: 10 }),
		).rejects.toThrow("429");
	});
});
