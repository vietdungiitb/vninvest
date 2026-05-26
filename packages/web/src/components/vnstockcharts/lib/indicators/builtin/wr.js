import { wrSeries } from "../utils.js";
/** WR — Williams %R. Range: -100 → 0. */
const WR = {
    name: "WR",
    compute: (bars, period = 14) => wrSeries(bars, period),
    computeExtents: () => [-100, 0],
    render: () => undefined,
};
export default WR;
