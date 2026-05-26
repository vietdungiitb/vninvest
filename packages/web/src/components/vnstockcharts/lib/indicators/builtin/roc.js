import { numericExtent, rocSeries } from "../utils.js";
const ROC = {
    name: "ROC",
    compute: (bars, period = 12) => rocSeries(bars, period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default ROC;
