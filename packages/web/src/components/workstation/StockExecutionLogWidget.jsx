import { useMemo } from "react";
import { createElement } from "react";

/**
 * StockExecutionLogWidget - Trade Log (Execution Log) Display
 * 
 * Displays matched trades matching the class names defined in StockDetailPage.css
 * (.tl-widget, .tl-list, .tl-row, .tl-time, .tl-price, .tl-qty, .tl-side).
 * 
 * Accessibility:
 * - role="log" with aria-live="polite"
 * - Color-blind friendly prefix indicator via css buy/sell shapes
 * 
 * @param {Object} props
 * @param {Array} props.trades - Array of trade objects
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {Function} props.onRefresh
 * @param {number} props.prevClose - Previous close price for change/color calculation
 */
export function StockExecutionLogWidget({ trades, loading, error, onRefresh, prevClose }) {
  const e = createElement;

  const skeletonRows = useMemo(() => Array(5).fill(null).map((_, i) => ({
    time: "--:--:--",
    price: null,
    volume: null,
    side: "NO",
  })), []);

  const formatVolume = (v) => {
    if (v == null) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString("vi-VN");
  };

  const formatPrice = (p) => {
    if (p == null) return "—";
    return Number(p).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const sideLabel = (side) => {
    const s = String(side || "").toUpperCase();
    if (s === "BUY" || s === "B") return { label: "Mua", class: "buy" };
    if (s === "SELL" || s === "S") return { label: "Bán", class: "sell" };
    return { label: "—", class: "neutral" };
  };

  const displayTrades = trades && trades.length > 0 ? trades : (loading ? skeletonRows : []);

  const renderTrade = (trade, index) => {
    const isSkeleton = loading && trade.price == null;
    const sideInfo = sideLabel(trade.side);
    
    // Price class for color code based on prevClose
    let priceClass = "tl-price";
    if (prevClose != null && trade.price != null && !isSkeleton) {
      const diff = Number(trade.price) - Number(prevClose);
      if (diff > 0) priceClass += " up";
      else if (diff < 0) priceClass += " down";
    }

    return e(
      "div",
      {
        key: `trade-${index}`,
        className: `tl-row ${isSkeleton ? "tl-skeleton-row" : ""}`,
        role: "listitem",
        "aria-label": isSkeleton 
          ? undefined 
          : `Khớp lệnh ${sideInfo.label}: Giá ${formatPrice(trade.price)}, Khối lượng ${formatVolume(trade.volume)}, lúc ${trade.time}`,
        "aria-live": index === 0 && !loading ? "polite" : "off",
      },
      e("span", { className: "tl-time" }, trade.time),
      e("span", { className: priceClass }, formatPrice(trade.price)),
      e("span", { className: "tl-qty" }, formatVolume(trade.volume)),
      e("span", { className: `tl-side ${sideInfo.class}` }, sideInfo.label)
    );
  };

  if (error) {
    return e(
      "div",
      { className: "tl-widget tl-error" },
      e("div", { className: "tl-error-icon", "aria-hidden": "true" }, "⚠️"),
      e("p", { className: "tl-error-text" }, error),
      e(
        "button",
        {
          className: "tl-retry-btn",
          type: "button",
          onClick: onRefresh,
          "aria-label": "Thử lại tải nhật ký khớp lệnh"
        },
        "Thử lại"
      )
    );
  }

  return e(
    "div",
    { className: "tl-widget" },
    e(
      "div",
      { className: "tl-header" },
      e("h3", { className: "tl-title" }, "Nhật ký khớp lệnh (Trade Log)"),
      e(
        "div",
        { className: "tl-last-update" },
        `${trades?.length || 0} giao dịch`
      )
    ),
    e(
      "div",
      {
        className: "tl-list",
        role: "log",
        "aria-live": "polite",
        "aria-atomic": "false",
        "aria-label": "Danh sách khớp lệnh thời gian thực"
      },
      displayTrades.map((trade, i) => renderTrade(trade, i))
    ),
    trades?.length === 0 && !loading && !error && e(
      "div",
      { className: "tl-empty" },
      "Chưa có khớp lệnh trong phiên này"
    )
  );
}