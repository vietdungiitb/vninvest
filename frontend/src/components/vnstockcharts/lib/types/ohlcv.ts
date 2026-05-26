export interface OHLCVBar {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	buyVolume?: number;
	sellVolume?: number;
	foreignBuy?: number;
	foreignSell?: number;
	openInterest?: number;
	index: number;
	dataIndex: number;
}