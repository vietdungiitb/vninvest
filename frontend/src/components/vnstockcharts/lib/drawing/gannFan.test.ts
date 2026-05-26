import { describe, expect, it } from "vitest";
import { calculateGannFanGeometry } from "./builtin/gannFan";

describe("calculateGannFanGeometry", () => {
	it("DT4-01: returns exactly 9 lines", () => {
		// Arrange
		const chartWidth = 800;
		const chartHeight = 400;

		// Act
		const geometry = calculateGannFanGeometry(100, 300, 300, 100, chartWidth, chartHeight);

		// Assert
		expect(geometry.lines).toHaveLength(9);
	});

	it("DT4-02: all lines originate from the origin point", () => {
		const geometry = calculateGannFanGeometry(100, 200, 400, 100, 800, 400);

		for (const line of geometry.lines) {
			expect(line.x1).toBe(100);
			expect(line.y1).toBe(200);
		}
	});

	it("DT4-03: principal 1×1 line is marked isPrincipal=true", () => {
		const geometry = calculateGannFanGeometry(100, 200, 400, 100, 800, 400);

		const principal = geometry.lines.filter((l) => l.isPrincipal);
		expect(principal).toHaveLength(1);
		expect(principal[0]?.label).toBe("1×1");
	});

	it("DT4-04: all non-principal lines have isPrincipal=false", () => {
		const geometry = calculateGannFanGeometry(100, 200, 400, 100, 800, 400);

		const nonPrincipal = geometry.lines.filter((l) => !l.isPrincipal);
		expect(nonPrincipal).toHaveLength(8);
	});

	it("DT4-05: all line endpoints are within chart bounds", () => {
		const chartWidth = 600;
		const chartHeight = 300;
		const geometry = calculateGannFanGeometry(50, 250, 250, 100, chartWidth, chartHeight);

		for (const line of geometry.lines) {
			expect(line.x2).toBeGreaterThanOrEqual(-1);
			expect(line.x2).toBeLessThanOrEqual(chartWidth + 1);
			expect(line.y2).toBeGreaterThanOrEqual(-1);
			expect(line.y2).toBeLessThanOrEqual(chartHeight + 1);
		}
	});

	it("DT4-06: 1×1 line passes through end point direction", () => {
		// When end point is at (300,100) from origin (100,200):
		//   dx = +200, dy = -100  — the 1×1 line has ratio 1 so slope = dy/dx
		const geometry = calculateGannFanGeometry(100, 200, 300, 100, 800, 400);
		const principal = geometry.lines.find((l) => l.isPrincipal)!;

		// Direction from origin to principal end should be proportional to (dx, dy)
		const dx = principal.x2 - principal.x1;
		const dy = principal.y2 - principal.y1;
		const ratio = dy / dx;

		// dy/dx for end point direction = (100-200)/(300-100) = -100/200 = -0.5
		// The 1×1 line is unitBarX=dx_end, unitPriceY=dy_end * ratio=1
		// So it should match the original slope
		expect(ratio).toBeCloseTo(-0.5, 4);
	});

	it("DT4-07: degenerate case (same point) returns 9 fallback lines", () => {
		// Arrange — origin === end (degenerate)
		const geometry = calculateGannFanGeometry(100, 100, 100, 100, 800, 400);

		// Act / Assert — should not throw, returns 9 lines (fallback)
		expect(geometry.lines).toHaveLength(9);
	});

	it("DT4-08: line labels are correct set", () => {
		const geometry = calculateGannFanGeometry(100, 200, 300, 100, 800, 400);
		const labels = geometry.lines.map((l) => l.label);

		expect(labels).toContain("1×1");
		expect(labels).toContain("1×2");
		expect(labels).toContain("2×1");
		expect(labels).toContain("1×8");
		expect(labels).toContain("8×1");
		expect(new Set(labels).size).toBe(9); // all unique
	});
});
