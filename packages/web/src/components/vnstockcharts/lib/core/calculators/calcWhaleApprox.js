export function calcWhaleApprox(raw, threshold = 50_000) {
    return raw.map((bar) => {
        const dollarVolume = bar.close * bar.volume;
        const range = bar.high - bar.low;
        const buyShare = range > 0 ? (bar.close - bar.low) / range : 0.5;
        const sellShare = 1 - buyShare;
        const buyDollar = dollarVolume * buyShare;
        const sellDollar = dollarVolume * sellShare;
        const next = {};
        if (buyDollar >= threshold) {
            next.whaleBuyVol = bar.volume * buyShare;
        }
        if (sellDollar >= threshold) {
            next.whaleSellVol = bar.volume * sellShare;
        }
        return next;
    });
}
