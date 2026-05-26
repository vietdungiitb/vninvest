import { aoSeries, numericExtent } from "../utils.js";
const AO = {
    name: "AO",
    compute: (bars) => aoSeries(bars),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default AO;
