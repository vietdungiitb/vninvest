// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { WhaleFeedResponse } from "../vninvest/types";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let DemoI18nBoundary: typeof import("../i18n").DemoI18nBoundary;
let WhalePanel: typeof import("../components/WhalePanel").WhalePanel;

const sampleWhaleData: WhaleFeedResponse = {
	symbol: "TCB",
	whale_orders: [],
	summary: {
		buy_value: 3_000_000_000,
		sell_value: 1_000_000_000,
		shark_buy: 1_200_000_000,
		shark_sell: 600_000_000,
		whale_buy: 1_500_000_000,
		whale_sell: 300_000_000,
		small_buy: 300_000_000,
		small_sell: 100_000_000,
	},
};

describe("WhalePanel", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;
	let consoleErrorSpy: {
		mockImplementation: (implementation: (...args: unknown[]) => unknown) => unknown;
		mockRestore: () => void;
	};

	beforeAll(async () => {
		({ act } = await import("react"));
		({ createRoot } = await import("react-dom/client"));
		({ DemoI18nBoundary } = await import("../i18n"));
		({ WhalePanel } = await import("../components/WhalePanel"));
	});

	beforeEach(() => {
		window.localStorage.clear();
		consoleErrorSpy = vi.spyOn(console, "error");
		consoleErrorSpy.mockImplementation(() => {});
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		root?.unmount();
		root = null;
		container?.remove();
		container = null;
		consoleErrorSpy.mockRestore();
		window.localStorage.clear();
	});

	it("renders nothing when whale flow data is missing", async () => {
		await act(async () => {
			root?.render(
				<DemoI18nBoundary>
					<WhalePanel data={null} />
				</DemoI18nBoundary>,
			);
		});

		expect(container?.querySelector(".gc-whale-panel")).toBeNull();
		expect(container?.textContent?.trim()).toBe("");
	});

	it("renders the whale summary when data is available", async () => {
		await act(async () => {
			root?.render(
				<DemoI18nBoundary>
					<WhalePanel data={sampleWhaleData} />
				</DemoI18nBoundary>,
			);
		});

		expect(container?.querySelector(".gc-whale-panel")).not.toBeNull();
		expect(container?.textContent).toContain("2.00");
		expect(container?.textContent).not.toContain("Chưa có dữ liệu dòng tiền.");
	});
});