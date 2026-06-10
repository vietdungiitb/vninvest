import { emaSeries } from "../../indicators/utils.js";
function blankUntil(values, startIndex) {
    return values.map((value, index) => (index >= startIndex ? value : undefined));
}
export function calcStrengthElder(raw) {
    if (raw.length === 0) {
        return [];
    }
    const closes = raw.map((bar) => bar.close);
    const ema13 = blankUntil(emaSeries(closes, 13), 12);
    return raw.map((bar, index) => {
        const ema = ema13[index];
        if (ema === undefined) {
            return {};
        }
        return {
            ema13: ema,
            bullPower: bar.high - ema,
            bearPower: bar.low - ema,
        };
    });
}
