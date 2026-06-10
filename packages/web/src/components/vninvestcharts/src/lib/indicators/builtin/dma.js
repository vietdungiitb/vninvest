import { collectNumbers, dmaSeries, numericExtent } from "../utils.js";
const DMA = {
    name: "DMA",
    compute: (bars, fastPeriod = 10, slowPeriod = 50, signalPeriod = 10) => dmaSeries(bars, fastPeriod, slowPeriod, signalPeriod),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default DMA;
