import { createElement, useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { useWatchlist } from "./WatchlistContext";
import { WatchlistTable } from "./WatchlistTable";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useI18n } from "../../../context/LangContext.js";
import styles from "../../../components/soc/soc.module.css";

const api = coreApiAdapter;

function ColumnPicker() {
  const { visibleColumns, setVisibleColumns } = useWatchlist();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const columns = [
    { key: 'rsi', label: t("watchlist.column.rsi", { defaultValue: "RSI(14)" }) },
    { key: 'rvol', label: t("watchlist.column.rvol", { defaultValue: "RVOL" }) },
    { key: 'ma20Dist', label: t("watchlist.column.ma20_dist", { defaultValue: "% Cách MA20" }) },
    { key: 'bias', label: t("watchlist.column.bias", { defaultValue: "Định hướng" }) },
  ];

  return createElement(
    "div",
    { className: "relative", ref, style: { position: "relative" } },
    createElement(
      "button",
      { 
        onClick: () => setOpen(!open),
        className: styles.actionBtn,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          color: "var(--text-primary, #f1f5f9)",
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 600
        }
      },
      createElement("svg", {
        width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"
      }, createElement("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })),
      t("watchlist.main.column_picker", { defaultValue: "Cột hiển thị" })
    ),

    open && createElement(
      "div",
      {
        className: styles.glassPanel,
        style: {
          position: "absolute",
          right: 0,
          top: "100%",
          marginTop: "4px",
          width: "192px",
          zIndex: 50,
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
        }
      },
      createElement(
        "div",
        {
          style: {
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "var(--text-muted, #94a3b8)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "4px",
            padding: "0 8px"
          }
        },
        t("watchlist.main.column_options", { defaultValue: "Tùy chọn cột" })
      ),
      columns.map(c => 
        createElement(
          "label",
          {
            key: c.key,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "var(--text-primary, #f1f5f9)"
            },
            className: "hover:bg-slate-800"
          },
          createElement("input", {
            type: "checkbox",
            checked: visibleColumns[c.key],
            onChange: () => toggle(c.key),
            style: {
              borderRadius: "4px",
              border: "1px solid rgba(80, 120, 168, 0.3)",
              background: "rgba(2, 11, 35, 0.6)",
              cursor: "pointer"
            }
          }),
          c.label
        )
      )
    )
  );
}

export function WatchlistMainWorkspace() {
  const { 
    watchlists, legacyGroups, 
    selectedType, selectedId, 
    activeItems, realtimeFeed,
    errorMsg, successMsg,
    fetchItems, fetchPriceAlertsList
  } = useWatchlist();

  const { t } = useI18n();

  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [addingSymbol, setAddingSymbol] = useState(false);

  const getListTitle = () => {
    if (selectedType === "holds") return t("watchlist.sidebar.holdings", { defaultValue: "Cổ phiếu nắm giữ" });
    if (selectedType === "tracked") return t("watchlist.sidebar.money_flow_alert", { defaultValue: "Cảnh báo dòng tiền" });
    if (selectedType === "watchlist") {
      const w = watchlists.find(x => x.id === selectedId);
      return w ? w.name : t("watchlist.main.custom_list", { defaultValue: "Danh sách tùy chỉnh" });
    }
    if (selectedType === "group") {
      const g = legacyGroups.find(x => x.id === selectedId);
      return g ? g.name : t("watchlist.main.market_indices", { defaultValue: "Nhóm chỉ số" });
    }
    return t("watchlist.main.title", { defaultValue: "Danh mục" });
  };

  const handleAddSymbol = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSymbolInput.trim() || selectedType !== "watchlist" || !selectedId) return;

    setAddingSymbol(true);
    try {
      const sym = newSymbolInput.trim().toUpperCase();
      await api.addWatchlistItem(selectedId, sym);
      setNewSymbolInput("");
      await fetchItems(selectedId);
      await fetchPriceAlertsList();
    } catch (err) {
      console.error("Lỗi khi thêm mã:", err);
    } finally {
      setAddingSymbol(false);
    }
  };

  return createElement(
    "main",
    { 
      className: `${styles.glassPanel} watchlistPage__mainCard`,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box"
      }
    },
    createElement(
      "header",
      { 
        className: "watchlistPage__header",
        style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }
      },
      createElement(
        "div",
        { className: "watchlistPage__headerLeft", style: { display: "flex", flexDirection: "column", gap: "4px" } },
        createElement(
          "h1",
          { 
            className: "watchlistPage__title",
            style: {
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary, #f1f5f9)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }
          },
          getListTitle(),
          createElement(
            "span",
            { 
              className: "text-xs",
              style: {
                background: "rgba(255, 255, 255, 0.08)",
                color: "var(--text-muted, #94a3b8)",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontWeight: 600
              }
            },
            `${activeItems.length} ${t("watchlist.sidebar.count_suffix", { defaultValue: "mã" })}`
          )
        ),
        createElement(
          "p",
          { 
            className: "watchlistPage__status",
            style: { margin: 0, fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", display: "flex", alignItems: "center", gap: "8px" }
          },
          realtimeFeed?.realtimeStatus === "CONNECTED"
            ? createElement(
                "span",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                createElement("span", {
                  style: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)",
                    display: "inline-block"
                  }
                }),
                t("watchlist.main.streaming_live", { defaultValue: "Streaming Live" })
              )
            : createElement(
                "span",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                createElement("span", {
                  style: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#64748b",
                    display: "inline-block"
                  }
                }),
                t("watchlist.main.offline", { defaultValue: "Offline" })
              ),
          createElement("span", { style: { opacity: 0.3 } }, "|"),
          createElement("span", null, `${t("watchlist.main.last_updated", { defaultValue: "Cập nhật lúc" })}: ${new Date().toLocaleTimeString()}`)
        )
      )
    ),

    // Notifications
    errorMsg && createElement("div", {
      className: "p-3 bg-rose-500/10 border border-rose-500/50 text-rose-400 text-sm rounded"
    }, errorMsg),
    successMsg && createElement("div", {
      className: "p-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-sm rounded"
    }, successMsg),

    // Controls Toolbar
    createElement(
      "div",
      { 
        className: "watchlistPage__controls",
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }
      },
      selectedType === "watchlist" && selectedId
        ? createElement(
            "form",
            { 
              className: "watchlistPage__addForm", 
              style: { display: "flex", gap: "8px", width: "300px" },
              onSubmit: handleAddSymbol
            },
            createElement("input", {
              type: "text",
              className: "watchlistPage__input",
              style: {
                flex: 1,
                padding: "8px 12px",
                background: "rgba(2, 11, 35, 0.4)",
                border: "1px solid rgba(80, 120, 168, 0.15)",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "0.8rem",
                textTransform: "uppercase"
              },
              placeholder: t("watchlist.main.add_symbol_placeholder", { defaultValue: "Nhập mã chứng khoán..." }),
              value: newSymbolInput,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setNewSymbolInput(e.target.value),
              disabled: addingSymbol
            }),
            createElement(
              "button",
              {
                type: "submit",
                className: styles.actionBtn,
                style: {
                  padding: "8px 16px",
                  background: "rgba(0, 180, 216, 0.2)",
                  border: "1px solid var(--accent-cyan, #22d3ee)",
                  borderRadius: "6px",
                  color: "var(--accent-cyan, #22d3ee)",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer"
                },
                disabled: addingSymbol || !newSymbolInput.trim()
              },
              addingSymbol ? "⏳" : t("watchlist.main.add_symbol_btn", { defaultValue: "Thêm mã" })
            )
          )
        : createElement("div"),

      createElement(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        selectedType === "watchlist" && createElement(ColumnPicker),

        // Density buttons
        createElement(
          "div",
          { 
            style: { 
              display: "flex", 
              background: "rgba(2, 11, 35, 0.4)", 
              border: "1px solid rgba(80, 120, 168, 0.15)", 
              borderRadius: "6px",
              overflow: "hidden"
            } 
          },
          createElement(
            "button",
            {
              className: `px-2 py-1.5 text-xs transition-colors ${density === 'compact' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`,
              style: { border: "none", cursor: "pointer", display: "flex", alignItems: "center", background: density === "compact" ? "rgba(255,255,255,0.08)" : "transparent", padding: "6px 10px" },
              onClick: () => setDensity("compact")
            },
            createElement("svg", {
              width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"
            }, createElement("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), createElement("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), createElement("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), createElement("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }), createElement("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }), createElement("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" }))
          ),
          createElement(
            "button",
            {
              className: `px-2 py-1.5 text-xs transition-colors ${density === 'comfortable' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`,
              style: { border: "none", cursor: "pointer", display: "flex", alignItems: "center", background: density === "comfortable" ? "rgba(255,255,255,0.08)" : "transparent", padding: "6px 10px", borderLeft: "1px solid rgba(80, 120, 168, 0.15)" },
              onClick: () => setDensity("comfortable")
            },
            createElement("svg", {
              width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"
            }, createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }), createElement("line", { x1: "3", y1: "9", x2: "21", y2: "9" }), createElement("line", { x1: "9", y1: "21", x2: "9", y2: "9" }))
          )
        )
      )
    ),

    // Watchlist Table
    createElement(WatchlistTable, { density })
  );
}
