import { bbiSeries, numericExtent } from "../utils.js";
/** BBI — Bull and Bear Index = (MA3 + MA6 + MA12 + MA24) / 4 */
const BBI = {
    name: "BBI",
    compute: (bars) => bbiSeries(bars),
    computeExtents: (values) => numericExtent(values),
    render: () => undefined,
};
export default BBI;
