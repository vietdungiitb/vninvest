import { rsiSeries } from "../utils.js";
const RSI = {
    name: "RSI",
    compute: (bars, period = 14) => rsiSeries(bars.map((bar) => bar.close), period),
    computeExtents: () => [0, 100],
    yAxis: "right",
    render: () => undefined,
};
export default RSI;
