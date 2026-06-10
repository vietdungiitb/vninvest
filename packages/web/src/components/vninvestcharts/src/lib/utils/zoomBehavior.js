import { getCurrentItem } from "./ChartDataUtil.js";
import { last, isDefined } from "./index.js";
/* eslint-disable no-unused-vars */
export function mouseBasedZoomAnchor({ xScale, xAccessor, mouseXY, plotData, fullData, }) {
    const currentItem = getCurrentItem(xScale, xAccessor, mouseXY, plotData);
    if (isDefined(currentItem))
        return xAccessor(currentItem);
    if (isDefined(xScale.invert))
        return xScale.invert(mouseXY[0]);
    const lastItem = last(fullData);
    return isDefined(lastItem) ? xAccessor(lastItem) : xScale.domain()[1];
}
export function lastVisibleItemBasedZoomAnchor({ xScale, xAccessor, mouseXY, plotData, fullData, }) {
    const lastItem = last(plotData);
    return xAccessor(lastItem);
}
export function rightDomainBasedZoomAnchor({ xScale, xAccessor, mouseXY, plotData, fullData, }) {
    const [, end] = xScale.domain();
    return end;
}
/* eslint-enable no-unused-vars */ 
