import React, { useEffect, useRef, useState, useMemo } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import "./WatchlistPage.css";

const api = coreApiAdapter;

interface WatchlistItem {
  id?: string | number;
  symbol: string;
  note?: string;
  whale_alert_threshold_million?: number;
  industry?: string;
  company_name?: string;
  quantity?: number;
  avg_cost?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
}

interface Watchlist {
  id: string | number;
  name: string;
  description?: string;
  items?: WatchlistItem[];
}

interface LegacyGroup {
  id: string | number;
  name: string;
  description?: string;
  items?: WatchlistItem[];
}

interface Holding {
  symbol: string;
  quantity?: number;
  avg_cost?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
}

interface TrackedSymbol {
  id?: string | number;
  symbol: string;
  whale_alert_threshold_million?: number;
  industry?: string;
  company_name?: string;
}

interface PriceAlert {
  id: string | number;
  symbol: string;
  condition: "ABOVE" | "BELOW" | "EQUAL";
  target_price: number;
  current_price?: number;
  is_active: boolean;
  cooldown_seconds?: number;
  alert_type?: string;
  price_threshold?: number;
}

interface TechnicalData {
  symbol: string;
  rsi_14?: number;
  sma20?: number;
  sma50?: number;
  momentum_20d_pct?: number;
  rvol?: number;
  ma20_distance_pct?: number;
  bias_label?: string;
  industry?: string;
  company_name?: string;
  price?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

interface QuoteData {
  current_price?: number;
  change_pct?: number;
  change_value?: number;
  price?: number;
  change?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

interface MergedData extends TechnicalData {
  price?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

interface Identity {
  is_staff?: boolean;
  is_superuser?: boolean;
}

interface Session {
  is_staff?: boolean;
  is_superuser?: boolean;
  principal?: {
    identity?: Identity;
  };
}

interface WatchlistPageProps {
  env?: Record<string, unknown>;
  autoLoad?: boolean;
  t?: (key: string, defaultVal: string) => string;
  identity?: Identity;
  session?: Session;
}

interface RealtimeFeedData {
  quotesBySymbol?: Record<string, QuoteData>;
  realtimeStatus?: string;
  lastEventAt?: string | null;
  alerts?: unknown[];
  darkFlowAlerts?: unknown[];
  marketDiscoveryEvents?: unknown[];
  latestWhaleAlert?: unknown | null;
  latestDarkFlowAlert?: unknown | null;
  latestMarketDiscoveryEvent?: unknown | null;
  metrics?: {
    eventCounts?: Record<string, number>;
    lastLatencyMs?: number | null;
    connectionState?: { transport?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const EXCLUDED_MARKET_GROUPS = [
  "Ngân hàng", "Bất động sản", "Thép & Vật liệu", "Dầu khí", "Công nghệ", 
  "Bán lẻ & Tiêu dùng", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
];

// Helper component for tracked threshold editing inline
function TrackedThresholdCell({ item, onUpdate }: { item: TrackedSymbol; onUpdate: (id: string | number, threshold: number) => Promise<void> }) {
  const [val, setVal] = useState(item.whale_alert_threshold_million);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVal(item.whale_alert_threshold_million);
  }, [item.whale_alert_threshold_million]);

  const handleSave = async () => {
    const numVal = Number(val);
    if (isNaN(numVal) || numVal <= 0) return;
    if (numVal === item.whale_alert_threshold_million) return;
    setSaving(true);
    try {
      await onUpdate(item.id!, numVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Lỗi cập nhật ngưỡng:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        type="number"
        className="watchlistPage__input w-20 px-2 py-1 m-0 text-right bg-slate-950/60 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        value={val}
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setVal(Number(ev.target.value))}
        onKeyDown={(ev: React.KeyboardEvent) => {
          if (ev.key === "Enter") handleSave();
        }}
        onBlur={handleSave}
      />
      <span className="text-xs text-slate-400">Tr.đ</span>
      {saving && <span className="text-xs text-amber-500">⏳</span>}
      {saved && <span className="text-xs text-emerald-500">✓</span>}
    </div>
  );
}

export function WatchlistPage({
  env: _env = {},
  autoLoad = true,
  t: _t = (_key: string, defaultVal: string) => defaultVal,
  identity = {},
  session = {},
}: WatchlistPageProps) {
  const isAdmin = Boolean(
    (identity as Identity)?.is_staff || 
    (identity as Identity)?.is_superuser || 
    (session as Session)?.is_staff || 
    (session as Session)?.is_superuser || 
    (session as Session)?.principal?.identity?.is_staff ||
    (session as Session)?.principal?.identity?.is_superuser
  );

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

  const [activeTab, setActiveTab] = useState<"table" | "manage" | "alerts">("table");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");

  const [_loading, setLoading] = useState(false);
  const [syncingStockProfile, setSyncingStockProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [newListName, setNewListName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newSymbolNote, setNewSymbolNote] = useState("");

  const [newTrackedSymbol, setNewTrackedSymbol] = useState("");
  const [newTrackedThreshold, setNewTrackedThreshold] = useState("1000");

  const [editingWlId, setEditingWlId] = useState<string | number | null>(null);
  const [editingWlName, setEditingWlName] = useState("");

  const [newAlertSymbol, setNewAlertSymbol] = useState("");
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [newAlertCondition, setNewAlertCondition] = useState<"ABOVE" | "BELOW" | "EQUAL">("ABOVE");
  const [newAlertCooldown, setNewAlertCooldown] = useState("300");

  // Dialog States
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<"active" | "all">("active");

  const priceHistoryRef = useRef<Record<string, number[]>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ────────────────────────────────────────────────────────────────────────────
  // Data Fetching Methods
  // ────────────────────────────────────────────────────────────────────────────

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
        } else {
          try {
            const newWl = await api.createWatchlist({
              name: "Cổ phiếu Công nghệ & Bán lẻ",
              description: "Danh sách theo dõi các mã Công nghệ và Bán lẻ.",
            });
            setWatchlists([newWl]);
            setSelectedType("watchlist");
            setSelectedId(newWl.id);
          } catch (e) {
            console.error("Lỗi tạo default watchlist:", e);
          }
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

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle Effects
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoLoad) {
      loadAllLists(true);
      fetchPriceAlertsList();
    }
  }, [autoLoad]);

  useEffect(() => {
    if (selectedType === "watchlist" && selectedId) {
      fetchItems(selectedId);
    }
  }, [selectedType, selectedId]);

  const activeItems = useMemo<(WatchlistItem | Holding | TrackedSymbol)[]>(() => {
    if (selectedType === "holds") {
      return holdings;
    } else if (selectedType === "tracked") {
      return trackedSymbols;
    } else if (selectedType === "watchlist") {
      return items;
    } else if (selectedType === "group") {
      const activeGroup = legacyGroups.find(g => g.id === selectedId);
      return activeGroup?.items || [];
    }
    return [];
  }, [selectedType, selectedId, holdings, trackedSymbols, items, legacyGroups]);

  useEffect(() => {
    const list = activeItems.map(item => (item as WatchlistItem).symbol).filter(Boolean) as string[];
    if (list.length > 0) {
      fetchTechnicals(list);
    }
  }, [activeItems]);

  // ────────────────────────────────────────────────────────────────────────────
  // Realtime Integration using useRealtimeFeedFromManager
  // ────────────────────────────────────────────────────────────────────────────

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
      const price = Number((quote as QuoteData).current_price ?? (quote as QuoteData).price);
      if (!Number.isFinite(price) || price <= 0) return;

      if (!priceHistoryRef.current[symbol]) {
        priceHistoryRef.current[symbol] = [];
      }
      const history = priceHistoryRef.current[symbol];
      if (history.length === 0 || history[history.length - 1] !== price) {
        history.push(price);
        if (history.length > 20) {
          history.shift();
        }
      }

      const prevPrice = prevPricesRef.current[symbol];
      if (prevPrice !== undefined && price !== prevPrice) {
        const dir: "up" | "down" = price > prevPrice ? "up" : "down";
        setPriceFlashMap(prev => ({ ...prev, [symbol]: dir }));

        if (flashTimeoutRefs.current[symbol]) {
          clearTimeout(flashTimeoutRefs.current[symbol]);
        }
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

  // ────────────────────────────────────────────────────────────────────────────
  // Action Handlers
  // ────────────────────────────────────────────────────────────────────────────

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const wl = await api.createWatchlist({
        name: newListName.trim(),
        description: "Danh sách watchlist tùy chỉnh của tôi.",
      });
      setNewListName("");
      setSuccessMsg("Đã tạo danh sách theo dõi thành công.");
      await loadAllLists(false);
      setSelectedType("watchlist");
      setSelectedId(wl.id);
    } catch (err) {
      setErrorMsg((err as Error).message || "Không thể tạo watchlist mới.");
    }
  };

  const handleRenameWatchlist = async (id: string | number) => {
    if (!editingWlName.trim()) {
      setEditingWlId(null);
      return;
    }
    const oldWl = watchlists.find(w => w.id === id);
    if (oldWl && oldWl.name === editingWlName.trim()) {
      setEditingWlId(null);
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.updateWatchlist(id.toString(), { name: editingWlName.trim() });
      setSuccessMsg("Đã đổi tên danh sách thành công.");
      setEditingWlId(null);
      await loadAllLists(false);
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi khi đổi tên danh sách.");
    }
  };

  const handleDeleteWatchlist = (id: string | number, name: string) => {
    setConfirmState({
      isOpen: true,
      title: "Xóa danh sách theo dõi",
      message: `Bạn có chắc chắn muốn xóa danh sách theo dõi "${name}"? Thao tác này sẽ xóa toàn bộ mã bên trong và không thể hoàn tác.`,
      onConfirm: async () => {
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await api.deleteWatchlist(id.toString());
          setSuccessMsg(`Đã xóa danh sách "${name}" thành công.`);
          const activeAfterDelete = watchlists.filter(w => w.id !== id);
          await loadAllLists(false);

          if (selectedType === "watchlist" && selectedId === id) {
            if (activeAfterDelete.length > 0) {
              setSelectedType("watchlist");
              setSelectedId(activeAfterDelete[0].id);
            } else {
              setSelectedType("holds");
              setSelectedId(null);
            }
          }
        } catch (err) {
          setErrorMsg((err as Error).message || "Lỗi khi xóa danh sách.");
        }
      }
    });
  };

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || selectedType !== "watchlist" || selectedId === null) return;
    const currentId = selectedId;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newSymbol.trim().toUpperCase();
    try {
      await api.addWatchlistItem(currentId, symbolUpper);
      setNewSymbol("");
      setNewSymbolNote("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách.`);
      await fetchItems(currentId);
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (selectedType !== "watchlist" || selectedId === null) return;
    const currentId = selectedId;
    setConfirmState({
      isOpen: true,
      title: "Xóa mã khỏi danh sách",
      message: `Bạn có chắc chắn muốn xóa mã ${symbol} khỏi danh sách theo dõi?`,
      onConfirm: async () => {
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await api.removeWatchlistItem(currentId, symbol);
          setSuccessMsg(`Đã xóa mã ${symbol} thành công.`);
          await fetchItems(currentId);
        } catch (err) {
          setErrorMsg((err as Error).message || `Lỗi khi xóa mã ${symbol}.`);
        }
      }
    });
  };

  const handleAddTrackedSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackedSymbol.trim() || !newTrackedThreshold.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newTrackedSymbol.trim().toUpperCase();
    try {
      await api.addTrackedSymbol(symbolUpper, null, Number(newTrackedThreshold));
      setNewTrackedSymbol("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách giám sát.`);
      const trackedRes = await api.getTrackedSymbols();
      setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi khi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveTrackedSymbol = (id: string | number, symbol: string) => {
    setConfirmState({
      isOpen: true,
      title: "Ngừng giám sát",
      message: `Bạn có chắc chắn muốn ngừng giám sát cá mập đối với mã ${symbol}?`,
      onConfirm: async () => {
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await api.removeTrackedSymbol(id);
          setSuccessMsg(`Đã dừng giám sát mã ${symbol} thành công.`);
          const trackedRes = await api.getTrackedSymbols();
          setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
        } catch (err) {
          setErrorMsg((err as Error).message || `Lỗi khi xóa mã ${symbol}.`);
        }
      }
    });
  };

  const handleUpdateTrackedThreshold = async (id: string | number, threshold: number) => {
    try {
      await api.updateTrackedSymbol(id, threshold);
      setTrackedSymbols(prev => prev.map(item => item.id === id ? { ...item, whale_alert_threshold_million: threshold } : item));
      setSuccessMsg("Đã cập nhật ngưỡng cảnh báo cá mập.");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi cập nhật ngưỡng.");
    }
  };

  const handlePromoteToWatchlist = async (symbol: string) => {
    if (watchlists.length === 0) {
      setErrorMsg("Không tìm thấy watchlist cá nhân nào để thêm vào. Vui lòng tạo danh sách trước.");
      return;
    }
    const targetWl = watchlists[0];
    try {
      await api.addWatchlistItem(targetWl.id, symbol);
      setSuccessMsg(`Đã thêm mã ${symbol} vào danh sách "${targetWl.name}".`);
      setTimeout(() => setSuccessMsg(""), 3000);
      if (selectedType === "watchlist" && selectedId === targetWl.id) {
        fetchItems(targetWl.id);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi khi thêm mã ${symbol} vào danh sách.`);
    }
  };

  const handlePromoteToTracked = async (symbol: string) => {
    try {
      const isAlreadyTracked = trackedSymbols.some(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      if (isAlreadyTracked) return;
      await api.addTrackedSymbol(symbol, null, 1000);
      setSuccessMsg(`Đã thêm mã ${symbol} vào danh sách giám sát cá mập (Ngưỡng mặc định 1,000 Tr.đ).`);
      setTimeout(() => setSuccessMsg(""), 3000);

      const trackedRes = await api.getTrackedSymbols();
      setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi khi thêm mã ${symbol} vào danh sách giám sát.`);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertSymbol.trim() || !newAlertPrice.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newAlertSymbol.trim().toUpperCase();
    try {
      await api.createPriceAlert({
        symbol: symbolUpper,
        alert_type: newAlertCondition,
        price_threshold: Number(newAlertPrice),
        cooldown_seconds: Number(newAlertCooldown),
        is_enabled: true,
      });
      setNewAlertSymbol("");
      setNewAlertPrice("");
      setSuccessMsg(`Đã thiết lập cảnh báo giá cho mã ${symbolUpper}.`);
      fetchPriceAlertsList();
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi tạo cảnh báo giá.");
    }
  };

  const handleDeleteAlert = (id: string | number) => {
    setConfirmState({
      isOpen: true,
      title: "Xóa cảnh báo giá",
      message: "Bạn muốn xóa cảnh báo giá này?",
      onConfirm: async () => {
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await api.deletePriceAlert(id);
          setSuccessMsg("Đã xóa cảnh báo giá thành công.");
          fetchPriceAlertsList();
        } catch (err) {
          setErrorMsg((err as Error).message || "Lỗi xóa cảnh báo giá.");
        }
      }
    });
  };

  const executeSyncStockProfile = async (mode: "active" | "all") => {
    setSyncDialogOpen(false);
    setSyncingStockProfile(true);
    setErrorMsg("");
    setSuccessMsg("Đang gửi yêu cầu đồng bộ...");

    try {
      const res = await api.syncAdminMarketGroups(mode);
      if (res && res.task_id) {
        const taskId = res.task_id;
        let attempts = 0;
        const maxAttempts = 40;

        const poll = async () => {
          try {
            const statusRes = await api.getMarketGroupsSyncStatus(taskId);
            if (statusRes.status === "SUCCESS") {
              const total = statusRes.result?.total_symbols_synced || 0;
               setSuccessMsg(`Đồng bộ thành công! Đã cập nhật ${total} mã.`);
              loadAllLists(false);
              setSyncingStockProfile(false);
              setTimeout(() => setSuccessMsg(""), 5000);
            } else if (statusRes.status === "FAILURE") {
              setErrorMsg(statusRes.error || "Đồng bộ thất bại trên máy chủ.");
              setSyncingStockProfile(false);
              setTimeout(() => setErrorMsg(""), 5000);
            } else {
              attempts++;
              if (attempts >= maxAttempts) {
                setErrorMsg("Quá thời gian đồng bộ. Vui lòng kiểm tra lại sau.");
                setSyncingStockProfile(false);
                setTimeout(() => setErrorMsg(""), 5000);
              } else {
                setSuccessMsg(`Đang đồng bộ danh sách mã chứng khoán... (${attempts * 3}s)`);
                setTimeout(poll, 3000);
              }
            }
          } catch (pollErr) {
            setErrorMsg((pollErr as Error).message || "Lỗi khi kiểm tra trạng thái đồng bộ.");
            setSyncingStockProfile(false);
            setTimeout(() => setErrorMsg(""), 5000);
          }
        };

        setTimeout(poll, 2000);
      } else if (res?.ok || res?.total_symbols_synced !== undefined) {
        setSuccessMsg(`Đồng bộ thành công! Đã cập nhật ${res.total_symbols_synced || 0} mã.`);
        loadAllLists(false);
        setSyncingStockProfile(false);
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        setErrorMsg("Đồng bộ thất bại từ máy chủ.");
        setSyncingStockProfile(false);
        setTimeout(() => setErrorMsg(""), 5000);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi khi đồng bộ mã chứng khoán.");
      setSyncingStockProfile(false);
      setTimeout(() => setErrorMsg(""), 5000);
    }
  };

  const handleSyncPrices = async () => {
    setLoading(true);
    try {
      const activeList = activeItems.map(item => (item as WatchlistItem).symbol).filter(Boolean) as string[];
      await fetchTechnicals(activeList);
      setSuccessMsg("Đã làm mới dữ liệu giá tĩnh từ máy chủ.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg("Không thể đồng bộ giá.");
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // UI Helpers & Render Methods
  // ────────────────────────────────────────────────────────────────────────────

  const getActiveTitle = () => {
    if (selectedType === "holds") {
      return "💼 Cổ phiếu nắm giữ";
    } else if (selectedType === "tracked") {
      return "🐋 Cổ phiếu giám sát (Whale)";
    } else if (selectedType === "watchlist") {
      const active = watchlists.find(w => w.id === selectedId);
      return active ? `📁 ${active.name}` : "Danh sách cá nhân";
    } else {
      const active = legacyGroups.find(g => g.id === selectedId);
      return active ? `🌐 ${active.name}` : "Nhóm thị trường";
    }
  };

  const getActiveDescription = () => {
    if (selectedType === "holds") {
      return "Danh sách các mã cổ phiếu đang sở hữu thực tế trong tài sản giao dịch.";
    } else if (selectedType === "tracked") {
      return "Giám sát dòng tiền cá mập thời gian thực với các ngưỡng alert riêng biệt.";
    } else if (selectedType === "watchlist") {
      const active = watchlists.find(w => w.id === selectedId);
      return active?.description || "Danh sách theo dõi cá nhân tự chọn.";
    } else {
      const active = legacyGroups.find(g => g.id === selectedId);
      return active?.description || "Chỉ số sàn giao dịch hoặc phân loại ngành mặc định.";
    }
  };

  const getMergedData = (symbol: string): MergedData => {
    const staticData = technicalsMap[symbol] || {};
    const streamingData = (realtimeFeed?.quotesBySymbol?.[symbol] || {}) as QuoteData;

    const price = streamingData.current_price ?? streamingData.price ?? staticData.price;
    const change = streamingData.change ?? streamingData.price_change ?? staticData.price_change;
    const changePct = streamingData.change_pct ?? streamingData.price_change_pct ?? staticData.price_change_pct;
    const volume = streamingData.volume ?? staticData.volume;

    return {
      ...staticData,
      price,
      price_change: change,
      price_change_pct: changePct,
      volume,
    };
  };

  const getGroupCounters = (symbolsList: string[]) => {
    let up = 0;
    let down = 0;
    symbolsList.forEach(symbol => {
      const merged = getMergedData(symbol);
      const changePct = merged.price_change_pct;
      if (changePct !== undefined && changePct !== null) {
        const val = Number(changePct);
        if (val > 0) up++;
        else if (val < 0) down++;
      }
    });
    return { up, down, total: symbolsList.length };
  };

  const renderSparkline = (symbol: string) => {
    const history = priceHistoryRef.current[symbol] || [];
    if (history.length < 2) {
      const merged = getMergedData(symbol);
      const change = Number(merged.price_change_pct || 0);
      const color = change >= 0 ? "#00FFBB" : "#FF3344";
      const path = change >= 0 ? "M 5,20 Q 25,12 45,18 T 85,5" : "M 5,5 Q 25,18 45,12 T 85,20";
      return (
        <svg className="watchlistPage__sparklineSvg block" width="90" height="25" viewBox="0 0 90 25">
          <path className="watchlistPage__sparklinePath fill-none stroke-[1.5]" d={path} stroke={color} />
        </svg>
      );
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

    const points = history.map((val, idx) => {
      const x = 5 + (idx / (history.length - 1)) * 80;
      const y = 20 - ((val - min) / range) * 15;
      return `${x},${y}`;
    }).join(" ");

    const lastPrice = history[history.length - 1];
    const prevPrice = history[0];
    const color = lastPrice >= prevPrice ? "#00FFBB" : "#FF3344";

    return (
      <svg className="watchlistPage__sparklineSvg block" width="90" height="25" viewBox="0 0 90 25">
        <polyline stroke={color} strokeWidth="1.5" fill="none" points={points} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const formatTime = (dateObj: Date) => {
    return dateObj.toTimeString().split(" ")[0];
  };

  const renderTableHeader = () => {
    if (selectedType === "holds") {
      return (
        <tr>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Mã</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Giá hiện tại</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">% Thay đổi</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right">Số lượng</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right">Giá vốn TB</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right">Giá trị TT</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right">Lãi / Lỗ</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right">% Lãi / Lỗ</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Xu hướng</th>
        </tr>
      );
    } else if (selectedType === "tracked") {
      return (
        <tr>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Mã</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Tên doanh nghiệp</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Giá hiện tại</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">% Thay đổi</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-right pr-8">Ngưỡng giám sát dòng tiền</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Hành động</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Xu hướng</th>
        </tr>
      );
    } else if (selectedType === "watchlist") {
      return (
        <tr>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Mã</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Giá hiện tại</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">% Thay đổi</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">RSI(14)</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">RVOL</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">% Cách MA20</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Định hướng</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Hành động</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Xu hướng</th>
        </tr>
      );
    } else {
      return (
        <tr>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Mã</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Tên doanh nghiệp</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">Giá hiện tại</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">% Thay đổi</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">RSI(14)</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider">RVOL</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Hành động nhanh</th>
          <th className="p-3 text-slate-400 font-bold uppercase text-xs tracking-wider text-center">Xu hướng</th>
        </tr>
      );
    }
  };

  const renderTableBody = () => {
    return activeItems.map(item => {
      const symbol = (item as WatchlistItem).symbol;
      const merged = getMergedData(symbol);
      const changePct = Number(merged.price_change_pct || 0);
      const isUp = changePct > 0;
      const isDown = changePct < 0;

      const flashState = priceFlashMap[symbol];
      const flashClass = flashState ? `watchlistPage__priceCell--${flashState}` : "";

      if (selectedType === "holds") {
        const h = item as Holding;
        const qty = Number(h.quantity || 0);
        const avgCost = Number(h.avg_cost || 0);
        const marketValue = Number(h.market_value || 0);
        const pnl = Number(h.unrealized_pnl || 0);
        const pnlPct = Number(h.unrealized_pnl_pct || 0);

        return (
          <tr key={symbol} className="border-b border-slate-800 hover:bg-slate-800/10">
            <td className="p-3">
              <a className="watchlistPage__symbolLink font-mono font-bold text-cyan-400 hover:underline" href={`/stocks/${symbol}`}>
                {symbol}
              </a>
            </td>
            <td className={`watchlistPage__priceCell p-3 ${flashClass} font-mono font-semibold ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-100"}`}>
              {merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"}
            </td>
            <td className={`p-3 font-mono ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-500"}`}>
              {changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
            </td>
            <td className="p-3 font-mono text-slate-100 text-right">{qty.toLocaleString()}</td>
            <td className="p-3 font-mono text-slate-100 text-right">{Math.round(avgCost).toLocaleString()}</td>
            <td className="p-3 font-mono text-slate-100 text-right">{Math.round(marketValue).toLocaleString()}</td>
            <td className={`p-3 font-mono text-right ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-rose-400" : "text-slate-500"}`}>
              {pnl !== 0 ? `${pnl > 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}` : "0"}
            </td>
            <td className={`p-3 font-mono text-right ${pnlPct > 0 ? "text-emerald-400" : pnlPct < 0 ? "text-rose-400" : "text-slate-500"}`}>
              {pnlPct !== 0 ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "0.00%"}
            </td>
            <td className="watchlistPage__sparklineCell p-3 text-center">{renderSparkline(symbol)}</td>
          </tr>
        );

      } else if (selectedType === "tracked") {
        const t = item as TrackedSymbol;
        const industry = t.industry || "—";
        const companyName = t.company_name || "—";

        return (
          <tr key={symbol} className="border-b border-slate-800 hover:bg-slate-800/10">
            <td className="p-3">
              <a className="watchlistPage__symbolLink font-mono font-bold text-cyan-400 hover:underline" href={`/stocks/${symbol}`}>
                {symbol}
              </a>
            </td>
            <td className="p-3">
              <div className="flex flex-col">
                <span className="font-bold text-slate-100">{companyName}</span>
                <span className="text-xs text-slate-400">{industry}</span>
              </div>
            </td>
            <td className={`watchlistPage__priceCell p-3 ${flashClass} font-mono font-semibold ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-100"}`}>
              {merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"}
            </td>
            <td className={`p-3 font-mono ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-500"}`}>
              {changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
            </td>
            <td className="p-3 text-right pr-8">
              <TrackedThresholdCell item={t} onUpdate={handleUpdateTrackedThreshold} />
            </td>
            <td className="p-3 text-center">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-2 py-1 text-xs"
                onClick={() => handleRemoveTrackedSymbol(t.id!, symbol)}
              >
                Ngừng giám sát
              </Button>
            </td>
            <td className="watchlistPage__sparklineCell p-3 text-center">{renderSparkline(symbol)}</td>
          </tr>
        );

      } else if (selectedType === "watchlist") {
        const rsiValue = merged.rsi_14 !== undefined && merged.rsi_14 !== null ? Number(merged.rsi_14).toFixed(1) : "—";
        const rvolValue = merged.rvol !== undefined && merged.rvol !== null ? Number(merged.rvol).toFixed(2) : "—";
        const ma20Dist = merged.ma20_distance_pct !== undefined && merged.ma20_distance_pct !== null ? `${Number(merged.ma20_distance_pct).toFixed(1)}%` : "—";

        return (
          <tr key={symbol} className="border-b border-slate-800 hover:bg-slate-800/10">
            <td className="p-3">
              <a className="watchlistPage__symbolLink font-mono font-bold text-cyan-400 hover:underline" href={`/stocks/${symbol}`}>
                {symbol}
              </a>
            </td>
            <td className={`watchlistPage__priceCell p-3 ${flashClass} font-mono font-semibold ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-100"}`}>
              {merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"}
            </td>
            <td className={`p-3 font-mono ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-500"}`}>
              {changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
            </td>
            <td className="p-3 font-mono text-slate-100">{rsiValue}</td>
            <td className="p-3 font-mono text-slate-100">{rvolValue}</td>
            <td className={`p-3 font-mono ${Number(merged.ma20_distance_pct) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{ma20Dist}</td>
            <td className="p-3 text-slate-400">{merged.bias_label || "Trung tính"}</td>
            <td className="p-3 text-center">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-2 py-1 text-xs"
                onClick={() => handleRemoveSymbol(symbol)}
              >
                Xóa
              </Button>
            </td>
            <td className="watchlistPage__sparklineCell p-3 text-center">{renderSparkline(symbol)}</td>
          </tr>
        );

      } else {
        const grpItem = item as WatchlistItem;
        const industry = merged.industry || grpItem.industry || "—";
        const companyName = merged.company_name || grpItem.company_name || "—";
        const rsiValue = merged.rsi_14 !== undefined && merged.rsi_14 !== null ? Number(merged.rsi_14).toFixed(1) : "—";
        const rvolValue = merged.rvol !== undefined && merged.rvol !== null ? Number(merged.rvol).toFixed(2) : "—";

        const isAlreadyTracked = trackedSymbols.some(t => t.symbol.toUpperCase() === symbol.toUpperCase());

        return (
          <tr key={symbol} className="border-b border-slate-800 hover:bg-slate-800/10">
            <td className="p-3">
              <a className="watchlistPage__symbolLink font-mono font-bold text-cyan-400 hover:underline" href={`/stocks/${symbol}`}>
                {symbol}
              </a>
            </td>
            <td className="p-3">
              <div className="flex flex-col">
                <span className="font-bold text-slate-100">{companyName}</span>
                <span className="text-xs text-slate-400">{industry}</span>
              </div>
            </td>
            <td className={`watchlistPage__priceCell p-3 ${flashClass} font-mono font-semibold ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-100"}`}>
              {merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"}
            </td>
            <td className={`p-3 font-mono ${isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-500"}`}>
              {changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
            </td>
            <td className="p-3 font-mono text-slate-100">{rsiValue}</td>
            <td className="p-3 font-mono text-slate-100">{rvolValue}</td>
            <td className="p-3 text-center">
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 py-1 text-xs"
                  onClick={() => handlePromoteToWatchlist(symbol)}
                >
                  ⭐️ +Watchlist
                </Button>
                <Button
                  variant={isAlreadyTracked ? "outline" : "default"}
                  size="sm"
                  className="h-8 px-2 py-1 text-xs"
                  onClick={() => handlePromoteToTracked(symbol)}
                  disabled={isAlreadyTracked}
                >
                  {isAlreadyTracked ? "🐋 Đang giám sát" : "🐋 +Giám sát"}
                </Button>
              </div>
            </td>
            <td className="watchlistPage__sparklineCell p-3 text-center">{renderSparkline(symbol)}</td>
          </tr>
        );
      }
    });
  };

  return (
    <div className="watchlistPage__container flex flex-col gap-6 w-full text-slate-200 h-[calc(100vh-120px)] overflow-hidden">
      {errorMsg && <div className="shellPage__notice shellPage__notice--error bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded text-sm">{errorMsg}</div>}
      {successMsg && <div className="shellPage__notice shellPage__notice--success bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded text-sm">{successMsg}</div>}

      <div className="watchlistPage__layout grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 w-full items-stretch h-full overflow-hidden">
        {/* Sidebar */}
        <aside className="watchlistPage__sidebarCard flex flex-col gap-5 p-6 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-lg h-full overflow-y-auto box-border">
          <h2 className="watchlistPage__sidebarTitle text-lg font-bold text-slate-100 border-b border-slate-800 pb-3 mb-1 tracking-tight">
            Danh mục của tôi
          </h2>
          
          <div className="watchlistPage__list flex flex-col gap-2 mb-2">
            <div
              className={`watchlistPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded px-4 py-3 cursor-pointer transition-all hover:bg-cyan-500/5 hover:border-slate-700 ${
                selectedType === "holds" ? "watchlistPage__listItem--active border-cyan-500 bg-cyan-500/10" : ""
              }`}
              onClick={() => {
                setSelectedType("holds");
                setSelectedId(null);
                setErrorMsg("");
                setSuccessMsg("");
              }}
            >
              <span className={`watchlistPage__listItemName text-sm font-semibold ${selectedType === "holds" ? "text-cyan-400" : "text-slate-100"}`}>
                💼 Cổ phiếu nắm giữ
              </span>
              <span className="watchlistPage__listItemCount text-xs bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5 text-slate-400 font-medium">
                {holdings.length} mã
              </span>
            </div>

            <div
              className={`watchlistPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded px-4 py-3 cursor-pointer transition-all hover:bg-cyan-500/5 hover:border-slate-700 ${
                selectedType === "tracked" ? "watchlistPage__listItem--active border-cyan-500 bg-cyan-500/10" : ""
              }`}
              onClick={() => {
                setSelectedType("tracked");
                setSelectedId(null);
                setErrorMsg("");
                setSuccessMsg("");
              }}
            >
              <span className={`watchlistPage__listItemName text-sm font-semibold ${selectedType === "tracked" ? "text-cyan-400" : "text-slate-100"}`}>
                🐋 Cảnh báo dòng tiền
              </span>
              <span className="watchlistPage__listItemCount text-xs bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5 text-slate-400 font-medium">
                {trackedSymbols.length} mã
              </span>
            </div>

            {watchlists.map(wl => {
              const isEditing = editingWlId === wl.id;
              const isActive = selectedType === "watchlist" && selectedId === wl.id;

              return (
                <div
                  key={wl.id}
                  className={`watchlistPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded px-4 py-3 cursor-pointer transition-all hover:bg-cyan-500/5 hover:border-slate-700 ${
                    isActive ? "watchlistPage__listItem--active border-cyan-500 bg-cyan-500/10" : ""
                  }`}
                  onClick={() => {
                    if (!isEditing) {
                      setSelectedType("watchlist");
                      setSelectedId(wl.id);
                      setErrorMsg("");
                      setSuccessMsg("");
                    }
                  }}
                >
                  {isEditing ? (
                    <input
                      className="watchlistPage__input w-full px-2 py-1 text-sm m-0 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      value={editingWlName}
                      onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setEditingWlName(ev.target.value)}
                      onKeyDown={(ev: React.KeyboardEvent) => {
                        if (ev.key === "Enter") handleRenameWatchlist(wl.id);
                        else if (ev.key === "Escape") setEditingWlId(null);
                      }}
                      autoFocus
                      onClick={ev => ev.stopPropagation()}
                      onBlur={() => handleRenameWatchlist(wl.id)}
                    />
                  ) : (
                    <span className={`watchlistPage__listItemName text-sm font-semibold ${isActive ? "text-cyan-400" : "text-slate-100"}`}>
                      📁 {wl.name}
                    </span>
                  )}

                  {!isEditing && (
                    <div
                      className="watchlistPage__itemActions flex gap-2 items-center"
                      onClick={ev => ev.stopPropagation()}
                    >
                      <span
                        className="cursor-pointer text-xs opacity-70 hover:opacity-100 transition-opacity"
                        title="Đổi tên"
                        onClick={() => {
                          setEditingWlId(wl.id);
                          setEditingWlName(wl.name);
                        }}
                      >
                        ✏️
                      </span>
                      <span
                        className="cursor-pointer text-xs opacity-70 hover:opacity-100 transition-opacity"
                        title="Xóa danh sách"
                        onClick={() => handleDeleteWatchlist(wl.id, wl.name)}
                      >
                        🗑️
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form className="watchlistPage__sidebarAction flex flex-col gap-2 mb-4" onSubmit={handleCreateWatchlist}>
            <input
              className="watchlistPage__input w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="Tên danh sách mới..."
              value={newListName}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setNewListName(ev.target.value)}
            />
            <Button type="submit" variant="secondary" className="w-full text-slate-100 font-bold bg-slate-800 hover:bg-slate-700">
              Tạo danh sách
            </Button>
          </form>

          <h2 className="watchlistPage__sidebarTitle text-lg font-bold text-slate-100 border-b border-slate-800 pb-3 mb-1 tracking-tight">
            Thị trường & Chỉ số
          </h2>
          
          <div className="watchlistPage__list flex flex-col gap-2">
            {legacyGroups.map(group => {
              const symbolsList = (group.items || []).map(item => item.symbol);
              const counters = getGroupCounters(symbolsList);
              const showUpDown = counters.up > 0 || counters.down > 0;
              const isGroupActive = selectedType === "group" && selectedId === group.id;

              return (
                <div
                  key={group.id}
                  className={`watchlistPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded px-4 py-3 cursor-pointer transition-all hover:bg-cyan-500/5 hover:border-slate-700 ${
                    isGroupActive ? "watchlistPage__listItem--active border-cyan-500 bg-cyan-500/10" : ""
                  }`}
                  onClick={() => {
                    setSelectedType("group");
                    setSelectedId(group.id);
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={`watchlistPage__listItemName text-sm font-semibold ${isGroupActive ? "text-cyan-400" : "text-slate-100"}`}>
                      🌐 {group.name}
                    </span>
                    {showUpDown && (
                      <span className="text-xs text-slate-400 mt-0.5 font-mono">
                        <span className="text-emerald-400 font-semibold">▲{counters.up}</span>{" "}
                        <span className="text-rose-400 font-semibold">▼{counters.down}</span>
                      </span>
                    )}
                  </div>
                  <span className="watchlistPage__listItemCount text-xs bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5 text-slate-400 font-medium">
                    {counters.total} mã
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="watchlistPage__mainCard flex flex-col gap-6 p-7 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-lg h-full overflow-y-auto box-border">
          <div className="watchlistPage__header flex justify-between items-start gap-4 flex-wrap">
            <div className="watchlistPage__titleGroup flex flex-col gap-1">
              <h1 className="watchlistPage__title text-2xl font-bold text-slate-100 tracking-tight">{getActiveTitle()}</h1>
              <p className="watchlistPage__description text-sm text-slate-400 mt-1">{getActiveDescription()}</p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              <span className="watchlistPage__syncBadge flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900 text-xs font-mono text-cyan-400 font-medium">
                <span
                  className={`shellPage__statusDot w-2 h-2 rounded-full inline-block ${
                    realtimeFeed?.realtimeStatus === "live" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                Realtime: {realtimeFeed?.realtimeStatus === "live" ? "Live" : "Sync"} | Sync: {formatTime(lastSyncTime)}
              </span>
              
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                  onClick={() => setSyncDialogOpen(true)}
                  disabled={syncingStockProfile}
                >
                  {syncingStockProfile ? "Đang đồng bộ..." : "Tự động lấy mã"}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                  onClick={handleSyncPrices}
                >
                  Đồng bộ giá
                </Button>
              )}
            </div>
          </div>

          {selectedType === "watchlist" && (
            <div className="watchlistPage__tabs flex gap-3 border-b border-slate-800 pb-3">
              <button
                className={`watchlistPage__tabBtn px-4 py-2 text-sm font-semibold rounded-full border transition-all ${
                  activeTab === "table"
                    ? "watchlistPage__tabBtn--active border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-slate-900/10"
                }`}
                onClick={() => setActiveTab("table")}
              >
                Bảng giá
              </button>
              <button
                className={`watchlistPage__tabBtn px-4 py-2 text-sm font-semibold rounded-full border transition-all ${
                  activeTab === "manage"
                    ? "watchlistPage__tabBtn--active border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-slate-900/10"
                }`}
                onClick={() => setActiveTab("manage")}
              >
                Quản lý mã
              </button>
              <button
                className={`watchlistPage__tabBtn px-4 py-2 text-sm font-semibold rounded-full border transition-all ${
                  activeTab === "alerts"
                    ? "watchlistPage__tabBtn--active border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-slate-900/10"
                }`}
                onClick={() => setActiveTab("alerts")}
              >
                Cảnh báo giá
              </button>
            </div>
          )}

          {selectedType === "tracked" && (
            <form
              className="watchlistPage__form flex gap-3 items-center mb-4 flex-wrap p-4 bg-slate-900/30 rounded-lg border border-slate-800"
              onSubmit={handleAddTrackedSymbol}
            >
              <span className="text-sm font-bold text-slate-200">Thêm mã giám sát:</span>
              <input
                className="watchlistPage__input w-36 uppercase px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Mã CP (vd: HPG)"
                value={newTrackedSymbol}
                onChange={ev => setNewTrackedSymbol(ev.target.value.toUpperCase())}
              />
              <input
                type="number"
                className="watchlistPage__input w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Ngưỡng cảnh báo (Tr.đ)"
                value={newTrackedThreshold}
                onChange={ev => setNewTrackedThreshold(ev.target.value)}
              />
              <Button type="submit" size="sm" className="bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 h-9 px-4">
                Thêm theo dõi
              </Button>
            </form>
          )}

          {(selectedType !== "watchlist" || activeTab === "table") && (
            <div className="shellPage__stack flex flex-col gap-4">
              <div className="watchlistPage__controls flex justify-between items-center gap-4 flex-wrap">
                <div className="text-slate-400 text-sm">Đang hiển thị {activeItems.length} mã chứng khoán.</div>
                
                <div className="watchlistPage__densityToggle inline-flex bg-slate-950/50 p-1 border border-slate-800 rounded-full">
                  <button
                    className={`watchlistPage__densityBtn px-3.5 py-1.5 text-xs font-semibold rounded-full border-none cursor-pointer transition-all ${
                      density === "compact" ? "watchlistPage__densityBtn--active bg-slate-800 text-cyan-400 shadow-lg" : "text-slate-400"
                    }`}
                    onClick={() => setDensity("compact")}
                  >
                    Compact
                  </button>
                  <button
                    className={`watchlistPage__densityBtn px-3.5 py-1.5 text-xs font-semibold rounded-full border-none cursor-pointer transition-all ${
                      density === "comfortable" ? "watchlistPage__densityBtn--active bg-slate-800 text-cyan-400 shadow-lg" : "text-slate-400"
                    }`}
                    onClick={() => setDensity("comfortable")}
                  >
                    Comfortable
                  </button>
                </div>
              </div>

              {activeItems.length === 0 ? (
                <div className="watchlistPage__emptyState flex flex-col items-center justify-center py-12 px-6 gap-3 text-slate-400 text-center">
                  <span className="watchlistPage__emptyIcon text-4xl opacity-30">💼</span>
                  <p className="text-sm">Chưa có mã nào trong danh sách hiện tại.</p>
                  {selectedType === "watchlist" && (
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("manage")}>
                      Thêm mã ngay
                    </Button>
                  )}
                </div>
              ) : (
                <div className="watchlistPage__tableWrapper overflow-x-auto border border-slate-800 rounded bg-slate-950/20 w-full">
                  <table className={`watchlistPage__table w-full border-collapse text-left ${density === "compact" ? "watchlistPage__table--compact" : ""}`}>
                    <thead>
                      {renderTableHeader()}
                    </thead>
                    <tbody>
                      {renderTableBody()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedType === "watchlist" && activeTab === "manage" && (
            <div className="shellPage__stack flex flex-col gap-4">
              <h3 className="shellPage__itemTitle text-md font-bold text-slate-200">Quản lý danh sách</h3>
              
              <form className="watchlistPage__form flex gap-2 items-center flex-wrap" onSubmit={handleAddSymbol}>
                <input
                  className="watchlistPage__input w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  placeholder="Mã (Ví dụ: HPG)..."
                  value={newSymbol}
                  onChange={ev => setNewSymbol(ev.target.value)}
                />
                <input
                  className="watchlistPage__input w-72 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  placeholder="Ghi chú nhanh..."
                  value={newSymbolNote}
                  onChange={ev => setNewSymbolNote(ev.target.value)}
                />
                <Button type="submit" size="sm">Thêm vào danh sách</Button>
              </form>

              <div className="shellPage__list flex flex-col gap-3 mt-4 w-full">
                {items.length === 0 ? (
                  <div className="shellPage__empty text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded bg-slate-950/20">
                    Chưa có mã chứng khoán nào trong danh sách này.
                  </div>
                ) : (
                  items.map(item => (
                    <article className="shellPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded p-4 hover:border-slate-700" key={item.id}>
                      <div className="flex flex-col">
                        <h4 className="shellPage__itemTitle font-mono font-bold text-slate-200 m-0">{item.symbol}</h4>
                        {item.note && <p className="shellPage__itemMeta text-xs text-slate-400 mt-1 m-0">{item.note}</p>}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveSymbol(item.symbol)}
                      >
                        Xóa
                      </Button>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedType === "watchlist" && activeTab === "alerts" && (
            <div className="shellPage__stack flex flex-col gap-4">
              <h3 className="shellPage__itemTitle text-md font-bold text-slate-200">Thiết lập Cảnh báo giá</h3>
              
              <form className="watchlistPage__form flex gap-2 items-center flex-wrap" onSubmit={handleCreateAlert}>
                <input
                  className="watchlistPage__input w-36 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  placeholder="Mã (Ví dụ: SSI)..."
                  value={newAlertSymbol}
                  onChange={ev => setNewAlertSymbol(ev.target.value)}
                />
                <select
                  className="watchlistPage__select w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  value={newAlertCondition}
                  onChange={ev => setNewAlertCondition(ev.target.value as "ABOVE" | "BELOW" | "EQUAL")}
                >
                  <option value="ABOVE">Giá vượt quá (&gt;=)</option>
                  <option value="BELOW">Giá giảm dưới (&lt;=)</option>
                  <option value="EQUAL">Bằng giá (=)</option>
                </select>
                <input
                  className="watchlistPage__input w-44 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  placeholder="Mức giá cảnh báo..."
                  value={newAlertPrice}
                  onChange={ev => setNewAlertPrice(ev.target.value)}
                />
                <input
                  className="watchlistPage__input w-44 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 text-sm focus:outline-none"
                  placeholder="Cooldown (giây, vd: 300)..."
                  value={newAlertCooldown}
                  onChange={ev => setNewAlertCooldown(ev.target.value)}
                />
                <Button type="submit" size="sm">Tạo cảnh báo</Button>
              </form>

              <div className="shellPage__list flex flex-col gap-3 mt-4 w-full">
                {priceAlerts.length === 0 ? (
                  <div className="shellPage__empty text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded bg-slate-950/20">
                    Chưa thiết lập cảnh báo giá nào.
                  </div>
                ) : (
                  priceAlerts.map(alert => {
                    const merged = getMergedData(alert.symbol);
                    const currentPrice = merged.price || alert.current_price;
                    const typeLabel = alert.condition === "ABOVE" ? ">=" : alert.condition === "BELOW" ? "<=" : "=";

                    return (
                      <article className="shellPage__listItem flex justify-between items-center bg-slate-950/20 border border-slate-800 rounded p-4 hover:border-slate-700" key={alert.id}>
                        <div className="flex flex-col">
                          <h4 className="shellPage__itemTitle font-mono font-bold text-slate-200 m-0">
                            {alert.symbol} {typeLabel} {Number(alert.target_price).toLocaleString()} VNĐ
                          </h4>
                          <p className="shellPage__itemMeta text-xs text-slate-400 mt-1 m-0">
                            Giá hiện tại: {currentPrice ? Number(currentPrice).toLocaleString() : "—"} | Trạng thái:{" "}
                            <span className={alert.is_active ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                              {alert.is_active ? "Đang hoạt động" : "Triggered/Vô hiệu"}
                            </span>
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteAlert(alert.id)}
                        >
                          Xóa
                        </Button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Dialog replacement for window.confirm */}
      <Dialog open={confirmState.isOpen} onOpenChange={open => setConfirmState(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-slate-100 shadow-xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100 font-bold text-lg">{confirmState.title}</DialogTitle>
            <DialogDescription className="text-slate-400 mt-2 text-sm">
              {confirmState.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-100 h-9 px-4 text-xs font-semibold"
              onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-500 text-slate-50 h-9 px-4 text-xs font-semibold"
              onClick={async () => {
                await confirmState.onConfirm();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Stock Profile Dialog replacement for window.prompt */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-slate-900 border-slate-800 text-slate-100 shadow-xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100 font-bold text-lg">ĐỒNG BỘ MÃ CHỨNG KHOÁN</DialogTitle>
            <DialogDescription className="text-slate-400 mt-2 text-sm">
              Chọn phạm vi đồng bộ mã chứng khoán từ nguồn dữ liệu sàn giao dịch. (Chỉ dành cho Quản trị viên)
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4 text-sm text-slate-300">
            <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-950/40 border border-slate-800 rounded hover:border-cyan-500/50 transition-all">
              <input
                type="radio"
                name="syncMode"
                value="active"
                className="mt-1 accent-cyan-500"
                checked={syncMode === "active"}
                onChange={() => setSyncMode("active")}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                  Chỉ mã đang hoạt động <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded font-mono">Khuyến nghị</span>
                </span>
                <span className="text-xs text-slate-400 mt-1">Đồng bộ khoảng 1,300 mã đang có giao dịch phát sinh. Tối ưu thời gian xử lý.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-950/40 border border-slate-800 rounded hover:border-cyan-500/50 transition-all">
              <input
                type="radio"
                name="syncMode"
                value="all"
                className="mt-1 accent-cyan-500"
                checked={syncMode === "all"}
                onChange={() => setSyncMode("all")}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100">Toàn bộ mã thị trường</span>
                <span className="text-xs text-slate-400 mt-1">Đồng bộ khoảng 3,200 mã bao gồm cả chứng quyền (warrants), trái phiếu, mã đã ngừng giao dịch...</span>
              </div>
            </label>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-100 h-9 px-4 text-xs font-semibold"
              onClick={() => setSyncDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 h-9 px-4 text-xs font-semibold font-bold"
              onClick={() => executeSyncStockProfile(syncMode)}
            >
              Bắt đầu đồng bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WatchlistPage;
