import { rebind, merge } from "../utils";

import { compare } from "../calculator";

import baseIndicator from "./baseIndicator";

const ALGORITHM_TYPE = "Compare";

export default function() {
	const base = baseIndicator()
		.type(ALGORITHM_TYPE)
		.accessor((d: any) => d.compare);

	const underlyingAlgorithm = compare();

	const mergedAlgorithm = merge()
		.algorithm(underlyingAlgorithm)
		.merge((datum: any, indicator: any) => { datum.compare = indicator; });

	// TODO(ts-migration): narrow type
	const indicator: any = function(data: any, options = { merge: true }) {
		if (options.merge) {
			if (!base.accessor()) throw new Error(`Set an accessor to ${ALGORITHM_TYPE} before calculating`);
			return mergedAlgorithm(data);
		}
		return underlyingAlgorithm(data);
	};

	rebind(indicator, base, "id", "accessor", "stroke", "fill", "echo", "type");
	rebind(indicator, underlyingAlgorithm, "options");
	rebind(indicator, mergedAlgorithm, "merge");

	return indicator;
}