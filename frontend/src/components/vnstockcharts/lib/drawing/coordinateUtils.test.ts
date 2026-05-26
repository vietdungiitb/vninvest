import { describe, expect, it } from "vitest";
import { chartPointToPixel, pixelToChartPoint } from "./coordinateUtils";

describe("coordinateUtils", () => {
	it("round-trips pixel coordinates through chart space without drift", () => {
		const scales = {
			xScale: (date: Date) => date.getTime() / 1000,
			xScaleInvert: (px: number) => new Date(px * 1000),
			yScale: (price: number) => price * 2,
			yScaleInvert: (px: number) => px / 2,
		};
		const containerRect = { left: 30, top: 20 } as DOMRect;

		const point = pixelToChartPoint(130, 90, containerRect, scales);
		const pixel = chartPointToPixel(point, scales);

		expect(point).toEqual({ x: 100_000, y: 35 });
		expect(pixel).toEqual({ x: 100, y: 70 });
	});
});