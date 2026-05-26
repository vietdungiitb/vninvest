import { rebind, merge } from "../utils/index.js";
import { atr } from "../calculator/index.js";
import baseIndicator from "./baseIndicator.js";
const ALGORITHM_TYPE = "ATR";
export default function () {
    const base = baseIndicator()
        .type(ALGORITHM_TYPE);
    const underlyingAlgorithm = atr();
    const mergedAlgorithm = merge()
        .algorithm(underlyingAlgorithm)
        .merge((datum, indicator) => { datum.atr = indicator; });
    // TODO(ts-migration): narrow type
    const indicator = function (data, options = { merge: true }) {
        if (options.merge) {
            if (!base.accessor())
                throw new Error(`Set an accessor to ${ALGORITHM_TYPE} before calculating`);
            return mergedAlgorithm(data);
        }
        return underlyingAlgorithm(data);
    };
    rebind(indicator, base, "id", "accessor", "stroke", "fill", "echo", "type");
    rebind(indicator, underlyingAlgorithm, "options");
    rebind(indicator, mergedAlgorithm, "merge", "skipUndefined");
    return indicator;
}
