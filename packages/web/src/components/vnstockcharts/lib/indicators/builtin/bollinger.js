import { bollingerSeries, collectNumbers, numericExtent } from "../utils.js";
const BOLLINGER = {
    name: "BOLLINGER",
    compute: (bars, period = 20, multiplier = 2) => {
        return bollingerSeries(bars.map((bar) => bar.close), period, multiplier);
    },
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default BOLLINGER;
