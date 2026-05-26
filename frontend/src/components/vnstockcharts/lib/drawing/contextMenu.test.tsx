// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DrawingContextMenu } from "./contextMenu";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	root = null;
	container?.remove();
	container = null;
});

describe("DrawingContextMenu", () => {
	it("renders actions, fires item callbacks, and closes on escape", () => {
		const onClose = vi.fn();
		const onSelect = vi.fn();

		act(() => {
			root?.render(createElement(DrawingContextMenu, {
				ariaLabel: "Drawing actions",
				position: { x: 24, y: 32 },
				title: "Drawing menu",
				isDark: false,
				onClose,
				items: [
					{ key: "copy", label: "Copy", onSelect },
				],
			}));
		});

		expect(container?.textContent).toContain("Drawing menu");
		expect(container?.textContent).toContain("Copy");

		const button = container?.querySelector<HTMLButtonElement>("button[role='menuitem']");
		button?.click();

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		});

		expect(onClose).toHaveBeenCalledTimes(2);
	});
});