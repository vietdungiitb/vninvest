import { merge, slidingWindow, identity } from "../utils";

export default function() {

	let windowSize = 1,
		accumulator = identity,
		mergeAs = identity;

	const algorithm: any = function(data: any) {

		const defaultAlgorithm = slidingWindow()
			.windowSize(windowSize)
			.accumulator(accumulator);

		const calculator = merge()
			.algorithm(defaultAlgorithm)
			.merge(mergeAs);

		const newData = calculator(data);

		return newData;
	};

	algorithm.accumulator = function(x: any) {
		if (!arguments.length) {
			return accumulator;
		}
		accumulator = x;
		return algorithm;
	};

	algorithm.windowSize = function(x: any) {
		if (!arguments.length) {
			return windowSize;
		}
		windowSize = x;
		return algorithm;
	};
	algorithm.merge = function(x: any) {
		if (!arguments.length) {
			return mergeAs;
		}
		mergeAs = x;
		return algorithm;
	};

	return algorithm;
}