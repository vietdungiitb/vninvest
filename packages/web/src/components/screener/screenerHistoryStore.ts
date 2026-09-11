const STORAGE_KEY = "vninvest_screener_history_v1";
const MAX_RUNS = 20;

export type HistoryAction = "BUY" | "SELL" | "HOLD" | "STAND_ASIDE" | null;

export interface HistoryRow {
  symbol: string;
  close: number | null;
  action: HistoryAction;
  score: number | null;
}

export interface ScreenerRunEntry {
  id: string;
  ruleId: number | null;
  ruleName: string;
  timestamp: number;
  rows: HistoryRow[];
}

export function loadScreenerRuns(): ScreenerRunEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ScreenerRunEntry[];
  } catch {
    return [];
  }
}

export function saveScreenerRun(entry: ScreenerRunEntry): ScreenerRunEntry[] {
  const existing = loadScreenerRuns();
  const next = [entry, ...existing].slice(0, MAX_RUNS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

export interface TradeResult {
  symbol: string;
  action: "BUY" | "SELL";
  entry: number;
  exit: number;
  win: boolean;
}

export function buildTrades(
  runs: ScreenerRunEntry[],
  currentPrices: Record<string, number | null> | null
): TradeResult[] {
  const asc = [...runs].sort((a, b) => a.timestamp - b.timestamp);
  const bySymbol = new Map<string, { ts: number; close: number }[]>();
  asc.forEach((run) => {
    run.rows.forEach((row) => {
      if (row.close == null) return;
      if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
      bySymbol.get(row.symbol)!.push({ ts: run.timestamp, close: row.close });
    });
  });

  const trades: TradeResult[] = [];
  asc.forEach((run) => {
    run.rows.forEach((row) => {
      if (row.action !== "BUY" && row.action !== "SELL") return;
      if (row.close == null) return;
      const entry = row.close;
      let exit: number | null =
        currentPrices && currentPrices[row.symbol] != null ? currentPrices[row.symbol] : null;
      if (exit == null) {
        const later = bySymbol.get(row.symbol)?.find((d) => d.ts > run.timestamp);
        exit = later ? later.close : null;
      }
      if (exit == null) return;
      const win = row.action === "BUY" ? exit > entry : exit < entry;
      trades.push({ symbol: row.symbol, action: row.action, entry, exit, win });
    });
  });
  return trades;
}
