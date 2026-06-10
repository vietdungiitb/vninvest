import { collectNumbers, dmiSeries, numericExtent } from "../utils.js";
const DMI = {
    name: "DMI",
    compute: (bars, period = 14) => dmiSeries(bars, period),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default DMI;
