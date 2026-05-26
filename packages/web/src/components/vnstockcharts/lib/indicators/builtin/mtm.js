import { collectNumbers, mtmSeries, numericExtent } from "../utils.js";
const MTM = {
    name: "MTM",
    compute: (bars, period = 6, signalPeriod = 6) => mtmSeries(bars, period, signalPeriod),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default MTM;
