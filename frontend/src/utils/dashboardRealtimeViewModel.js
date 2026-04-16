function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

const OFFHOURS_PHASES = new Set(['offhours', 'post_close', 'pre_open']);

function resolveDisplayPrice({ quoteCurrentPrice, quotePrevPrice, holdingLivePrice, holdingSnapshotPrice }) {
  if (isPositiveNumber(quoteCurrentPrice)) {
    return { displayPrice: quoteCurrentPrice, source: 'current_price' };
  }
  if (isPositiveNumber(quotePrevPrice)) {
    return { displayPrice: quotePrevPrice, source: 'prev_price' };
  }
  if (isPositiveNumber(holdingLivePrice)) {
    return { displayPrice: holdingLivePrice, source: 'holding_live_price' };
  }
  if (isPositiveNumber(holdingSnapshotPrice)) {
    return { displayPrice: holdingSnapshotPrice, source: 'holding_snapshot_price' };
  }
  return { displayPrice: null, source: 'none' };
}

function resolveDisplaySemantic({ quoteSemantic, marketPhase, displayPriceSource }) {
  const normalizedPhase = String(marketPhase || '').toLowerCase();
  if (quoteSemantic === 'last_session_close' || OFFHOURS_PHASES.has(normalizedPhase)) {
    return 'last_session_close';
  }
  if (displayPriceSource !== 'current_price') {
    return 'stale_fallback';
  }
  return 'realtime';
}

function computeChangePct({ quoteChangePct, displayPrice, prevPrice }) {
  if (Number.isFinite(quoteChangePct)) {
    return quoteChangePct;
  }
  if (!Number.isFinite(displayPrice) || !Number.isFinite(prevPrice) || prevPrice <= 0) {
    return null;
  }
  return ((displayPrice - prevPrice) / prevPrice) * 100;
}

export function buildDashboardRealtimeQuote({ symbol, quote = {}, holding = null }) {
  const normalizedSymbol = normalizeSymbol(symbol || quote.symbol || holding?.symbol);

  const quoteCurrentPrice = toFiniteNumber(quote.current_price);
  const quotePrevPrice = toFiniteNumber(quote.prev_price);
  const quoteChangePct = toFiniteNumber(quote.change_pct);
  const holdingLivePrice = toFiniteNumber(holding?.live_current_price);
  const holdingSnapshotPrice = toFiniteNumber(holding?.current_price);

  const { displayPrice, source: displayPriceSource } = resolveDisplayPrice({
    quoteCurrentPrice,
    quotePrevPrice,
    holdingLivePrice,
    holdingSnapshotPrice,
  });

  const displaySemantic = resolveDisplaySemantic({
    quoteSemantic: quote.data_semantic,
    marketPhase: quote.market_phase,
    displayPriceSource,
  });

  const derivedPrevPrice = Number.isFinite(quotePrevPrice)
    ? quotePrevPrice
    : (Number.isFinite(holdingSnapshotPrice) ? holdingSnapshotPrice : null);

  const resolvedChangePct = computeChangePct({
    quoteChangePct,
    displayPrice,
    prevPrice: derivedPrevPrice,
  });

  const resolvedFreshnessSeconds = toFiniteNumber(quote.freshness_seconds);
  const resolvedAgeSeconds = toFiniteNumber(quote.age_seconds);
  const resolvedThresholdSeconds = toFiniteNumber(quote.stale_threshold_seconds);
  const staleOverThreshold = Boolean(quote.stale_over_threshold);
  const hasDisplayPrice = isPositiveNumber(displayPrice);
  const normalizedPhase = String(quote.market_phase || '').toLowerCase();
  const isOffhoursLike = OFFHOURS_PHASES.has(normalizedPhase);
  const resolvedStale = displaySemantic === 'last_session_close'
    ? false
    : Boolean((quote.stale || displaySemantic === 'stale_fallback' || staleOverThreshold) && hasDisplayPrice);

  const displayState = !hasDisplayPrice
    ? (isOffhoursLike ? 'no_data_offhours' : 'no_data')
    : (staleOverThreshold ? 'resyncing' : (resolvedStale ? 'stale' : 'realtime'));

  return {
    ...quote,
    symbol: normalizedSymbol,
    current_price: displayPrice,
    display_price: displayPrice,
    display_price_source: displayPriceSource,
    prev_price: derivedPrevPrice,
    change_pct: resolvedChangePct,
    data_semantic: displaySemantic,
    stale: resolvedStale,
    freshness_seconds: Number.isFinite(resolvedFreshnessSeconds)
      ? resolvedFreshnessSeconds
      : (Number.isFinite(resolvedAgeSeconds) ? resolvedAgeSeconds : null),
    age_seconds: Number.isFinite(resolvedAgeSeconds)
      ? resolvedAgeSeconds
      : (Number.isFinite(resolvedFreshnessSeconds) ? resolvedFreshnessSeconds : null),
    stale_threshold_seconds: Number.isFinite(resolvedThresholdSeconds) ? resolvedThresholdSeconds : null,
    stale_over_threshold: staleOverThreshold,
    source_event_at: quote.source_event_at || null,
    served_at: quote.served_at || null,
    display_state: displayState,
    market_phase: quote.market_phase,
    market_code: quote.market_code,
  };
}

export function buildDashboardRealtimeQuoteList({ monitoredSymbols = [], quotesBySymbol = {}, holdings = [] }) {
  const holdingsBySymbol = new Map(
    (holdings || []).map((item) => [normalizeSymbol(item?.symbol), item]),
  );

  return (monitoredSymbols || []).map((symbol) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = quotesBySymbol[normalizedSymbol]
      || quotesBySymbol[symbol]
      || quotesBySymbol[String(symbol || '').toLowerCase()]
      || { symbol: normalizedSymbol };

    const holding = holdingsBySymbol.get(normalizedSymbol) || null;
    return buildDashboardRealtimeQuote({
      symbol: normalizedSymbol,
      quote,
      holding,
    });
  });
}
