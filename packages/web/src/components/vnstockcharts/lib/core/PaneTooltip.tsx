import { Fragment, useMemo } from "react";
import { format as d3Format } from "d3-format";
import displayValuesFor from "../tooltip/displayValuesFor";
import GenericChartComponent from "../GenericChartComponent";
import ToolTipText from "../tooltip/ToolTipText";
import ToolTipTSpanLabel from "../tooltip/ToolTipTSpanLabel";
import { functor, isDefined } from "../utils";
import type { EnrichedDatum } from "./calculators/types";

export interface PaneTooltipEntry {
	label: string;
	value: (datum: EnrichedDatum) => number | string | undefined;
	color?: string;
	format?: (value: number) => string;
}

export interface PaneTooltipProps {
	entries: PaneTooltipEntry[];
	xDisplayFormat?: (date: Date) => string;
	origin?: [number, number] | ((width: number, height: number) => [number, number]);
	className?: string;
	fontFamily?: string;
	fontSize?: number;
	labelFill?: string;
	textFill?: string;
	displayValuesFor?: typeof displayValuesFor;
	dateLabel?: string;
}

function toDisplayValue(entry: PaneTooltipEntry, item: EnrichedDatum | undefined) {
	const rawValue = item ? entry.value(item) : undefined;
	if (!isDefined(rawValue)) {
		return "n/a";
	}
	if (typeof rawValue === "number") {
		return entry.format ? entry.format(rawValue) : d3Format(".2f")(rawValue);
	}
	return String(rawValue);
}

function defaultDateValue(date: Date | undefined, xDisplayFormat?: (date: Date) => string) {
	if (!date) {
		return "n/a";
	}
	return xDisplayFormat ? xDisplayFormat(date) : date.toISOString();
}

export function PaneTooltip({
	entries,
	xDisplayFormat,
	origin = [0, 0],
	className = "rsc-pane-tooltip",
	fontFamily = "Helvetica Neue, Helvetica, Arial, sans-serif",
	fontSize = 11,
	labelFill = "#7c8798",
	textFill = "#1e2a3b",
	displayValuesFor: selectCurrentItem = displayValuesFor,
	dateLabel = "Date",
}: PaneTooltipProps) {
	const renderSVG = useMemo(() => {
		return (moreProps: any) => {
			const chartConfigList = moreProps.chartConfig;
			const config = Array.isArray(chartConfigList)
				? chartConfigList.find((each: any) => each.id === moreProps.chartId) || chartConfigList[0]
				: chartConfigList;
			if (!config) return null;

			const { width, height } = config;
			const currentItem = selectCurrentItem({}, moreProps) as EnrichedDatum | undefined;
			const resolvedOrigin = functor(origin as any);
			const [x, y] = resolvedOrigin(width, height);

			const lines = entries.map((entry) => ({
				label: entry.label,
				value: toDisplayValue(entry, currentItem),
				color: entry.color ?? textFill,
			}));

			return (
				<g className={className} transform={`translate(${x}, ${y})`}>
					<ToolTipText x={0} y={0} fontFamily={fontFamily} fontSize={fontSize}>
						<ToolTipTSpanLabel fill={labelFill} key="label-date" x={0} dy="5">{`${dateLabel}: `}</ToolTipTSpanLabel>
						<tspan fill={textFill} key="value-date">{defaultDateValue(currentItem?.date, xDisplayFormat)}</tspan>
						{lines.map((line) => (
							<Fragment key={line.label}>
								<ToolTipTSpanLabel fill={line.color}>{` ${line.label}: `}</ToolTipTSpanLabel>
								<tspan fill={line.color}>{line.value}</tspan>
							</Fragment>
						))}
					</ToolTipText>
				</g>
			);
		};
	}, [className, dateLabel, entries, fontFamily, fontSize, labelFill, origin, selectCurrentItem, textFill, xDisplayFormat]);

	return (
		<GenericChartComponent
			clip={false}
			svgDraw={renderSVG}
			drawOn={["mousemove"]}
		/>
	);
}
