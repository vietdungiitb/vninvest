import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { applyDrawingTemplate, clearDrawingTemplate, loadDrawingTemplate, saveDrawingTemplate, validateDrawingStyleTemplate } from "./drawingStyleRegistry";

// ─── DT-5 tests ───────────────────────────────────────────────────────────────

describe("validateDrawingStyleTemplate", () => {
	it("DT5-01: accepts valid DrawingStyle fields", () => {
		const result = validateDrawingStyleTemplate({
			stroke: "#ff0000",
			strokeWidth: 2,
			opacity: 0.8,
			strokeDasharray: "dashed",
		});
		expect(result).toEqual({ stroke: "#ff0000", strokeWidth: 2, opacity: 0.8, strokeDasharray: "dashed" });
	});

	it("DT5-02: rejects non-hex stroke (XSS prevention)", () => {
		const result = validateDrawingStyleTemplate({ stroke: "red; background: url(evil)" });
		expect(result).toBeNull();
	});

	it("DT5-03: rejects strokeWidth out of range", () => {
		const result = validateDrawingStyleTemplate({ strokeWidth: 999 });
		expect(result).toBeNull();
	});

	it("DT5-04: rejects negative strokeWidth", () => {
		const result = validateDrawingStyleTemplate({ strokeWidth: -1 });
		expect(result).toBeNull();
	});

	it("DT5-05: rejects opacity > 1", () => {
		const result = validateDrawingStyleTemplate({ opacity: 1.5 });
		expect(result).toBeNull();
	});

	it("DT5-06: rejects null", () => {
		expect(validateDrawingStyleTemplate(null)).toBeNull();
	});

	it("DT5-07: rejects array", () => {
		expect(validateDrawingStyleTemplate(["#ff0000"])).toBeNull();
	});

	it("DT5-08: returns null for empty object (no recognized fields)", () => {
		expect(validateDrawingStyleTemplate({ unknown: "value" })).toBeNull();
	});

	it("DT5-09: accepts valid 3-char hex colour", () => {
		const result = validateDrawingStyleTemplate({ stroke: "#f00" });
		expect(result).toEqual({ stroke: "#f00" });
	});
});

describe("saveDrawingTemplate + loadDrawingTemplate round-trip", () => {
	// Mock localStorage
	const localStorageMock = (() => {
		let store: Record<string, string> = {};
		return {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => { store[key] = value; },
			removeItem: (key: string) => { delete store[key]; },
			clear: () => { store = {}; },
		};
	})();

	beforeAll(() => {
		vi.stubGlobal("localStorage", localStorageMock);
	});

	afterEach(() => {
		localStorageMock.clear();
	});

	it("DT5-10: save + load round-trip returns same data", () => {
		const style = { stroke: "#123456", strokeWidth: 2, opacity: 1 };
		const saved = saveDrawingTemplate("trendLine", style);
		expect(saved).toBe(true);

		const loaded = loadDrawingTemplate("trendLine");
		expect(loaded).toEqual({ stroke: "#123456", strokeWidth: 2, opacity: 1 });
	});

	it("DT5-11: save returns false for invalid style", () => {
		const result = saveDrawingTemplate("trendLine", { stroke: "javascript:alert(1)" } as never);
		expect(result).toBe(false);
	});

	it("DT5-12: loadDrawingTemplate returns null when no template saved", () => {
		const result = loadDrawingTemplate("fibonacci");
		expect(result).toBeNull();
	});

	it("DT5-13: clearDrawingTemplate removes the saved entry", () => {
		saveDrawingTemplate("ray", { stroke: "#abcdef", strokeWidth: 1, opacity: 1 });
		clearDrawingTemplate("ray");
		expect(loadDrawingTemplate("ray")).toBeNull();
	});

	it("DT5-14: corrupted localStorage data is discarded", () => {
		localStorageMock.setItem("rsc-drawing-template-rectangle", "not json{{{{");
		const result = loadDrawingTemplate("rectangle");
		expect(result).toBeNull();
	});

	it("DT5-15: applyDrawingTemplate merges template onto baseStyle", () => {
		saveDrawingTemplate("hLine", { stroke: "#ff0000", strokeWidth: 3, opacity: 1 });
		const base = { stroke: "#000000", strokeWidth: 1, opacity: 1 };
		const result = applyDrawingTemplate("hLine", base);
		expect(result.stroke).toBe("#ff0000");
		expect(result.strokeWidth).toBe(3);
	});

	it("DT5-16: applyDrawingTemplate returns baseStyle unchanged when no template", () => {
		const base = { stroke: "#000000", strokeWidth: 1, opacity: 1 };
		const result = applyDrawingTemplate("polyline", base);
		expect(result).toEqual(base);
	});
});
