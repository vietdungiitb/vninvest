import { mean } from "d3-array";
import ema from "./ema.js";
import { ElderRay as defaultOptions } from "./defaultOptionsForComputation.js";
import { isDefined, zipper, slidingWindow } from "../utils/index.js";
export default function elderRay() {
    let options = defaultOptions;
    let ohlc = (d) => ({ open: d.open, high: d.high, low: d.low, close: d.close });
    function calculator(data) {
        const { windowSize, sourcePath, movingAverageType } = options;
        const meanAlgorithm = movingAverageType === "ema"
            ? ema().options({ windowSize, sourcePath })
            : slidingWindow().windowSize(windowSize).accumulator((values) => mean(values)).sourcePath(sourcePath);
        const zip = zipper()
            .combine((datum, meanValue) => {
            const bullPower = isDefined(meanValue) ? ohlc(datum).high - meanValue : undefined;
            const bearPower = isDefined(meanValue) ? ohlc(datum).low - meanValue : undefined;
            return { bullPower, bearPower };
        });
        const newData = zip(data, meanAlgorithm(data));
        return newData;
    }
    calculator.undefinedLength = function () {
        const { windowSize } = options;
        return windowSize - 1;
    };
    calculator.ohlc = function (x) {
        if (!arguments.length) {
            return ohlc;
        }
        ohlc = x;
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
