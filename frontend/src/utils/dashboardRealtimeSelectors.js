function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLivePriceUnit(rawLivePrice, { snapshotPrice, avgCost }) {
  const livePrice = toFiniteNumber(rawLivePrice);
  if (livePrice === null || livePrice <= 0) {
    return null;
  }

  const baseline = toFiniteNumber(snapshotPrice) && Number(snapshotPrice) > 0
    ? Number(snapshotPrice)
    : (toFiniteNumber(avgCost) && Number(avgCost) > 0 ? Number(avgCost) : null);

  if (!baseline) {
    return livePrice;
  }

  const candidates = [livePrice, livePrice * 1000, livePrice / 1000].filter((item) => item > 0);
  const score = (candidate) => Math.abs(Math.log(candidate / baseline));

  let best = candidates[0];
  let bestScore = score(best);
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const candidateScore = score(candidate);
    if (candidateScore < bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return best;
}

export function buildLiveHoldingsOverlay(holdings, quotesBySymbol) {
  return (holdings || []).map((holding) => {
    const quantity = toNumber(holding.quantity);
    const avgCost = toNumber(holding.avg_cost);
    const costBasis = toNumber(holding.cost_basis) || (avgCost * quantity);
    const snapshotMarketValue = toNumber(holding.market_value);
    const quote = quotesBySymbol?.[holding.symbol] || {};

    const livePrice = normalizeLivePriceUnit(quote.current_price ?? holding.current_price, {
      snapshotPrice: holding.current_price,
      avgCost,
    });
    const hasLivePrice = livePrice !== null;
    const liveMarketValue = hasLivePrice ? livePrice * quantity : snapshotMarketValue;
    const liveUnrealizedPL = liveMarketValue - costBasis;
    const liveUnrealizedPLPct = costBasis > 0 ? (liveUnrealizedPL / costBasis) * 100 : 0;

    return {
      ...holding,
      live_current_price: hasLivePrice ? livePrice : null,
      live_market_value: liveMarketValue,
      live_unrealized_pl: liveUnrealizedPL,
      live_unrealized_pl_pct: liveUnrealizedPLPct,
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
