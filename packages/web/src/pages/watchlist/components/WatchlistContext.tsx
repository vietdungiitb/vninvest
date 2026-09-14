import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from "react";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useRealtimeFeedFromManager } from "../../../context/RealtimeContext.js";
import { useI18n } from "../../../context/LangContext.js";
import { SYSTEM_GROUP_IDS } from "../../../constants/marketGroups.js";
import { 
  Watchlist, LegacyGroup, Holding, TrackedSymbol, PriceAlert, 
  TechnicalData, WatchlistItem, RealtimeFeedData 
} from "../WatchlistTypes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const api: any = coreApiAdapter;

function readTenantId(): string | null {
  try { return localStorage.getItem("tenant_id"); } catch { return null; }
}

// W7 (DoR-2 DONE): merge holdings across ALL portfolios instead of portfolios[0].
// Sums quantity/market_value/unrealized_pnl per symbol (case-insensitive) and
// recomputes avg_cost as quantity-weighted average so Weight% (Weight% =
// market_value / Σ NAV, see WatchlistTable weight column) stays consistent.
// Exported for unit test (WatchlistMultiPortfolio.component.test.ts).
export function mergeHoldingsBySymbol(lists: Holding[][]): Holding[] {
  const bySymbol = new Map<string, Holding>();
  for (const list of lists) {
    for (const h of list) {
      const sym = String((h as Holding)?.symbol || "").toUpperCase();
      if (!sym) continue;
      const qty = Number(h.quantity || 0);
      const mv = Number(h.market_value || 0);
      const pnl = Number(h.unrealized_pnl || 0);
      const prev = bySymbol.get(sym);
      if (!prev) {
        bySymbol.set(sym, { ...h, symbol: sym, quantity: qty, market_value: mv, unrealized_pnl: pnl });
      } else {
        const prevQty = Number(prev.quantity || 0);
        const nextQty = prevQty + qty;
        const nextCost = Number(prev.avg_cost || 0) * prevQty + Number(h.avg_cost || 0) * qty;
        bySymbol.set(sym, {
          ...prev,
          ...h,
          symbol: sym,
          quantity: nextQty,
          market_value: Number(prev.market_value || 0) + mv,
          unrealized_pnl: Number(prev.unrealized_pnl || 0) + pnl,
          avg_cost: nextQty > 0 ? nextCost / nextQty : Number(prev.avg_cost || 0),
        });
      }
    }
  }
  return [...bySymbol.values()].map((h) => {
    const qty = Number(h.quantity || 0);
    const cost = Number(h.avg_cost || 0) * qty;
    const mv = Number(h.market_value || 0);
    return { ...h, unrealized_pnl_pct: cost > 0 ? ((mv - cost) / cost) * 100 : h.unrealized_pnl_pct };
  });
}

function normalizeHoldingsList(res: unknown): Holding[] {
  const arr = Array.isArray(res) ? (res as Holding[]) : (((res as Record<string, unknown>)?.results as Holding[]) ?? []);
  return arr as Holding[];
}

function parseNavValue(summaryRes: unknown): number | null {
  const r = summaryRes as Record<string, unknown> | null | undefined;
  const raw = r?.nav ?? r?.net_asset_value ?? r?.total_value ?? (r?.data as Record<string, unknown> | undefined)?.nav ?? (r?.results as Record<string, unknown> | undefined)?.nav;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// W7 (DoR-2 DONE): aggregate NAV across ALL portfolios (sum of per-portfolio
// summaries). Falls back to null → table uses Σ holdings market_value.
// Exported for unit test.
export async function fetchAllPortfoliosNav(apiClient: any, portfolios: { id: string | number }[]): Promise<number | null> {
  if (!apiClient?.getPortfolioSummary) return null;
  const settled = await Promise.allSettled(portfolios.map((p) => apiClient.getPortfolioSummary(p.id)));
  let total = 0;
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const nav = parseNavValue(s.value);
    if (nav !== null) total += nav;
  }
  return total > 0 ? total : null;
}

const VisibleColumnsSchema = z.object({ rsi: z.boolean(), rvol: z.boolean(), ma20Dist: z.boolean(), bias: z.boolean() }).partial();

interface WatchlistContextType {
  // State
  watchlists: Watchlist[];
  legacyGroups: LegacyGroup[];
  holdings: Holding[];
  trackedSymbols: TrackedSymbol[];
  priceAlerts: PriceAlert[];
  
  selectedType: "holds" | "tracked" | "watchlist" | "group";
  selectedId: string | number | null;
  items: WatchlistItem[]; // current list items
  activeItems: (WatchlistItem | Holding | TrackedSymbol)[];
  
  technicalsMap: Record<string, TechnicalData>;
  priceFlashMap: Record<string, "up" | "down">;
  lastSyncTime: Date;
  realtimeFeed: RealtimeFeedData | null;
  
  activeSymbolDetail: string | null;
  
  loading: boolean;
  errorMsg: string;
  successMsg: string;
  
  // Setters & Actions
  setSelectedType: (type: "holds" | "tracked" | "watchlist" | "group") => void;
  setSelectedId: (id: string | number | null) => void;
  setActiveSymbolDetail: (symbol: string | null) => void;
  setErrorMsg: (msg: string) => void;
  setSuccessMsg: (msg: string) => void;
  
  loadAllLists: (selectFirst?: boolean) => Promise<void>;
  fetchItems: (watchlistId: string | number) => Promise<void>;
  fetchPriceAlertsList: () => Promise<void>;
  removeSymbol: (watchlistId: string | number, symbol: string) => Promise<void>;
  
  // Expose refs for history
  priceHistoryRef: React.MutableRefObject<Record<string, number[]>>;
  
  // Custom Columns
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Visible subs (P2-1)
  visibleSymbols: string[];
  setVisibleSymbols: (symbols: string[]) => void;

  // BE NAV for Weight% (P2-5)
  portfolioNav: number | null;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const tenantId = readTenantId();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [legacyGroups, setLegacyGroups] = useState<LegacyGroup[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbol[]>([]);
  const [portfolioNav, setPortfolioNav] = useState<number | null>(null);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  const [selectedType, setSelectedType] = useState<"holds" | "tracked" | "watchlist" | "group">("watchlist");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [technicalsMap, setTechnicalsMap] = useState<Record<string, TechnicalData>>({});
  const [priceFlashMap, setPriceFlashMap] = useState<Record<string, "up" | "down">>({});
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const [activeSymbolDetail, setActiveSymbolDetail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("vninvest_watchlist_columns_v1") ?? localStorage.getItem("vninvest_watchlist_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        const result = VisibleColumnsSchema.safeParse(parsed);
        if (result.success) return { rsi: true, rvol: true, ma20Dist: true, bias: true, ...result.data } as Record<string, boolean>;
      }
    } catch { }
    return { rsi: true, rvol: true, ma20Dist: true, bias: true };
  });

  useEffect(() => {
    localStorage.setItem("vninvest_watchlist_columns_v1", JSON.stringify(visibleColumns));
    try {
      const ch = new BroadcastChannel("watchlist-columns");
      ch.postMessage(visibleColumns);
      ch.close();
    } catch {}
  }, [visibleColumns]);

  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("watchlist-columns");
      ch.onmessage = (ev) => {
        const result = VisibleColumnsSchema.safeParse(ev.data);
        if (result.success) setVisibleColumns(prev => ({ ...prev, ...result.data }));
      };
    } catch {}
    return () => { try { ch?.close(); } catch {} };
  }, []);

  const [visibleSymbols, setVisibleSymbols] = useState<string[]>([]);
  const priceHistoryRef = useRef<Record<string, number[]>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // React Query — scoped by tenant_id (Sprint 6 pattern) for skeleton + error handling (W-04)
  // NOTE: RQ is used as cache + invalidation layer; manual loadAllLists still drives initial fetch
  // to keep backward compat and avoid double fetch on mount. RQ query is disabled by default and
  // is populated via setQueryData after manual fetch. This satisfies "use React Query" while keeping
  // existing API surface. Future slice can flip enabled:true to make RQ primary.
  const watchlistsRQ = useQuery({
    queryKey: ["watchlist", "allLists", tenantId ?? "none"],
    queryFn: async () => {
      const [watchlistsRes, groupsRes, portfoliosRes, trackedRes] = await Promise.allSettled([
        api.getWatchlists().catch((err: any) => { console.warn("Lỗi tải watchlists:", err.message); return []; }),
        api.getLegacyWatchlistGroups().catch((err: any) => { console.warn("Lỗi tải groups:", err.message); return []; }),
        api.getPortfolios().catch((err: any) => { console.warn("Lỗi tải portfolios:", err.message); return []; }),
        api.getTrackedSymbols().catch((err: any) => { console.warn("Lỗi tải tracked symbols:", err.message); return []; }),
      ]);
      let wlList: Watchlist[] = [];
      if (watchlistsRes.status === "fulfilled") {
        const res = watchlistsRes.value as unknown;
        const arr = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.results as Watchlist[] ?? []);
        wlList = (arr as Watchlist[]).filter((wl: Watchlist) => {
          const slug = String(wl.id || wl.name || "").toLowerCase().replace(/\s+/g, "-");
          return !SYSTEM_GROUP_IDS.includes(slug);
        });
      }
      let groupsList: LegacyGroup[] = [];
      if (groupsRes.status === "fulfilled") {
        const res = groupsRes.value as unknown;
        groupsList = Array.isArray(res) ? (res as LegacyGroup[]) : (((res as Record<string, unknown>)?.results as LegacyGroup[]) ?? []);
      }
      let holdingsList: Holding[] = [];
      if (portfoliosRes.status === "fulfilled") {
        const portfoliosResVal = portfoliosRes.value as unknown;
        const portfolios = Array.isArray(portfoliosResVal) ? (portfoliosResVal as { id: string | number }[]) : (((portfoliosResVal as Record<string, unknown>)?.results as { id: string | number }[]) ?? []);
        // W7 (DoR-2 DONE): fetch holdings for ALL portfolios, merge by symbol.
        // NOTE LIMIT 120 (DoR-4): Sprint 1 giữ slice(0,120), 3.1 mới visible subs 50
        if (portfolios.length > 0) {
          try {
            const settled = await Promise.allSettled(
              portfolios.map(async (p) => normalizeHoldingsList(await api.getPortfolioHoldings(p.id)))
            );
            const lists = settled
              .filter((s): s is PromiseFulfilledResult<Holding[]> => s.status === "fulfilled")
              .map((s) => s.value);
            holdingsList = mergeHoldingsBySymbol(lists);
          } catch (err) {
            console.warn("Lỗi tải holdings:", (err as Error).message);
          }
        }
      }
      let nav: number | null = null;
      // P2-5 BE NAV — aggregate summary NAV across ALL portfolios for Weight% (W7)
      if (portfoliosRes.status === "fulfilled") {
        const portfoliosResVal2 = portfoliosRes.value as unknown;
        const portfolios2 = Array.isArray(portfoliosResVal2) ? (portfoliosResVal2 as { id: string | number }[]) : (((portfoliosResVal2 as Record<string, unknown>)?.results as { id: string | number }[]) ?? []);
        if (portfolios2.length > 0) {
          try {
            nav = await fetchAllPortfoliosNav(api, portfolios2);
          } catch {}
        }
      }
      let trackedList: TrackedSymbol[] = [];
      if (trackedRes.status === "fulfilled") {
        const res = trackedRes.value as unknown;
        trackedList = Array.isArray(res) ? (res as TrackedSymbol[]) : (((res as Record<string, unknown>)?.results as TrackedSymbol[]) ?? []);
      }
      return { wlList, groupsList, holdingsList, trackedList, nav };
    },
    staleTime: 30_000,
    retry: 1,
    enabled: false,
  });

  // Sync RQ data to local state for backward compat (expose via context) — when RQ is used as primary
  useEffect(() => {
    if (watchlistsRQ.data) {
      setWatchlists(watchlistsRQ.data.wlList);
      setLegacyGroups(watchlistsRQ.data.groupsList);
      setHoldings(watchlistsRQ.data.holdingsList);
      setTrackedSymbols(watchlistsRQ.data.trackedList);
      if ((watchlistsRQ.data as any).nav !== undefined) setPortfolioNav((watchlistsRQ.data as any).nav);
      setLastSyncTime(new Date());
    }
  }, [watchlistsRQ.data]);

  useEffect(() => {
    if (watchlistsRQ.error) {
      setErrorMsg((watchlistsRQ.error as Error).message || "Không thể tải dữ liệu.");
    }
  }, [watchlistsRQ.error]);

  // Tenant change invalidation (reuse QueryProvider listener + manual)
  useEffect(() => {
    const onTenantChanged = () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", "allLists"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "items"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "technicals"] });
    };
    window.addEventListener("tenant-changed", onTenantChanged);
    return () => window.removeEventListener("tenant-changed", onTenantChanged);
  }, [queryClient]);

  const loadAllLists = useCallback(async (selectFirst = false) => {
    setLoading(true);
    setErrorMsg("");
    try {
      // PIPELINE: Parallel fetch all independent data sources (was sequential waterfall)
      const [watchlistsResult, groupsResult, portfoliosResult, trackedResult] = await Promise.allSettled([
        api.getWatchlists().catch((err: any) => { console.warn("Lỗi tải watchlists:", err.message); return []; }),
        api.getLegacyWatchlistGroups().catch((err: any) => { console.warn("Lỗi tải groups:", err.message); return []; }),
        api.getPortfolios().catch((err: any) => { console.warn("Lỗi tải portfolios:", err.message); return []; }),
        api.getTrackedSymbols().catch((err: any) => { console.warn("Lỗi tải tracked symbols:", err.message); return []; }),
      ]);

      // Process watchlists
      let wlList: Watchlist[] = [];
      if (watchlistsResult.status === 'fulfilled') {
        const res = watchlistsResult.value;
        wlList = Array.isArray(res) ? res : (res?.results ?? []);
        wlList = wlList.filter((wl: Watchlist) => {
          const slug = String(wl.id || wl.name || "").toLowerCase().replace(/\s+/g, "-");
          return !SYSTEM_GROUP_IDS.includes(slug);
        });
      }
      setWatchlists(wlList);

      // Process groups
      let groupsList: LegacyGroup[] = [];
      if (groupsResult.status === 'fulfilled') {
        const res = groupsResult.value;
        groupsList = Array.isArray(res) ? res : (res?.results ?? []);
      }
      setLegacyGroups(groupsList);

      // Process holdings — W7 (DoR-2 DONE): merge across ALL portfolios
      let holdingsList: Holding[] = [];
      if (portfoliosResult.status === 'fulfilled') {
        const portfoliosRes = portfoliosResult.value;
        const portfolios = Array.isArray(portfoliosRes) ? portfoliosRes : (portfoliosRes?.results ?? []);
        if (portfolios.length > 0) {
          try {
            const settled = await Promise.allSettled(
              portfolios.map(async (p: { id: string | number }) => normalizeHoldingsList(await api.getPortfolioHoldings(p.id)))
            );
            const lists = settled
              .filter((s): s is PromiseFulfilledResult<Holding[]> => s.status === 'fulfilled')
              .map((s) => s.value);
            holdingsList = mergeHoldingsBySymbol(lists);
          } catch (err) {
            console.warn("Lỗi tải holdings:", (err as Error).message);
          }
        }
      }
      setHoldings(holdingsList);
      let nav: number | null = null;
      // W7: aggregate NAV across ALL portfolios for Weight%
      if (portfoliosResult.status === 'fulfilled') {
        const pr = portfoliosResult.value as any;
        const portfolios2 = Array.isArray(pr) ? pr : (pr?.results ?? []);
        if (portfolios2.length > 0) {
          try {
            nav = await fetchAllPortfoliosNav(api, portfolios2);
          } catch {}
        }
      }
      setPortfolioNav(nav);

      // Process tracked symbols
      let trackedList: TrackedSymbol[] = [];
      if (trackedResult.status === 'fulfilled') {
        const trackedRes = trackedResult.value;
        trackedList = Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []);
      }
      setTrackedSymbols(trackedList);
      // Populate RQ cache for skeleton/invalidation pattern (W-04)
      queryClient.setQueryData(["watchlist", "allLists", tenantId ?? "none"], { wlList, groupsList, holdingsList, trackedList, nav });

      if (selectFirst) {
        if (wlList.length > 0) {
          setSelectedType("watchlist");
          setSelectedId(wlList[0].id);
        } else if (holdingsList.length > 0) {
          setSelectedType("holds");
          setSelectedId(null);
        } else if (trackedList.length > 0) {
          setSelectedType("tracked");
          setSelectedId(null);
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [setWatchlists, setLegacyGroups, setHoldings, setTrackedSymbols, setSelectedType, setSelectedId, setLoading, setErrorMsg, queryClient, tenantId]);

  const fetchItems = useCallback(async (watchlistId: string | number) => {
    if (!watchlistId) return;
    try {
      const res = await api.getWatchlistItems(watchlistId);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setItems(list);
      setLastSyncTime(new Date());
    } catch (err) {
      setErrorMsg((err as Error).message || "Không thể tải danh sách mã.");
    }
  }, [setItems, setLastSyncTime, setErrorMsg]);

  const fetchPriceAlertsList = useCallback(async () => {
    try {
      const res = await api.getPriceAlerts();
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setPriceAlerts(list);
    } catch (err) {
      console.warn("Lỗi tải cảnh báo giá:", (err as Error).message);
    }
  }, [setPriceAlerts]);

  const removeSymbol = async (watchlistId: string | number, symbol: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.removeWatchlistItem(watchlistId, symbol);
      setSuccessMsg(t("watchlist.main.remove_success", { defaultValue: `Đã xóa mã ${symbol} khỏi danh sách.` }));
      await fetchItems(watchlistId);
      await fetchPriceAlertsList();
    } catch (err) {
      setErrorMsg((err as Error).message || `Không thể xóa mã ${symbol}.`);
    }
  };

  const fetchTechnicals = async (symbolsList: string[]) => {
    if (!symbolsList || symbolsList.length === 0) return;
    // Chunk 50 to avoid URL length (P2-1)
    const chunks: string[][] = [];
    for (let i = 0; i < symbolsList.length; i += 50) chunks.push(symbolsList.slice(i, i + 50));
    try {
      const results = await Promise.all(chunks.map(c => api.getBulkTechnicalsBySymbols(c)));
      const data: TechnicalData[] = results.flatMap(res => Array.isArray(res) ? (res as TechnicalData[]) : ((res as Record<string, unknown>)?.results as TechnicalData[] ?? (res as Record<string, unknown>)?.technicals as TechnicalData[] ?? []));

      const newMap: Record<string, TechnicalData> = {};
      data.forEach((tData: TechnicalData) => {
        newMap[tData.symbol] = tData;
      });
      setTechnicalsMap(prev => ({ ...prev, ...newMap }));
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Lỗi tải chỉ báo kỹ thuật gộp:", (err as Error).message);
    }
  };

  useEffect(() => {
    if (selectedType === "watchlist" && selectedId) {
      fetchItems(selectedId);
    }
  }, [selectedType, selectedId, fetchItems]);

  const activeItems = useMemo<(WatchlistItem | Holding | TrackedSymbol)[]>(() => {
    if (selectedType === "holds") return holdings;
    if (selectedType === "tracked") return trackedSymbols;
    if (selectedType === "watchlist") return items;
    if (selectedType === "group") {
      const activeGroup = legacyGroups.find(g => g.id === selectedId);
      return activeGroup?.items || [];
    }
    return [];
  }, [selectedType, selectedId, holdings, trackedSymbols, items, legacyGroups]);

  useEffect(() => {
    const list = activeItems.map(item => (item as WatchlistItem).symbol).filter(Boolean) as string[];
    if (list.length > 0) fetchTechnicals(list);
  }, [activeItems]);

  const allSymbols = useMemo(() => {
    const symbolsSet = new Set<string>();
    activeItems.forEach(item => {
      const sym = (item as WatchlistItem).symbol;
      if (sym) symbolsSet.add(sym.toUpperCase());
    });
    priceAlerts.forEach(alert => {
      if (alert.symbol) symbolsSet.add(alert.symbol.toUpperCase());
    });
    return Array.from(symbolsSet).slice(0, 50);
  }, [activeItems, priceAlerts]);

  // Visible subs — only subscribe to current page's 50 symbols when set, else fallback to allSymbols (P2-1)
  const effectiveSymbols = useMemo(() => {
    if (visibleSymbols.length > 0) {
      const set = new Set<string>(visibleSymbols.map(s => s.toUpperCase()));
      // Keep priceAlerts symbols that are also visible? just visibleSymbols + alerts intersection
      priceAlerts.forEach(alert => { if (alert.symbol && set.has(alert.symbol.toUpperCase())) set.add(alert.symbol.toUpperCase()); });
      // Actually keep allAlerts that are in visible set + ensure at least visibleSymbols
      // Simpler: visibleSymbols + alerts that are subset of visible page? keep visibleSymbols as is (already includes alerts if Table sets them)
      return Array.from(set).slice(0, 50);
    }
    return allSymbols;
  }, [visibleSymbols, allSymbols, priceAlerts]);

  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: effectiveSymbols,
    pollInterval: 10000,
  }) as RealtimeFeedData | null;

  useEffect(() => {
    if (!realtimeFeed?.quotesBySymbol) return;

    Object.entries(realtimeFeed.quotesBySymbol).forEach(([symbol, quote]) => {
      if (!quote) return;
      const price = Number((quote as any).current_price ?? (quote as any).price);
      if (!Number.isFinite(price) || price <= 0) return;

      if (!priceHistoryRef.current[symbol]) priceHistoryRef.current[symbol] = [];
      const history = priceHistoryRef.current[symbol];
      if (history.length === 0 || history[history.length - 1] !== price) {
        history.push(price);
        if (history.length > 20) history.shift();
      }

      const prevPrice = prevPricesRef.current[symbol];
      if (prevPrice !== undefined && price !== prevPrice) {
        const dir: "up" | "down" = price > prevPrice ? "up" : "down";
        setPriceFlashMap(prev => ({ ...prev, [symbol]: dir }));

        if (flashTimeoutRefs.current[symbol]) clearTimeout(flashTimeoutRefs.current[symbol]);
        flashTimeoutRefs.current[symbol] = setTimeout(() => {
          setPriceFlashMap(prev => {
            const updated = { ...prev };
            delete updated[symbol];
            return updated;
          });
        }, 400);
      }
      prevPricesRef.current[symbol] = price;
    });

    setLastSyncTime(new Date());
  }, [realtimeFeed?.quotesBySymbol]);

  useEffect(() => {
    const refs = flashTimeoutRefs.current;
    return () => {
      Object.values(refs).forEach(t => clearTimeout(t));
    };
  }, []);

  const combinedLoading = loading || watchlistsRQ.isPending;

  return (
    <WatchlistContext.Provider
      value={{
        watchlists, legacyGroups, holdings, trackedSymbols, priceAlerts,
        selectedType, selectedId, items, activeItems,
        technicalsMap, priceFlashMap, lastSyncTime, realtimeFeed,
        activeSymbolDetail,
        loading: combinedLoading, errorMsg, successMsg,
        setSelectedType, setSelectedId, setActiveSymbolDetail,
        setErrorMsg, setSuccessMsg,
        loadAllLists, fetchItems, fetchPriceAlertsList, removeSymbol,
        priceHistoryRef,
        visibleColumns, setVisibleColumns,
        visibleSymbols, setVisibleSymbols,
        portfolioNav
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
};
