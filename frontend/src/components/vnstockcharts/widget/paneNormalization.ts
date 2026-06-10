import type { PaneDescriptor } from "../lib/core";
import { normalizeSeriesTypeId } from "../lib/core/types/pane-descriptor";

export function normalizePaneDescriptorsForExplicitScaleSlots(panes: readonly PaneDescriptor[]): PaneDescriptor[] {
	return panes.map((pane) => {
		const normalizedSeries = pane.series.flatMap((series) => {
			const normalizedType = normalizeSeriesTypeId(series.type);
			if (!normalizedType) {
				return [];
			}

			return [{
				...series,
				type: normalizedType,
				params: series.params ? { ...series.params } : undefined,
				scaleSlotId: series.scaleSlotId ?? `${pane.id}-${series.yAxis}`,
				subColors: series.subColors ? { ...series.subColors } : undefined,
			}];
		});
		const activeSeries = normalizedSeries.filter((series) => series.visible !== false);
		const hasLeftAxis = activeSeries.some((series) => series.yAxis === "left");
		const hasRightAxis = activeSeries.some((series) => series.yAxis === "right");

		return {
			...pane,
			series: normalizedSeries,
			splitScale: hasLeftAxis && hasRightAxis,
		};
	});
}