import { sarSeries, numericExtent } from "../utils.js";
/** SAR — Parabolic Stop and Reverse */
const SAR = {
    name: "SAR",
    compute: (bars, afStep = 0.02, afMax = 0.2) => sarSeries(bars, afStep, afMax),
    computeExtents: (values) => numericExtent(values.filter((v) => Number.isFinite(v))),
    render: () => undefined,
};
export default SAR;
