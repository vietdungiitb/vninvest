function hasSeriesData(series) {
  return Array.isArray(series) && series.length > 0;
}

/**
 * T1.4: Chuẩn hoá whale feed item từ BE shape (ts/matched_value) sang FE shape (time/price).
 * BE trả `ts`/`alert_at` + `matched_value` (legacy_views.py:707-751) trong khi FE trước đây đọc
 * `event_time`/`triggered_at` + `price`/`avg_price` → card "— — CP —". Map canonical về `time`/`price`
 * đồng thời giữ backward-compat với field cũ.
 */
export function normalizeWhaleFeedItem(item) {
  if (!item || typeof item !== "object") return item;
  const time = item.ts ?? item.alert_at ?? item.event_time ?? item.triggered_at ?? null;
  const price = item.matched_value ?? item.value ?? item.price ?? item.avg_price ?? null;
  const volume = item.volume ?? item.net_volume ?? 0;
  return {
    ...item,
    time,
    price,
    volume,
  };
}

/**
 * T1.4: Chuẩn hoá summary whale — BE trả `{whale_order_count, extreme_order_count}`
 * (portfolio_analytics_views.py:1255-1256) nhưng FE đọc `total_orders/buy_orders/sell_orders`.
 * Nếu BE đã trả `total_orders` thì giữ nguyên (backward-compat), chỉ fill default `internal_orders`.
 * Ngược lại map `whale_order_count -> total_orders` và đếm buy/sell từ items.
 * `internal_orders` luôn default 0 vì BE chưa từng trả (R-2 independent review).
 */
export function normalizeWhaleSummary(summary, items = []) {
  if (!summary || typeof summary !== "object") {
    const arr = Array.isArray(items) ? items : [];
    const buy = arr.filter((it) => String(it?.side || "").toLowerCase() === "buy").length;
    const sell = arr.filter((it) => String(it?.side || "").toLowerCase() === "sell").length;
    return { total_orders: arr.length, buy_orders: buy, sell_orders: sell, internal_orders: 0 };
  }
  if (summary.total_orders != null) {
    return {
      ...summary,
      total_orders: Number(summary.total_orders) || 0,
      buy_orders: summary.buy_orders ?? 0,
      sell_orders: summary.sell_orders ?? 0,
      internal_orders: summary.internal_orders ?? 0,
    };
  }
  const arr = Array.isArray(items) ? items : [];
  const whaleCount = Number(summary.whale_order_count ?? 0);
  // Đếm buy/sell từ items nếu có, fallback 0
  const buy = arr.filter((it) => String(it?.side || "").toLowerCase() === "buy").length;
  const sell = arr.filter((it) => String(it?.side || "").toLowerCase() === "sell").length;
  return {
    ...summary,
    total_orders: whaleCount,
    buy_orders: buy,
    sell_orders: sell,
    internal_orders: 0,
  };
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

  // T1.4: alias dark_flow ↔ darkFlow + flat strength cho chart (VNStockChartPanel đọc dark_flow.strength hoặc darkFlowStrength)
  const darkFlowObj = baseOrderFlowData.dark_flow ?? baseOrderFlowData.darkFlow ?? null;
  const darkFlowStrength = darkFlowObj && typeof darkFlowObj === "object" ? (darkFlowObj.strength ?? darkFlowObj.strength_pct ?? null) : null;
  baseOrderFlowData.dark_flow = darkFlowObj || null;
  baseOrderFlowData.darkFlow = darkFlowObj || null;
  baseOrderFlowData.darkFlowStrength = darkFlowStrength;
  baseOrderFlowData.dark_flow_strength = darkFlowStrength;

  const fallbackCvdSeries = normalizeWhaleCvdSeries(whaleSnapshotPayload?.flow_series?.cvd);
  if (hasSeriesData(baseOrderFlowData.cvd_series) || !hasSeriesData(fallbackCvdSeries)) {
    return baseOrderFlowData;
  }

  const fallbackDarkFlow = hasObjectContent(baseOrderFlowData.dark_flow)
    ? baseOrderFlowData.dark_flow
    : (whaleSnapshotPayload?.flow?.dark_flow || null);
  const fallbackStrength = fallbackDarkFlow && typeof fallbackDarkFlow === "object" ? (fallbackDarkFlow.strength ?? fallbackDarkFlow.strength_pct ?? null) : null;
  return {
    ...baseOrderFlowData,
    session_date: baseOrderFlowData.session_date ?? resolveFallbackTradeDate({ whaleSnapshotPayload, orderFlowPayload }),
    window: baseOrderFlowData.window ?? whaleSnapshotPayload?.timeframe ?? fallbackWindow,
    dark_flow: fallbackDarkFlow,
    darkFlow: fallbackDarkFlow,
    darkFlowStrength: fallbackStrength,
    dark_flow_strength: fallbackStrength,
    cvd_series: fallbackCvdSeries,
    _cvd_source: "whale-analytics-fallback",
    _cvd_materialization: whaleSnapshotPayload?.materialization?.read_path ?? null,
  };
}

export default buildEffectiveOrderFlowData;