import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useMemo } from "react";
import { format as d3Format } from "d3-format";
import displayValuesFor from "../tooltip/displayValuesFor.js";
import GenericChartComponent from "../GenericChartComponent.js";
import ToolTipText from "../tooltip/ToolTipText.js";
import ToolTipTSpanLabel from "../tooltip/ToolTipTSpanLabel.js";
import { functor, isDefined } from "../utils/index.js";
function toDisplayValue(entry, item) {
    const rawValue = item ? entry.value(item) : undefined;
    if (!isDefined(rawValue)) {
        return "n/a";
    }
    if (typeof rawValue === "number") {
        return entry.format ? entry.format(rawValue) : d3Format(".2f")(rawValue);
    }
    return String(rawValue);
}
function defaultDateValue(date, xDisplayFormat) {
    if (!date) {
        return "n/a";
    }
    return xDisplayFormat ? xDisplayFormat(date) : date.toISOString();
}
export function PaneTooltip({ entries, xDisplayFormat, origin = [0, 0], className = "rsc-pane-tooltip", fontFamily = "Helvetica Neue, Helvetica, Arial, sans-serif", fontSize = 11, labelFill = "#7c8798", textFill = "#1e2a3b", displayValuesFor: selectCurrentItem = displayValuesFor, dateLabel = "Date", }) {
    const renderSVG = useMemo(() => {
        return (moreProps) => {
            const chartConfigList = moreProps.chartConfig;
            const config = Array.isArray(chartConfigList)
                ? chartConfigList.find((each) => each.id === moreProps.chartId) || chartConfigList[0]
                : chartConfigList;
            if (!config)
                return null;
            const { width, height } = config;
            const currentItem = selectCurrentItem({}, moreProps);
            const resolvedOrigin = functor(origin);
            const [x, y] = resolvedOrigin(width, height);
            const lines = entries.map((entry) => ({
                label: entry.label,
                value: toDisplayValue(entry, currentItem),
                color: entry.color ?? textFill,
            }));
            return (_jsx("g", { className: className, transform: `translate(${x}, ${y})`, children: _jsxs(ToolTipText, { x: 0, y: 0, fontFamily: fontFamily, fontSize: fontSize, children: [_jsx(ToolTipTSpanLabel, { fill: labelFill, x: 0, dy: "5", children: `${dateLabel}: ` }, "label-date"), _jsx("tspan", { fill: textFill, children: defaultDateValue(currentItem?.date, xDisplayFormat) }, "value-date"), lines.map((line) => (_jsxs(Fragment, { children: [_jsx(ToolTipTSpanLabel, { fill: line.color, children: ` ${line.label}: ` }), _jsx("tspan", { fill: line.color, children: line.value })] }, line.label)))] }) }));
        };
    }, [className, dateLabel, entries, fontFamily, fontSize, labelFill, origin, selectCurrentItem, textFill, xDisplayFormat]);
    return (_jsx(GenericChartComponent, { clip: false, svgDraw: renderSVG, drawOn: ["mousemove"] }));
}
