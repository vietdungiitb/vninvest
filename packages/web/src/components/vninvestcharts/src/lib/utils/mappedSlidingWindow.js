import noop from "./noop.js";
import identity from "./identity.js";
import { functor } from "./index.js";
export default function mappedSlidingWindow() {
    let undefinedValue = undefined, windowSize = 10, accumulator = noop, source = identity, skipInitial = 0;
    // eslint-disable-next-line prefer-const
    let mappedSlidingWindowFn = function (data) {
        const size = functor(windowSize).apply(this, arguments);
        const windowData = [];
        let accumulatorIdx = 0;
        const undef = functor(undefinedValue);
        const result = [];
        data.forEach(function (d, i) {
            let mapped;
            if (i < (skipInitial + size - 1)) {
                mapped = undef(d, i);
                result.push(mapped);
                windowData.push(mapped);
                return;
            }
            if (i >= (skipInitial + size)) {
                windowData.shift();
            }
            windowData.push(source(d, i));
            mapped = accumulator(windowData, i, accumulatorIdx++);
            result.push(mapped);
            windowData.pop();
            windowData.push(mapped);
            return;
        });
        return result;
    };
    mappedSlidingWindowFn.undefinedValue = function (x) {
        if (!arguments.length) {
            return undefinedValue;
        }
        undefinedValue = x;
        return mappedSlidingWindowFn;
    };
    mappedSlidingWindowFn.windowSize = function (x) {
        if (!arguments.length) {
            return windowSize;
        }
        windowSize = x;
        return mappedSlidingWindowFn;
    };
    mappedSlidingWindowFn.accumulator = function (x) {
        if (!arguments.length) {
            return accumulator;
        }
        accumulator = x;
        return mappedSlidingWindowFn;
    };
    mappedSlidingWindowFn.skipInitial = function (x) {
        if (!arguments.length) {
            return skipInitial;
        }
        skipInitial = x;
        return mappedSlidingWindowFn;
    };
    mappedSlidingWindowFn.source = function (x) {
        if (!arguments.length) {
            return source;
        }
        source = x;
        return mappedSlidingWindowFn;
    };
    return mappedSlidingWindowFn;
}
