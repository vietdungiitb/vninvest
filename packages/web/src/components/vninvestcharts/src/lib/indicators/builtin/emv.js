import { collectNumbers, emvSeries, numericExtent } from "../utils.js";
const EMV = {
    name: "EMV",
    compute: (bars, period = 14) => emvSeries(bars, period),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default EMV;
