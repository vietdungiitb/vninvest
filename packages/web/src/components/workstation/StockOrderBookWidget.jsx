import { useMemo } from "react";
import { createElement } from "react";

/**
 * StockOrderBookWidget - Market Depth (Order Book) Display
 * 
 * Displays a side-by-side bids and asks table matching the class names
 * defined in StockDetailPage.css (.ob-widget, .ob-grid, .ob-side, etc.).
 * 
 * Accessibility:
 * - role="rowgroup", role="row" structure
 * - aria-live="polite" for dynamic updates
 * - Color-blind friendly styling via css borders and shapes
 * 
 * @param {Object} props
 * @param {Object} props.orderBook - { bids: [], asks: [], spread: number, timestamp: string }
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {Function} props.onRefresh
 */
export function StockOrderBookWidget({ orderBook, loading, error, onRefresh }) {
  const e = createElement;

  // Skeleton rows for loading state
  const skeletonRows = useMemo(() => [
    { price: null, volume: null },
    { price: null, volume: null },
    { price: null, volume: null },
  ], []);

  const formatVolume = (v) => {
    if (v == null) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString("vi-VN");
  };

  const formatPrice = (p) => {
    if (p == null) return "—";
    return Number(p).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const bids = orderBook?.bids ?? (loading ? skeletonRows : []);
  const asks = orderBook?.asks ?? (loading ? skeletonRows : []);
  const spread = orderBook?.spread ?? 0;

  // Calculate total bid/ask volume for the title badges
  const totalBidQty = useMemo(() => {
    return bids.reduce((acc, b) => acc + (Number(b.volume) || 0), 0);
  }, [bids]);

  const totalAskQty = useMemo(() => {
    return asks.reduce((acc, a) => acc + (Number(a.volume) || 0), 0);
  }, [asks]);

  // Calculate max volume for progress bar scaling
  const maxVolume = useMemo(() => {
    const allVolumes = [
      ...bids.map((b) => Number(b.volume) || 0),
      ...asks.map((a) => Number(a.volume) || 0),
    ];
    return Math.max(...allVolumes, 1);
  }, [bids, asks]);

  const renderLevel = (level, index, isBid) => {
    const isSkeleton = loading && level.price == null;
    const price = formatPrice(level.price);
    const volume = formatVolume(level.volume);
    const volNum = Number(level.volume) || 0;
    const pct = maxVolume > 0 ? (volNum / maxVolume) * 100 : 0;

    return e(
      "div",
      {
        key: `${isBid ? "bid" : "ask"}-${index}`,
        className: `ob-level ${isBid ? "bid" : "ask"} ${isSkeleton ? "ob-skeleton-level" : ""}`,
        role: "row",
        tabIndex: 0,
        "aria-label": isSkeleton 
          ? undefined 
          : `${isBid ? "Mua" : "Bán"} mức ${index + 1}: Giá ${price}, Khối lượng ${volume}`,
      },
      e("span", { className: "ob-price" }, price),
      e("span", { className: "ob-qty" }, volume),
      e(
        "div",
        { className: "ob-progress-wrap", "aria-hidden": "true" },
        e(
          "div",
          { className: "ob-progress-bg" },
          e("div", {
            className: "ob-progress-bar",
            style: { width: isSkeleton ? "0%" : `${Math.min(pct, 100)}%` },
          })
        )
      )
    );
  };

  if (error) {
    return e(
      "div",
      { className: "ob-widget ob-error" },
      e("div", { className: "ob-error-icon", "aria-hidden": "true" }, "⚠️"),
      e("p", { className: "ob-error-text" }, error),
      e(
        "button",
        {
          className: "ob-retry-btn",
          type: "button",
          onClick: onRefresh,
          "aria-label": "Thử lại tải sổ lệnh"
        },
        "Thử lại"
      )
    );
  }

  return e(
    "div",
    { className: "ob-widget" },
    e(
      "div",
      { className: "ob-header" },
      e("h3", { className: "ob-title" }, "Độ sâu thị trường (Market Depth)"),
      orderBook?.timestamp && e(
        "div",
        { className: "ob-last-update" },
        `Cập nhật: ${new Date(orderBook.timestamp).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
      )
    ),
    e(
      "div",
      { className: "ob-grid" },
      // Bids column (left)
      e(
        "div",
        { className: "ob-side bids" },
        e(
          "div",
          { className: "ob-side-title bids" },
          "Mua",
          totalBidQty > 0 && e("span", { className: "ob-total-qty" }, ` (${formatVolume(totalBidQty)})`)
        ),
        e(
          "div",
          { className: "ob-levels", role: "rowgroup", "aria-label": "Giá Mua (Bid)", "aria-live": "polite" },
          bids.map((bid, i) => renderLevel(bid, i, true))
        )
      ),
      // Asks column (right)
      e(
        "div",
        { className: "ob-side asks" },
        e(
          "div",
          { className: "ob-side-title asks" },
          "Bán",
          totalAskQty > 0 && e("span", { className: "ob-total-qty" }, ` (${formatVolume(totalAskQty)})`)
        ),
        e(
          "div",
          { className: "ob-levels", role: "rowgroup", "aria-label": "Giá Bán (Ask)", "aria-live": "polite" },
          asks.map((ask, i) => renderLevel(ask, i, false))
        )
      )
    )
  );
}