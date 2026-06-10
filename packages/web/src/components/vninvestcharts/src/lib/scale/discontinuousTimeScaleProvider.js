import { timeFormat } from "d3-time-format";
import financeDiscontinuousScale from "./financeDiscontinuousScale.js";
import { slidingWindow, zipper, identity, isNotDefined } from "../utils/index.js";
import { defaultFormatters, levelDefinition } from "./levels.js";
function evaluateLevel(d, date, i, formatters) {
    return levelDefinition
        .map((eachLevel, idx) => {
        return {
            level: levelDefinition.length - idx - 1,
            format: formatters[eachLevel(d, date, i)]
        };
    })
        .find((l) => !!l.format);
}
const discontinuousIndexCalculator = slidingWindow()
    .windowSize(2)
    .undefinedValue((d, idx, { initialIndex, formatters }) => {
    const i = initialIndex;
    const row = {
        date: d.getTime(),
        startOf30Seconds: false,
        startOfMinute: false,
        startOf5Minutes: false,
        startOf15Minutes: false,
        startOf30Minutes: false,
        startOfHour: false,
        startOfEighthOfADay: false,
        startOfQuarterDay: false,
        startOfHalfDay: false,
        startOfDay: true,
        startOfWeek: false,
        startOfMonth: false,
        startOfQuarter: false,
        startOfYear: false,
    };
    const level = evaluateLevel(row, d, i, formatters);
    return { ...row, index: i, ...level };
});
const discontinuousIndexCalculatorLocalTime = discontinuousIndexCalculator
    .accumulator(([prevDate, nowDate], i, idx, { initialIndex, formatters }) => {
    const startOf30Seconds = nowDate.getSeconds() % 30 === 0;
    const startOfMinute = nowDate.getMinutes() !== prevDate.getMinutes();
    const startOf5Minutes = startOfMinute && nowDate.getMinutes() % 5 <= prevDate.getMinutes() % 5;
    const startOf15Minutes = startOfMinute && nowDate.getMinutes() % 15 <= prevDate.getMinutes() % 15;
    const startOf30Minutes = startOfMinute && nowDate.getMinutes() % 30 <= prevDate.getMinutes() % 30;
    const startOfHour = nowDate.getHours() !== prevDate.getHours();
    const startOfEighthOfADay = startOfHour && nowDate.getHours() % 3 === 0;
    const startOfQuarterDay = startOfHour && nowDate.getHours() % 6 === 0;
    const startOfHalfDay = startOfHour && nowDate.getHours() % 12 === 0;
    const startOfDay = nowDate.getDay() !== prevDate.getDay();
    const startOfWeek = nowDate.getDay() < prevDate.getDay();
    const startOfMonth = nowDate.getMonth() !== prevDate.getMonth();
    const startOfQuarter = startOfMonth && (nowDate.getMonth() % 3 <= prevDate.getMonth() % 3);
    const startOfYear = nowDate.getFullYear() !== prevDate.getFullYear();
    const row = {
        date: nowDate.getTime(),
        startOf30Seconds,
        startOfMinute,
        startOf5Minutes,
        startOf15Minutes,
        startOf30Minutes,
        startOfHour,
        startOfEighthOfADay,
        startOfQuarterDay,
        startOfHalfDay,
        startOfDay,
        startOfWeek,
        startOfMonth,
        startOfQuarter,
        startOfYear,
    };
    const level = evaluateLevel(row, nowDate, i, formatters);
    if (level == null) {
    }
    return { ...row, index: i + initialIndex, ...level };
});
function doStuff(realDateAccessor, inputDateAccessor, initialIndex, formatters) {
    return function (data) {
        const dateAccessor = realDateAccessor(inputDateAccessor);
        const calculate = discontinuousIndexCalculatorLocalTime
            .source(dateAccessor)
            .misc({ initialIndex, formatters });
        const index = calculate(data).map((each) => {
            const { format } = each;
            return {
                index: each.index,
                level: each.level,
                date: new Date(each.date),
                format: timeFormat(format),
            };
        });
        return { index };
    };
}
export function discontinuousTimeScaleProviderBuilder() {
    let initialIndex = 0, realDateAccessor = identity;
    let inputDateAccessor = (d) => d.date, indexAccessor = (d) => d.idx, indexMutator = (d, idx) => ({ ...d, idx }), withIndex;
    let currentFormatters = defaultFormatters;
    // eslint-disable-next-line prefer-const
    let discontinuousTimeScaleProvider = function (data) {
        let index = withIndex;
        if (isNotDefined(index)) {
            const response = doStuff(realDateAccessor, inputDateAccessor, initialIndex, currentFormatters)(data);
            index = response.index;
        }
        const inputIndex = index;
        const xScale = financeDiscontinuousScale(inputIndex);
        const mergedData = zipper()
            .combine(indexMutator);
        const finalData = mergedData(data, inputIndex);
        return {
            data: finalData,
            xScale,
            xAccessor: (d) => d && indexAccessor(d).index,
            displayXAccessor: realDateAccessor(inputDateAccessor),
        };
    };
    discontinuousTimeScaleProvider.initialIndex = function (x) {
        if (!arguments.length) {
            return initialIndex;
        }
        initialIndex = x;
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.inputDateAccessor = function (x) {
        if (!arguments.length) {
            return inputDateAccessor;
        }
        inputDateAccessor = x;
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.indexAccessor = function (x) {
        if (!arguments.length) {
            return indexAccessor;
        }
        indexAccessor = x;
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.indexMutator = function (x) {
        if (!arguments.length) {
            return indexMutator;
        }
        indexMutator = x;
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.withIndex = function (x) {
        if (!arguments.length) {
            return withIndex;
        }
        withIndex = x;
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.utc = function () {
        realDateAccessor = (dateAccessor) => (d) => {
            const date = dateAccessor(d);
            const offsetInMillis = date.getTimezoneOffset() * 60 * 1000;
            return new Date(date.getTime() + offsetInMillis);
        };
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.locale = function (locale, formatters) {
        // timeFormatDefaultLocale removed from d3-time-format v3+
        if (formatters) {
            currentFormatters = formatters;
        }
        return discontinuousTimeScaleProvider;
    };
    discontinuousTimeScaleProvider.indexCalculator = function () {
        return doStuff(realDateAccessor, inputDateAccessor, initialIndex, currentFormatters);
    };
    return discontinuousTimeScaleProvider;
}
export default discontinuousTimeScaleProviderBuilder();
