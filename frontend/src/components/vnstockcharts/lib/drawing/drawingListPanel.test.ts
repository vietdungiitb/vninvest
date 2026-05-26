import { describe, expect, it } from "vitest";
import { generateDrawingLabel } from "./DrawingListPanel";
import type { DrawingObject } from "./types";

function makeDrawing(overrides: Partial<DrawingObject> = {}): DrawingObject {
	return {
		id: "d1",
		type: "trendLine",
		points: [],
		style: {} as DrawingObject["style"],
		visible: true,
		locked: false,
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_000,
		...overrides,
	};
}

describe("DT-8 – DrawingListPanel utilities", () => {
	describe("generateDrawingLabel", () => {
		it("DT8-T01: returns label when drawing has custom label", () => {
			const d = makeDrawing({ label: "Support zone" });
			expect(generateDrawingLabel(d)).toBe("Support zone");
		});

		it("DT8-T02: trims whitespace from label", () => {
			const d = makeDrawing({ label: "  SL line  " });
			expect(generateDrawingLabel(d)).toBe("SL line");
		});

		it("DT8-T03: falls back to tool label for trendLine", () => {
			const d = makeDrawing({ type: "trendLine", label: "" });
			expect(generateDrawingLabel(d)).toBe("Đường xu hướng");
		});

		it("DT8-T04: falls back to tool label for fibonacci", () => {
			const d = makeDrawing({ type: "fibonacci", label: undefined });
			expect(generateDrawingLabel(d)).toBe("Fibonacci");
		});

		it("DT8-T05: falls back to tool label for longPosition", () => {
			const d = makeDrawing({ type: "longPosition" });
			expect(generateDrawingLabel(d)).toBe("Vị thế mua");
		});

		it("DT8-T06: falls back to tool label for rectangle", () => {
			const d = makeDrawing({ type: "rectangle" });
			expect(generateDrawingLabel(d)).toBe("Hình chữ nhật");
		});

		it("DT8-T07: falls back to tool label for hLine", () => {
			const d = makeDrawing({ type: "hLine" });
			expect(generateDrawingLabel(d)).toBe("Đường ngang");
		});

		it("DT8-T08: falls back to tool label for gannFan", () => {
			const d = makeDrawing({ type: "gannFan" });
			expect(generateDrawingLabel(d)).toBe("Gann Fan");
		});
	});
});
