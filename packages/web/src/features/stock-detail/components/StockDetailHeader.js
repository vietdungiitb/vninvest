import { createElement } from "react";

const e = createElement;

function fmtPrice(v, locale = "vi-VN") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPriceColorClass(price, refPrice, ceilPrice, floorPrice) {
  const p = Number(price);
  const ref = Number(refPrice);
  const ceil = Number(ceilPrice);
  const floor = Number(floorPrice);
  if (!Number.isFinite(p)) return "sdp-price-yellow";
  if (ceil && p >= ceil) return "sdp-price-purple"; // Trần (Tím)
  if (floor && p <= floor) return "sdp-price-cyan"; // Sàn (Xanh lơ)
  if (ref && p === ref) return "sdp-price-yellow"; // Tham chiếu (Vàng)
  if (ref && p > ref) return "sdp-price-green"; // Tăng (Xanh lá)
  if (ref && p < ref) return "sdp-price-red"; // Giảm (Đỏ)
  return "sdp-price-yellow";
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
  const companyName = profile?.company_name || snapshot?.company_name || symbol;
  const exchange = profile?.exchange || snapshot?.exchange || "";
  const industry = profile?.industry || snapshot?.industry || "";

  const price = snapshot?.current_price ?? snapshot?.price ?? snapshot?.close_price ?? null;
  const change = snapshot?.change_value ?? snapshot?.change ?? snapshot?.price_change ?? null;
  const changePct = snapshot?.change_pct ?? snapshot?.price_change_pct ?? null;

  const ceil = snapshot?.ceiling_price ?? null;
  const floor = snapshot?.floor_price ?? null;
  const ref = snapshot?.reference_price ?? snapshot?.prev_price ?? null;
  const open = snapshot?.open_price ?? null;
  const average = snapshot?.average_price ?? null;
  const high = snapshot?.high_price ?? null;
  const low = snapshot?.low_price ?? null;
  const volume = snapshot?.volume ?? null;

  const isUp = Number(change) >= 0;
  const priceColorClass = getPriceColorClass(price, ref, ceil, floor);

  return e(
    "header",
    { className: "sdp-premium-header" },
    
    // Hàng 1: Badge + Tên công ty + Tags + Actions
    e(
      "div",
      { className: "sdp-header-row-1" },
      e(
        "div",
        { className: "sdp-header-left" },
        e("div", { className: "sdp-ticker-badge" }, symbol),
        e(
          "div",
          { className: "sdp-header-meta" },
          loading
            ? e("div", { className: "sdp-skeleton sdp-skeleton-md", style: { width: "200px", height: "24px" } })
            : e("h1", { className: "sdp-company-name" }, companyName),
          e(
            "div",
            { className: "sdp-header-tags" },
            exchange && e("span", { className: "sdp-tag sdp-tag-exchange" }, exchange),
            industry && e("span", { className: "sdp-tag sdp-tag-industry" }, industry),
            snapshot?.stale && e("span", { className: "sdp-tag sdp-tag-stale" }, "⚠️ Chậm")
          )
        )
      ),
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
            title: "Bật/Tắt khuyến nghị AI và phân tích cơ bản"
          },
          "🤖 Phân tích cơ bản"
        ),
        e(
          "button",
          {
            className: "sdp-trade-btn",
            type: "button",
            onClick: onTradeTrigger,
            title: "Mở bảng đặt lệnh nhanh"
          },
          "⚡ Đặt lệnh"
        )
      )
    ),

    // Hàng 2: Giá lớn + Mũi tên xu hướng + Chênh lệch và %
    price != null && e(
      "div",
      { className: "sdp-header-row-2" },
      e(
        "div",
        { className: `sdp-large-price-block ${priceColorClass}` },
        e("span", { className: "sdp-large-price" }, fmtPrice(price)),
        change != null && e(
          "span",
          { className: "sdp-large-change" },
          isUp ? "▲" : "▼",
          " ",
          fmtPrice(Math.abs(change)),
          changePct != null && e("span", { className: "sdp-large-change-pct" }, ` (${isUp ? "+" : ""}${Number(changePct).toFixed(2)}%)`)
        )
      )
    ),

    // Hàng 3: Chỉ số iBoard SSI (Trần, Sàn, TC, Mở cửa, TB, Thấp, Cao, KL)
    e(
      "div",
      { className: "sdp-header-row-3" },
      e(
        "div",
        { className: "sdp-index-strip" },
        e("span", { className: "sdp-strip-item" }, "Trần: ", e("strong", { className: "text-purple" }, fmtPrice(ceil))),
        e("span", { className: "sdp-strip-divider" }, "|"),
        e("span", { className: "sdp-strip-item" }, "Sàn: ", e("strong", { className: "text-cyan" }, fmtPrice(floor))),
        e("span", { className: "sdp-strip-divider" }, "|"),
        e("span", { className: "sdp-strip-item" }, "Tham chiếu: ", e("strong", { className: "text-yellow" }, fmtPrice(ref))),
        e("span", { className: "sdp-strip-divider" }, "|"),
        e(
          "span",
          { className: "sdp-strip-item" },
          "Mở cửa / Trung bình: ",
          e("strong", { className: getPriceColorClass(open, ref, ceil, floor) }, fmtPrice(open)),
          " / ",
          e("strong", { className: getPriceColorClass(average, ref, ceil, floor) }, fmtPrice(average))
        ),
        e("span", { className: "sdp-strip-divider" }, "|"),
        e(
          "span",
          { className: "sdp-strip-item" },
          "Thấp / Cao: ",
          e("strong", { className: getPriceColorClass(low, ref, ceil, floor) }, fmtPrice(low)),
          " / ",
          e("strong", { className: getPriceColorClass(high, ref, ceil, floor) }, fmtPrice(high))
        ),
        e("span", { className: "sdp-strip-divider" }, "|"),
        e("span", { className: "sdp-strip-item" }, "Tổng KL: ", e("strong", { className: "text-white" }, volume != null ? volume.toLocaleString("vi-VN") : "—"))
      )
    )
  );
}
