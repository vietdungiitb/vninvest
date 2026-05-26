import { collectNumbers, crSeries, numericExtent } from "../utils.js";
const CR = {
    name: "CR",
    compute: (bars, period = 26, m1 = 10, m2 = 20, m3 = 40, m4 = 60) => crSeries(bars, period, m1, m2, m3, m4),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default CR;
