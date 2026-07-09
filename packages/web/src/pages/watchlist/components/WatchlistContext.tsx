import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useRealtimeFeedFromManager } from "../../../context/RealtimeContext.js";
import { useI18n } from "../../../context/LangContext.js";
import { 
  Watchlist, LegacyGroup, Holding, TrackedSymbol, PriceAlert, 
  TechnicalData, WatchlistItem, RealtimeFeedData 
} from "../WatchlistTypes";

const api = coreApiAdapter;

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
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

const EXCLUDED_MARKET_GROUPS = [
  "Ngân hàng", "Bất động sản", "Thép & Vật liệu", "Dầu khí", "Công nghệ", 
  "Bán lẻ & Tiêu dùng", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
];

export const WatchlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [legacyGroups, setLegacyGroups] = useState<LegacyGroup[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbol[]>([]);
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
      const saved = localStorage.getItem("vninvest_watchlist_columns");
      if (saved) return JSON.parse(saved);
    } catch { }
    return { rsi: true, rvol: true, ma20Dist: true, bias: true };
  });

  useEffect(() => {
    localStorage.setItem("vninvest_watchlist_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const priceHistoryRef = useRef<Record<string, number[]>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadAllLists = async (selectFirst = false) => {
    setLoading(true);
    setErrorMsg("");
    try {
      let wlList: Watchlist[] = [];
      try {
        const res = await api.getWatchlists();
        wlList = Array.isArray(res) ? res : (res?.results ?? []);
        wlList = wlList.filter((wl: Watchlist) => !EXCLUDED_MARKET_GROUPS.includes(wl.name));
      } catch (err) {
        console.warn("Lỗi tải watchlists:", (err as Error).message);
      }
      setWatchlists(wlList);

      let groupsList: LegacyGroup[] = [];
      try {
        const res = await api.getLegacyWatchlistGroups();
        groupsList = Array.isArray(res) ? res : (res?.results ?? []);
      } catch (err) {
        console.warn("Lỗi tải groups:", (err as Error).message);
      }
      setLegacyGroups(groupsList);

      let holdingsList: Holding[] = [];
      try {
        const portfoliosRes = await api.getPortfolios();
        const portfolios = Array.isArray(portfoliosRes) ? portfoliosRes : (portfoliosRes?.results ?? []);
        if (portfolios.length > 0) {
          const holdingsRes = await api.getPortfolioHoldings(portfolios[0].id);
          holdingsList = Array.isArray(holdingsRes) ? holdingsRes : (holdingsRes?.results ?? []);
        }
      } catch (err) {
        console.warn("Lỗi tải holdings:", (err as Error).message);
      }
      setHoldings(holdingsList);

      let trackedList: TrackedSymbol[] = [];
      try {
        const trackedRes = await api.getTrackedSymbols();
        trackedList = Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []);
      } catch (err) {
        console.warn("Lỗi tải tracked symbols:", (err as Error).message);
      }
      setTrackedSymbols(trackedList);

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
  };

  const fetchItems = async (watchlistId: string | number) => {
    if (!watchlistId) return;
    try {
      const res = await api.getWatchlistItems(watchlistId);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setItems(list);
      setLastSyncTime(new Date());
    } catch (err) {
      setErrorMsg((err as Error).message || "Không thể tải danh sách mã.");
    }
  };

  const fetchPriceAlertsList = async () => {
    try {
      const res = await api.getPriceAlerts();
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setPriceAlerts(list);
    } catch (err) {
      console.warn("Lỗi tải cảnh báo giá:", (err as Error).message);
    }
  };

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
    try {
      const res = await api.getBulkTechnicalsBySymbols(symbolsList);
      const data: TechnicalData[] = Array.isArray(res) ? res : (res?.results ?? res?.technicals ?? []);

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
  }, [selectedType, selectedId]);

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
    return Array.from(symbolsSet).slice(0, 120);
  }, [activeItems, priceAlerts]);

  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: allSymbols,
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
    return () => {
      Object.values(flashTimeoutRefs.current).forEach(t => clearTimeout(t));
    };
  }, []);

  return (
    <WatchlistContext.Provider
      value={{
        watchlists, legacyGroups, holdings, trackedSymbols, priceAlerts,
        selectedType, selectedId, items, activeItems,
        technicalsMap, priceFlashMap, lastSyncTime, realtimeFeed,
        activeSymbolDetail,
        loading, errorMsg, successMsg,
        setSelectedType, setSelectedId, setActiveSymbolDetail,
        setErrorMsg, setSuccessMsg,
        loadAllLists, fetchItems, fetchPriceAlertsList, removeSymbol,
        priceHistoryRef,
        visibleColumns, setVisibleColumns
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
