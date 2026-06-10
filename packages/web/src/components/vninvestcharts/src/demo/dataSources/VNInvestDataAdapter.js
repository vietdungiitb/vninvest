/**
 * H-01 — VNInvestDataAdapter
 *
 * Thin facade over VNInvestClient that exposes typed domain methods for
 * whale events and dark-flow signals consumed by widget overlays.
 *
 * Architecture note: This layer lives in src/demo/dataSources/ rather than
 * src/widget/ due to the tech-debt-INT-01 decision (widget migration deferred).
 * Widget props (enableWhale, enableCVD, darkFlowStrength, darkFlowSignalType)
 * are already exposed in VNInvestCharts.tsx and wired from LibraryShowcaseDemo.
 */
// ── Class ────────────────────────────────────────────────────────────────────
export class VNInvestDataAdapter {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * H-01: Fetch whale order events for a symbol and map them to the canonical
     * WhaleEvent shape used by widget overlays.
     *
     * Returns an empty array on network or auth error; never throws.
     */
    async getWhaleEvents(symbol, opts) {
        const feed = await this.client.getWhaleFeed(symbol).catch(() => null);
        if (!feed || !Array.isArray(feed.whale_orders))
            return [];
        const threshold = opts?.threshold ?? 1_000_000;
        return feed.whale_orders
            .filter((order) => order.matched_value >= threshold)
            .filter((order) => {
            if (opts?.since === undefined)
                return true;
            return new Date(order.ts).getTime() >= opts.since;
        })
            .map((order) => ({
            ts: order.ts,
            side: order.side,
            value: order.matched_value,
            severity: order.size_class,
            score: Math.min(1, order.matched_value / (10 * threshold)),
            price: order.price,
        }));
    }
    /**
     * H-04: Fetch dark flow strength and signal type from the order-flow endpoint.
     *
     * Returns null on network or auth error; never throws.
     */
    async getDarkFlowStrength(symbol, window = "30m") {
        const flow = await this.client.getOrderFlow(symbol, window).catch(() => null);
        return flow?.dark_flow ?? null;
    }
    /**
     * H-04: Convenience method returning just the signal type string,
     * defaulting to "none" when no data is available.
     */
    async getDarkFlowSignalType(symbol) {
        const result = await this.getDarkFlowStrength(symbol);
        return result?.signal_type ?? "none";
    }
}
