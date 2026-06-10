import { cciSeries, numericExtent } from "../utils.js";
const CCI = {
    name: "CCI",
    compute: (bars, period = 20) => cciSeries(bars, period),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default CCI;
