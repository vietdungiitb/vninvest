import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VNInvestClient, resolveApiBase } from "../VNInvestClient";
import { VNInvestDataSource, DemoDataSource } from "../index";

vi.mock("../../demoData", () => ({
	getOfflineDemoBars: () => [
		{ date: new Date("2026-01-01T00:00:00.000Z"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
	],
}));

describe("VNInvestClient", () => {
	let client: VNInvestClient;

	beforeEach(() => {
		vi.unstubAllGlobals();
		// Clear localStorage mock
		vi.stubGlobal("localStorage", {
			getItem: vi.fn().mockReturnValue(null),
			setItem: vi.fn(),
			removeItem: vi.fn(),
		});
		client = new VNInvestClient();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("resolveApiBase fallback về 127.0.0.1 khi chưa có override", () => {
		expect(resolveApiBase()).toBe("http://127.0.0.1");
	});

	it("resolveApiBase ưu tiên giá trị đã lưu trong localStorage thay vì origin", () => {
		vi.stubGlobal("location", {
			origin: "http://127.0.0.1:3000",
			hostname: "127.0.0.1",
			port: "3000",
		});
		vi.stubGlobal("localStorage", {
			getItem: vi.fn().mockReturnValue("https://vninvest.edusuccess.vn"),
			setItem: vi.fn(),
			removeItem: vi.fn(),
		});

		expect(resolveApiBase()).toBe("https://vninvest.edusuccess.vn");
	});

	it("hasPAT trả false khi chưa set", () => {
		expect(client.hasPAT()).toBe(false);
	});

	it("hasPAT trả true sau setPAT", () => {
		client.setPAT("test-token-abc");
		expect(client.hasPAT()).toBe(true);
	});

	it("setPAT với chuỗi rỗng sẽ xóa PAT", () => {
		client.setPAT("existing-token");
		client.setPAT("   "); // whitespace only
		expect(client.hasPAT()).toBe(false);
		expect(client.getPAT()).toBe("");
	});

	it("getChart 401 → throw TOKEN_EXPIRED", async () => {
		client.setPAT("test-token");
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, ok: false }));
		await expect(client.getChart("VCB")).rejects.toThrow("TOKEN_EXPIRED");
	});

	it("getChart 404 → throw SYMBOL_NOT_FOUND", async () => {
		client.setPAT("test-token");
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
		await expect(client.getChart("INVALID")).rejects.toThrow("SYMBOL_NOT_FOUND");
	});

	it("getChart trả đúng RawOHLCVBar[] shape", async () => {
		client.setPAT("test-token");
		const mockResponse = {
			symbol: "VCB",
			days: 30,
			timeframe: "D",
			points: [
				{ date: "2026-01-01", open: 100, high: 110, low: 90, close: 105, volume: 1000 },
			],
			technical: { rsi14: 55.5 },
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));
		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].date).toBeInstanceOf(Date);
		expect(bars[0].open).toBe(100);
		expect(bars[0].close).toBe(105);
		expect(bars[0].technical?.rsi14).toBe(55.5);
	});

	it("getChart chuẩn hóa timeframe D giữ nguyên D theo backend contract", async () => {
		client.setPAT("test-token");
		const fetchMock = vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue({ points: [] }),
		});
		vi.stubGlobal("fetch", fetchMock);

		await client.getChart("VCB", { timeframe: "D", days: 5 });

		const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
		expect(calledUrl).toContain("timeframe=D");
		expect(calledUrl).toContain("days=5");
	});

	it("getChart chấp nhận payload mảng point trực tiếp từ SaaS runtime", async () => {
		client.setPAT("test-token");
		const mockResponse = [
			{ date: "2026-01-02", open: 101, high: 112, low: 99, close: 110, volume: 2000 },
		];
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));
		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].date).toBeInstanceOf(Date);
		expect(bars[0].open).toBe(101);
		expect(bars[0].technical).toBeUndefined();
	});

	it("getChart parse được payload nested data.points", async () => {
		client.setPAT("test-token");
		const mockResponse = {
			data: {
				points: [
					{ date: "2026-01-03T00:00:00Z", open: 102, high: 108, low: 100, close: 106, volume: 1500 },
				],
				technical: { rsi14: 60.1 },
			},
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));

		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].open).toBe(102);
		expect(bars[0].technical?.rsi14).toBe(60.1);
	});

	it("getChart parse được payload candles với key o/h/l/c/v", async () => {
		client.setPAT("test-token");
		const mockResponse = {
			candles: [
				{ t: "2026-01-04T00:00:00Z", o: 103, h: 109, l: 101, c: 107, v: 1700 },
			],
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));

		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].close).toBe(107);
		expect(bars[0].volume).toBe(1700);
	});

	it("getChart parse được payload OHLCV dạng chuỗi số", async () => {
		client.setPAT("test-token");
		const mockResponse = {
			points: [
				{ date: "2026-01-05", open: "104", high: "111", low: "102", close: "109", volume: "2500" },
			],
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));

		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].open).toBe(104);
		expect(bars[0].close).toBe(109);
		expect(bars[0].volume).toBe(2500);
	});

	it("getChart parse đúng timestamp unix seconds", async () => {
		client.setPAT("test-token");
		const mockResponse = {
			candles: [
				{ t: 1704412800, o: 104, h: 111, l: 102, c: 109, v: 2500 },
			],
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue(mockResponse),
		}));

		const bars = await client.getChart("VCB");
		expect(bars).toHaveLength(1);
		expect(bars[0].date.valueOf()).toBe(new Date("2024-01-05T00:00:00.000Z").valueOf());
	});

	it("getWhaleFeed trả null khi backend trả mảng rỗng", async () => {
		client.setPAT("test-token");
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: vi.fn().mockResolvedValue([]),
		}));
		await expect(client.getWhaleFeed("VCB")).resolves.toBeNull();
	});
});

describe("VNInvestDataSource", () => {
	it("loadBars throw khi client chưa có PAT", async () => {
		vi.stubGlobal("localStorage", {
			getItem: vi.fn().mockReturnValue(null),
			setItem: vi.fn(),
		});
		const client = new VNInvestClient();
		const ds = new VNInvestDataSource(client);
		await expect(ds.loadBars("VCB")).rejects.toThrow("NO_PAT");
	});
});

describe("DemoDataSource", () => {
	it("loadBars trả non-empty array", async () => {
		const ds = new DemoDataSource();
		const bars = await ds.loadBars("BTCUSDT");
		expect(bars.length).toBeGreaterThan(0);
	});

	it("searchSymbols trả array có shape đúng", async () => {
		const ds = new DemoDataSource();
		const results = await ds.searchSymbols("BTC");
		expect(results[0]).toHaveProperty("symbol");
	});
});
