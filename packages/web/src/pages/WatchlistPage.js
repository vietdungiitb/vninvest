import { createElement, useEffect, useRef, useState } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import "./WatchlistPage.css";

const e = createElement;

export function WatchlistPage({
  env = {},
  autoLoad = true,
  t = (key, defaultVal) => defaultVal,
}) {
  // State variables
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState(null);
  const [items, setItems] = useState([]);
  const [technicalsMap, setTechnicalsMap] = useState({});
  const [priceFlashMap, setPriceFlashMap] = useState({}); // symbol -> "up" | "down"
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  
  // Tab control: "table" | "manage" | "alerts"
  const [activeTab, setActiveTab] = useState("table");
  
  // High-density layout control: "compact" | "comfortable"
  const [density, setDensity] = useState("compact");
  
  // API loading and errors
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Sub-forms state
  const [newListName, setNewListName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newSymbolNote, setNewSymbolNote] = useState("");
  
  // Price Alerts state
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [newAlertSymbol, setNewAlertSymbol] = useState("");
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [newAlertCondition, setNewAlertCondition] = useState("ABOVE"); // ABOVE | BELOW | EQUAL
  const [newAlertCooldown, setNewAlertCooldown] = useState("300");

  // WebSocket reference
  const socketRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const prevPricesRef = useRef({});
  const flashTimeoutRefs = useRef({});

  // 1. Fetch all watchlists for user
  const fetchWatchlists = async (selectFirst = false) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await coreApiAdapter.getWatchlists();
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setWatchlists(list);
      
      if (list.length > 0) {
        if (selectFirst || !activeWatchlist) {
          setActiveWatchlist(list[0]);
        } else {
          // Keep selection but refresh it
          const updated = list.find(w => w.id === activeWatchlist.id);
          if (updated) setActiveWatchlist(updated);
        }
      } else {
        // Automatically create a default watchlist if none exist
        const newWl = await coreApiAdapter.createWatchlist({
          name: "Danh sách theo dõi cá nhân",
          description: "Mã chứng khoán bạn muốn theo dõi sát thời gian thực.",
          is_default: true,
        });
        setWatchlists([newWl]);
        setActiveWatchlist(newWl);
      }
    } catch (err) {
      setErrorMsg(err.message || "Không thể tải danh sách theo dõi.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch items for active watchlist
  const fetchItems = async (watchlistId) => {
    if (!watchlistId) return;
    setErrorMsg("");
    try {
      const res = await coreApiAdapter.getWatchlistItems(watchlistId);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setItems(list);
      setLastSyncTime(new Date());
    } catch (err) {
      setErrorMsg(err.message || "Không thể tải danh sách mã.");
    }
  };

  // 3. Fetch bulk technical indicators from Backend
  const fetchTechnicals = async (symbolsList) => {
    if (!symbolsList || symbolsList.length === 0) return;
    try {
      const res = await coreApiAdapter.getBulkTechnicalsBySymbols(symbolsList);
      const data = Array.isArray(res) ? res : (res?.results ?? res?.technicals ?? []);
      
      const newMap = {};
      data.forEach(tData => {
        newMap[tData.symbol] = tData;
        
        // Calculate price changes to trigger flash glow animations
        const prevPrice = prevPricesRef.current[tData.symbol];
        const nextPrice = Number(tData.price);
        if (prevPrice !== undefined && nextPrice !== prevPrice) {
          const dir = nextPrice > prevPrice ? "up" : "down";
          setPriceFlashMap(prev => ({ ...prev, [tData.symbol]: dir }));
          
          // Clear animation class after 400ms
          if (flashTimeoutRefs.current[tData.symbol]) {
            clearTimeout(flashTimeoutRefs.current[tData.symbol]);
          }
          flashTimeoutRefs.current[tData.symbol] = setTimeout(() => {
            setPriceFlashMap(prev => {
              const updated = { ...prev };
              delete updated[tData.symbol];
              return updated;
            });
          }, 400);
        }
        prevPricesRef.current[tData.symbol] = nextPrice;
      });
      setTechnicalsMap(newMap);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Lỗi tải technicals gộp:", err.message);
    }
  };

  // 4. Fetch price alerts
  const fetchPriceAlertsList = async () => {
    try {
      const res = await coreApiAdapter.getPriceAlerts();
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setPriceAlerts(list);
    } catch (err) {
      console.warn("Lỗi tải cảnh báo giá:", err.message);
    }
  };

  // Initial Load
  useEffect(() => {
    if (autoLoad) {
      fetchWatchlists(true);
      fetchPriceAlertsList();
    }
  }, [autoLoad]);

  // Load items when active watchlist changes
  useEffect(() => {
    if (activeWatchlist?.id) {
      fetchItems(activeWatchlist.id);
    }
  }, [activeWatchlist]);

  // Fetch technical indicators when items change
  useEffect(() => {
    if (items.length > 0) {
      const symbols = items.map(item => item.symbol);
      fetchTechnicals(symbols);
    } else {
      setTechnicalsMap({});
    }
  }, [items]);

  // 5. Establish Real-time WebSocket connection
  useEffect(() => {
    if (items.length === 0) return undefined;
    
    const symbols = items.map(item => item.symbol);
    const token = localStorage.getItem("access_token") || "";
    if (!token) return undefined;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const isDev = ["3000", "3001"].includes(window.location.port);
    
    // Construct portable WS url
    const wsUrl = isDev
      ? `ws://localhost:3000/ws/realtime/?token=${encodeURIComponent(token)}`
      : `${protocol}://${host}/ws/realtime/?token=${encodeURIComponent(token)}`;

    let wsRetries = 0;
    const maxRetries = 3;

    function connectWS() {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        wsRetries = 0;
        // Subscribe to our symbols
        ws.send(JSON.stringify({
          action: "subscribe",
          symbols: symbols,
        }));
        
        // Disable fallback short-polling interval
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
          fallbackIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Parse tick prices and trigger flashes
          if (msg && msg.type === "ticker" && symbols.includes(msg.symbol)) {
            const nextPrice = Number(msg.price);
            const prevPrice = prevPricesRef.current[msg.symbol];
            
            if (prevPrice !== undefined && nextPrice !== prevPrice) {
              const dir = nextPrice > prevPrice ? "up" : "down";
              setPriceFlashMap(prev => ({ ...prev, [msg.symbol]: dir }));
              
              if (flashTimeoutRefs.current[msg.symbol]) {
                clearTimeout(flashTimeoutRefs.current[msg.symbol]);
              }
              flashTimeoutRefs.current[msg.symbol] = setTimeout(() => {
                setPriceFlashMap(prev => {
                  const updated = { ...prev };
                  delete updated[msg.symbol];
                  return updated;
                });
              }, 400);
            }
            
            prevPricesRef.current[msg.symbol] = nextPrice;

            // Merge price update into technicals state map
            setTechnicalsMap(prev => {
              const existing = prev[msg.symbol] || {};
              return {
                ...prev,
                [msg.symbol]: {
                  ...existing,
                  price: nextPrice,
                  price_change: msg.change ?? existing.price_change,
                  price_change_pct: msg.change_pct ?? existing.price_change_pct,
                  volume: msg.volume ?? existing.volume,
                }
              };
            });
            setLastSyncTime(new Date());
          }
        } catch (err) {
          console.warn("WS message parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("WS error:", err);
      };

      ws.onclose = () => {
        if (wsRetries < maxRetries) {
          wsRetries++;
          setTimeout(connectWS, 2000 * wsRetries); // Exponential retry backoff
        } else {
          // Fallback permanently to short HTTP polling (30s) if WebSocket opens circuit
          if (!fallbackIntervalRef.current) {
            fallbackIntervalRef.current = setInterval(() => {
              fetchTechnicals(symbols);
            }, 30000);
          }
        }
      };
    }

    connectWS();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      Object.values(flashTimeoutRefs.current).forEach(clearTimeout);
    };
  }, [items]);

  // Actions handlers
  const handleCreateWatchlist = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const wl = await coreApiAdapter.createWatchlist({
        name: newListName.trim(),
        description: "Danh sách watchlist tùy chỉnh.",
      });
      setNewListName("");
      setSuccessMsg("Đã tạo nhóm watchlist thành công.");
      await fetchWatchlists();
      setActiveWatchlist(wl);
    } catch (err) {
      setErrorMsg(err.message || "Không thể tạo watchlist.");
    }
  };

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim() || !activeWatchlist?.id) return;
    setErrorMsg("");
    setSuccessMsg("");
    const symbolUpper = newSymbol.trim().toUpperCase();
    try {
      await coreApiAdapter.addWatchlistItem(activeWatchlist.id, symbolUpper);
      setNewSymbol("");
      setNewSymbolNote("");
      setSuccessMsg(`Đã thêm mã ${symbolUpper} vào danh sách.`);
      await fetchItems(activeWatchlist.id);
    } catch (err) {
      setErrorMsg(err.message || `Lỗi thêm mã ${symbolUpper}.`);
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    if (!activeWatchlist?.id) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa mã ${symbol} khỏi danh sách?`)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await coreApiAdapter.removeWatchlistItem(activeWatchlist.id, symbol);
      setSuccessMsg(`Đã xóa mã ${symbol} thành công.`);
      await fetchItems(activeWatchlist.id);
    } catch (err) {
      setErrorMsg(err.message || `Lỗi khi xóa mã ${symbol}.`);
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

  // Helper formatter
  const formatTime = (dateObj) => {
    return dateObj.toTimeString().split(" ")[0];
  };

  const renderSparkline = (symbol) => {
    // Generate beautiful clean SVG mini-sparkline based on technical stats
    const tData = technicalsMap[symbol];
    if (!tData) return e("span", { className: "text-gray" }, "—");
    
    // Draw a neat diagnostic vector curve
    const change = Number(tData.price_change_pct || 0);
    const color = change >= 0 ? "#00FFBB" : "#FF3344";
    const path = change >= 0
      ? "M 5,20 Q 25,12 45,18 T 85,5" 
      : "M 5,5 Q 25,18 45,12 T 85,20";

    return e(
      "svg",
      { className: "watchlistPage__sparklineSvg", width: "90", height: "25", viewBox: "0 0 90 25" },
      e("path", {
        className: "watchlistPage__sparklinePath",
        d: path,
        stroke: color,
        strokeWidth: "1.5",
        fill: "none"
      })
    );
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
      
      // Sidebar: lists watchlists
      e(
        "aside",
        { className: "watchlistPage__sidebarCard" },
        e("h2", { className: "watchlistPage__sidebarTitle" }, "Sổ watchlist"),
        e(
          "div",
          { className: "watchlistPage__list" },
          watchlists.map(wl => e(
            "div",
            {
              key: wl.id,
              className: `watchlistPage__listItem ${activeWatchlist?.id === wl.id ? "watchlistPage__listItem--active" : ""}`,
              onClick: () => {
                setActiveWatchlist(wl);
                setErrorMsg("");
                setSuccessMsg("");
              }
            },
            e("span", { className: "watchlistPage__listItemName" }, wl.name),
            e("span", { className: "watchlistPage__listItemCount" }, activeWatchlist?.id === wl.id ? String(items.length) : "mã")
          ))
        ),
        
        // Sidebar form: create a new watchlist
        e(
          "form",
          { className: "watchlistPage__sidebarAction", onSubmit: handleCreateWatchlist },
          e("input", {
            className: "watchlistPage__input",
            style: { width: "100%", boxSizing: "border-box", marginBottom: "0.5rem" },
            placeholder: "Tên watchlist mới...",
            value: newListName,
            onChange: (e) => setNewListName(e.target.value),
          }),
          e("button", { type: "submit", className: "watchlistPage__btn", style: { width: "100%" } }, "Tạo watchlist mới")
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
            e("h1", { className: "watchlistPage__title" }, activeWatchlist?.name || "Danh sách theo dõi"),
            e("p", { className: "watchlistPage__description" }, activeWatchlist?.description || "Bám sát các cơ hội đầu tư cá mập")
          ),
          e(
            "span",
            { className: "watchlistPage__syncBadge" },
            e("span", { className: "shellPage__statusDot" }),
            `Tự động cập nhật ngầm | Đồng bộ cuối: ${formatTime(lastSyncTime)}`
          )
        ),

        // Tabs
        e(
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

        // Tab Content 1: Table Grid
        activeTab === "table" && e(
          "div",
          { className: "shellPage__stack" },
          
          // Density Control Strip
          e(
            "div",
            { className: "watchlistPage__controls" },
            e("div", { className: "text-gray", style: { fontSize: "0.875rem" } }, `Đang hiển thị ${items.length} mã chứng khoán.`),
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
          items.length === 0
            ? e(
                "div",
                { className: "watchlistPage__emptyState" },
                e("span", { className: "watchlistPage__emptyIcon" }, "☰"),
                e("p", null, "Chưa có mã nào trong danh sách theo dõi cá nhân."),
                e("button", { className: "watchlistPage__btn", onClick: () => setActiveTab("manage") }, "Thêm mã ngay")
              )
            : e(
                "div",
                { className: "watchlistPage__tableWrapper" },
                e(
                  "table",
                  { className: `watchlistPage__table ${density === "compact" ? "watchlistPage__table--compact" : ""}` },
                  e(
                    "thead",
                    null,
                    e(
                      "tr",
                      null,
                      e("th", null, "Mã"),
                      e("th", null, "Giá"),
                      e("th", null, "% Thay đổi"),
                      e("th", null, "RSI(14)"),
                      e("th", null, "RVOL"),
                      e("th", null, "% Cách MA20"),
                      e("th", null, "Định hướng"),
                      e("th", null, "Xu hướng")
                    )
                  ),
                  e(
                    "tbody",
                    null,
                    items.map(item => {
                      const tData = technicalsMap[item.symbol];
                      const changePct = Number(tData?.price_change_pct || 0);
                      const isUp = changePct > 0;
                      const isDown = changePct < 0;
                      
                      const flashState = priceFlashMap[item.symbol];
                      const flashClass = flashState ? `watchlistPage__priceCell--${flashState}` : "";

                      const rsiValue = tData?.rsi_14 !== undefined && tData.rsi_14 !== null ? Number(tData.rsi_14).toFixed(1) : "—";
                      const rvolValue = tData?.avg_volume_20 ? Number(tData.volume / tData.avg_volume_20).toFixed(2) : "—";
                      const ma20Dist = tData?.price_vs_sma20_pct !== undefined && tData.price_vs_sma20_pct !== null ? `${Number(tData.price_vs_sma20_pct).toFixed(1)}%` : "—";

                      return e(
                        "tr",
                        { key: item.id },
                        e(
                          "td",
                          null,
                          e("a", { className: "watchlistPage__symbolLink", href: `/stocks/${item.symbol}` }, item.symbol)
                        ),
                        e(
                          "td",
                          { className: `watchlistPage__priceCell ${flashClass} text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-white"}` },
                          tData?.price !== undefined ? Number(tData.price).toLocaleString() : "—"
                        ),
                        e(
                          "td",
                          { className: `text-mono ${isUp ? "text-green" : isDown ? "text-red" : "text-gray"}` },
                          changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
                        ),
                        e("td", { className: "text-mono text-white" }, rsiValue),
                        e("td", { className: "text-mono text-white" }, rvolValue),
                        e("td", { className: `text-mono ${Number(tData?.price_vs_sma20_pct) >= 0 ? "text-green" : "text-red"}` }, ma20Dist),
                        e("td", { className: "text-gray" }, tData?.bias_label || "Trung tính"),
                        e("td", { className: "watchlistPage__sparklineCell" }, renderSparkline(item.symbol))
                      );
                    })
                  )
                )
              )
        ),

        // Tab Content 2: Manage Items
        activeTab === "manage" && e(
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
                    { className: "shellPage__listItemHeader", style: { width: "100%", justifyContent: "space-between" } },
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
        activeTab === "alerts" && e(
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
                  const currentPrice = technicalsMap[alert.symbol]?.price || alert.current_price;
                  const typeLabel = alert.condition === "ABOVE" ? ">=" : alert.condition === "BELOW" ? "<=" : "=";
                  
                  return e(
                    "article",
                    { className: "shellPage__listItem", key: alert.id },
                    e(
                      "div",
                      { className: "shellPage__listItemHeader", style: { width: "100%", justifyContent: "space-between" } },
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
