import ema from "./ema";

import { isDefined, zipper } from "../utils";
import { MACD as defaultOptions } from "./defaultOptionsForComputation";

export default function macd() {
	let options: any = defaultOptions;

	function calculator(data: any[]) {
		const { fast, slow, signal, sourcePath } = options;

		const fastEMA = ema()
			.options({ windowSize: fast, sourcePath });

		const slowEMA = ema()
			.options({ windowSize: slow, sourcePath });

		const signalEMA = ema()
			.options({ windowSize: signal, sourcePath: undefined });

		const macdCalculator = zipper()
			.combine((fastValue: any, slowValue: any) => (isDefined(fastValue) && isDefined(slowValue)) ? fastValue - slowValue : undefined);

		const macdArray = macdCalculator(fastEMA(data), slowEMA(data));

		const undefinedArray = new Array(slow);
		const signalArray = undefinedArray.concat(signalEMA(macdArray.slice(slow)));

		const zip = zipper()
			.combine((macdValue: any, signalValue: any) => ({
				macd: macdValue,
				signal: signalValue,
				divergence: (isDefined(macdValue) && isDefined(signalValue)) ? macdValue - signalValue : undefined,
			}));

		const macdResult = zip(macdArray, signalArray);

		return macdResult;
	}

	calculator.undefinedLength = function() {
		const { slow, signal } = options;
		return slow + signal - 1;
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