function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function getOrCreateEntry(map, rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return null;

  if (!map.has(symbol)) {
    map.set(symbol, {
      symbol,
      in_holdings: false,
      in_tracked: false,
      in_watchlist: false,
      source_tags: [],
      watchlist_group_ids: [],
      watchlist_group_names: [],
      source_group_id: null,
      source_group_name: null,
      quantity: null,
      avg_cost: null,
      market_value: null,
      unrealized_pl_pct: null,
      current_price: null,
      change_pct: null,
      volume: null,
      market_cap_bn: null,
      industry: null,
      company_name: null,
    });
  }

  return map.get(symbol);
}

function addSourceTag(entry, tag) {
  if (!entry.source_tags.includes(tag)) {
    entry.source_tags.push(tag);
  }
}

export function buildModernDashboardSymbolUniverse({
  holdings = [],
  trackedSymbols = [],
  watchlistGroups = [],
  quotesBySymbol = {},
} = {}) {
  const entries = new Map();

  ensureArray(holdings).forEach((holding) => {
    const entry = getOrCreateEntry(entries, holding?.symbol);
    if (!entry) return;

    entry.in_holdings = true;
    addSourceTag(entry, 'holdings');
    entry.quantity = holding?.quantity ?? entry.quantity;
    entry.avg_cost = holding?.avg_cost ?? entry.avg_cost;
    entry.market_value = holding?.live_market_value ?? holding?.market_value ?? entry.market_value;
    entry.unrealized_pl_pct = holding?.live_unrealized_pl_pct ?? holding?.unrealized_pl_pct ?? entry.unrealized_pl_pct;
    entry.current_price = holding?.live_current_price ?? holding?.current_price ?? entry.current_price;
    entry.change_pct = holding?.live_change_pct ?? entry.change_pct;
    entry.industry = holding?.industry || entry.industry;
    entry.company_name = holding?.company_name || holding?.name || entry.company_name;
    entry.market_cap_bn = holding?.market_cap_bn ?? entry.market_cap_bn;
  });

  ensureArray(trackedSymbols).forEach((tracked) => {
    const entry = getOrCreateEntry(entries, tracked?.symbol);
    if (!entry) return;

    entry.in_tracked = true;
    addSourceTag(entry, 'tracked');
    entry.source_group_id = tracked?.source_group_id ?? entry.source_group_id;
    entry.source_group_name = tracked?.source_group_name || entry.source_group_name;
    entry.industry = tracked?.industry || entry.industry;
    entry.company_name = tracked?.company_name || entry.company_name;
    entry.market_cap_bn = tracked?.market_cap_bn ?? entry.market_cap_bn;
    entry.current_price = tracked?.current_price ?? entry.current_price;
    entry.change_pct = tracked?.change_pct ?? entry.change_pct;
  });

  ensureArray(watchlistGroups).forEach((group) => {
    const groupId = group?.id ?? null;
    const groupName = String(group?.name || '').trim();

    ensureArray(group?.items).forEach((item) => {
      const entry = getOrCreateEntry(entries, item?.symbol);
      if (!entry) return;

      entry.in_watchlist = true;
      addSourceTag(entry, 'watchlist');

      if (groupId != null && !entry.watchlist_group_ids.includes(groupId)) {
        entry.watchlist_group_ids.push(groupId);
      }
      if (groupName && !entry.watchlist_group_names.includes(groupName)) {
        entry.watchlist_group_names.push(groupName);
      }
    });
  });

  Array.from(entries.values()).forEach((entry) => {
    const quote = quotesBySymbol[entry.symbol] || {};
    entry.current_price = quote?.current_price ?? entry.current_price;
    entry.change_pct = quote?.change_pct ?? entry.change_pct;
    entry.volume = quote?.volume ?? entry.volume;
    entry.market_cap_bn = entry.market_cap_bn ?? (quote?.market_cap ? Number(quote.market_cap) : null);
  });

  return Array.from(entries.values()).sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function filterUniverseByScope(symbolUniverse = [], scope = 'holdings') {
  if (scope === 'tracked') {
    return symbolUniverse.filter((item) => item.in_tracked);
  }
  if (scope === 'watchlist') {
    return symbolUniverse.filter((item) => item.in_watchlist);
  }
  if (scope === 'all') {
    return symbolUniverse;
  }
  return symbolUniverse.filter((item) => item.in_holdings);
}

export { normalizeSymbol };
