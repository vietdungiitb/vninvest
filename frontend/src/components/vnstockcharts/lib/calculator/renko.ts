
import { merge, isNotDefined, functor } from "../utils";

import atr from "./atr";

import { Renko as defaultOptions } from "./defaultOptionsForComputation";

export default function renko() {
	let options: any = defaultOptions;

	let dateAccessor: any = (d: any) => d.date;
	let dateMutator: any = (d: any, date: any) => { d.date = date; };

	function calculator(rawData: any[]) {
		const { reversalType, fixedBrickSize, sourcePath, windowSize } = options;

		const source: any = sourcePath === "high/low"
			? (d: any) => { return { high: d.high, low: d.low }; }
			: (d: any) => { return { high: d.close, low: d.close }; };

		const pricingMethod = source;
		let brickSize: any;

		if (reversalType === "ATR") {
			const atrAlgorithm = atr().options({ windowSize });

			const atrCalculator = (merge() as any)
				.algorithm(atrAlgorithm)
				.merge((d: any, c: any) => { d["atr" + windowSize] = c; } );

			atrCalculator(rawData);
			brickSize = (d: any) => d["atr" + windowSize];
		} else {
			brickSize = functor(fixedBrickSize);
		}

		const renkoData: any[] = [];

		let index = 0, prevBrickClose = rawData[index].open, prevBrickOpen = rawData[index].open;
		let brick: any = {}, direction = 0;

		rawData.forEach(function(d, idx) {
			if (isNotDefined(brick.from)) {
				brick.high = d.high;
				brick.low = d.low;
				brick.startOfYear = d.startOfYear;
				brick.startOfQuarter = d.startOfQuarter;
				brick.startOfMonth = d.startOfMonth;
				brick.startOfWeek = d.startOfWeek;

				brick.from = idx;
				brick.fromDate = dateAccessor(d);
				dateMutator(brick, dateAccessor(d));
			}
			brick.volume = (brick.volume || 0) + d.volume;

			const prevCloseToHigh = (prevBrickClose - pricingMethod(d).high),
				prevCloseToLow = (prevBrickClose - pricingMethod(d).low),
				prevOpenToHigh = (prevBrickOpen - pricingMethod(d).high),
				prevOpenToLow = (prevBrickOpen - pricingMethod(d).low),
				priceMovement = Math.min(
					Math.abs(prevCloseToHigh),
					Math.abs(prevCloseToLow),
					Math.abs(prevOpenToHigh),
					Math.abs(prevOpenToLow));

			brick.high = Math.max(brick.high, d.high);
			brick.low = Math.min(brick.low, d.low);

			if (!brick.startOfYear) {
				brick.startOfYear = d.startOfYear;
				if (brick.startOfYear) {
					dateMutator(brick, dateAccessor(d));
				}
			}

			if (!brick.startOfQuarter) {
				brick.startOfQuarter = d.startOfQuarter;
				if (brick.startOfQuarter && !brick.startOfYear) {
					dateMutator(brick, dateAccessor(d));
				}
			}

			if (!brick.startOfMonth) {
				brick.startOfMonth = d.startOfMonth;
				if (brick.startOfMonth && !brick.startOfQuarter) {
					dateMutator(brick, dateAccessor(d));
				}
			}
			if (!brick.startOfWeek) {
				brick.startOfWeek = d.startOfWeek;
				if (brick.startOfWeek && !brick.startOfMonth) {
					dateMutator(brick, dateAccessor(d));
				}
			}

			if (brickSize(d)) {
				const noOfBricks = Math.floor(priceMovement / brickSize(d));

				brick.open = (Math.abs(prevCloseToHigh) < Math.abs(prevOpenToHigh)
					|| Math.abs(prevCloseToLow) < Math.abs(prevOpenToLow))
					? prevBrickClose
					: prevBrickOpen;

				if (noOfBricks >= 1) {
					let j = 0;
					for (j = 0; j < noOfBricks; j++) {
						brick.close = (brick.open < pricingMethod(d).high)
							? brick.open + brickSize(d)
							: brick.open - brickSize(d);
						direction = brick.close > brick.open ? 1 : -1;
						brick.direction = direction;
						brick.to = idx;
						brick.toDate = dateAccessor(d);
						brick.fullyFormed = true;
						renkoData.push(brick);

						prevBrickClose = brick.close;
						prevBrickOpen = brick.open;

						const newBrick = {
							high: brick.high,
							low: brick.low,
							open: brick.close,
							startOfYear: false,
							startOfMonth: false,
							startOfQuarter: false,
							startOfWeek: false
						};
						brick = newBrick;
						brick.from = idx;
						brick.fromDate = dateAccessor(d);
						dateMutator(brick, dateAccessor(d));
						brick.volume = (brick.volume || 0) + d.volume;
					}
					index = index + j - 1;
					brick = {};
				} else {
					if (idx === rawData.length - 1) {
						brick.close = direction > 0 ? pricingMethod(d).high : pricingMethod(d).low;
						brick.to = idx;
						brick.toDate = dateAccessor(d);
						dateMutator(brick, dateAccessor(d));
						brick.fullyFormed = false;
						renkoData.push(brick);
					}
				}
			}

		});
		return renkoData;

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
