export const CHART_RANGES = ["1D", "5D", "1M", "3M", "YTD", "1Y", "All"];
export const DEFAULT_CHART_RANGE = "5D";
export const CHART_RANGE_LABEL_KEYS = {
    "1D": "library.range.1d",
    "5D": "library.range.5d",
    "1M": "library.range.1m",
    "3M": "library.range.3m",
    YTD: "library.range.ytd",
    "1Y": "library.range.1y",
    All: "library.range.all",
};
const FETCH_PREFETCH_MULTIPLIER = {
    "1D": 7,
    "5D": 6,
    "1M": 3,
    "3M": 2,
    YTD: 1.25,
    "1Y": 1.1,
    All: 1,
};
function normalizeDate(value) {
    return value instanceof Date ? value : new Date(value);
}
function subtractDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() - days);
    return next;
}
function subtractMonths(date, months) {
    const next = new Date(date.getTime());
    const dayOfMonth = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() - months);
    const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
    return next;
}
function subtractYears(date, years) {
    const next = new Date(date.getTime());
    next.setFullYear(next.getFullYear() - years);
    return next;
}
export function resolveChartRangeStart(endDate, range) {
    switch (range) {
        case "1D":
            return subtractDays(endDate, 1);
        case "5D":
            return subtractDays(endDate, 5);
        case "1M":
            return subtractMonths(endDate, 1);
        case "3M":
            return subtractMonths(endDate, 3);
        case "YTD":
            return new Date(endDate.getFullYear(), 0, 1);
        case "1Y":
            return subtractYears(endDate, 1);
        case "All":
            return new Date(0);
        default:
            return endDate;
    }
}
export function resolveChartRangeFetchStart(endDate, range) {
    if (range === "All") {
        return new Date(0);
    }
    const viewportStart = resolveChartRangeStart(endDate, range);
    const multiplier = FETCH_PREFETCH_MULTIPLIER[range] ?? 1;
    if (multiplier <= 1) {
        return viewportStart;
    }
    const viewportSpanMs = Math.max(1, endDate.valueOf() - viewportStart.valueOf());
    const fetchSpanMs = Math.ceil(viewportSpanMs * multiplier);
    return new Date(endDate.valueOf() - fetchSpanMs);
}
export function resolveChartRangeExtents(data, range) {
    if (data.length === 0) {
        return [new Date(0), new Date(0)];
    }
    if (data.length === 1) {
        const single = normalizeDate(data[0].date);
        return [single, single];
    }
    const first = normalizeDate(data[0].date);
    const last = normalizeDate(data[data.length - 1].date);
    if (range === "All") {
        return [first, last];
    }
    const rangeStart = resolveChartRangeStart(last, range);
    return [rangeStart.valueOf() < first.valueOf() ? first : rangeStart, last];
}
export function isChartRangeSatisfied(data, range) {
    if (data.length === 0 || range === "All") {
        return true;
    }
    const first = normalizeDate(data[0].date);
    const last = normalizeDate(data[data.length - 1].date);
    const targetStart = resolveChartRangeStart(last, range);
    return first.valueOf() <= targetStart.valueOf();
}
