import { createElement } from "react";

const e = createElement;

function fmtPrice(v, locale = "vi-VN") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("vi-VN");
}

export function StockDetailHeader({
  symbol,
  profile,
  snapshot,
  loading,
  isWatched,
  onWatch,
  onAlertTrigger,
  onTradeTrigger
}) {
  const price = snapshot?.price ?? snapshot?.close_price ?? null;
  const change = snapshot?.change ?? snapshot?.price_change ?? null;
  const changePct = snapshot?.change_pct ?? snapshot?.price_change_pct ?? null;
  const marketCap = snapshot?.market_cap ?? null;
  const isUp = Number(change) >= 0;

  return e(
    "header",
    { className: "sdp-header" },
    e(
      "div",
      { className: "sdp-header-left" },
      e("div", { className: "sdp-ticker-badge" }, symbol),
      e(
        "div",
        { className: "sdp-header-meta" },
        loading
          ? e("div", { className: "sdp-skeleton sdp-skeleton-md", style: { width: "200px", height: "24px" } })
          : profile?.company_name
          ? e("h1", { className: "sdp-company-name" }, profile.company_name)
          : e("h1", { className: "sdp-company-name" }, symbol),
        e(
          "div",
          { className: "sdp-header-tags" },
          profile?.exchange && e("span", { className: "sdp-tag sdp-tag-exchange" }, profile.exchange),
          profile?.industry && e("span", { className: "sdp-tag sdp-tag-industry" }, profile.industry),
          snapshot?.stale && e("span", { className: "sdp-tag sdp-tag-stale" }, "⚠️ Chậm")
        )
      )
    ),
    e(
      "div",
      { className: "sdp-header-right" },
      loading
        ? e("div", { className: "sdp-price-block" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "120px", height: "36px" } }))
        : price != null
        ? e(
            "div",
            { className: "sdp-price-block" },
            e("span", { className: "sdp-price" }, fmtPrice(price)),
            change != null &&
              e(
                "span",
                { className: `sdp-change ${isUp ? "sdp-up" : "sdp-down"}` },
                `${isUp ? "▲" : "▼"} ${fmtPrice(Math.abs(change))}`,
                changePct != null && e("span", { className: "sdp-change-pct" }, ` (${Number(changePct).toFixed(2)}%)`)
              ),
            marketCap != null &&
              e(
                "div",
                { className: "sdp-market-cap" },
                "Vốn hóa: ",
                e("strong", null, fmtCompact(marketCap))
              )
          )
        : null,
      e(
        "div",
        { className: "sdp-action-group" },
        e(
          "button",
          {
            className: `sdp-watch-btn ${isWatched ? "sdp-watched" : ""}`,
            type: "button",
            onClick: onWatch,
            title: isWatched ? "Bỏ theo dõi" : "Thêm vào danh sách theo dõi"
          },
          isWatched ? "★ Đã theo dõi" : "☆ Theo dõi"
        ),
        e(
          "button",
          {
            className: "sdp-alert-btn",
            type: "button",
            onClick: onAlertTrigger,
            title: "Thiết lập cảnh báo giá/khối lượng"
          },
          "🔔 Cảnh báo"
        ),
        e(
          "button",
          {
            className: "sdp-trade-btn",
            type: "button",
            onClick: onTradeTrigger,
            title: "Mở giao dịch trực tiếp"
          },
          "⚡ Giao dịch"
        )
      )
    )
  );
}
