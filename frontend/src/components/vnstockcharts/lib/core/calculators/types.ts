export interface RawOHLCV {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface IndicatorBandValue {
	top: number;
	middle: number;
	bottom: number;
}

export interface IndicatorMacdValue {
	macd: number;
	signal: number;
	divergence: number;
}

export interface IndicatorWhaleValue {
	whaleBuyVol?: number;
	whaleSellVol?: number;
}

export interface IndicatorKdjValue {
	k: number;
	d: number;
	j: number;
}

export interface IndicatorDmiValue {
	plusDI: number;
	minusDI: number;
	adx: number;
}

export interface IndicatorBrarValue {
	ar: number;
	br: number;
}

export interface IndicatorMtmValue {
	mtm: number;
	signal: number;
}

export interface IndicatorEmvValue {
	emv: number;
	signal: number;
}

export interface IndicatorTrixValue {
	trix: number;
	signal: number;
}

export interface IndicatorDmaValue {
	ddd: number;
	ama: number;
}

export interface IndicatorPsyValue {
	psy: number;
	signal: number;
}

export interface IndicatorCrValue {
	cr: number;
	ma1: number;
	ma2: number;
	ma3: number;
	ma4: number;
}

export type IndicatorDatumValue =
	number
	| IndicatorBandValue
	| IndicatorMacdValue
	| IndicatorWhaleValue
	| IndicatorKdjValue
	| IndicatorDmiValue
	| IndicatorBrarValue
	| IndicatorMtmValue
	| IndicatorEmvValue
	| IndicatorTrixValue
	| IndicatorDmaValue
	| IndicatorPsyValue
	| IndicatorCrValue;

export interface EnrichedDatum extends RawOHLCV {
	ema13?: number;
	ema20?: number;
	ema50?: number;
	bollingerBand?: IndicatorBandValue;
	rsi?: number;
	macd?: IndicatorMacdValue;
	cvdApprox?: number;
	cvdDelta?: number;
	bullPower?: number;
	bearPower?: number;
	whaleBuyVol?: number;
	whaleSellVol?: number;
	cvdRealtime?: number;
	strengthRelative?: number;
	// CE15
	bbi?: number;
	sar?: number;
	obv?: number;
	wr?: number;
	vr?: number;
	kdj?: IndicatorKdjValue;
	cci?: number;
	dmi?: IndicatorDmiValue;
	bias?: number;
	brar?: IndicatorBrarValue;
	mtm?: IndicatorMtmValue;
	emv?: IndicatorEmvValue;
	ao?: number;
	aoColor?: string;
	roc?: number;
	trix?: IndicatorTrixValue;
	dma?: IndicatorDmaValue;
	pvt?: number;
	psy?: IndicatorPsyValue;
	cr?: IndicatorCrValue;
	indicatorValues?: Record<string, IndicatorDatumValue | undefined>;
}
