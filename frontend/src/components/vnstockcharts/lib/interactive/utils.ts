import {
	isNotDefined,
	isDefined,
	mapObject,
	find,
} from "../utils";

export function getValueFromOverride(override: any, index: any, key: any, defaultValue: any) {
	if (isDefined(override) && override.index === index) return override[key];
	return defaultValue;
}

export function terminate(this: any) {
	this.setState({
		current: null,
		override: null,
	});
}

export function saveNodeType(this: any, type: any) {
	return (node: any) => {
		if (isNotDefined(node) && isDefined(this.nodes[type])) {
			delete this.nodes[type];
		} else {
			this.nodes[type] = node;
		}
	};
}

export function isHoverForInteractiveType(interactiveType: string) {
	return function(this: any, moreProps: any) {
		if (isDefined(this.nodes)) {
			const selecedNodes = this.nodes
				.map((node: any) => node.isHover(moreProps));
			const interactive = this.props[interactiveType].map((t: any, idx: number) => {
				return {
					...t,
					selected: selecedNodes[idx]
				};
			});
			return interactive;
		}
	};
}

export function isHover(this: any, moreProps: any) {
	const hovering = mapObject(this.nodes, (node: any) => node.isHover(moreProps))
		.reduce((a: any, b: any) => {
			return a || b;
		});
	return hovering;
}

function getMouseXY(moreProps: any, [ox, oy]: [number, number]) {
	if (Array.isArray(moreProps.mouseXY)) {
		const { mouseXY: [x, y] } = moreProps;
		const mouseXY = [
			x - ox,
			y - oy
		];
		return mouseXY;
	}
	return moreProps.mouseXY;
}

export function getMorePropsForChart(moreProps: any, chartId: any) {
	const { chartConfig: chartConfigList } = moreProps;
	const chartConfig = find(chartConfigList, (each: any) => each.id === chartId);

	const { origin } = chartConfig;
	const mouseXY = getMouseXY(moreProps, origin);
	return {
		...moreProps,
		chartConfig,
		mouseXY,
	};
}

export function getSelected(interactives: any[]) {
	const selected = interactives
		.map((each: any) => {
			const objects = each.objects.filter((obj: any) => {
				return obj.selected;
			});
			return {
				...each,
				objects,
			};
		})
		.filter((each: any) => each.objects.length > 0);
	return selected;
}