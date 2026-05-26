import { sum } from "d3-array";

import { slidingWindow } from "../utils";
import { WMA as defaultOptions } from "./defaultOptionsForComputation";

export default function wma() {

	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { windowSize, sourcePath } = options;

		const weight = windowSize * (windowSize + 1) / 2;

		const waverage = slidingWindow()
			.windowSize(windowSize)
			.sourcePath(sourcePath)
			.accumulator((values: any[]) => {
				const total = sum(values, (v: any, i: number) => {
					return (i + 1) * v;
				});
				return total / weight;
			});

		return waverage(data);
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