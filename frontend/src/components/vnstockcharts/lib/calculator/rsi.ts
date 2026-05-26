import { mean } from "d3-array";

import { isDefined, last, slidingWindow, path } from "../utils";
import { RSI as defaultOptions } from "./defaultOptionsForComputation";

export default function rsi() {

	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { windowSize, sourcePath } = options;

		const source = path(sourcePath);
		let prevAvgGain: any, prevAvgLoss: any;
		const rsiAlgorithm = slidingWindow()
			.windowSize(windowSize)
			.accumulator((values: any[]) => {

				const avgGain: number = isDefined(prevAvgGain)
					? (prevAvgGain * (windowSize - 1) + last(values).gain) / windowSize
					: (mean(values, (each: any) => each.gain) ?? 0);

				const avgLoss: number = isDefined(prevAvgLoss)
					? (prevAvgLoss * (windowSize - 1) + last(values).loss) / windowSize
					: (mean(values, (each: any) => each.loss) ?? 0);

				const relativeStrength = avgGain / avgLoss;
				const rsiValue = 100 - (100 / (1 + relativeStrength));

				prevAvgGain = avgGain;
				prevAvgLoss = avgLoss;

				return rsiValue;
			});

		const gainsAndLossesCalculator = slidingWindow()
			.windowSize(2)
			.undefinedValue(() => [0, 0])
			.accumulator((tuple: any[]) => {
				const prev = tuple[0];
				const now = tuple[1];
				const change = source(now) - source(prev);
				return {
					gain: Math.max(change, 0),
					loss: Math.abs(Math.min(change, 0)),
				};
			});

		const gainsAndLosses = gainsAndLossesCalculator(data);

		const rsiData = rsiAlgorithm(gainsAndLosses);

		return rsiData;
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