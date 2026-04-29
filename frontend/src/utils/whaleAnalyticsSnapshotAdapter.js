import { resolveWhaleTimeframeWindow, toCanonicalMinute } from './whaleTimeAdapter';
import { buildWhaleFlowViewModel } from './whaleFlowViewModel';

function buildWindowFromSnapshot(snapshot, timeframe) {
  const startValue = snapshot?.axis?.window_start;
  const endValue = snapshot?.axis?.window_end;
  const fallback = resolveWhaleTimeframeWindow(timeframe);
  const startDate = startValue ? new Date(startValue) : new Date(fallback.startMs);
  const endDate = endValue ? new Date(endValue) : new Date(fallback.endMs);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fallback;
  }
  return {
    ...fallback,
    startEpochSec: Math.floor(startDate.getTime() / 1000),
    endEpochSec: Math.floor(endDate.getTime() / 1000),
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}

export function normalizeWhaleAnalyticsSnapshot(snapshot, timeframe) {
  const timeframeWindow = buildWindowFromSnapshot(snapshot, timeframe);
  const bubbleSeries = Array.isArray(snapshot?.bubble_series) ? snapshot.bubble_series : [];
  const priceSeries = Array.isArray(snapshot?.price_series) ? snapshot.price_series : [];
  const sessionLevels = snapshot?.session_levels || {};
  const cvdSeries = Array.isArray(snapshot?.flow_series?.cvd) ? snapshot.flow_series.cvd : [];
  const buyStrengthSeries = Array.isArray(snapshot?.flow_series?.buy_strength) ? snapshot.flow_series.buy_strength : [];
  const institutionalStrengthSeries = Array.isArray(snapshot?.flow_series?.institutional_strength)
    ? snapshot.flow_series.institutional_strength
    : [];
  const speedSeries = Array.isArray(snapshot?.flow_series?.speed) ? snapshot.flow_series.speed : [];
  const flowCompareSeries = Array.isArray(snapshot?.flow_compare_series) ? snapshot.flow_compare_series : [];
  const heatmapSeries = Array.isArray(snapshot?.heatmap_series) ? snapshot.heatmap_series : [];
  const markerSeries = Array.isArray(snapshot?.marker_series) ? snapshot.marker_series : [];
  const sessionContext = snapshot?.session_context || null;
  const snapshotQualityFlags = snapshot?.quality_flags || {};

  const bubbleOrders = {
    buy: [],
    sell: [],
    internal: [],
  };

  bubbleSeries.forEach((item) => {
    const order = {
      ts: item?.ts,
      price: Number(item?.price ?? 0),
      volume: Number(item?.volume ?? 0),
      matched_value: Number(item?.matched_value ?? 0),
      side: item?.side || 'NEUTRAL',
      is_extreme: Boolean(item?.is_extreme),
      is_whale: Boolean(item?.is_whale),
      bucket_ts: item?.bucket_ts,
      event_score: Number(item?.event_score ?? 0),
      matched_value_percentile_10d: item?.matched_value_percentile_10d == null ? null : Number(item?.matched_value_percentile_10d),
      event_score_percentile_10d: item?.event_score_percentile_10d == null ? null : Number(item?.event_score_percentile_10d),
      baseline_sample_size: item?.baseline_sample_size == null ? null : Number(item?.baseline_sample_size),
      delta_pct: Number(item?.delta_pct ?? 0),
    };
    const normalizedSide = String(order.side || '').trim().toLowerCase();
    if (normalizedSide === 'buy') {
      bubbleOrders.buy.push(order);
    } else if (normalizedSide === 'sell') {
      bubbleOrders.sell.push(order);
    } else {
      bubbleOrders.internal.push(order);
    }
  });

  const latestInstitutional = institutionalStrengthSeries[institutionalStrengthSeries.length - 1] || null;
  const staleReason = snapshot?.meta?.stale_reason || null;
  const normalizedPriceSeries = priceSeries.map((item) => ({
    ts: toCanonicalMinute(item?.bucket_ts),
    bucket_ts: item?.bucket_ts,
    price: Number(item?.price ?? 0),
    reference_price: Number(item?.reference_price ?? 0),
    delta_pct: Number(item?.delta_pct ?? 0),
  })).filter((item) => item.ts != null);
  const normalizedCvdSeries = cvdSeries.map((item) => ({
    ts: toCanonicalMinute(item?.bucket_ts),
    bucket_ts: item?.bucket_ts,
    cvd: Number(item?.value ?? 0),
    cumulative_cvd: Number(item?.value ?? 0),
  })).filter((item) => item.ts != null);
  const normalizedStrengthSeries = buyStrengthSeries.map((item) => ({
    ts: toCanonicalMinute(item?.bucket_ts),
    bucket_ts: item?.bucket_ts,
    strength: Number(item?.value ?? 0),
    confidence: item?.confidence || 'low',
  })).filter((item) => item.ts != null);
  const normalizedInstitutionalStrengthSeries = institutionalStrengthSeries.map((item) => ({
    ts: toCanonicalMinute(item?.bucket_ts),
    bucket_ts: item?.bucket_ts,
    strength: Number(item?.value ?? 0),
    confidence: item?.confidence || 'low',
  })).filter((item) => item.ts != null);
  const normalizedSpeedSeries = speedSeries.map((item) => ({
    ts: toCanonicalMinute(item?.bucket_ts),
    bucket_ts: item?.bucket_ts,
    speed: item?.value == null ? null : Number(item?.value),
    unit: item?.unit || 'events_per_second',
    confidence: item?.confidence || 'low',
  })).filter((item) => item.ts != null);
  const normalizedFlowCompareSeries = flowCompareSeries.map((item) => ({
    ts: toCanonicalMinute(item?.ts ?? item?.bucket_ts),
    bucket_ts: item?.bucket_ts ?? item?.ts,
    cvd_raw: Number(item?.cvd_raw ?? item?.cvd ?? 0),
    cvd_normalized_0_100: Number(item?.cvd_normalized_0_100 ?? item?.cvd_normalized ?? 0),
    buy_strength: Number(item?.buy_strength ?? 0),
    institutional_strength: Number(item?.institutional_strength ?? 0),
    baseline: Number(item?.baseline ?? 50),
  })).filter((item) => item.ts != null);
  const normalizedHeatmapSeries = heatmapSeries.map((item) => ({
    ts: toCanonicalMinute(item?.ts ?? item?.bucket_ts),
    bucket_ts: item?.bucket_ts ?? item?.ts,
    buy_heat: Number(item?.buy_heat ?? 0),
    sell_heat: Number(item?.sell_heat ?? 0),
    net_heat: Number(item?.net_heat ?? 0),
    whale_score: Number(item?.whale_score ?? 0),
    confidence: item?.confidence == null ? null : Number(item?.confidence),
    confidence_label: item?.confidence_label || null,
  })).filter((item) => item.ts != null);
  const normalizedMarkerSeries = markerSeries.map((item) => ({
    ts: toCanonicalMinute(item?.ts ?? item?.bucket_ts),
    bucket_ts: item?.bucket_ts ?? item?.ts,
    side: item?.side || null,
    score: Number(item?.score ?? 0),
    matched_value: Number(item?.matched_value ?? 0),
    event_score: Number(item?.event_score ?? 0),
    confidence: item?.confidence == null ? null : Number(item?.confidence),
  })).filter((item) => item.ts != null);
  const allBubbleOrders = [...bubbleOrders.buy, ...bubbleOrders.sell, ...bubbleOrders.internal];
  const flowViewModel = buildWhaleFlowViewModel({
    flowCompareSeries: normalizedFlowCompareSeries,
    heatmapSeries: normalizedHeatmapSeries,
    markerSeries: normalizedMarkerSeries,
    cvdSeries: normalizedCvdSeries,
    strengthSeries: normalizedStrengthSeries,
    institutionalStrengthSeries: normalizedInstitutionalStrengthSeries,
    bubbleOrders: allBubbleOrders,
    sessionContext,
    qualityFlags: snapshotQualityFlags,
    tradeDate: snapshot?.trade_date || null,
  });

  return {
    bubbles: {
      ok: true,
      symbol: snapshot?.symbol,
      ref_price: Number(priceSeries[priceSeries.length - 1]?.reference_price ?? priceSeries[0]?.reference_price ?? 0) || null,
      session_start: snapshot?.axis?.window_start,
      session_end: snapshot?.axis?.window_end,
      timeframe: snapshot?.timeframe || timeframe,
      price_series: normalizedPriceSeries,
      orders: bubbleOrders,
      summary: {
        total_orders: Number(snapshot?.summary?.whale_order_count ?? 0),
        buy_orders: bubbleOrders.buy.length,
        sell_orders: bubbleOrders.sell.length,
        internal_orders: bubbleOrders.internal.length,
        avg_matched_value: (() => {
          const allValues = [...bubbleOrders.buy, ...bubbleOrders.sell, ...bubbleOrders.internal]
            .map((item) => Number(item.matched_value || 0))
            .filter((value) => Number.isFinite(value));
          if (!allValues.length) return 0;
          return allValues.reduce((sum, value) => sum + value, 0) / allValues.length;
        })(),
        extreme_order_count: Number(snapshot?.summary?.extreme_order_count ?? 0),
        data_state: snapshot?.meta?.data_state || 'snapshot',
      },
      degraded_mode: Boolean(snapshot?.meta?.degraded_mode),
      quality_flags: {
        missing_reference_price: staleReason === 'missing_reference_price',
        missing_intraday_ticks: staleReason === 'missing_intraday_ticks',
        missing_session_levels: staleReason === 'missing_session_levels',
        has_flow_data: Boolean(snapshotQualityFlags?.has_flow_data),
        has_heatmap_data: Boolean(snapshotQualityFlags?.has_heatmap_data),
        contract_version: snapshotQualityFlags?.contract_version || null,
        cache_key_version: snapshotQualityFlags?.cache_key_version || null,
      },
      stale_reason: staleReason,
      session_levels: {
        reference_price: Number(sessionLevels?.reference_price ?? priceSeries[priceSeries.length - 1]?.reference_price ?? priceSeries[0]?.reference_price ?? 0) || null,
        high_price: Number(sessionLevels?.high_price ?? 0) || null,
        low_price: Number(sessionLevels?.low_price ?? 0) || null,
        ceiling_price: Number(sessionLevels?.ceiling_price ?? 0) || null,
        floor_price: Number(sessionLevels?.floor_price ?? 0) || null,
      },
      timeframe_window: timeframeWindow,
      meta: snapshot?.meta || null,
    },
    flow: {
      cvd_series: normalizedCvdSeries,
      strength_series: normalizedStrengthSeries,
      institutional_strength_series: normalizedInstitutionalStrengthSeries,
      speed_series: normalizedSpeedSeries,
      flow_compare_series: normalizedFlowCompareSeries,
      heatmap_series: normalizedHeatmapSeries,
      marker_series: normalizedMarkerSeries,
      session_context: sessionContext,
      quality_flags: snapshotQualityFlags,
      view_model: flowViewModel,
      dark_flow: {
        strength: Number(latestInstitutional?.value ?? 0),
        confidence: latestInstitutional?.confidence || 'low',
        signal_type: 'institutional_strength',
      },
      stale_reason: staleReason,
      timeframe_window: timeframeWindow,
      meta: snapshot?.meta || null,
      smfi: null,
    },
    meta: snapshot?.meta || null,
  };
}