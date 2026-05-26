import { collectNumbers, numericExtent, trixSeries } from "../utils.js";
const TRIX = {
    name: "TRIX",
    compute: (bars, period = 12, signalPeriod = 9) => trixSeries(bars, period, signalPeriod),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default TRIX;
