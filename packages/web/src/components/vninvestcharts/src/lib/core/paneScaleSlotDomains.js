import { getSeriesStyleOverride } from "./registry/SeriesRegistry.js";
import { resolveSeriesValueAccessors } from "./seriesValueResolver.js";
const BAR_SERIES_TYPES = ["Volume", "Whale", "AO"];
function finiteExtent(values) {
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    for (const value of values) {
        if (!Number.isFinite(value)) {
            continue;
        }
        if (value < minValue) {
            minValue = value;
        }
        if (value > maxValue) {
            maxValue = value;
        }
    }
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return [0, 1];
    }
    if (minValue === maxValue) {
        return [minValue - 1, maxValue + 1];
    }
    return [minValue, maxValue];
}
function isSeriesVisible(series) {
    const styleOverride = series.id ? getSeriesStyleOverride(series.id) : undefined;
    return series.visible !== false && styleOverride?.visible !== false;
}
function buildAxisAccessors(series) {
    const accessors = series.flatMap((item) => resolveSeriesValueAccessors(item));
    if (series.some((item) => BAR_SERIES_TYPES.includes(item.type))) {
        return [(_) => 0, ...accessors];
    }
    return accessors;
}
function computeAxisDomain(pane, data, axis) {
    const axisSeries = pane.series.filter((series) => isSeriesVisible(series) && series.yAxis === axis);
    if (axisSeries.length === 0) {
        return undefined;
    }
    const accessors = buildAxisAccessors(axisSeries);
    const values = data.flatMap((datum) => accessors
        .map((accessor) => accessor(datum))
        .filter((value) => typeof value === "number" && Number.isFinite(value)));
    return finiteExtent(values);
}
export function computePaneScaleSlotDomains(panes, data) {
    const domains = {};
    panes.forEach((pane) => {
        const leftDomain = computeAxisDomain(pane, data, "left");
        if (leftDomain) {
            domains[`${pane.id}-left`] = leftDomain;
        }
        const rightDomain = computeAxisDomain(pane, data, "right");
        if (rightDomain) {
            domains[`${pane.id}-right`] = rightDomain;
        }
    });
    return domains;
}
