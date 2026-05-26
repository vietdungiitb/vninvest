import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import PriceCoordinate from "../coordinates/PriceCoordinate";
import { createDrawingObject } from "./shared";
import { DrawingPriceLabels, resolveDrawingPriceMarkers } from "./priceLabel";

type ElementWithProps = ReactElement<Record<string, unknown>>;

describe("drawing price label markers", () => {
	it("uses the endpoint price for trend-like drawings", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-1",
		});

		expect(resolveDrawingPriceMarkers(drawing)).toEqual([
			{ key: "drawing-1-anchor", price: 40 },
		]);
	});

	it("resolves the risk reward ladder for position tools", () => {
		const drawing = createDrawingObject("longPosition", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-2",
			riskReward: { entry: 20, stop: 16, target: 28 },
		});

		expect(resolveDrawingPriceMarkers(drawing)).toEqual([
			{ key: "drawing-2-entry", price: 20 },
			{ key: "drawing-2-stop", price: 16 },
			{ key: "drawing-2-target", price: 28 },
		]);
	});

	it("expands fibonacci tools into axis levels", () => {
		const drawing = createDrawingObject("fibExtension", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-3",
			fibLevels: [1.272, 1.414],
		});

		expect(resolveDrawingPriceMarkers(drawing)).toEqual([
			{ key: "drawing-3-fib-extension-0", price: 65.44 },
			{ key: "drawing-3-fib-extension-1", price: 68.28 },
		]);
	});

	it("skips vertical lines", () => {
		const drawing = createDrawingObject("vLine", [
			{ x: 100, y: 20 },
			{ x: 100, y: 40 },
		], {
			id: "drawing-4",
		});

		expect(resolveDrawingPriceMarkers(drawing)).toEqual([]);
	});

	it("can be disabled from settings", () => {
		const drawing = createDrawingObject("text", [
			{ x: 100, y: 20 },
		], {
			id: "drawing-5",
			text: "Ghi chú",
		});

		expect(DrawingPriceLabels({ drawing, enabled: false })).toBeNull();
	});

	it("renders legacy drawing price markers through the SVG path so removed drawings do not leave stale axis canvas labels", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-6",
		});

		const labels = DrawingPriceLabels({ drawing }) as ElementWithProps;
		expect(labels.props["data-rsc-drawing-price-labels"]).toBe("legacy");

		const markerElements = Children.toArray(labels.props.children as ReactNode) as ElementWithProps[];
		expect(markerElements).toHaveLength(1);

		const coordinate = markerElements[0] as ElementWithProps;
		expect(coordinate.type).toBe(PriceCoordinate);

		const renderedCoordinate = new (PriceCoordinate as unknown as new (props: Record<string, unknown>) => { render: () => ElementWithProps })(coordinate.props).render();
		expect(renderedCoordinate.props.canvasDraw).toBeUndefined();
		expect(typeof renderedCoordinate.props.svgDraw).toBe("function");
	});

	it("skips rendering legacy price markers until chartConfig is ready", () => {
		const coordinate = new (PriceCoordinate as unknown as new (props: Record<string, unknown>) => { renderSVG: (moreProps: Record<string, unknown>) => ReactElement | null })({
			displayFormat: (value: number) => value.toFixed(2),
			price: 40,
		});

		expect(coordinate.renderSVG({ width: 1200 })).toBeNull();
	});
});