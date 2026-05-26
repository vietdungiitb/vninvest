import { rebind, merge } from "../utils/index.js";
import { change } from "../calculator/index.js";
import baseIndicator from "./baseIndicator.js";
const ALGORITHM_TYPE = "Change";
export default function () {
    const base = baseIndicator()
        .type(ALGORITHM_TYPE);
    const underlyingAlgorithm = change();
    const mergedAlgorithm = merge()
        .algorithm(underlyingAlgorithm)
        .merge((datum, indicator) => {
        datum.absoluteChange = indicator.absoluteChange;
        datum.percentChange = indicator.percentChange;
    });
    // TODO(ts-migration): narrow type
    const indicator = function (data, options = { merge: true }) {
        if (options.merge) {
            return mergedAlgorithm(data);
        }
        return underlyingAlgorithm(data);
    };
    rebind(indicator, base, "id", "accessor", "stroke", "fill", "echo", "type");
    rebind(indicator, underlyingAlgorithm, "options");
    rebind(indicator, mergedAlgorithm, "merge", "skipUndefined");
    return indicator;
}
