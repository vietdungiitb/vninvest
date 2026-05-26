import {
	getCurrentItem
} from "./ChartDataUtil";

import {
	last,
	isDefined
} from "./index";
/* eslint-disable no-unused-vars */

export function mouseBasedZoomAnchor({
	xScale,
	xAccessor,
	mouseXY,
	plotData,
	fullData,
}: any) {
	const currentItem = getCurrentItem(xScale, xAccessor, mouseXY, plotData);
	if (isDefined(currentItem)) return xAccessor(currentItem);
	if (isDefined(xScale.invert)) return xScale.invert(mouseXY[0]);
	const lastItem = last(fullData);
	return isDefined(lastItem) ? xAccessor(lastItem) : xScale.domain()[1];
}

export function lastVisibleItemBasedZoomAnchor({
	xScale,
	xAccessor,
	mouseXY,
	plotData,
	fullData,
}: any) {
	const lastItem = last(plotData);
	return xAccessor(lastItem);
}

export function rightDomainBasedZoomAnchor({
	xScale,
	xAccessor,
	mouseXY,
	plotData,
	fullData,
}: any) {
	const [, end] = xScale.domain();
	return end;
}
/* eslint-enable no-unused-vars */