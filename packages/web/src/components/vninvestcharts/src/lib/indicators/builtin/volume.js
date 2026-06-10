import { numericExtent } from "../utils.js";
const VOLUME = {
    name: "VOLUME",
    compute: (bars) => bars.map((bar) => bar.volume),
    computeExtents: (values) => numericExtent(values),
    yAxis: "right",
    render: () => undefined,
};
export default VOLUME;
