import React, { createElement, useEffect, useRef, useState, useMemo } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";
import "./WatchlistPage.css";

const e: (...args: any[]) => any = createElement as any;
const api = coreApiAdapter as any;

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
  [key: string]: unknown;
}

interface Watchlist {
  id: string | number;
  name: string;
  description?: string;
  items?: WatchlistItem[];
  [key: string]: unknown;
}

interface LegacyGroup {
  id: string | number;
  name: string;
  items?: WatchlistItem[];
  [key: string]: unknown;
}

interface Holding {
  symbol: string;
  quantity?: number;
  avg_cost?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
  [key: string]: unknown;
}

interface TrackedSymbol {
  id?: string | number;
  symbol: string;
  whale_alert_threshold_million?: number;
  industry?: string;
  company_name?: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

interface Identity {
  is_staff?: boolean;
  is_superuser?: boolean;
  [key: string]: unknown;
}

interface Session {
  is_staff?: boolean;
  is_superuser?: boolean;
  principal?: {
    identity?: Identity;
  };
  [key: string]: unknown;
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

  return e("div", { style: { display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" } },
    e("input", {
      type: "number",
      className: "watchlistPage__input",
      style: { width: "80px", padding: "4px 8px", margin: 0, textAlign: "right" },
      value: val,
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setVal(Number(ev.target.value)),
      onKeyDown: (ev: React.KeyboardEvent) => {
        if (ev.key === "Enter") handleSave();
      },
      onBlur: handleSave,
    }),
    e("span", { style: { fontSize: "0.825rem", color: "var(--text-muted)" } }, "Tr.đ"),
    saving && e("span", { style: { fontSize: "0.825rem", color: "var(--text-warning)" } }, "⏳"),
    saved && e("span", { style: { fontSize: "0.825rem", color: "var(--text-success)" } }, "✓")
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

  const priceHistoryRef = useRef<Record<string, number[]>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const EXCLUDED_MARKET_GROUPS = useMemo(() => [
    "Ngân hàng", "Bất động sản", "Thép & Vật liệu", "Dầu khí", "Công nghệ", 
    "Bán lẻ & Tiêu dùng", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
  ], []);

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
      await api.updateWatchlist(id, { name: editingWlName.trim() });
      setSuccessMsg("Đã đổi tên danh sách thành công.");
      setEditingWlId(null);
      await loadAllLists(false);
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi khi đổi tên danh sách.");
    }
  };

  const handleDeleteWatchlist = async (id: string | number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa danh sách theo dõi "${name}"? Thao tác này sẽ xóa toàn bộ mã bên trong.`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.deleteWatchlist(id);
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
  };

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || selectedType !== "watchlist" || !selectedId) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newSymbol.trim().toUpperCase();
    try {
      await api.addWatchlistItem(selectedId, symbolUpper);
      setNewSymbol("");
      setNewSymbolNote("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách.`);
      await fetchItems(selectedId);
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    if (selectedType !== "watchlist" || !selectedId) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa mã ${symbol} khỏi danh sách theo dõi?`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.removeWatchlistItem(selectedId, symbol);
      setSuccessMsg(`Đã xóa mã ${symbol} thành công.`);
      await fetchItems(selectedId);
    } catch (err) {
      setErrorMsg((err as Error).message || `Lỗi khi xóa mã ${symbol}.`);
    }
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

  const handleRemoveTrackedSymbol = async (id: string | number, symbol: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ngừng giám sát cá mập đối với mã ${symbol}?`)) return;
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

  const handleDeleteAlert = async (id: string | number) => {
    if (!confirm("Bạn muốn xóa cảnh báo giá này?")) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.deletePriceAlert(id);
      setSuccessMsg("Đã xóa cảnh báo giá thành công.");
      fetchPriceAlertsList();
    } catch (err) {
      setErrorMsg((err as Error).message || "Lỗi xóa cảnh báo giá.");
    }
  };

  const handleSyncStockProfile = async () => {
    const inputMode = prompt(
      "ĐỒNG BỘ MÃ CHỨNG KHOÁN (Chỉ dành cho Quản trị viên)\n\n" +
      "- Nhấn OK (hoặc Enter) để chỉ đồng bộ ~1300 mã đang hoạt động (Khuyến nghị).\n" +
      "- Nhập 'ALL' để đồng bộ toàn bộ ~3200 mã (bao gồm cả mã không giao dịch/chứng quyền/bonds).\n\n" +
      "Chế độ chọn:", 
      "active"
    );
    if (inputMode === null) return;

    const mode = inputMode.trim().toLowerCase() === "all" ? "all" : "active";
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

  const getMergedData = (symbol: string): Record<string, unknown> => {
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
      return e("svg", { className: "watchlistPage__sparklineSvg", width: "90", height: "25", viewBox: "0 0 90 25" },
        e("path", { className: "watchlistPage__sparklinePath", d: path, stroke: color, strokeWidth: "1.5", fill: "none" })
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

    return e("svg", { className: "watchlistPage__sparklineSvg", width: "90", height: "25", viewBox: "0 0 90 25" },
      e("polyline", { stroke: color, strokeWidth: "1.5", fill: "none", points: points })
    );
  };

  const formatTime = (dateObj: Date) => {
    return dateObj.toTimeString().split(" ")[0];
  };

  const renderTableHeader = () => {
    if (selectedType === "holds") {
      return e("tr", null,
        e("th", null, "Mã"),
        e("th", null, "Giá hiện tại"),
        e("th", null, "% Thay đổi"),
        e("th", { className: "text-right" }, "Số lượng"),
        e("th", { className: "text-right" }, "Giá vốn TB"),
        e("th", { className: "text-right" }, "Giá trị TT"),
        e("th", { className: "text-right" }, "Lại / Lỗ"),
        e("th", { className: "text-right" }, "% Lãi / Lỗ"),
        e("th", { style: { textAlign: "center" } }, "Xu hướng")
      );
    } else if (selectedType === "tracked") {
      return e("tr", null,
        e("th", null, "Mã"),
        e("th", null, "Tên doanh nghiệp"),
        e("th", null, "Giá hiện tại"),
        e("th", null, "% Thay đổi"),
        e("th", { className: "text-right", style: { paddingRight: "30px" } }, "Ngưỡng giám sát dòng tiền"),
        e("th", { style: { textAlign: "center" } }, "Hành động"),
        e("th", { style: { textAlign: "center" } }, "Xu hướng")
      );
    } else if (selectedType === "watchlist") {
      return e("tr", null,
        e("th", null, "Mã"),
        e("th", null, "Giá hiện tại"),
        e("th", null, "% Thay đổi"),
        e("th", null, "RSI(14)"),
        e("th", null, "RVOL"),
        e("th", null, "% Cách MA20"),
        e("th", null, "Định hướng"),
        e("th", { style: { textAlign: "center" } }, "Hành động"),
        e("th", { style: { textAlign: "center" } }, "Xu hướng")
      );
    } else {
      return e("tr", null,
        e("th", null, "Mã"),
        e("th", null, "Tên doanh nghiệp"),
        e("th", null, "Giá hiện tại"),
        e("th", null, "% Thay đổi"),
        e("th", null, "RSI(14)"),
        e("th", null, "RVOL"),
        e("th", { style: { textAlign: "center" } }, "Hành động nhanh"),
        e("th", { style: { textAlign: "center" } }, "Xu hướng")
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

        return e("tr", { key: symbol },
          e("td", null, e("a", { className: "watchlistPage__symbolLink", href: `/stocks/${symbol}` }, symbol)),
          e("td", { className: `watchlistPage__priceCell ${flashClass} text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-white"}` },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          e("td", { className: `text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-gray"}` },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          e("td", { className: "text-mono text-white text-right" }, qty.toLocaleString()),
          e("td", { className: "text-mono text-white text-right" }, Math.round(avgCost).toLocaleString()),
          e("td", { className: "text-mono text-white text-right" }, Math.round(marketValue).toLocaleString()),
          e("td", { className: `text-mono text-right ${pnl > 0 ? "text-green" : pnl < 0 ? "text-red" : "text-gray"}` },
            pnl !== 0 ? `${pnl > 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}` : "0"
          ),
          e("td", { className: `text-mono text-right ${pnlPct > 0 ? "text-green" : pnlPct < 0 ? "text-red" : "text-gray"}` },
            pnlPct !== 0 ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "0.00%"
          ),
          e("td", { className: "watchlistPage__sparklineCell" }, renderSparkline(symbol))
        );

      } else if (selectedType === "tracked") {
        const t = item as TrackedSymbol;
        const industry = t.industry || "—";
        const companyName = t.company_name || "—";

        return e("tr", { key: symbol },
          e("td", null, e("a", { className: "watchlistPage__symbolLink", href: `/stocks/${symbol}` }, symbol)),
          e("td", null, e("div", { style: { display: "flex", flexDirection: "column" } },
            e("span", { style: { fontWeight: "bold" } }, companyName),
            e("span", { style: { fontSize: "0.8rem", color: "var(--text-muted)" } }, industry)
          )),
          e("td", { className: `watchlistPage__priceCell ${flashClass} text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-white"}` },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          e("td", { className: `text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-gray"}` },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          e("td", { style: { textAlign: "right", paddingRight: "30px" } },
            e(TrackedThresholdCell, { item: t, onUpdate: handleUpdateTrackedThreshold })
          ),
          e("td", { style: { textAlign: "center" } },
            e("button", {
              className: "watchlistPage__btn watchlistPage__btn--danger",
              style: { padding: "4px 8px", fontSize: "0.75rem" },
              onClick: () => handleRemoveTrackedSymbol(t.id!, symbol)
            }, "Ngừng giám sát")
          ),
          e("td", { className: "watchlistPage__sparklineCell" }, renderSparkline(symbol))
        );

      } else if (selectedType === "watchlist") {
        const rsiValue = merged.rsi_14 !== undefined && merged.rsi_14 !== null ? Number(merged.rsi_14).toFixed(1) : "—";
        const rvolValue = merged.rvol !== undefined && merged.rvol !== null ? Number(merged.rvol).toFixed(2) : "—";
        const ma20Dist = merged.ma20_distance_pct !== undefined && merged.ma20_distance_pct !== null ? `${Number(merged.ma20_distance_pct).toFixed(1)}%` : "—";

        return e("tr", { key: symbol },
          e("td", null, e("a", { className: "watchlistPage__symbolLink", href: `/stocks/${symbol}` }, symbol)),
          e("td", { className: `watchlistPage__priceCell ${flashClass} text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-white"}` },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          e("td", { className: `text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-gray"}` },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          e("td", { className: "text-mono text-white" }, rsiValue),
          e("td", { className: "text-mono text-white" }, rvolValue),
          e("td", { className: `text-mono ${Number(merged.ma20_distance_pct) >= 0 ? "text-green" : "text-red"}` }, ma20Dist),
          e("td", { className: "text-gray" }, merged.bias_label || "Trung tính"),
          e("td", { style: { textAlign: "center" } },
            e("button", {
              className: "watchlistPage__btn watchlistPage__btn--danger",
              style: { padding: "4px 8px", fontSize: "0.75rem" },
              onClick: () => handleRemoveSymbol(symbol)
            }, "Xóa")
          ),
          e("td", { className: "watchlistPage__sparklineCell" }, renderSparkline(symbol))
        );

      } else {
        const grpItem = item as WatchlistItem;
        const industry = merged.industry || grpItem.industry || "—";
        const companyName = merged.company_name || grpItem.company_name || "—";
        const rsiValue = merged.rsi_14 !== undefined && merged.rsi_14 !== null ? Number(merged.rsi_14).toFixed(1) : "—";
        const rvolValue = merged.rvol !== undefined && merged.rvol !== null ? Number(merged.rvol).toFixed(2) : "—";

        const isAlreadyTracked = trackedSymbols.some(t => t.symbol.toUpperCase() === symbol.toUpperCase());

        return e("tr", { key: symbol },
          e("td", null, e("a", { className: "watchlistPage__symbolLink", href: `/stocks/${symbol}` }, symbol)),
          e("td", null, e("div", { style: { display: "flex", flexDirection: "column" } },
            e("span", { style: { fontWeight: "bold" } }, companyName),
            e("span", { style: { fontSize: "0.8rem", color: "var(--text-muted)" } }, industry)
          )),
          e("td", { className: `watchlistPage__priceCell ${flashClass} text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-white"}` },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          e("td", { className: `text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-gray"}` },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          e("td", { className: "text-mono text-white" }, rsiValue),
          e("td", { className: "text-mono text-white" }, rvolValue),
          e("td", { style: { textAlign: "center" } },
            e("div", { style: { display: "flex", gap: "8px", justifyContent: "center" } },
              e("button", {
                className: "watchlistPage__btn watchlistPage__btn--secondary",
                style: { padding: "4px 8px", fontSize: "0.75rem" },
                onClick: () => handlePromoteToWatchlist(symbol)
              }, "⭐️ +Watchlist"),
              e("button", {
                className: `watchlistPage__btn ${isAlreadyTracked ? "watchlistPage__btn--secondary" : "watchlistPage__btn--primary"}`,
                style: { padding: "4px 8px", fontSize: "0.75rem" },
                onClick: () => handlePromoteToTracked(symbol),
                disabled: isAlreadyTracked
              }, isAlreadyTracked ? "🐋 Đang giám sát" : "🐋 +Giám sát")
            )
          ),
          e("td", { className: "watchlistPage__sparklineCell" }, renderSparkline(symbol))
        );
      }
    });
  };

  return e(
    "div",
    { className: "watchlistPage__container" },

    errorMsg && e("div", { className: "shellPage__notice shellPage__notice--error" }, errorMsg),
    successMsg && e("div", { className: "shellPage__notice shellPage__notice--success" }, successMsg),

    e(
      "div",
      { className: "watchlistPage__layout" },

      // Sidebar
      e(
        "aside",
        { className: "watchlistPage__sidebarCard" },

        e("h2", { className: "watchlistPage__sidebarTitle" }, "Danh mục của tôi"),
        e(
          "div",
          { className: "watchlistPage__list", style: { marginBottom: "1.25rem" } },

          e(
            "div",
            {
              className: `watchlistPage__listItem ${selectedType === "holds" ? "watchlistPage__listItem--active" : ""}`,
              onClick: () => {
                setSelectedType("holds");
                setSelectedId(null);
                setErrorMsg("");
                setSuccessMsg("");
              }
            },
            e("span", { className: "watchlistPage__listItemName" }, "💼 Cổ phiếu nắm giữ"),
            e("span", { className: "watchlistPage__listItemCount" }, `${holdings.length} mã`)
          ),

          e(
            "div",
            {
              className: `watchlistPage__listItem ${selectedType === "tracked" ? "watchlistPage__listItem--active" : ""}`,
              onClick: () => {
                setSelectedType("tracked");
                setSelectedId(null);
                setErrorMsg("");
                setSuccessMsg("");
              }
            },
            e("span", { className: "watchlistPage__listItemName" }, "🐋 Cảnh báo dòng tiền"),
            e("span", { className: "watchlistPage__listItemCount" }, `${trackedSymbols.length} mã`)
          ),

          watchlists.map(wl => {
            const isEditing = editingWlId === wl.id;
            const isActive = selectedType === "watchlist" && selectedId === wl.id;

            return e(
              "div",
              {
                key: wl.id,
                className: `watchlistPage__listItem ${isActive ? "watchlistPage__listItem--active" : ""}`,
                onClick: () => {
                  if (!isEditing) {
                    setSelectedType("watchlist");
                    setSelectedId(wl.id);
                    setErrorMsg("");
                    setSuccessMsg("");
                  }
                }
              },
              isEditing
                ? e("input", {
                    className: "watchlistPage__input",
                    style: { width: "100%", padding: "4px 8px", fontSize: "0.9rem", margin: 0 },
                    value: editingWlName,
                    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setEditingWlName(ev.target.value),
                    onKeyDown: (ev: React.KeyboardEvent) => {
                      if (ev.key === "Enter") handleRenameWatchlist(wl.id);
                      else if (ev.key === "Escape") setEditingWlId(null);
                    },
                    autoFocus: true,
                    onClick: (ev: React.MouseEvent) => ev.stopPropagation(),
                    onBlur: () => handleRenameWatchlist(wl.id),
                  })
                : e("span", { className: "watchlistPage__listItemName" }, `📁 ${wl.name}`),

              !isEditing && e("div", { 
                className: "watchlistPage__itemActions", 
                style: { display: "flex", gap: "8px", alignItems: "center" },
                onClick: (ev: React.MouseEvent) => ev.stopPropagation()
              },
                e("span", {
                  style: { cursor: "pointer", fontSize: "0.85rem", opacity: 0.7 },
                  title: "Đổi tên",
                  onClick: () => {
                    setEditingWlId(wl.id);
                    setEditingWlName(wl.name);
                  }
                }, "✏️"),
                e("span", {
                  style: { cursor: "pointer", fontSize: "0.85rem", opacity: 0.7 },
                  title: "Xóa danh sách",
                  onClick: () => handleDeleteWatchlist(wl.id, wl.name)
                }, "🗑️")
              )
            );
          })
        ),

        e(
          "form",
          { className: "watchlistPage__sidebarAction", style: { marginBottom: "1.5rem" }, onSubmit: handleCreateWatchlist },
          e("input", {
            className: "watchlistPage__input",
            style: { width: "100%", boxSizing: "border-box", marginBottom: "0.5rem" },
            placeholder: "Tên danh sách mới...",
            value: newListName,
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewListName(ev.target.value),
          }),
          e("button", { type: "submit", className: "watchlistPage__btn", style: { width: "100%" } }, "Tạo danh sách")
        ),

        e("h2", { className: "watchlistPage__sidebarTitle" }, "Thị trường & Chỉ số"),
        e(
          "div",
          { className: "watchlistPage__list" },
          legacyGroups.map(group => {
            const symbolsList = (group.items || []).map(item => item.symbol);
            const counters = getGroupCounters(symbolsList);
            const showUpDown = counters.up > 0 || counters.down > 0;

            return e(
              "div",
              {
                key: group.id,
                className: `watchlistPage__listItem ${selectedType === "group" && selectedId === group.id ? "watchlistPage__listItem--active" : ""}`,
                onClick: () => {
                  setSelectedType("group");
                  setSelectedId(group.id);
                  setErrorMsg("");
                  setSuccessMsg("");
                }
              },
              e(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                e("span", { className: "watchlistPage__listItemName" }, `🌐 ${group.name}`),
                showUpDown && e(
                  "span",
                  { style: { fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "2px" } },
                  `▲${counters.up}  ▼${counters.down}`
                )
              ),
              e("span", { className: "watchlistPage__listItemCount" }, `${counters.total} mã`)
            );
          })
        )
      ),

      // Main content
      e(
        "main",
        { className: "watchlistPage__mainCard" },

        e(
          "div",
          { className: "watchlistPage__header" },
          e(
            "div",
            { className: "watchlistPage__titleGroup" },
            e("h1", { className: "watchlistPage__title" }, getActiveTitle()),
            e("p", { className: "watchlistPage__description" }, getActiveDescription())
          ),
          e(
            "div",
            { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
            e(
              "span",
              { className: "watchlistPage__syncBadge" },
              e("span", {
                className: "shellPage__statusDot",
                style: {
                  backgroundColor: realtimeFeed?.realtimeStatus === "live" ? "#00FFBB" : "#f59e0b"
                }
              }),
              `Realtime: ${realtimeFeed?.realtimeStatus === "live" ? "Live" : "Sync"} | Sync: ${formatTime(lastSyncTime)}`
            ),
            isAdmin && e(
              "button",
              {
                className: "watchlistPage__btn watchlistPage__btn--secondary",
                onClick: handleSyncStockProfile,
                disabled: syncingStockProfile,
                style: { padding: "8px 16px", fontSize: "0.875rem" }
              },
              syncingStockProfile ? "Đang đồng bộ..." : "Tự động lấy mã"
            ),
            isAdmin && e(
              "button",
              {
                className: "watchlistPage__btn watchlistPage__btn--secondary",
                onClick: handleSyncPrices,
                style: { padding: "8px 16px", fontSize: "0.875rem" }
              },
              "Đồng bộ giá"
            )
          )
        ),

        selectedType === "watchlist" && e(
          "div",
          { className: "watchlistPage__tabs" },
          e(
            "button",
            {
              className: `watchlistPage__tabBtn ${activeTab === "table" ? "watchlistPage__tabBtn--active" : ""}`,
              onClick: () => setActiveTab("table")
            },
            "Bảng giá"
          ),
          e(
            "button",
            {
              className: `watchlistPage__tabBtn ${activeTab === "manage" ? "watchlistPage__tabBtn--active" : ""}`,
              onClick: () => setActiveTab("manage")
            },
            "Quản lý mã"
          ),
          e(
            "button",
            {
              className: `watchlistPage__tabBtn ${activeTab === "alerts" ? "watchlistPage__tabBtn--active" : ""}`,
              onClick: () => setActiveTab("alerts")
            },
            "Cảnh báo giá"
          )
        ),

        selectedType === "tracked" && e(
          "form",
          {
            className: "watchlistPage__form",
            style: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px", flexWrap: "wrap" },
            onSubmit: handleAddTrackedSymbol
          },
          e("span", { style: { fontWeight: "bold", fontSize: "0.9rem" } }, "Thêm mã giám sát:"),
          e("input", {
            className: "watchlistPage__input",
            style: { width: "120px", textTransform: "uppercase" },
            placeholder: "Mã CP (vd: HPG)",
            value: newTrackedSymbol,
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewTrackedSymbol(ev.target.value.toUpperCase()),
          }),
          e("input", {
            type: "number",
            className: "watchlistPage__input",
            style: { width: "180px" },
            placeholder: "Ngưỡng cảnh báo (Tr.đ)",
            value: newTrackedThreshold,
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewTrackedThreshold(ev.target.value),
          }),
          e("button", { type: "submit", className: "watchlistPage__btn" }, "Thêm theo dõi")
        ),

        (selectedType !== "watchlist" || activeTab === "table") && e(
          "div",
          { className: "shellPage__stack" },

          e(
            "div",
            { className: "watchlistPage__controls" },
            e("div", { className: "text-gray", style: { fontSize: "0.875rem" } }, `Đang hiển thị ${activeItems.length} mã chứng khoán.`),
            e(
              "div",
              { className: "watchlistPage__densityToggle" },
              e(
                "button",
                {
                  className: `watchlistPage__densityBtn ${density === "compact" ? "watchlistPage__densityBtn--active" : ""}`,
                  onClick: () => setDensity("compact")
                },
                "Compact"
              ),
              e(
                "button",
                {
                  className: `watchlistPage__densityBtn ${density === "comfortable" ? "watchlistPage__densityBtn--active" : ""}`,
                  onClick: () => setDensity("comfortable")
                },
                "Comfortable"
              )
            )
          ),

          activeItems.length === 0
            ? e(
                "div",
                { className: "watchlistPage__emptyState" },
                e("span", { className: "watchlistPage__emptyIcon" }, "💼"),
                e("p", null, "Chưa có mã nào trong danh sách hiện tại."),
                selectedType === "watchlist" && e("button", { className: "watchlistPage__btn", onClick: () => setActiveTab("manage") }, "Thêm mã ngay")
              )
            : e(
                "div",
                { className: "watchlistPage__tableWrapper" },
                e(
                  "table",
                  { className: `watchlistPage__table ${density === "compact" ? "watchlistPage__table--compact" : ""}` },
                  e("thead", null, renderTableHeader()),
                  e("tbody", null, renderTableBody())
                )
              )
        ),

        selectedType === "watchlist" && activeTab === "manage" && e(
          "div",
          { className: "shellPage__stack" },
          e("h3", { className: "shellPage__itemTitle" }, "Quản lý danh sách"),
          e(
            "form",
            { className: "watchlistPage__form", onSubmit: handleAddSymbol },
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Mã (Ví dụ: HPG)...",
              value: newSymbol,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewSymbol(ev.target.value),
            }),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Ghi chú nhanh...",
              value: newSymbolNote,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewSymbolNote(ev.target.value),
            }),
            e("button", { type: "submit", className: "watchlistPage__btn" }, "Thêm vào danh sách")
          ),

          e(
            "div",
            { className: "shellPage__list", style: { marginTop: "1rem" } },
            items.length === 0
              ? e("div", { className: "shellPage__empty" }, "Chưa có mã chứng khoán nào trong danh sách này.")
              : items.map(item => e(
                  "article",
                  { className: "shellPage__listItem", key: item.id },
                  e(
                    "div",
                    { className: "shellPage__listItemHeader", style: { display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" } },
                    e(
                      "div",
                      null,
                      e("h4", { className: "shellPage__itemTitle", style: { margin: 0, fontFamily: "monospace" } }, item.symbol),
                      item.note && e("p", { className: "shellPage__itemMeta", style: { margin: "4px 0 0 0" } }, item.note)
                    ),
                    e("button", {
                      type: "button",
                      className: "watchlistPage__btn watchlistPage__btn--danger",
                      onClick: () => handleRemoveSymbol(item.symbol)
                    }, "Xóa")
                  )
                ))
          )
        ),

        selectedType === "watchlist" && activeTab === "alerts" && e(
          "div",
          { className: "shellPage__stack" },
          e("h3", { className: "shellPage__itemTitle" }, "Thiết lập Cảnh báo giá"),
          e(
            "form",
            { className: "watchlistPage__form", onSubmit: handleCreateAlert },
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Mã (Ví dụ: SSI)...",
              value: newAlertSymbol,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewAlertSymbol(ev.target.value),
            }),
            e(
              "select",
              {
                className: "watchlistPage__select",
                value: newAlertCondition,
                onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => setNewAlertCondition(ev.target.value as "ABOVE" | "BELOW" | "EQUAL")
              },
              e("option", { value: "ABOVE" }, "Giá vượt quá (>=)"),
              e("option", { value: "BELOW" }, "Giá giảm dưới (<=)"),
              e("option", { value: "EQUAL" }, "Bằng giá (=)")
            ),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Mức giá cảnh báo...",
              value: newAlertPrice,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewAlertPrice(ev.target.value),
            }),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Cooldown (giây, vd: 300)...",
              value: newAlertCooldown,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewAlertCooldown(ev.target.value),
            }),
            e("button", { type: "submit", className: "watchlistPage__btn" }, "Tạo cảnh báo")
          ),

          e(
            "div",
            { className: "shellPage__list", style: { marginTop: "1rem" } },
            priceAlerts.length === 0
              ? e("div", { className: "shellPage__empty" }, "Chưa thiết lập cảnh báo giá nào.")
              : priceAlerts.map(alert => {
                  const merged = getMergedData(alert.symbol);
                  const currentPrice = merged.price || alert.current_price;
                  const typeLabel = alert.condition === "ABOVE" ? ">=" : alert.condition === "BELOW" ? "<=" : "=";

                  return e(
                    "article",
                    { className: "shellPage__listItem", key: alert.id },
                    e(
                      "div",
                      { className: "shellPage__listItemHeader", style: { display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" } },
                      e(
                        "div",
                        null,
                        e("h4", { className: "shellPage__itemTitle", style: { margin: 0, fontFamily: "monospace" } }, `${alert.symbol} ${typeLabel} ${Number(alert.target_price).toLocaleString()} VNĐ`),
                        e(
                          "p",
                          { className: "shellPage__itemMeta", style: { margin: "4px 0 0 0" } },
                          `Giá hiện tại: ${currentPrice ? Number(currentPrice).toLocaleString() : "—"} | Trạng thái: ${alert.is_active ? "Đang hoạt động" : "Triggered/Vô hiệu"}`
                        )
                      ),
                      e("button", {
                        type: "button",
                        className: "watchlistPage__btn watchlistPage__btn--danger",
                        onClick: () => handleDeleteAlert(alert.id)
                      }, "Xóa")
                    )
                  );
                })
          )
        )
      )
    )
  );
}
export default WatchlistPage;
