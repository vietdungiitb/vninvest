import { aoColorSeries } from "../../indicators/utils.js";
import { buildIndicatorComputationPlan, computeIndicatorComputationResult, materializeIndicatorValues } from "./indicatorComputation.js";
import { enrichData } from "./enrichData.js";
/**
 * Normalize series config array to stable canonical form for store key.
 * Two config arrays with same indicators (different order/duplication) should have different hashes.
 */
function seriesConfigHash(series) {
    const sorted = [...series].sort((a, b) => {
        const typeOrder = a.type.localeCompare(b.type);
        if (typeOrder !== 0)
            return typeOrder;
        const aParamsStr = JSON.stringify(a.params ?? {});
        const bParamsStr = JSON.stringify(b.params ?? {});
        return aParamsStr.localeCompare(bParamsStr);
    });
    return JSON.stringify(sorted);
}
/**
 * Enrich OHLCV bars with indicator values using a canonical series store.
 *
 * If a `canonicalStore` is provided and hit, the computation result is reused.
 * If store is not provided or miss, falls back to regular enrichData.
 *
 * @param raw Raw OHLCV bars
 * @param options Enrichment options including canonical store
 * @returns Enriched data with computed indicator values
 */
export function enrichDataWithCanonicalStore(raw, options) {
    if (raw.length === 0) {
        return [];
    }
    const { series = [], whaleThreshold = 50_000, canonicalStore, sourceId, timeframe, } = options ?? {};
    // If no store provided, use regular enrichData
    if (!canonicalStore || !sourceId || !timeframe) {
        return enrichData(raw, { series, whaleThreshold });
    }
    // Build canonical store key from series config
    // Include data signature (first/last timestamp + bar count) so that different data
    // sources (e.g. switching from offline CSV ~430 USD to live Binance ~80k USD) always
    // trigger a cache miss and force recomputation instead of reusing stale indicator values.
    const dataSignature = `${raw[0]?.date?.getTime() ?? 0}:${raw[raw.length - 1]?.date?.getTime() ?? 0}:${raw.length}`;
    const storeKeyInput = {
        sourceId,
        timeframe,
        indicatorType: "indicator_batch",
        transformKey: `${seriesConfigHash(series)}:${dataSignature}`,
        normalizedParams: null,
    };
    // Try to retrieve cached computation from store
    const cachedEntry = canonicalStore.get(storeKeyInput);
    let plan;
    let result;
    let aoColors;
    if (cachedEntry) {
        // Cache hit: reuse computation plan and result
        plan = cachedEntry.plan;
        result = cachedEntry.result;
        aoColors = cachedEntry.aoColors;
    }
    else {
        // Cache miss: compute and store
        plan = buildIndicatorComputationPlan(series, whaleThreshold);
        result = computeIndicatorComputationResult(raw, plan);
        aoColors = plan.aoEnabled ? aoColorSeries(result.ao.map((value) => value ?? Number.NaN)) : [];
        canonicalStore.set(storeKeyInput, {
            plan,
            result,
            aoColors,
        });
    }
    // Extract first values for materialization (same logic as enrichData)
    const firstKdj = result.kdjByKey.size > 0 ? Array.from(result.kdjByKey.values())[0] : undefined;
    const firstCci = result.cciByPeriod.size > 0 ? Array.from(result.cciByPeriod.values())[0] : undefined;
    const firstDmi = result.dmiByPeriod.size > 0 ? Array.from(result.dmiByPeriod.values())[0] : undefined;
    const firstBias = result.biasByPeriod.size > 0 ? Array.from(result.biasByPeriod.values())[0] : undefined;
    const firstBrar = result.brarByPeriod.size > 0 ? Array.from(result.brarByPeriod.values())[0] : undefined;
    const firstMtm = result.mtmByKey.size > 0 ? Array.from(result.mtmByKey.values())[0] : undefined;
    const firstEmv = result.emvByPeriod.size > 0 ? Array.from(result.emvByPeriod.values())[0] : undefined;
    const firstRoc = result.rocByPeriod.size > 0 ? Array.from(result.rocByPeriod.values())[0] : undefined;
    const firstTrix = result.trixByKey.size > 0 ? Array.from(result.trixByKey.values())[0] : undefined;
    const firstDma = result.dmaByKey.size > 0 ? Array.from(result.dmaByKey.values())[0] : undefined;
    const firstPsy = result.psyByKey.size > 0 ? Array.from(result.psyByKey.values())[0] : undefined;
    const firstCr = result.crByKey.size > 0 ? Array.from(result.crByKey.values())[0] : undefined;
    // Materialize enriched data
    return raw.map((bar, index) => {
        const indicatorValues = materializeIndicatorValues(index, plan, result);
        return {
            ...bar,
            ema13: result.emaByPeriod.get(13)?.[index],
            ema20: result.emaByPeriod.get(20)?.[index],
            ema50: result.emaByPeriod.get(50)?.[index],
            bollingerBand: result.bollingerByKey.get(plan.defaultBollingerKey)?.[index],
            rsi: result.rsiByPeriod.get(14)?.[index],
            macd: result.macdByKey.get(plan.defaultMacdKey)?.[index],
            cvdApprox: result.cvd[index]?.cvdApprox,
            cvdDelta: result.cvd[index]?.cvdDelta,
            bullPower: result.strength[index]?.bullPower,
            bearPower: result.strength[index]?.bearPower,
            whaleBuyVol: result.whaleByKey.get(plan.defaultWhaleKey)?.[index]?.whaleBuyVol,
            whaleSellVol: result.whaleByKey.get(plan.defaultWhaleKey)?.[index]?.whaleSellVol,
            // CE15
            bbi: plan.bbiEnabled ? result.bbi[index] : undefined,
            sar: result.sarByKey.size > 0 ? Array.from(result.sarByKey.values())[0]?.[index] : undefined,
            obv: plan.obvEnabled ? result.obv[index] : undefined,
            wr: result.wrByPeriod.size > 0 ? Array.from(result.wrByPeriod.values())[0]?.[index] : undefined,
            vr: result.vrByPeriod.size > 0 ? Array.from(result.vrByPeriod.values())[0]?.[index] : undefined,
            // CE16
            kdj: firstKdj?.[index],
            cci: firstCci?.[index],
            dmi: firstDmi?.[index],
            bias: firstBias?.[index],
            brar: firstBrar?.[index],
            mtm: firstMtm?.[index],
            emv: firstEmv?.[index],
            ao: plan.aoEnabled ? result.ao[index] : undefined,
            aoColor: aoColors[index],
            roc: firstRoc?.[index],
            trix: firstTrix?.[index],
            dma: firstDma?.[index],
            pvt: plan.pvtEnabled ? result.pvt[index] : undefined,
            psy: firstPsy?.[index],
            cr: firstCr?.[index],
            indicatorValues: Object.keys(indicatorValues).length > 0 ? indicatorValues : undefined,
        };
    });
}
