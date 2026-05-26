import { isNotDefined, path } from "../utils/index.js";
import { EMA as defaultOptions } from "./defaultOptionsForComputation.js";
export default function ema() {
    let options = defaultOptions;
    function calculator(data) {
        const { windowSize, sourcePath } = options;
        const source = path(sourcePath);
        const alpha = 2 / (windowSize + 1);
        let previous;
        let initialAccumulator = 0;
        let skip = 0;
        return data.map(function (d, i) {
            const v = source(d, i);
            if (isNotDefined(previous) && isNotDefined(v)) {
                skip++;
                return undefined;
            }
            else if (i < windowSize + skip - 1) {
                initialAccumulator += v;
                return undefined;
            }
            else if (i === windowSize + skip - 1) {
                initialAccumulator += v;
                const initialValue = initialAccumulator / windowSize;
                previous = initialValue;
                return initialValue;
            }
            else {
                const nextValue = v * alpha + (1 - alpha) * previous;
                previous = nextValue;
                return nextValue;
            }
        });
    }
    calculator.undefinedLength = function () {
        const { windowSize } = options;
        return windowSize - 1;
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
