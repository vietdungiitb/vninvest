import { overlayColors } from "../utils";

let i = 0;

export default function baseIndicator(): any {
	let id = i++;
	let accessor: any;
	let stroke: any;
	let fill: any;
	let echo: any;
	let type: any;

	function baseIndicator(): any {
	}

	baseIndicator.id = function(x: any) {
		if (!arguments.length) return id;
		id = x;
		return baseIndicator;
	};
	baseIndicator.accessor = function(x: any) {
		if (!arguments.length) return accessor;
		accessor = x;
		return baseIndicator;
	};
	baseIndicator.stroke = function(x: any) {
		if (!arguments.length) return !stroke ? stroke = overlayColors(String(id)) : stroke;
		stroke = x;
		return baseIndicator;
	};
	baseIndicator.fill = function(x: any) {
		if (!arguments.length) return !fill ? fill = overlayColors(String(id)) : fill;
		fill = x;
		return baseIndicator;
	};
	baseIndicator.echo = function(x: any) {
		if (!arguments.length) return echo;
		echo = x;
		return baseIndicator;
	};
	baseIndicator.type = function(x: any) {
		if (!arguments.length) return type;
		type = x;
		return baseIndicator;
	};
	return baseIndicator;
}