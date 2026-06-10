import { afterEach, describe, expect, it } from "vitest";
import { createDrawingObject } from "./shared";
import { renderDrawingToSvg } from "./renderSvg";
import { clearDrawingStyleOverrides, overrideDrawingStyle } from "./drawingStyleRegistry";
afterEach(() => {
    clearDrawingStyleOverrides();
});
const scales = {
    xScale: (date) => date.getTime() / 1000,
    xScaleInvert: (px) => new Date(px * 1000),
    yScale: (price) => price * 4,
    yScaleInvert: (px) => px / 4,
};
const options = {
    chartWidth: 640,
    chartHeight: 360,
    isSelected: false,
};
function createExtendedDrawing(type, points, id) {
    return {
        ...createDrawingObject("trendLine", points, { id }),
        type,
    };
}
describe("renderDrawingToSvg", () => {
    it("renders trend lines with selection handles", () => {
        const drawing = createDrawingObject("trendLine", [
            { x: 100_000, y: 20 },
            { x: 160_000, y: 40 },
        ], { id: "trend-1" });
        const elements = renderDrawingToSvg(drawing, scales, { ...options, isSelected: true });
        const lineElements = elements.filter((element) => element.type === "line");
        const circleElements = elements.filter((element) => element.type === "circle");
        expect(lineElements).toHaveLength(1);
        expect(circleElements).toHaveLength(2);
        expect(lineElements[0]?.props.x1).toBe(100);
        expect(lineElements[0]?.props.x2).toBe(160);
    });
    it("renders a full-width horizontal line", () => {
        const drawing = createDrawingObject("hLine", [{ x: 100_000, y: 20 }, { x: 160_000, y: 20 }], { id: "h-1" });
        const [line] = renderDrawingToSvg(drawing, scales, options);
        expect(line?.type).toBe("line");
        expect(line?.props.x1).toBe(0);
        expect(line?.props.x2).toBe(640);
    });
    it("renders a full-height vertical line", () => {
        const drawing = createDrawingObject("vLine", [{ x: 100_000, y: 20 }, { x: 100_000, y: 60 }], { id: "v-1" });
        const [line] = renderDrawingToSvg(drawing, scales, options);
        expect(line?.type).toBe("line");
        expect(line?.props.y1).toBe(0);
        expect(line?.props.y2).toBe(360);
    });
    it("renders fibonacci levels as paired line and label elements", () => {
        const drawing = createDrawingObject("fibonacci", [{ x: 100_000, y: 10 }, { x: 200_000, y: 50 }], { id: "fib-1" });
        const elements = renderDrawingToSvg(drawing, scales, options);
        const lineElements = elements.filter((element) => element.type === "line");
        const textElements = elements.filter((element) => element.type === "text");
        expect(lineElements).toHaveLength(9);
        expect(textElements).toHaveLength(9);
        expect(textElements[0]?.props.children).toContain("% —");
    });
    it("renders channels as two parallel lines", () => {
        const drawing = createDrawingObject("channel", [{ x: 100_000, y: 10 }, { x: 200_000, y: 40 }, { x: 120_000, y: 30 }], { id: "channel-1" });
        const elements = renderDrawingToSvg(drawing, scales, options);
        expect(elements.filter((element) => element.type === "line")).toHaveLength(2);
    });
    it("renders text labels as SVG text elements", () => {
        const drawing = createDrawingObject("text", [{ x: 100_000, y: 20 }], { id: "text-1", text: "Note" });
        const [element] = renderDrawingToSvg(drawing, scales, options);
        expect(element?.type).toBe("text");
        expect(element?.props.children).toBe("Note");
    });
    it("renders rectangles and arrows for the expanded tool set", () => {
        const rectangle = createExtendedDrawing("rectangle", [{ x: 100_000, y: 20 }, { x: 160_000, y: 40 }], "rect-1");
        const arrow = createExtendedDrawing("arrow", [{ x: 100_000, y: 20 }, { x: 160_000, y: 40 }], "arrow-1");
        expect(renderDrawingToSvg(rectangle, scales, options).some((element) => element.type === "rect")).toBe(true);
        expect(renderDrawingToSvg(arrow, scales, options).some((element) => element.type === "polygon")).toBe(true);
    });
    it("renders with the effective style when a drawing override is active", () => {
        const drawing = createDrawingObject("trendLine", [
            { x: 100_000, y: 20 },
            { x: 160_000, y: 40 },
        ], { id: "trend-override" });
        overrideDrawingStyle(drawing.id, { color: "#ff00ff", lineWidth: 3 });
        const [line] = renderDrawingToSvg(drawing, scales, options);
        expect(line?.type).toBe("line");
        expect(line?.props.stroke).toBe("#ff00ff");
        expect(line?.props.strokeWidth).toBe(3);
    });
});
