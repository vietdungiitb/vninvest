import { describe, expect, it } from "vitest";
import CircleShape, { hitTestCircle } from "./circleShape";
import EllipseShape, { hitTestEllipse } from "./ellipseShape";
import TriangleShape, { hitTestTriangle } from "./triangleShape";
import CalloutShape, { hitTestCallout, measureCalloutBox } from "./calloutShape";
import PriceLabelShape, { hitTestPriceLabel, measurePriceLabelTag } from "./priceLabelShape";
describe("shape tools", () => {
    it("circle createDraft creates 2 anchor points", () => {
        const draft = CircleShape.createDraft({ x: 10, y: 20 });
        expect(draft.points).toHaveLength(2);
        expect(draft.points[1]).toEqual({ x: 10, y: 20 });
    });
    it("ellipse createDraft creates 2 anchor points", () => {
        const draft = EllipseShape.createDraft({ x: 10, y: 20 });
        expect(draft.points).toHaveLength(2);
    });
    it("triangle createDraft creates 3 anchor points", () => {
        const draft = TriangleShape.createDraft({ x: 10, y: 20 });
        expect(draft.points).toHaveLength(3);
    });
    it("callout createDraft initializes text", () => {
        const draft = CalloutShape.createDraft({ x: 10, y: 20 });
        expect(draft.text).toBe("Text");
    });
    it("priceLabel createDraft initializes text", () => {
        const draft = PriceLabelShape.createDraft({ x: 10, y: 20 });
        expect(draft.text).toBe("Price");
    });
    it("hitTestCircle returns true on boundary", () => {
        expect(hitTestCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, 1)).toBe(true);
    });
    it("hitTestCircle returns false well inside when fill is not considered", () => {
        expect(hitTestCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 0 }, 1)).toBe(false);
    });
    it("hitTestCircle returns false well outside", () => {
        expect(hitTestCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 14, y: 0 }, 1)).toBe(false);
    });
    it("hitTestEllipse returns true near boundary", () => {
        expect(hitTestEllipse({ x: 0, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 0 }, 1)).toBe(true);
    });
    it("hitTestEllipse returns false outside", () => {
        expect(hitTestEllipse({ x: 0, y: 0 }, { x: 20, y: 10 }, { x: 10, y: -5 }, 1)).toBe(false);
    });
    it("hitTestTriangle returns true on edge", () => {
        expect(hitTestTriangle({ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 5, y: 0 }, { x: 5, y: 10 }, 0.5)).toBe(true);
    });
    it("hitTestTriangle returns true inside", () => {
        expect(hitTestTriangle({ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 5, y: 0 }, { x: 5, y: 6 }, 0.5)).toBe(true);
    });
    it("hitTestTriangle returns false outside", () => {
        expect(hitTestTriangle({ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 5, y: 0 }, { x: 12, y: 6 }, 0.5)).toBe(false);
    });
    it("hitTestCallout returns true inside measured box", () => {
        const box = measureCalloutBox({ x: 40, y: 40 }, "Label", 12);
        expect(hitTestCallout({ x: 40, y: 40 }, { x: 60, y: 70 }, { x: box.x + 4, y: box.y + 4 }, "Label", 12, 1)).toBe(true);
    });
    it("hitTestPriceLabel returns true inside tag", () => {
        const tag = measurePriceLabelTag(200, "Price", 11);
        expect(hitTestPriceLabel({ x: 80, y: 50 }, { x: tag.x + 2, y: 50 }, 200, "Price", 11, 1)).toBe(true);
    });
});
