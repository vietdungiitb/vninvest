import { emaSeries, numericExtent } from "../utils.js";
const EMA = {
    name: "EMA",
    compute: (bars, period = 20) => emaSeries(bars.map((bar) => bar.close), period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default EMA;
