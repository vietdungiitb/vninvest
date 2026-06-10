import { obvSeries, numericExtent } from "../utils.js";
/** OBV — On Balance Volume */
const OBV = {
    name: "OBV",
    compute: (bars) => obvSeries(bars),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default OBV;
