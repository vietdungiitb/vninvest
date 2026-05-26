import { mean, deviation } from "d3-array";

import ema from "./ema";
import { last, slidingWindow, zipper, path } from "../utils";

import { BollingerBand as defaultOptions } from "./defaultOptionsForComputation";

export default function bollingerband() {
	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { windowSize, multiplier, movingAverageType, sourcePath } = options;

		const source = path(sourcePath);
		const meanAlgorithm = movingAverageType === "ema"
			? ema().options({ windowSize, sourcePath })
			: slidingWindow().windowSize(windowSize)
				.accumulator((values: any[]) => mean(values)).sourcePath(sourcePath);

		const bollingerBandAlgorithm = slidingWindow()
			.windowSize(windowSize)
			.accumulator((values: any[]) => {
				const avg = last(values).mean;
				const stdDev = deviation(values, (each: any) => source(each.datum)) ?? 0;
				return {
					top: avg + multiplier * stdDev,
					middle: avg,
					bottom: avg - multiplier * stdDev
				};
			});

		const zip = zipper()
			.combine((datum: any, meanValue: any) => ({ datum, mean: meanValue }));

		const tuples = zip(data, meanAlgorithm(data));
		return bollingerBandAlgorithm(tuples);
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