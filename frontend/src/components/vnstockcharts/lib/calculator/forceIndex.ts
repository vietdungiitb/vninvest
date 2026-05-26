import { slidingWindow, path } from "../utils";
import { ForceIndex as defaultOptions } from "./defaultOptionsForComputation";

export default function forceIndex() {

	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { sourcePath, volumePath } = options;

		const source = path(sourcePath);
		const volume = path(volumePath);

		const forceIndexCalulator = slidingWindow()
			.windowSize(2)
			.accumulator(([prev, curr]: any[]) => (source(curr) - source(prev)) * volume(curr));

		const forceIndex = forceIndexCalulator(data);

		return forceIndex;
	}
	calculator.undefinedLength = function() {
		return 2;
	};
	calculator.options = function(x: any) {
		if (!arguments.length) {
			return options;
		}
		options = { ...defaultOptions, ...x };
		return calculator;
	};

	return calculator;
}