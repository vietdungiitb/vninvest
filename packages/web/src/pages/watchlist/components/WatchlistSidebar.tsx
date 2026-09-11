import { createElement, useState, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useWatchlist } from "./WatchlistContext";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useI18n } from "../../../context/LangContext.js";
import styles from "../../../components/soc/soc.module.css";

const api = coreApiAdapter;

export function WatchlistSidebar() {
  const { 
    watchlists, legacyGroups, holdings, trackedSymbols, 
    selectedType, selectedId, 
    setSelectedType, setSelectedId,
    setErrorMsg, setSuccessMsg, loadAllLists 
  } = useWatchlist();

  const { t } = useI18n();

  const [newListName, setNewListName] = useState("");
  const [editingWlId, setEditingWlId] = useState<string | number | null>(null);
  const [editingWlName, setEditingWlName] = useState("");
  const [groupsExpanded, setGroupsExpanded] = useState(true);

  const handleCreateWatchlist = async (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const wl = await api.createWatchlist({
        name: newListName.trim(),
        description: "Custom user watchlist.",
      });
      setNewListName("");
      setSuccessMsg(t("watchlist.sidebar.create_success", { defaultValue: "Đã tạo danh sách theo dõi thành công." }));
      await loadAllLists(false);
      setSelectedType("watchlist");
      setSelectedId(wl.id);
    } catch (err) {
      setErrorMsg((err as Error).message || t("watchlist.sidebar.create_error", { defaultValue: "Không thể tạo watchlist mới." }));
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
      setSuccessMsg(t("watchlist.sidebar.rename_success", { defaultValue: "Đã đổi tên danh sách thành công." }));
      setEditingWlId(null);
      await loadAllLists(false);
    } catch (err) {
      setErrorMsg((err as Error).message || t("watchlist.sidebar.rename_error", { defaultValue: "Lỗi khi đổi tên danh sách." }));
    }
  };

  const handleDeleteWatchlist = async (id: string | number, name: string) => {
    const confirmMsg = t("watchlist.sidebar.delete_confirm", { defaultValue: `Bạn có chắc chắn muốn xóa danh sách "${name}"?` });
    if (!window.confirm(confirmMsg)) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.deleteWatchlist(id.toString());
      setSuccessMsg(t("watchlist.sidebar.delete_success", { defaultValue: `Đã xóa danh sách "${name}" thành công.` }));
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
      setErrorMsg((err as Error).message || t("watchlist.sidebar.delete_error", { defaultValue: "Lỗi khi xóa danh sách." }));
    }
  };

  return createElement(
    "aside",
    { 
      className: `${styles.glassPanel} watchlistPage__sidebarCard`,
      style: { height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }
    },
    createElement(
      "h2",
      { className: `${styles.sectionCardTitle} watchlistPage__sidebarTitle` },
      t("watchlist.sidebar.my_lists", { defaultValue: "Danh sách tự tạo" })
    ),
    createElement(
      "div",
      { className: "watchlistPage__list", style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
      
      // Holdings List Item
      createElement(
        "div",
        {
          className: `watchlistPage__listItem ${selectedType === "holds" ? "watchlistPage__listItem--active" : ""}`,
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: selectedType === "holds" ? "rgba(0, 180, 216, 0.12)" : "rgba(15, 23, 42, 0.25)",
            border: `1px solid ${selectedType === "holds" ? "var(--accent-cyan, #22d3ee)" : "rgba(80, 120, 168, 0.15)"}`
          },
          onClick: () => {
            setSelectedType("holds");
            setSelectedId(null);
            setErrorMsg("");
            setSuccessMsg("");
          }
        },
        createElement(
          "span",
          { 
            className: "watchlistPage__listItemName", 
            style: { 
              fontSize: "0.85rem", 
              fontWeight: 600, 
              color: selectedType === "holds" ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" 
            } 
          },
          `💼 ${t("watchlist.sidebar.holdings", { defaultValue: "Cổ phiếu nắm giữ" })}`
        ),
        createElement(
          "span",
          { className: "watchlistPage__listItemCount text-xs" },
          `${holdings.length} ${t("watchlist.sidebar.count_suffix", { defaultValue: "mã" })}`
        )
      ),

      // Tracked List Item (Whale Flow)
      createElement(
        "div",
        {
          className: `watchlistPage__listItem ${selectedType === "tracked" ? "watchlistPage__listItem--active" : ""}`,
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: selectedType === "tracked" ? "rgba(0, 180, 216, 0.12)" : "rgba(15, 23, 42, 0.25)",
            border: `1px solid ${selectedType === "tracked" ? "var(--accent-cyan, #22d3ee)" : "rgba(80, 120, 168, 0.15)"}`
          },
          onClick: () => {
            setSelectedType("tracked");
            setSelectedId(null);
            setErrorMsg("");
            setSuccessMsg("");
          }
        },
        createElement(
          "span",
          { 
            className: "watchlistPage__listItemName", 
            style: { 
              fontSize: "0.85rem", 
              fontWeight: 600, 
              color: selectedType === "tracked" ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" 
            } 
          },
          `🐋 ${t("watchlist.sidebar.money_flow_alert", { defaultValue: "Cảnh báo dòng tiền" })}`
        ),
        createElement(
          "span",
          { className: "watchlistPage__listItemCount text-xs" },
          `${trackedSymbols.length} ${t("watchlist.sidebar.count_suffix", { defaultValue: "mã" })}`
        )
      ),

      // Custom Watchlists
      watchlists.map(wl => {
        const isEditing = editingWlId === wl.id;
        const isActive = selectedType === "watchlist" && selectedId === wl.id;

        return createElement(
          "div",
          {
            key: wl.id,
            className: `watchlistPage__listItem ${isActive ? "watchlistPage__listItem--active" : ""}`,
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: isEditing ? "default" : "pointer",
              transition: "all 0.15s ease",
              background: isActive ? "rgba(0, 180, 216, 0.12)" : "rgba(15, 23, 42, 0.25)",
              border: `1px solid ${isActive ? "var(--accent-cyan, #22d3ee)" : "rgba(80, 120, 168, 0.15)"}`
            },
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
            ? createElement("input", {
                className: "watchlistPage__input",
                style: {
                  width: "100%",
                  padding: "4px 8px",
                  fontSize: "0.85rem",
                  background: "rgba(2, 11, 35, 0.6)",
                  border: "1px solid rgba(80, 120, 168, 0.3)",
                  borderRadius: "4px",
                  color: "#f1f5f9"
                },
                value: editingWlName,
                onChange: (ev: ChangeEvent<HTMLInputElement>) => setEditingWlName(ev.target.value),
                onKeyDown: (ev: KeyboardEvent) => {
                  if (ev.key === "Enter") handleRenameWatchlist(wl.id);
                  else if (ev.key === "Escape") setEditingWlId(null);
                },
                autoFocus: true,
                onClick: (ev: MouseEvent<HTMLInputElement>) => ev.stopPropagation(),
                onBlur: () => handleRenameWatchlist(wl.id)
              })
            : createElement(
                "span",
                { 
                  className: "watchlistPage__listItemName", 
                  style: { 
                    fontSize: "0.85rem", 
                    fontWeight: 600, 
                    color: isActive ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" 
                  } 
                },
                createElement(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
                  `📁 ${wl.name}`,
                  createElement(
                    "span",
                    {
                      className: "watchlistPage__badge watchlistPage__badge--user",
                      style: {
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: "rgba(34, 211, 238, 0.15)",
                        color: "var(--accent-cyan, #22d3ee)",
                        border: "1px solid rgba(34, 211, 238, 0.35)",
                        whiteSpace: "nowrap",
                      },
                    },
                    t("watchlist.sidebar.badge_user", { defaultValue: "Của tôi" })
                  )
                )
              ),
          
          !isEditing && createElement(
            "div",
            {
              className: "watchlistPage__itemActions",
              style: { display: "flex", gap: "8px", alignItems: "center" },
              onClick: (ev: MouseEvent<HTMLDivElement>) => ev.stopPropagation()
            },
            createElement(
              "span",
              {
                className: "cursor-pointer text-xs opacity-70 hover:opacity-100 transition-opacity",
                style: { fontSize: "0.75rem" },
                title: t("watchlist.sidebar.rename", { defaultValue: "Đổi tên" }),
                onClick: () => {
                  setEditingWlId(wl.id);
                  setEditingWlName(wl.name);
                }
              },
              "✏️"
            ),
            createElement(
              "span",
              {
                className: "cursor-pointer text-xs opacity-70 hover:opacity-100 transition-opacity",
                style: { fontSize: "0.75rem" },
                title: t("watchlist.sidebar.delete", { defaultValue: "Xóa danh sách" }),
                onClick: () => handleDeleteWatchlist(wl.id, wl.name)
              },
              "🗑️"
            )
          )
        );
      })
    ),

    // Create New Watchlist Form
    createElement(
      "form",
      { 
        className: "watchlistPage__sidebarAction", 
        style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "0.5rem" },
        onSubmit: handleCreateWatchlist 
      },
      createElement("input", {
        className: "watchlistPage__input",
        style: {
          width: "100%",
          padding: "8px 12px",
          fontSize: "0.8rem",
          background: "rgba(2, 11, 35, 0.4)",
          border: "1px solid rgba(80, 120, 168, 0.15)",
          borderRadius: "6px",
          color: "#f1f5f9",
          boxSizing: "border-box"
        },
        placeholder: t("watchlist.sidebar.new_list_placeholder", { defaultValue: "Tên danh sách mới..." }),
        value: newListName,
        onChange: (ev: ChangeEvent<HTMLInputElement>) => setNewListName(ev.target.value)
      }),
      createElement(
        "button",
        { 
          type: "submit", 
          className: styles.actionBtn,
          style: {
            width: "100%",
            padding: "8px 12px",
            fontSize: "0.8rem",
            fontWeight: 700,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "6px",
            color: "var(--text-primary, #f1f5f9)",
            cursor: "pointer",
            transition: "all 0.15s ease"
          }
        },
        t("watchlist.sidebar.create_list", { defaultValue: "Tạo danh sách" })
      )
    ),

    // Market & Indices Section
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" } },
      createElement(
        "h2",
        { className: `${styles.sectionCardTitle} watchlistPage__sidebarTitle`, style: { margin: 0 } },
        t("watchlist.sidebar.market_indices", { defaultValue: "Thị trường & Chỉ số" })
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: () => setGroupsExpanded(prev => !prev),
          title: groupsExpanded ? t("watchlist.sidebar.collapse", { defaultValue: "Thu gọn" }) : t("watchlist.sidebar.expand", { defaultValue: "Mở rộng" }),
          style: {
            fontSize: "0.75rem",
            padding: "2px 8px",
            borderRadius: "6px",
            border: "1px solid rgba(80, 120, 168, 0.25)",
            background: "rgba(15, 23, 42, 0.4)",
            color: "var(--text-muted, #94a3b8)",
            cursor: "pointer",
          },
        },
        groupsExpanded ? "▾" : "▸"
      )
    ),
    groupsExpanded && createElement(
      "div",
      {
        className: "watchlistPage__list",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          maxHeight: "320px",
          overflowY: "auto",
          paddingRight: "4px",
        },
      },
      legacyGroups.map(group => {
        const symbolsList = (group.items || []).map(item => item.symbol);
        const isGroupActive = selectedType === "group" && selectedId === group.id;

        return createElement(
          "div",
          {
            key: group.id,
            className: `watchlistPage__listItem ${isGroupActive ? "watchlistPage__listItem--active" : ""}`,
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: isGroupActive ? "rgba(0, 180, 216, 0.12)" : "rgba(15, 23, 42, 0.25)",
              border: `1px solid ${isGroupActive ? "var(--accent-cyan, #22d3ee)" : "rgba(80, 120, 168, 0.15)"}`
            },
            onClick: () => {
              setSelectedType("group");
              setSelectedId(group.id);
              setErrorMsg("");
              setSuccessMsg("");
            }
          },
          createElement(
            "span",
            { 
              className: "watchlistPage__listItemName", 
              style: { 
                fontSize: "0.85rem", 
                fontWeight: 600, 
                color: isGroupActive ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" 
              } 
            },
                createElement(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
                  `🌐 ${group.name}`,
                  createElement(
                    "span",
                    {
                      className: "watchlistPage__badge watchlistPage__badge--system",
                      style: {
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: "rgba(148, 163, 184, 0.15)",
                        color: "var(--text-muted, #94a3b8)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        whiteSpace: "nowrap",
                      },
                    },
                    t("watchlist.sidebar.badge_system", { defaultValue: "Hệ thống" })
                  )
                )
          ),
          createElement(
            "span",
            { className: "watchlistPage__listItemCount text-xs" },
            `${symbolsList.length} ${t("watchlist.sidebar.count_suffix", { defaultValue: "mã" })}`
          )
        );
      })
    )
  );
}
