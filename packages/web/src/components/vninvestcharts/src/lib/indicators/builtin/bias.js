import { biasSeries, numericExtent } from "../utils.js";
const BIAS = {
    name: "BIAS",
    compute: (bars, period = 6) => biasSeries(bars, period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default BIAS;
