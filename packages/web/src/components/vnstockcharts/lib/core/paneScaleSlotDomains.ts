import type { EnrichedDatum } from "./calculators/types";
import { getSeriesStyleOverride } from "./registry/SeriesRegistry";
import { resolveSeriesValueAccessors } from "./seriesValueResolver";
import type { PaneDescriptor, SeriesConfig, SeriesTypeId, YAxisSide } from "./types/pane-descriptor";

const BAR_SERIES_TYPES: SeriesTypeId[] = ["Volume", "Whale", "AO"];

function finiteExtent(values: readonly number[]): [number, number] {
	const finiteValues = values.filter((value) => Number.isFinite(value));
	if (finiteValues.length === 0) {
		return [0, 1];
	}

	const minValue = Math.min(...finiteValues);
	const maxValue = Math.max(...finiteValues);
	if (minValue === maxValue) {
		return [minValue - 1, maxValue + 1];
	}

	return [minValue, maxValue];
}

function isSeriesVisible(series: SeriesConfig) {
	const styleOverride = series.id ? getSeriesStyleOverride(series.id) : undefined;
	return series.visible !== false && styleOverride?.visible !== false;
}

function buildAxisAccessors(series: readonly SeriesConfig[]) {
	const accessors = series.flatMap((item) => resolveSeriesValueAccessors(item));
	if (series.some((item) => BAR_SERIES_TYPES.includes(item.type))) {
		return [(_: EnrichedDatum) => 0 as number | undefined, ...accessors];
	}

	return accessors;
}

function computeAxisDomain(pane: PaneDescriptor, data: readonly EnrichedDatum[], axis: YAxisSide) {
	const axisSeries = pane.series.filter((series) => isSeriesVisible(series) && series.yAxis === axis);
	if (axisSeries.length === 0) {
		return undefined;
	}

	const accessors = buildAxisAccessors(axisSeries);
	const values = data.flatMap((datum) => accessors
		.map((accessor) => accessor(datum))
		.filter((value): value is number => typeof value === "number" && Number.isFinite(value)));

	return finiteExtent(values);
}

export function computePaneScaleSlotDomains(panes: readonly PaneDescriptor[], data: readonly EnrichedDatum[]) {
	const domains: Record<string, [number, number]> = {};

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