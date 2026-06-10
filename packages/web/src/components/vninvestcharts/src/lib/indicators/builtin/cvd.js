import { numericExtent } from "../utils.js";
const CVD = {
    name: "CVD",
    compute: (bars) => {
        let cumulative = 0;
        return bars.map((bar) => {
            const delta = (bar.buyVolume ?? 0) - (bar.sellVolume ?? 0);
            cumulative += delta;
            return cumulative;
        });
    },
    computeExtents: (values) => numericExtent(values),
    yAxis: "right",
    render: () => undefined,
};
export default CVD;
