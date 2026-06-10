import { collectNumbers, kdjSeries, numericExtent } from "../utils.js";
const KDJ = {
    name: "KDJ",
    compute: (bars, period = 9, m1 = 3, m2 = 3) => kdjSeries(bars, period, m1, m2),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default KDJ;
