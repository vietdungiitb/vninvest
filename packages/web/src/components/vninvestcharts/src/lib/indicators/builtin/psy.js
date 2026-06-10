import { collectNumbers, numericExtent, psySeries } from "../utils.js";
const PSY = {
    name: "PSY",
    compute: (bars, period = 12, signalPeriod = 6) => psySeries(bars, period, signalPeriod),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default PSY;
