import { rebind, merge } from "../utils";

import { wma } from "../calculator";

import baseIndicator from "./baseIndicator";

const ALGORITHM_TYPE = "WMA";

export default function() {

	const base = baseIndicator()
		.type(ALGORITHM_TYPE)
		.accessor((d: any) => d.wma);

	const underlyingAlgorithm = wma();

	const mergedAlgorithm = merge()
		.algorithm(underlyingAlgorithm)
		.merge((datum: any, indicator: any) => { datum.wma = indicator; });

	const indicator: any = function(data: any, options = { merge: true }) {
		if (options.merge) {
			if (!base.accessor()) throw new Error(`Set an accessor to ${ALGORITHM_TYPE} before calculating`);
			return mergedAlgorithm(data);
		}
		return underlyingAlgorithm(data);
	};

	rebind(indicator, base, "id", "accessor", "stroke", "fill", "echo", "type");
	rebind(indicator, underlyingAlgorithm, "undefinedLength");
	rebind(indicator, underlyingAlgorithm, "options");
	rebind(indicator, mergedAlgorithm, "merge", "skipUndefined");


	return indicator;
}