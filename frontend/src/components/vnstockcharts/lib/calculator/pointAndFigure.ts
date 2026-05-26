
import { isNotDefined } from "../utils";
import { PointAndFigure as defaultOptions } from "./defaultOptionsForComputation";

function createBox(d: any, dateAccessor: any, dateMutator: any) {
	const box: any = {
		open: d.open,
		fromDate: dateAccessor(d),
		toDate: dateAccessor(d),
		startOfYear: d.startOfYear,
		startOfQuarter: d.startOfQuarter,
		startOfMonth: d.startOfMonth,
		startOfWeek: d.startOfWeek
	};
	dateMutator(box, dateAccessor(d));
	return box;
}

function updateColumns(columnData: any[], dateAccessor: any, dateMutator: any) {
	columnData.forEach(function(d) {
		d.startOfYear = false;
		d.startOfQuarter = false;
		d.startOfMonth = false;
		d.startOfWeek = false;

		d.boxes.forEach(function(eachBox: any) {
			if (isNotDefined(d.open)) d.open = eachBox.open;
			d.close = eachBox.close;
			d.high = Math.max(d.open, d.close);
			d.low = Math.min(d.open, d.close);

			if (isNotDefined(d.fromDate)) d.fromDate = eachBox.fromDate;
			if (isNotDefined(d.date)) d.date = eachBox.date;
			d.toDate = eachBox.toDate;

			if (eachBox.startOfYear) {
				d.startOfYear = d.startOfYear || eachBox.startOfYear;
				d.startOfQuarter = eachBox.startOfQuarter;
				d.startOfMonth = eachBox.startOfMonth;
				d.startOfWeek = eachBox.startOfWeek;
				dateMutator(d, dateAccessor(eachBox));
			}
			if (d.startOfQuarter !== true && eachBox.startOfQuarter) {
				d.startOfQuarter = eachBox.startOfQuarter;
				d.startOfMonth = eachBox.startOfMonth;
				d.startOfWeek = eachBox.startOfWeek;
				dateMutator(d, dateAccessor(eachBox));
			}
			if (d.startOfMonth !== true && eachBox.startOfMonth) {
				d.startOfMonth = eachBox.startOfMonth;
				d.startOfWeek = eachBox.startOfWeek;
				dateMutator(d, dateAccessor(eachBox));
			}
			if (d.startOfWeek !== true && eachBox.startOfWeek) {
				d.startOfWeek = eachBox.startOfWeek;
				dateMutator(d, dateAccessor(eachBox));
			}
		});

	});

	return columnData;
}


export default function pointAndFigure() {
	let options: any = defaultOptions;
	let dateAccessor: any = (d: any) => d.date;
	let dateMutator: any = (d: any, date: any) => { d.date = date; };

	function calculator(rawData: any[]) {
		const { reversal, boxSize, sourcePath } = options;

		const source: any = sourcePath === "high/low"
			? (d: any) => { return { high: d.high, low: d.low }; }
			: (d: any) => { return { high: d.close, low: d.close }; };


		const pricingMethod = source;
		const columnData: any[] = [];

		let column: any = {
				boxes: [],
				open: rawData[0].open
			}, box = createBox(rawData[0], dateAccessor, dateMutator);

		columnData.push(column);

		rawData.forEach(function(d) {
			column.volume = (column.volume || 0) + d.volume;

			if (!box.startOfYear) {
				box.startOfYear = d.startOfYear;
				if (box.startOfYear) {
					dateMutator(box, dateAccessor(d));
				}
			}

			if (!box.startOfYear && !box.startOfQuarter) {
				box.startOfQuarter = d.startOfQuarter;
				if (box.startOfQuarter && !box.startOfYear) {
					dateMutator(box, dateAccessor(d));
				}
			}

			if (!box.startOfQuarter && !box.startOfMonth) {
				box.startOfMonth = d.startOfMonth;
				if (box.startOfMonth && !box.startOfQuarter) {
					dateMutator(box, dateAccessor(d));
				}
			}
			if (!box.startOfMonth && !box.startOfWeek) {
				box.startOfWeek = d.startOfWeek;
				if (box.startOfWeek && !box.startOfMonth) {
					dateMutator(box, dateAccessor(d));
				}
			}

			if (columnData.length === 1 && column.boxes.length === 0) {
				const upwardMovement = (Math.max((pricingMethod(d).high - column.open), 0));
				const downwardMovement = Math.abs(Math.min((column.open - pricingMethod(d).low), 0));
				column.direction = upwardMovement > downwardMovement ? 1 : -1;
				if (boxSize * reversal < upwardMovement
					|| boxSize * reversal < downwardMovement) {
					box.toDate = dateAccessor(d);
					box.open = column.open;
					const noOfBoxes = column.direction > 0
						? Math.floor(upwardMovement / boxSize)
						: Math.floor(downwardMovement / boxSize);
					for (let i = 0; i < noOfBoxes; i++) {
						box.close = box.open + column.direction * boxSize;
						const prevBoxClose = box.close;
						column.boxes.push(box);
						box = createBox(box, dateAccessor, dateMutator);
						box.open = prevBoxClose;
					}
					box.fromDate = dateAccessor(d);
					box.date = dateAccessor(d);
				}
			} else {
				const upwardMovement = (Math.max((pricingMethod(d).high - box.open), 0));
				const downwardMovement = Math.abs(Math.min((pricingMethod(d).low - box.open), 0));

				if ((column.direction > 0 && upwardMovement > boxSize)
						|| (column.direction < 0 && downwardMovement > boxSize)) {
					box.close = box.open + column.direction * boxSize;
					box.toDate = dateAccessor(d);
					const prevBoxClose = box.close;
					column.boxes.push(box);
					box = createBox(d, dateAccessor, dateMutator);
					box.open = prevBoxClose;
					box.fromDate = dateAccessor(d);
					dateMutator(box, dateAccessor(d));
				} else if ((column.direction > 0 && downwardMovement > boxSize * reversal)
						|| (column.direction < 0 && upwardMovement > boxSize * reversal)) {
					box.open = box.open + -1 * column.direction * boxSize;
					box.toDate = dateAccessor(d);
					dateMutator(box, dateAccessor(d));
					column = {
						boxes: [],
						volume: 0,
						direction: -1 * column.direction
					};
					const noOfBoxes = column.direction > 0
						? Math.floor(upwardMovement / boxSize)
						: Math.floor(downwardMovement / boxSize);
					for (let i = 0; i < noOfBoxes; i++) {
						box.close = box.open + column.direction * boxSize;
						const prevBoxClose = box.close;
						column.boxes.push(box);
						box = createBox(d, dateAccessor, dateMutator);
						box.open = prevBoxClose;
					}

					columnData.push(column);
				}
			}
		});
		updateColumns(columnData, dateAccessor, dateMutator);

		return columnData;
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
