import { rebind, merge } from "../utils/index.js";
import { forceIndex } from "../calculator/index.js";
import baseIndicator from "./baseIndicator.js";
const ALGORITHM_TYPE = "ForceIndex";
export default function () {
    const base = baseIndicator()
        .type(ALGORITHM_TYPE)
        .accessor((d) => d.forceIndex);
    const underlyingAlgorithm = forceIndex();
    const mergedAlgorithm = merge()
        .algorithm(underlyingAlgorithm)
        .merge((datum, indicator) => { datum.forceIndex = indicator; });
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
