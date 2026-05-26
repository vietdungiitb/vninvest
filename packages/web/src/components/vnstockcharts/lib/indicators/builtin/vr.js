import { vrSeries, numericExtent } from "../utils.js";
/** VR — Volume Ratio */
const VR = {
    name: "VR",
    compute: (bars, period = 26) => vrSeries(bars, period),
    computeExtents: (values) => numericExtent(values.filter((v) => Number.isFinite(v))),
    render: () => undefined,
};
export default VR;
