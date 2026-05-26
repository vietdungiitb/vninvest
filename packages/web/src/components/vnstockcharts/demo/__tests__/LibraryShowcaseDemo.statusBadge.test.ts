import { describe, expect, it } from "vitest";

import { resolveDemoTopbarStatusBadge } from "../topbarStatusBadge";

describe("resolveDemoTopbarStatusBadge", () => {
	const t = (key: string) => key;

	it("returns the offline fallback badge for Binance fallback mode", () => {
		const badge = resolveDemoTopbarStatusBadge({
			activeSource: "binance",
			dataStatus: "offline",
			dataError: "network unavailable",
			vniError: null,
			t,
		});

		expect(badge).toEqual({
			className: "gc-offline-badge",
			label: "common.offlineFallback",
			title: "network unavailable",
		});
	});

	it("returns the loading badge for VNI loading state", () => {
		const badge = resolveDemoTopbarStatusBadge({
			activeSource: "vninvest",
			dataStatus: "loading",
			dataError: "",
			vniError: null,
			t,
		});

		expect(badge).toEqual({
			className: "gc-loading-badge",
			label: "vninvest.loading",
		});
	});
});
