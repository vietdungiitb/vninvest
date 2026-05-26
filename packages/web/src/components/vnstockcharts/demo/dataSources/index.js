/**
 * OB-M02 — DataSource abstraction layer
 * Provides a unified interface for loading bar data from different sources.
 */
import { getOfflineDemoBars } from "../demoData.js";
function vniBarToRawOHLCV(bar) {
    return {
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    };
}
/** Demo data source — uses bundled offline bars. */
export class DemoDataSource {
    async loadBars(_symbol, _options) {
        return getOfflineDemoBars();
    }
    async getSymbols() {
        return ["BTCUSDT", "ETHUSDT"];
    }
    async searchSymbols(query) {
        const all = [
            { symbol: "BTCUSDT", company_name: "Bitcoin / USDT", exchange: "Binance" },
            { symbol: "ETHUSDT", company_name: "Ethereum / USDT", exchange: "Binance" },
        ];
        if (!query)
            return all;
        const q = query.toLowerCase();
        return all.filter((item) => item.symbol.toLowerCase().includes(q) || (item.company_name ?? "").toLowerCase().includes(q));
    }
    async getSymbolName(symbol) {
        return symbol;
    }
}
/** VNInvest data source — delegates to VNInvestClient. */
export class VNInvestDataSource {
    _client;
    constructor(_client) {
        this._client = _client;
    }
    async loadBars(symbol, options) {
        if (!this._client.hasPAT()) {
            throw new Error("NO_PAT");
        }
        const bars = await this._client.getChart(symbol, options);
        return bars.map(vniBarToRawOHLCV);
    }
    async getSymbols() {
        const stocks = await this._client.getStocks();
        return stocks.map((s) => s.symbol);
    }
    async searchSymbols(query) {
        const stocks = await this._client.getStocks(query);
        return stocks.map((s) => ({
            symbol: s.symbol,
            company_name: s.company_name,
            exchange: s.exchange,
        }));
    }
    async getSymbolName(symbol) {
        const stocks = await this._client.getStocks(symbol);
        return stocks.find((s) => s.symbol === symbol)?.company_name ?? symbol;
    }
}
