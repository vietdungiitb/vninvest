import { slidingWindow } from "../utils";
import { Change as defaultOptions } from "./defaultOptionsForComputation";

export default function change() {
	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { sourcePath } = options;

		const algo = slidingWindow()
			.windowSize(2)
			.sourcePath(sourcePath)
			.accumulator(([prev, curr]: any[]) => {
				const absoluteChange = curr - prev;
				const percentChange = absoluteChange * 100 / prev;
				return { absoluteChange, percentChange };
			});

		const newData = algo(data);

		return newData;
	}
	calculator.undefinedLength = function() {
		return 1;
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