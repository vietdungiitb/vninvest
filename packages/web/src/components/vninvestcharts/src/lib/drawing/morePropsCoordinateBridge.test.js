import { describe, expect, it } from "vitest";
import { scaleLinear, scaleTime } from "d3-scale";
import { buildRenderScalesFromMoreProps, createDrawingCoordinateBridgeFromMoreProps, getAdjustedMousePosition, resolveActiveChartConfig, resolveBaseChartConfig, resolveChartPointFromMoreProps, resolveDrawingChartConfig, } from "./morePropsCoordinateBridge";
const plotData = [
    { date: new Date("2024-01-01T00:00:00.000Z"), close: 100 },
    { date: new Date("2024-01-02T00:00:00.000Z"), close: 110 },
];
function createMoreProps() {
    const xScale = scaleTime()
        .domain([plotData[0].date, plotData[1].date])
        .range([0, 200]);
    const priceYScale = scaleLinear().domain([80, 140]).range([180, 0]);
    const volumeYScale = scaleLinear().domain([0, 2000]).range([120, 0]);
    return {
        chartId: "root-price",
        chartConfig: [
            {
                id: "root-price",
                paneId: "price",
                yScaleId: "price-right",
                origin: [0, 0],
                padding: 0,
                yScale: priceYScale,
                yExtents: [],
                width: 200,
                height: 180,
            },
            {
                id: "volume-right",
                paneId: "volume",
                yScaleId: "volume-right",
                origin: [0, 180],
                padding: 0,
                yScale: volumeYScale,
                yExtents: [],
                width: 200,
                height: 120,
            },
        ],
        currentCharts: ["volume-right"],
        currentItem: plotData[1],
        xScale,
        xAccessor: (datum) => datum.date,
        plotData,
        mouseXY: [100, 240],
    };
}
describe("morePropsCoordinateBridge", () => {
    it("resolves base and active chart configs from moreProps", () => {
        const moreProps = createMoreProps();
        expect(resolveBaseChartConfig(moreProps)?.id).toBe("root-price");
        expect(resolveActiveChartConfig(moreProps)?.id).toBe("volume-right");
    });
    it("selects the exact drawing chart config by paneId and yScaleId", () => {
        const moreProps = createMoreProps();
        const drawing = {
            id: "drawing-1",
            type: "trendLine",
            points: [
                { x: plotData[0].date.getTime(), y: 100 },
                { x: plotData[1].date.getTime(), y: 110 },
            ],
            style: { stroke: "#000", strokeWidth: 1 },
            paneId: "volume",
            yScaleId: "volume-right",
            createdAt: 1,
            updatedAt: 1,
        };
        expect(resolveDrawingChartConfig(moreProps, drawing)?.id).toBe("volume-right");
    });
    it("adjusts mouse coordinates from the base chart origin to the target chart origin", () => {
        const moreProps = createMoreProps();
        const adjusted = getAdjustedMousePosition(moreProps, resolveActiveChartConfig(moreProps));
        expect(adjusted).toEqual([100, 60]);
    });
    it("builds render scales from the selected chart config", () => {
        const moreProps = createMoreProps();
        const renderScales = buildRenderScalesFromMoreProps(moreProps, resolveActiveChartConfig(moreProps));
        expect(renderScales?.plotData).toBe(plotData);
        expect(renderScales?.yScaleInvert(60)).toBeCloseTo(1000, 6);
    });
    it("resolves a chart point in chart coordinates for the active chart", () => {
        const moreProps = createMoreProps();
        const point = resolveChartPointFromMoreProps(moreProps, moreProps.mouseXY, resolveActiveChartConfig(moreProps));
        expect(point).toEqual({
            x: plotData[1].date.getTime(),
            y: 1000,
        });
    });
    it("uses bar-index projection when discontinuous lookup resolves a matching timestamp", () => {
        const fullPlotData = [
            { date: new Date("2024-01-01T00:00:00.000Z"), close: 100, index: 0 },
            { date: new Date("2024-01-02T00:00:00.000Z"), close: 110, index: 1 },
            { date: new Date("2024-01-03T00:00:00.000Z"), close: 120, index: 2 },
        ];
        const priceYScale = scaleLinear().domain([80, 140]).range([180, 0]);
        const discontinuousLikeScale = scaleLinear().domain([0, 2]).range([0, 200]);
        const moreProps = {
            chartId: "root-price",
            chartConfig: {
                id: "root-price",
                paneId: "price",
                yScaleId: "price-right",
                origin: [0, 0],
                padding: 0,
                yScale: priceYScale,
                yExtents: [],
                width: 200,
                height: 180,
            },
            xScale: discontinuousLikeScale,
            xAccessor: (datum) => datum.index,
            plotData: fullPlotData.slice(1),
            fullData: fullPlotData,
        };
        const bridge = createDrawingCoordinateBridgeFromMoreProps(moreProps);
        const pixel = bridge?.chartPointToPixel({
            paneId: "price",
            point: {
                x: fullPlotData[0].date.getTime(),
                y: 100,
                timeMsHint: fullPlotData[0].date.getTime(),
            },
        });
        expect(pixel).toBeDefined();
        expect(pixel?.x).toBeCloseTo(0, 6);
    });
});
