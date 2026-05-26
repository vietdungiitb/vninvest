import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSeriesStyleOverride, clearSeriesStyleOverrides, getSeriesStyleOverride, listSeriesStyleOverrides, overrideSeriesStyle, subscribeSeriesStyle, subscribeSeriesStyleChanges } from "./SeriesRegistry";

afterEach(() => {
	clearSeriesStyleOverrides();
	vi.restoreAllMocks();
});

describe("series style override registry", () => {
	it("sets and merges overrides per instance", () => {
		overrideSeriesStyle("ema-1", { color: "#ff0000" });
		overrideSeriesStyle("ema-1", { lineWidth: 2 });

		expect(getSeriesStyleOverride("ema-1")).toEqual({ color: "#ff0000", lineWidth: 2 });
		expect(listSeriesStyleOverrides()).toEqual({
			"ema-1": { color: "#ff0000", lineWidth: 2 },
		});
	});

	it("clears overrides and notifies subscribers", () => {
		const perInstance = vi.fn();
		const global = vi.fn();
		const unsubscribeInstance = subscribeSeriesStyle("ema-2", perInstance);
		const unsubscribeGlobal = subscribeSeriesStyleChanges(global);

		overrideSeriesStyle("ema-2", { color: "#00ff00" });
		clearSeriesStyleOverride("ema-2");

		expect(perInstance).toHaveBeenCalledTimes(2);
		expect(global).toHaveBeenCalledTimes(2);
		expect(getSeriesStyleOverride("ema-2")).toBeUndefined();

		unsubscribeInstance();
		unsubscribeGlobal();
	});
});