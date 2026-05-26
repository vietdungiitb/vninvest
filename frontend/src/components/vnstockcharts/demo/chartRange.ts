export const CHART_RANGES = ["1D", "5D", "1M", "3M", "YTD", "1Y", "All"] as const;

export type ChartRange = typeof CHART_RANGES[number];

export const DEFAULT_CHART_RANGE: ChartRange = "5D";

export const CHART_RANGE_LABEL_KEYS: Record<ChartRange, string> = {
	"1D": "library.range.1d",
	"5D": "library.range.5d",
	"1M": "library.range.1m",
	"3M": "library.range.3m",
	YTD: "library.range.ytd",
	"1Y": "library.range.1y",
	All: "library.range.all",
};

type RangeDatum = { date: Date | number };

function normalizeDate(value: Date | number) {
	return value instanceof Date ? value : new Date(value);
}

function subtractDays(date: Date, days: number) {
	const next = new Date(date.getTime());
	next.setDate(next.getDate() - days);
	return next;
}

function subtractMonths(date: Date, months: number) {
	const next = new Date(date.getTime());
	const dayOfMonth = next.getDate();
	next.setDate(1);
	next.setMonth(next.getMonth() - months);
	const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
	next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
	return next;
}

function subtractYears(date: Date, years: number) {
	const next = new Date(date.getTime());
	next.setFullYear(next.getFullYear() - years);
	return next;
}

export function resolveChartRangeStart(endDate: Date, range: ChartRange) {
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

export function resolveChartRangeExtents(data: readonly RangeDatum[], range: ChartRange): [Date, Date] {
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