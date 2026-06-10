function hasSeriesData(series) {
  return Array.isArray(series) && series.length > 0;
}

function hasObjectContent(value) {
  return Boolean(value) && typeof value === "object" && Object.keys(value).length > 0;
}

function normalizeWhaleCvdSeries(series) {
  if (!Array.isArray(series)) {
    return [];
  }

  return series.flatMap((item) => {
    const bucketTs = item?.bucket_ts ?? item?.ts ?? null;
    if (!bucketTs) {
      return [];
    }

    const numericValue = Number(item?.value ?? item?.cvd ?? item?.cumulative_cvd ?? 0);
    const value = Number.isFinite(numericValue) ? numericValue : 0;

    return [{
      ts: bucketTs,
      bucket_ts: bucketTs,
      cvd: value,
      cumulative_cvd: value,
    }];
  });
}

function resolveFallbackTradeDate({ whaleSnapshotPayload = null, orderFlowPayload = null } = {}) {
  const sessionContext = whaleSnapshotPayload?.session_context || null;

  return orderFlowPayload?.session_date
    ?? sessionContext?.selected_trade_date
    ?? sessionContext?.default_trade_date
    ?? whaleSnapshotPayload?.session_summary?.selected_trade_date
    ?? null;
}

export function buildEffectiveOrderFlowData({
  orderFlowPayload = null,
  sessionFactsCvdPayload = null,
  whaleSnapshotPayload = null,
  symbol = null,
  fallbackWindow = null,
} = {}) {
  if (!orderFlowPayload && !sessionFactsCvdPayload && !whaleSnapshotPayload) {
    return null;
  }

  const baseOrderFlowData = {
    ...(orderFlowPayload || {}),
    symbol: symbol || orderFlowPayload?.symbol || sessionFactsCvdPayload?.symbol || whaleSnapshotPayload?.symbol || null,
    session_date: sessionFactsCvdPayload?.session_date ?? orderFlowPayload?.session_date ?? null,
    window: sessionFactsCvdPayload?.window ?? orderFlowPayload?.window ?? fallbackWindow,
    bucket_minutes: sessionFactsCvdPayload?.bucket_minutes ?? orderFlowPayload?.bucket_minutes ?? null,
    cvd_normalized: sessionFactsCvdPayload?.cvd_normalized ?? orderFlowPayload?.cvd_normalized ?? null,
    delta_strength_pct: sessionFactsCvdPayload?.delta_strength_pct ?? orderFlowPayload?.delta_strength_pct ?? null,
    whale_net_flow: sessionFactsCvdPayload?.whale_net_flow ?? orderFlowPayload?.whale_net_flow ?? null,
    cvd_series: sessionFactsCvdPayload?.cvd_series ?? orderFlowPayload?.cvd_series ?? [],
    _cvd_source: sessionFactsCvdPayload ? "whale-ssot" : (hasSeriesData(orderFlowPayload?.cvd_series) ? "intraday-tick" : null),
  };

  const fallbackCvdSeries = normalizeWhaleCvdSeries(whaleSnapshotPayload?.flow_series?.cvd);
  if (hasSeriesData(baseOrderFlowData.cvd_series) || !hasSeriesData(fallbackCvdSeries)) {
    return baseOrderFlowData;
  }

  return {
    ...baseOrderFlowData,
    session_date: baseOrderFlowData.session_date ?? resolveFallbackTradeDate({ whaleSnapshotPayload, orderFlowPayload }),
    window: baseOrderFlowData.window ?? whaleSnapshotPayload?.timeframe ?? fallbackWindow,
    dark_flow: hasObjectContent(baseOrderFlowData.dark_flow)
      ? baseOrderFlowData.dark_flow
      : (whaleSnapshotPayload?.flow?.dark_flow || null),
    cvd_series: fallbackCvdSeries,
    _cvd_source: "whale-analytics-fallback",
    _cvd_materialization: whaleSnapshotPayload?.materialization?.read_path ?? null,
  };
}

export default buildEffectiveOrderFlowData;