import { collectNumbers, macdSeries, numericExtent } from "../utils.js";
const MACD = {
    name: "MACD",
    compute: (bars, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
        return macdSeries(bars.map((bar) => bar.close), fastPeriod, slowPeriod, signalPeriod);
    },
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default MACD;
