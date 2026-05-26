// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { DemoI18nProvider } from "../i18n";
import { VNSymbolSearch } from "../components/VNSymbolSearch";
import type { VNInvestClient } from "../dataSources/VNInvestClient";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("VNSymbolSearch", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;

	beforeEach(() => {
		document.documentElement.lang = "vi";
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => {
			root?.unmount();
		});
		root = null;
		container?.remove();
		container = null;
		document.documentElement.lang = "";
	});

	it("commits the raw typed symbol on Enter when no dropdown result is available", async () => {
		const client = {
			getStocks: vi.fn().mockRejectedValue(new Error("search unavailable")),
		} as unknown as VNInvestClient;
		const onChange = vi.fn();

		await act(async () => {
			root?.render(
				<DemoI18nProvider>
					<VNSymbolSearch client={client} value="tpb" onChange={onChange} />
				</DemoI18nProvider>,
			);
		});

		const input = container?.querySelector("input[role='combobox']") as HTMLInputElement | null;
		expect(input).not.toBeNull();

		await act(async () => {
			input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		});

		expect(onChange).toHaveBeenCalledWith("TPB");
	});
});