import { numericExtent, smaSeries } from "../utils.js";
const SMA = {
    name: "SMA",
    compute: (bars, period = 20) => smaSeries(bars.map((bar) => bar.close), period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default SMA;
