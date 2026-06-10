import { brarSeries, collectNumbers, numericExtent } from "../utils.js";
const BRAR = {
    name: "BRAR",
    compute: (bars, period = 26) => brarSeries(bars, period),
    computeExtents: (values) => numericExtent(collectNumbers(values)),
    render: () => undefined,
};
export default BRAR;
