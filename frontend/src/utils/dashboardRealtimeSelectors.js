function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveLiveChangePct({ quoteChangePct, livePrice, prevPrice }) {
  const normalizedQuoteChangePct = toFiniteNumber(quoteChangePct);
  if (normalizedQuoteChangePct !== null) {
    return normalizedQuoteChangePct;
  }

  const normalizedLivePrice = toFiniteNumber(livePrice);
  const normalizedPrevPrice = toFiniteNumber(prevPrice);
  if (normalizedLivePrice === null || normalizedPrevPrice === null || normalizedPrevPrice <= 0) {
    return null;
  }

  return ((normalizedLivePrice - normalizedPrevPrice) / normalizedPrevPrice) * 100;
}

// REMOVED: normalizeLivePriceUnit() function
// REASON: Backend now guarantees all prices in canonical THOUSAND_VND
// No heuristic unit detection needed on frontend anymore

export function buildLiveHoldingsOverlay(holdings, quotesBySymbol) {
  return (holdings || []).map((holding) => {
    const quantity = toNumber(holding.quantity);
    const avgCost = toNumber(holding.avg_cost);
    const costBasis = toNumber(holding.cost_basis) || (avgCost * quantity);
    const snapshotMarketValue = toNumber(holding.market_value);
    const quote = quotesBySymbol?.[holding.symbol] || {};

    // Canonical unit: Trust backend price directly (already THOUSAND_VND)
    const livePrice = toFiniteNumber(quote.current_price ?? holding.current_price);
    const hasLivePrice = livePrice !== null;
    const liveMarketValue = hasLivePrice ? livePrice * quantity : snapshotMarketValue;
    const liveUnrealizedPL = liveMarketValue - costBasis;
    const liveUnrealizedPLPct = costBasis > 0 ? (liveUnrealizedPL / costBasis) * 100 : 0;
    const liveChangePct = resolveLiveChangePct({
      quoteChangePct: quote.change_pct,
      livePrice,
      prevPrice: quote.prev_price ?? holding.prev_close,
    });

    return {
      ...holding,
      live_current_price: hasLivePrice ? livePrice : null,
      live_market_value: liveMarketValue,
      live_unrealized_pl: liveUnrealizedPL,
      live_unrealized_pl_pct: liveUnrealizedPLPct,
      live_change_pct: liveChangePct,
      live_is_stale: Boolean(quote.stale),
      live_freshness_seconds: quote.freshness_seconds,
    };
  });
}

export function buildLiveSummaryFromHoldings(liveHoldings) {
  const totals = (liveHoldings || []).reduce((acc, holding) => {
    acc.totalMarketValue += toNumber(holding.live_market_value ?? holding.market_value);
    acc.totalUnrealizedPL += toNumber(holding.live_unrealized_pl ?? holding.unrealized_pl);
    if (holding.live_is_stale) {
      acc.stalePositions += 1;
    }
    return acc;
  }, {
    totalMarketValue: 0,
    totalUnrealizedPL: 0,
    stalePositions: 0,
  });

  const impliedCostBasis = totals.totalMarketValue - totals.totalUnrealizedPL;
  return {
    ...totals,
    totalUnrealizedPLPct: impliedCostBasis > 0
      ? (totals.totalUnrealizedPL / impliedCostBasis) * 100
      : 0,
  };
}
