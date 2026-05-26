import { rebind, merge } from "../utils";

import { change } from "../calculator";

import baseIndicator from "./baseIndicator";

const ALGORITHM_TYPE = "Change";

export default function() {
	const base = baseIndicator()
		.type(ALGORITHM_TYPE);

	const underlyingAlgorithm = change();

	const mergedAlgorithm = merge()
		.algorithm(underlyingAlgorithm)
		.merge((datum: any, indicator: any) => {
			datum.absoluteChange = indicator.absoluteChange;
			datum.percentChange = indicator.percentChange;
		});

	// TODO(ts-migration): narrow type
	const indicator: any = function(data: any, options = { merge: true }) {
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