import { sum } from "d3-array";

import { ATR as defaultOptions } from "./defaultOptionsForComputation";
import { slidingWindow, last, isDefined } from "../utils";

export default function atr() {

	let options: any = defaultOptions;
	let source: any = (d: any) => ({ open: d.open, high: d.high, low: d.low, close: d.close });

	function calculator(data: any[]) {
		const { windowSize } = options;

		const trueRangeAlgorithm = slidingWindow()
			.windowSize(2)
			.source(source)
			.undefinedValue((d: any) => d.high - d.low)
			.accumulator((values: any[]) => {
				const prev = values[0];
				const d = values[1];
				return Math.max(d.high - d.low,
					d.high - prev.close,
					d.low - prev.close);
			});

		let prevATR: any;

		const atrAlgorithm = slidingWindow()
			.skipInitial(1)
			.windowSize(windowSize)
			.accumulator((values: any[]) => {
				const tr = last(values);
				const atrValue = isDefined(prevATR)
					? ((prevATR * (windowSize - 1)) + tr) / windowSize
					: sum(values) / windowSize;

				prevATR = atrValue;
				return atrValue;
			});

		const newData = atrAlgorithm(trueRangeAlgorithm(data));

		return newData;
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

	calculator.source = function(x: any) {
		if (!arguments.length) {
			return source;
		}
		source = x;
		return calculator;
	};

	return calculator;
}