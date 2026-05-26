import { mean } from "d3-array";

import { slidingWindow } from "../utils";
import { SMA as defaultOptions } from "./defaultOptionsForComputation";

export default function sma() {

	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { windowSize, sourcePath } = options;

		const average = slidingWindow()
			.windowSize(windowSize)
			.sourcePath(sourcePath)
			.accumulator((values: any[]) => mean(values));

		return average(data);
	}
	calculator.undefinedLength = function() {
		const { windowSize } = options;
		return windowSize - 1;
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