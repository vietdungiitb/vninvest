import { max, min, mean } from "d3-array";
import { last, slidingWindow, zipper } from "../utils/index.js";
import { FullStochasticOscillator as defaultOptions } from "./defaultOptionsForComputation.js";
export default function sto() {
    let options = defaultOptions;
    let source = (d) => ({ open: d.open, high: d.high, low: d.low, close: d.close });
    function calculator(data) {
        const { windowSize, kWindowSize, dWindowSize } = options;
        const high = (d) => source(d).high, low = (d) => source(d).low, close = (d) => source(d).close;
        const kWindow = slidingWindow()
            .windowSize(windowSize)
            .accumulator((values) => {
            const highestHigh = max(values, high);
            const lowestLow = min(values, low);
            const currentClose = close(last(values));
            const k = (currentClose - lowestLow) / (highestHigh - lowestLow) * 100;
            return k;
        });
        const kSmoothed = slidingWindow()
            .skipInitial(windowSize - 1)
            .windowSize(kWindowSize)
            .accumulator((values) => mean(values));
        const dWindow = slidingWindow()
            .skipInitial(windowSize - 1 + kWindowSize - 1)
            .windowSize(dWindowSize)
            .accumulator((values) => mean(values));
        const stoAlgorithm = zipper()
            .combine((K, D) => ({ K, D }));
        const kData = kSmoothed(kWindow(data));
        const dData = dWindow(kData);
        const indicatorData = stoAlgorithm(kData, dData);
        return indicatorData;
    }
    calculator.undefinedLength = function () {
        const { windowSize, kWindowSize, dWindowSize } = options;
        return windowSize + kWindowSize + dWindowSize;
    };
    calculator.source = function (x) {
        if (!arguments.length) {
            return source;
        }
        source = x;
        return calculator;
    };
    calculator.options = function (x) {
        if (!arguments.length) {
            return options;
        }
        options = { ...defaultOptions, ...x };
        return calculator;
    };
    return calculator;
}
