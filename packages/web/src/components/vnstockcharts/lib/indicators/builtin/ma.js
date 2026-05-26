import { numericExtent, smaSeries } from "../utils.js";
/** MA — Moving Average (alias for parameterized SMA) */
const MA = {
    name: "MA",
    compute: (bars, period = 20) => smaSeries(bars.map((b) => b.close), period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default MA;
