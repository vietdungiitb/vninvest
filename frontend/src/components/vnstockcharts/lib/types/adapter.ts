import type { OHLCVBar } from "./ohlcv";

export type Unsubscribe = () => void;

export type Timeframe = string;

export interface Trade {
	symbol: string;
	price: number;
	size: number;
	timestamp: Date;
	side?: "buy" | "sell" | "unknown";
}

export interface OrderbookLevel {
	price: number;
	size: number;
}

export interface OrderbookSnapshot {
	bids: readonly OrderbookLevel[];
	asks: readonly OrderbookLevel[];
	timestamp: Date;
}

export interface SymbolInfo {
	symbol: string;
	name?: string;
	exchange?: string;
}

export interface StockDataAdapter {
	fetchBars(symbol: string, timeframe: Timeframe, from: Date, to: Date): Promise<readonly OHLCVBar[]>;
	fetchMoreBars(symbol: string, timeframe: Timeframe, before: Date, limit?: number): Promise<readonly OHLCVBar[]>;
	subscribeToBar(symbol: string, timeframe: Timeframe, onBar: (bar: OHLCVBar) => void): Unsubscribe;
	subscribeToTrades(symbol: string, onTrade: (trade: Trade) => void): Unsubscribe;
	subscribeToOrderbook(symbol: string, onUpdate: (snapshot: OrderbookSnapshot) => void): Unsubscribe;
	searchSymbols(query: string): Promise<readonly SymbolInfo[]>;
}