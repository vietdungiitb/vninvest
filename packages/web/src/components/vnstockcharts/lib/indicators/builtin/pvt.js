import { numericExtent, pvtSeries } from "../utils.js";
const PVT = {
    name: "PVT",
    compute: (bars) => pvtSeries(bars),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default PVT;
