import { describe, expect, it, vi } from "vitest";
import { getDrawingPlugin, listDrawingPlugins, registerDrawingPlugin } from "./registry";
import type { DrawingPluginDefinition } from "./types";

function makePlugin(type: string): DrawingPluginDefinition {
	return {
		type,
		labelKey: `plugin.${type}`,
		onStart: () => ({ type, points: [], style: { stroke: "#fff", strokeWidth: 1 } } as any),
		render: () => null,
		hitTest: () => false,
	};
}

describe("registerDrawingPlugin", () => {
	it("registers and retrieves a custom plugin", () => {
		const plugin = makePlugin("ce19-test-a");
		registerDrawingPlugin(plugin);
		expect(getDrawingPlugin("ce19-test-a")).toBe(plugin);
	});

	it("warns when overwriting an existing plugin", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const first = makePlugin("ce19-test-b");
		const second = makePlugin("ce19-test-b");
		registerDrawingPlugin(first);
		registerDrawingPlugin(second);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("Overwriting"));
		warn.mockRestore();
	});

	it("includes the plugin in listDrawingPlugins()", () => {
		const plugin = makePlugin("ce19-test-c");
		registerDrawingPlugin(plugin);
		expect(listDrawingPlugins()).toContain(plugin);
	});

	it("returns undefined for an unregistered plugin type", () => {
		expect(getDrawingPlugin("__nonexistent__")).toBeUndefined();
	});
});
