import { max, min, mean } from "d3-array";

import { last, slidingWindow, zipper } from "../utils";
import { FullStochasticOscillator as defaultOptions } from "./defaultOptionsForComputation";

export default function sto() {

	let options: any = defaultOptions;

	let source: any = (d: any) => ({ open: d.open, high: d.high, low: d.low, close: d.close });

	function calculator(data: any[]) {
		const { windowSize, kWindowSize, dWindowSize } = options;

		const high = (d: any) => source(d).high,
			low = (d: any) => source(d).low,
			close = (d: any) => source(d).close;

		const kWindow = slidingWindow()
			.windowSize(windowSize)
			.accumulator((values: any[]) => {

				const highestHigh = max(values, high);
				const lowestLow = min(values, low);

				const currentClose = close(last(values));
				const k = (currentClose - lowestLow) / (highestHigh - lowestLow) * 100;

				return k;
			});

		const kSmoothed = slidingWindow()
			.skipInitial(windowSize - 1)
			.windowSize(kWindowSize)
			.accumulator((values: any[]) => mean(values));

		const dWindow = slidingWindow()
			.skipInitial(windowSize - 1 + kWindowSize - 1)
			.windowSize(dWindowSize)
			.accumulator((values: any[]) => mean(values));

		const stoAlgorithm = zipper()
			.combine((K: any, D: any) => ({ K, D }));

		const kData = kSmoothed(kWindow(data));
		const dData = dWindow(kData);

		const indicatorData = stoAlgorithm(kData, dData);

		return indicatorData;
	}
	calculator.undefinedLength = function() {
		const { windowSize, kWindowSize, dWindowSize } = options;
		return windowSize + kWindowSize + dWindowSize;
	};
	calculator.source = function(x: any) {
		if (!arguments.length) {
			return source;
		}
		source = x;
		return calculator;
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