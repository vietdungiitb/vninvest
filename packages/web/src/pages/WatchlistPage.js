import { createElement, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";
import "./WatchlistPage.css";

const e = createElement;

// Helper component for tracked threshold editing inline
function TrackedThresholdCell({ item, onUpdate }) {
  const [val, setVal] = useState(item.whale_alert_threshold_million);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync val if prop changes from outside
  useEffect(() => {
    setVal(item.whale_alert_threshold_million);
  }, [item.whale_alert_threshold_million]);

  const handleSave = async () => {
    const numVal = Number(val);
    if (isNaN(numVal) || numVal <= 0) return;
    if (numVal === item.whale_alert_threshold_million) return;
    setSaving(true);
    try {
      await onUpdate(item.id, numVal);
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
      onChange: (e) => setVal(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") handleSave();
      },
      onBlur: handleSave,
    }),
    e("span", { style: { fontSize: "0.825rem", color: "var(--text-muted)" } }, "Tr.đ"),
    saving && e("span", { style: { fontSize: "0.825rem", color: "var(--text-warning)" } }, "⏳"),
    saved && e("span", { style: { fontSize: "0.825rem", color: "var(--text-success)" } }, "✓")
  );
}

export function WatchlistPage({
  env = {},
  autoLoad = true,
  t = (key, defaultVal) => defaultVal,
  identity = {},
  session = {},
}) {
  const isAdmin = Boolean(
    identity?.is_staff || 
    identity?.is_superuser || 
    session?.is_staff || 
    session?.is_superuser || 
    session?.principal?.identity?.is_staff ||
    session?.principal?.identity?.is_superuser
  );

  // ────────────────────────────────────────────────────────────────────────────
  // State variables
  // ────────────────────────────────────────────────────────────────────────────
  const [watchlists, setWatchlists] = useState([]);
  const [legacyGroups, setLegacyGroups] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  
  // Selection state: "holds" | "tracked" | "watchlist" | "group"
  const [selectedType, setSelectedType] = useState("watchlist");
  const [selectedId, setSelectedId] = useState(null);
  
  // Watchlist items & indicators map
  const [items, setItems] = useState([]);
  const [technicalsMap, setTechnicalsMap] = useState({});
  const [priceFlashMap, setPriceFlashMap] = useState({}); // symbol -> "up" | "down"
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  
  // Tabs & Layout
  const [activeTab, setActiveTab] = useState("table"); // "table" | "manage" | "alerts"
  const [density, setDensity] = useState("compact"); // "compact" | "comfortable"
  
  // Feedback states
  const [loading, setLoading] = useState(false);
  const [syncingStockProfile, setSyncingStockProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Form states
  const [newListName, setNewListName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newSymbolNote, setNewSymbolNote] = useState("");
  
  // Tracked Add form states
  const [newTrackedSymbol, setNewTrackedSymbol] = useState("");
  const [newTrackedThreshold, setNewTrackedThreshold] = useState("1000");
  
  // Rename Watchlist states
  const [editingWlId, setEditingWlId] = useState(null);
  const [editingWlName, setEditingWlName] = useState("");
  
  // Price Alerts states
  const [newAlertSymbol, setNewAlertSymbol] = useState("");
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [newAlertCondition, setNewAlertCondition] = useState("ABOVE"); // ABOVE | BELOW | EQUAL
  const [newAlertCooldown, setNewAlertCooldown] = useState("300");

  // Sparkline price history ref (symbol -> array of past prices, max 20)
  const priceHistoryRef = useRef({});
  const prevPricesRef = useRef({});
  const flashTimeoutRefs = useRef({});

  // System default group names to exclude from custom personal watchlists
  const EXCLUDED_MARKET_GROUPS = useMemo(() => [
    "Ngân hàng", "Bất động sản", "Thép & Vật liệu", "Dầu khí", "Công nghệ", 
    "Bán lẻ & Tiêu dùng", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
  ], []);

  // ────────────────────────────────────────────────────────────────────────────
  // Data Fetching Methods
  // ────────────────────────────────────────────────────────────────────────────
  
  // Fetch everything needed for the sidebar & lists
  const loadAllLists = async (selectFirst = false) => {
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Fetch personal watchlists
      let wlList = [];
      try {
        const res = await coreApiAdapter.getWatchlists();
        wlList = Array.isArray(res) ? res : (res?.results ?? []);
        // Filter out system default groups from custom watchlists list
        wlList = wlList.filter(wl => !EXCLUDED_MARKET_GROUPS.includes(wl.name));
      } catch (err) {
        console.warn("Lỗi tải watchlists:", err.message);
      }
      setWatchlists(wlList);

      // 2. Fetch system default groups
      let groupsList = [];
      try {
        const res = await coreApiAdapter.getLegacyWatchlistGroups();
        groupsList = Array.isArray(res) ? res : (res?.results ?? []);
      } catch (err) {
        console.warn("Lỗi tải groups:", err.message);
      }
      setLegacyGroups(groupsList);

      // 3. Fetch portfolio & holdings
      let holdingsList = [];
      try {
        const portfoliosRes = await coreApiAdapter.getPortfolios();
        const portfolios = Array.isArray(portfoliosRes) ? portfoliosRes : (portfoliosRes?.results ?? []);
        if (portfolios.length > 0) {
          const holdingsRes = await coreApiAdapter.getPortfolioHoldings(portfolios[0].id);
          holdingsList = Array.isArray(holdingsRes) ? holdingsRes : (holdingsRes?.results ?? []);
        }
      } catch (err) {
        console.warn("Lỗi tải holdings:", err.message);
      }
      setHoldings(holdingsList);

      // 4. Fetch tracked symbols
      let trackedList = [];
      try {
        const trackedRes = await coreApiAdapter.getTrackedSymbols();
        trackedList = Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []);
      } catch (err) {
        console.warn("Lỗi tải tracked symbols:", err.message);
      }
      setTrackedSymbols(trackedList);

      // 5. Determine initial selection if needed
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
          // Fallback: create default watchlist
          try {
            const newWl = await coreApiAdapter.createWatchlist({
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
      setErrorMsg(err.message || "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch items for selected personal watchlist
  const fetchItems = async (watchlistId) => {
    if (!watchlistId) return;
    try {
      const res = await coreApiAdapter.getWatchlistItems(watchlistId);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setItems(list);
      setLastSyncTime(new Date());
    } catch (err) {
      setErrorMsg(err.message || "Không thể tải danh sách mã.");
    }
  };

  // Fetch price alerts list
  const fetchPriceAlertsList = async () => {
    try {
      const res = await coreApiAdapter.getPriceAlerts();
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setPriceAlerts(list);
    } catch (err) {
      console.warn("Lỗi tải cảnh báo giá:", err.message);
    }
  };

  // Fetch bulk technical indicators
  const fetchTechnicals = async (symbolsList) => {
    if (!symbolsList || symbolsList.length === 0) return;
    try {
      const res = await coreApiAdapter.getBulkTechnicalsBySymbols(symbolsList);
      const data = Array.isArray(res) ? res : (res?.results ?? res?.technicals ?? []);
      
      const newMap = {};
      data.forEach(tData => {
        newMap[tData.symbol] = tData;
      });
      setTechnicalsMap(prev => ({ ...prev, ...newMap }));
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Lỗi tải chỉ báo kỹ thuật gộp:", err.message);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle Effects
  // ────────────────────────────────────────────────────────────────────────────
  
  // Initial load
  useEffect(() => {
    if (autoLoad) {
      loadAllLists(true);
      fetchPriceAlertsList();
    }
  }, [autoLoad]);

  // Load items when selected personal watchlist changes
  useEffect(() => {
    if (selectedType === "watchlist" && selectedId) {
      fetchItems(selectedId);
    }
  }, [selectedType, selectedId]);

  // Compute active symbols to display in grid
  const activeItems = useMemo(() => {
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

  // Fetch technicals when active items change
  useEffect(() => {
    const list = activeItems.map(item => item.symbol).filter(Boolean);
    if (list.length > 0) {
      fetchTechnicals(list);
    }
  }, [activeItems]);

  // ────────────────────────────────────────────────────────────────────────────
  // Realtime Integration using useRealtimeFeedFromManager
  // ────────────────────────────────────────────────────────────────────────────
  
  // Compute only display symbols + background alert symbols to register with manager
  const allSymbols = useMemo(() => {
    const symbolsSet = new Set();
    
    activeItems.forEach(item => {
      if (item.symbol) symbolsSet.add(item.symbol.toUpperCase());
    });
    
    priceAlerts.forEach(alert => {
      if (alert.symbol) symbolsSet.add(alert.symbol.toUpperCase());
    });
    
    return Array.from(symbolsSet).slice(0, 120);
  }, [activeItems, priceAlerts]);

  // Register with realtime feed
  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: allSymbols,
    pollInterval: 10000,
  });

  // Track price history for sparklines & flash triggers
  useEffect(() => {
    if (!realtimeFeed?.quotesBySymbol) return;
    
    Object.entries(realtimeFeed.quotesBySymbol).forEach(([symbol, quote]) => {
      const price = Number(quote.current_price ?? quote.price);
      if (!Number.isFinite(price) || price <= 0) return;
      
      // Update price history ring buffer (max 20 ticks) for sparkline
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

      // Trigger flash glow animations if price changed
      const prevPrice = prevPricesRef.current[symbol];
      if (prevPrice !== undefined && price !== prevPrice) {
        const dir = price > prevPrice ? "up" : "down";
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

  // Cleanup flash timeouts
  useEffect(() => {
    return () => {
      Object.values(flashTimeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Action Handlers
  // ────────────────────────────────────────────────────────────────────────────
  
  const handleCreateWatchlist = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const wl = await coreApiAdapter.createWatchlist({
        name: newListName.trim(),
        description: "Danh sách watchlist tùy chỉnh của tôi.",
      });
      setNewListName("");
      setSuccessMsg("Đã tạo danh sách theo dõi thành công.");
      await loadAllLists(false);
      setSelectedType("watchlist");
      setSelectedId(wl.id);
    } catch (err) {
      setErrorMsg(err.message || "Không thể tạo watchlist mới.");
    }
  };

  const handleRenameWatchlist = async (id) => {
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
      await coreApiAdapter.updateWatchlist(id, { name: editingWlName.trim() });
      setSuccessMsg(`Đã đổi tên danh sách thành công.`);
      setEditingWlId(null);
      await loadAllLists(false);
    } catch (err) {
      setErrorMsg(err.message || "Lỗi khi đổi tên danh sách.");
    }
  };

  const handleDeleteWatchlist = async (id, name) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa danh sách theo dõi "${name}"? Thao tác này sẽ xóa toàn bộ mã bên trong.`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await coreApiAdapter.deleteWatchlist(id);
      setSuccessMsg(`Đã xóa danh sách "${name}" thành công.`);
      const activeAfterDelete = watchlists.filter(w => w.id !== id);
      await loadAllLists(false);
      
      // Update selection if the deleted one was active
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
      setErrorMsg(err.message || "Lỗi khi xóa danh sách.");
    }
  };

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim() || selectedType !== "watchlist" || !selectedId) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newSymbol.trim().toUpperCase();
    try {
      await coreApiAdapter.addWatchlistItem(selectedId, symbolUpper);
      setNewSymbol("");
      setNewSymbolNote("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách.`);
      await fetchItems(selectedId);
    } catch (err) {
      setErrorMsg(err.message || `Lỗi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    if (selectedType !== "watchlist" || !selectedId) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa mã ${symbol} khỏi danh sách theo dõi?`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await coreApiAdapter.removeWatchlistItem(selectedId, symbol);
      setSuccessMsg(`Đã xóa mã ${symbol} thành công.`);
      await fetchItems(selectedId);
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi xóa mã ${symbol}.`);
    }
  };

  const handleAddTrackedSymbol = async (e) => {
    e.preventDefault();
    if (!newTrackedSymbol.trim() || !newTrackedThreshold.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newTrackedSymbol.trim().toUpperCase();
    try {
      await coreApiAdapter.addTrackedSymbol(symbolUpper, null, Number(newTrackedThreshold));
      setNewTrackedSymbol("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách giám sát.`);
      const trackedRes = await coreApiAdapter.getTrackedSymbols();
      setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveTrackedSymbol = async (id, symbol) => {
    if (!confirm(`Bạn có chắc chắn muốn ngừng giám sát cá mập đối với mã ${symbol}?`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await coreApiAdapter.removeTrackedSymbol(id);
      setSuccessMsg(`Đã dừng giám sát mã ${symbol} thành công.`);
      const trackedRes = await coreApiAdapter.getTrackedSymbols();
      setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi xóa mã ${symbol}.`);
    }
  };

  const handleUpdateTrackedThreshold = async (id, threshold) => {
    try {
      await coreApiAdapter.updateTrackedSymbol(id, threshold);
      setTrackedSymbols(prev => prev.map(item => item.id === id ? { ...item, whale_alert_threshold_million: threshold } : item));
      setSuccessMsg("Đã cập nhật ngưỡng cảnh báo cá mập.");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err) {
      setErrorMsg(err.message || "Lỗi cập nhật ngưỡng.");
    }
  };

  const handlePromoteToWatchlist = async (symbol) => {
    if (watchlists.length === 0) {
      setErrorMsg("Không tìm thấy watchlist cá nhân nào để thêm vào. Vui lòng tạo danh sách trước.");
      return;
    }
    const targetWl = watchlists[0];
    try {
      await coreApiAdapter.addWatchlistItem(targetWl.id, symbol);
      setSuccessMsg(`Đã thêm mã ${symbol} vào danh sách "${targetWl.name}".`);
      setTimeout(() => setSuccessMsg(""), 3000);
      if (selectedType === "watchlist" && selectedId === targetWl.id) {
        fetchItems(targetWl.id);
      }
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi thêm mã ${symbol} vào danh sách.`);
    }
  };

  const handlePromoteToTracked = async (symbol) => {
    try {
      const isAlreadyTracked = trackedSymbols.some(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      if (isAlreadyTracked) return;
      await coreApiAdapter.addTrackedSymbol(symbol, null, 1000);
      setSuccessMsg(`Đã thêm mã ${symbol} vào danh sách giám sát cá mập (Ngưỡng mặc định 1,000 Tr.đ).`);
      setTimeout(() => setSuccessMsg(""), 3000);
      
      const trackedRes = await coreApiAdapter.getTrackedSymbols();
      setTrackedSymbols(Array.isArray(trackedRes) ? trackedRes : (trackedRes?.results ?? []));
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi thêm mã ${symbol} vào danh sách giám sát.`);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!newAlertSymbol.trim() || !newAlertPrice.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newAlertSymbol.trim().toUpperCase();
    try {
      await coreApiAdapter.createPriceAlert({
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
      setErrorMsg(err.message || "Lỗi tạo cảnh báo giá.");
    }
  };

  const handleDeleteAlert = async (id) => {
    if (!confirm("Bạn muốn xóa cảnh báo giá này?")) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await coreApiAdapter.deletePriceAlert(id);
      setSuccessMsg("Đã xóa cảnh báo giá thành công.");
      fetchPriceAlertsList();
    } catch (err) {
      setErrorMsg(err.message || "Lỗi xóa cảnh báo giá.");
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
    if (inputMode === null) return; // User cancelled
    
    const mode = inputMode.trim().toLowerCase() === "all" ? "all" : "active";
    setSyncingStockProfile(true);
    setErrorMsg("");
    setSuccessMsg("Đang gửi yêu cầu đồng bộ...");

    try {
      const res = await coreApiAdapter.syncAdminMarketGroups(mode);
      if (res && res.task_id) {
        const taskId = res.task_id;
        let attempts = 0;
        const maxAttempts = 40; // 120s max
        
        const poll = async () => {
          try {
            const statusRes = await coreApiAdapter.getMarketGroupsSyncStatus(taskId);
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
            setErrorMsg(pollErr.message || "Lỗi khi kiểm tra trạng thái đồng bộ.");
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
      setErrorMsg(err.message || "Lỗi khi đồng bộ mã chứng khoán.");
      setSyncingStockProfile(false);
      setTimeout(() => setErrorMsg(""), 5000);
    }
  };

  const handleSyncPrices = async () => {
    setLoading(true);
    try {
      const activeList = activeItems.map(item => item.symbol).filter(Boolean);
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

  const getMergedData = (symbol) => {
    const staticData = technicalsMap[symbol] || {};
    const streamingData = realtimeFeed?.quotesBySymbol?.[symbol] || {};
    
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

  const getGroupCounters = (symbolsList) => {
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

  const renderSparkline = (symbol) => {
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

  const formatTime = (dateObj) => {
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
    } else { // "group"
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
      const symbol = item.symbol;
      const merged = getMergedData(symbol);
      const changePct = Number(merged.price_change_pct || 0);
      const isUp = changePct > 0;
      const isDown = changePct < 0;
      
      const flashState = priceFlashMap[symbol];
      const flashClass = flashState ? `watchlistPage__priceCell--${flashState}` : "";

      if (selectedType === "holds") {
        const qty = Number(item.quantity || 0);
        const avgCost = Number(item.avg_cost || 0);
        const marketValue = Number(item.market_value || 0);
        const pnl = Number(item.unrealized_pnl || 0);
        const pnlPct = Number(item.unrealized_pnl_pct || 0);

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
        const industry = item.industry || "—";
        const companyName = item.company_name || "—";

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
            e(TrackedThresholdCell, { item, onUpdate: handleUpdateTrackedThreshold })
          ),
          e("td", { style: { textAlign: "center" } },
            e("button", {
              className: "watchlistPage__btn watchlistPage__btn--danger",
              style: { padding: "4px 8px", fontSize: "0.75rem" },
              onClick: () => handleRemoveTrackedSymbol(item.id, symbol)
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
        
      } else { // "group"
        const industry = merged.industry || item.industry || "—";
        const companyName = merged.company_name || item.company_name || "—";
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
    
    // Notifications banner
    errorMsg && e("div", { className: "shellPage__notice shellPage__notice--error" }, errorMsg),
    successMsg && e("div", { className: "shellPage__notice shellPage__notice--success" }, successMsg),

    e(
      "div",
      { className: "watchlistPage__layout" },
      
      // Sidebar: flat structure
      e(
        "aside",
        { className: "watchlistPage__sidebarCard" },
        
        // Section 1: Danh mục cá nhân (Personal lists)
        e("h2", { className: "watchlistPage__sidebarTitle" }, "Danh mục của tôi"),
        e(
          "div",
          { className: "watchlistPage__list", style: { marginBottom: "1.25rem" } },
          
          // 💼 Holds select row
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
          
          // 🐋 Tracked select row
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
          
          // Custom Watchlists with Rename & Delete
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
                    onChange: (e) => setEditingWlName(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter") handleRenameWatchlist(wl.id);
                      else if (e.key === "Escape") setEditingWlId(null);
                    },
                    autoFocus: true,
                    onClick: (e) => e.stopPropagation(),
                    onBlur: () => handleRenameWatchlist(wl.id),
                  })
                : e("span", { className: "watchlistPage__listItemName" }, `📁 ${wl.name}`),
                
              !isEditing && e("div", { 
                className: "watchlistPage__itemActions", 
                style: { display: "flex", gap: "8px", alignItems: "center" },
                onClick: (e) => e.stopPropagation()
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
        
        // Personal Watchlist Quick Form
        e(
          "form",
          { className: "watchlistPage__sidebarAction", style: { marginBottom: "1.5rem" }, onSubmit: handleCreateWatchlist },
          e("input", {
            className: "watchlistPage__input",
            style: { width: "100%", boxSizing: "border-box", marginBottom: "0.5rem" },
            placeholder: "Tên danh sách mới...",
            value: newListName,
            onChange: (e) => setNewListName(e.target.value),
          }),
          e("button", { type: "submit", className: "watchlistPage__btn", style: { width: "100%" } }, "Tạo danh sách")
        ),
        
        // Section 2: Market Groups (Sectors)
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

      // Main content: smart radar table & active tabs
      e(
        "main",
        { className: "watchlistPage__mainCard" },
        
        // Watchlist Header & Sync Status
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

        // Tabs (Only visible when personal watchlist is active)
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

        // Add Quick form for tracked symbols if tracked selected
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
            onChange: (e) => setNewTrackedSymbol(e.target.value.toUpperCase()),
          }),
          e("input", {
            type: "number",
            className: "watchlistPage__input",
            style: { width: "180px" },
            placeholder: "Ngưỡng cảnh báo (Tr.đ)",
            value: newTrackedThreshold,
            onChange: (e) => setNewTrackedThreshold(e.target.value),
          }),
          e("button", { type: "submit", className: "watchlistPage__btn" }, "Thêm theo dõi")
        ),

        // Tab Content 1: Table Grid
        (selectedType !== "watchlist" || activeTab === "table") && e(
          "div",
          { className: "shellPage__stack" },
          
          // Density Control Strip
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

          // Table
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

        // Tab Content 2: Manage Items
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
              onChange: (e) => setNewSymbol(e.target.value),
            }),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Ghi chú nhanh...",
              value: newSymbolNote,
              onChange: (e) => setNewSymbolNote(e.target.value),
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

        // Tab Content 3: Price Alerts
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
              onChange: (e) => setNewAlertSymbol(e.target.value),
            }),
            e(
              "select",
              {
                className: "watchlistPage__select",
                value: newAlertCondition,
                onChange: (e) => setNewAlertCondition(e.target.value)
              },
              e("option", { value: "ABOVE" }, "Giá vượt quá (>=)"),
              e("option", { value: "BELOW" }, "Giá giảm dưới (<=)"),
              e("option", { value: "EQUAL" }, "Bằng giá (=)")
            ),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Mức giá cảnh báo...",
              value: newAlertPrice,
              onChange: (e) => setNewAlertPrice(e.target.value),
            }),
            e("input", {
              className: "watchlistPage__input",
              placeholder: "Cooldown (giây, vd: 300)...",
              value: newAlertCooldown,
              onChange: (e) => setNewAlertCooldown(e.target.value),
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