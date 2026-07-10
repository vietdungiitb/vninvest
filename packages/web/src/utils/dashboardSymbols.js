export function collectUniqueSortedSymbols(
  holdings,
  trackedSymbols,
  watchlists,
  watchlistGroups
) {
  const rawList = [
    ...(holdings || []).map((h) => h?.symbol),
    ...(trackedSymbols || []).map((s) => s?.symbol),
    ...(watchlists || []).flatMap((w) => (w?.items || []).map((i) => i?.symbol)),
    ...(watchlistGroups || []).flatMap((g) => (g?.items || []).map((i) => i?.symbol)),
  ];

  const uniqueSorted = Array.from(
    new Set(rawList.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean))
  ).sort();

  return uniqueSorted.join("|");
}
