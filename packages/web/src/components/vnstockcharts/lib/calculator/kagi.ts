
import { merge, isNotDefined, path, functor } from "../utils";
import atr from "./atr";

import { Kagi as defaultOptions } from "./defaultOptionsForComputation";

export default function kagi() {

	let options: any = defaultOptions;
	let dateAccessor: any = (d: any) => d.date;
	let dateMutator: any = (d: any, date: any) => { d.date = date; };

	function calculator(data: any[]) {
		const { reversalType, windowSize, reversal, sourcePath } = options;

		const source = path(sourcePath);
		let reversalThreshold: any;

		if (reversalType === "ATR") {
			const atrAlgorithm = atr().options({ windowSize });

			const atrCalculator = (merge() as any)
				.algorithm(atrAlgorithm)
				.merge((d: any, c: any) => { d["atr" + windowSize] = c; } );

			atrCalculator(data);
			reversalThreshold = (d: any) => d["atr" + windowSize];
		} else {
			reversalThreshold = functor(reversal);
		}

		const kagiData: any[] = [];

		let prevPeak: any, prevTrough: any, direction: any;
		let line: any = {};

		data.forEach(function(d) {
			if (isNotDefined(line.from)) {
				dateMutator(line, dateAccessor(d));
				line.from = dateAccessor(d);

				if (!line.open) line.open = d.open;
				line.high = d.high;
				line.low = d.low;
				if (!line.close) line.close = source(d);
				line.startOfYear = d.startOfYear;
				line.startOfQuarter = d.startOfQuarter;
				line.startOfMonth = d.startOfMonth;
				line.startOfWeek = d.startOfWeek;
			}

			if (!line.startOfYear) {
				line.startOfYear = d.startOfYear;
				if (line.startOfYear) {
					line.date = d.date;
				}
			}

			if (!line.startOfQuarter) {
				line.startOfQuarter = d.startOfQuarter;
				if (line.startOfQuarter && !line.startOfYear) {
					line.date = d.date;
				}
			}

			if (!line.startOfMonth) {
				line.startOfMonth = d.startOfMonth;
				if (line.startOfMonth && !line.startOfQuarter) {
					line.date = d.date;
				}
			}
			if (!line.startOfWeek) {
				line.startOfWeek = d.startOfWeek;
				if (line.startOfWeek && !line.startOfMonth) {
					line.date = d.date;
				}
			}
			line.volume = (line.volume || 0) + d.volume;
			line.high = Math.max(line.high, d.high);
			line.low = Math.min(line.low, d.low);
			line.to = dateAccessor(d);

			const priceMovement = (source(d) - line.close);

			if ((line.close >= line.open && priceMovement > 0)
					|| (line.close < line.open && priceMovement < 0)) {
				line.close = source(d);
				if (prevTrough && line.close < prevTrough) {
					line.changePoint = prevTrough;
					if (line.startAs !== "yin") {
						line.changeTo = "yin";
					}
				}
				if (prevPeak && line.close > prevPeak) {
					line.changePoint = prevPeak;
					if (line.startAs !== "yang") {
						line.changeTo = "yang";
					}
				}
			} else if ((line.close >= line.open
							&& priceMovement < 0
							&& Math.abs(priceMovement) > reversalThreshold(d))
					|| (line.close < line.open
							&& priceMovement > 0
							&& Math.abs(priceMovement) > reversalThreshold(d))) {
				const nextLineOpen = line.close;

				direction = (line.close - line.open) / Math.abs(line.close - line.open);

				let nextChangePoint: any, nextChangeTo: any;
				if (direction < 0) {
					if (isNotDefined(prevPeak)) prevPeak = line.open;
					prevTrough = line.close;
					if (source(d) > prevPeak) {
						nextChangePoint = prevPeak;
						nextChangeTo = "yang";
					}
				} else {
					if (isNotDefined(prevTrough)) prevTrough = line.open;
					prevPeak = line.close;
					if (source(d) < prevTrough) {
						nextChangePoint = prevTrough;
						nextChangeTo = "yin";
					}
				}
				if (isNotDefined(line.startAs)) {
					line.startAs = direction > 0 ? "yang" : "yin";
				}

				const startAs = line.changeTo || line.startAs;
				line.added = true;
				kagiData.push(line);
				direction = -1 * direction;

				line = { ...line };
				line.open = nextLineOpen;
				line.close = source(d);
				line.startAs = startAs;
				line.changePoint = nextChangePoint;
				line.changeTo = nextChangeTo;
				line.added = false;
				line.from = undefined;
				line.volume = 0;
			}
			line.current = source(d);
			let dir = line.close - line.open;
			dir = dir === 0 ? 1 : dir / Math.abs(dir);
			line.reverseAt = dir > 0 ? line.close - reversalThreshold(d) : line.open - reversalThreshold(d);
		});
		if (!line.added) kagiData.push(line);

		return kagiData;
	}
	calculator.options = function(x: any) {
		if (!arguments.length) {
			return options;
		}
		options = { ...defaultOptions, ...x };
		return calculator;
	};
	calculator.dateMutator = function(x: any) {
		if (!arguments.length) return dateMutator;
		dateMutator = x;
		return calculator;
	};
	calculator.dateAccessor = function(x: any) {
		if (!arguments.length) return dateAccessor;
		dateAccessor = x;
		return calculator;
	};
	return calculator;
}
