import { createElement } from "react";

const e = createElement;

function signalColorClass(signal) {
  const s = String(signal || "").toLowerCase();
  if (s === "buy" || s === "strong_buy") return "sdp-signal-buy";
  if (s === "sell" || s === "strong_sell") return "sdp-signal-sell";
  return "sdp-signal-neutral";
}

function signalLabel(signal) {
  const map = {
    buy: "Mua",
    strong_buy: "Mua Mạnh",
    sell: "Bán",
    strong_sell: "Bán Mạnh",
    neutral: "Trung lập",
    hold: "Giữ",
    watch: "Theo dõi",
  };
  return map[String(signal || "").toLowerCase()] || signal || "—";
}

export function StockInsightDeck({
  advisory,
  selectedSession,
  loadingDeferred,
  news,
  financials,
  loadingNews,
  loadingFinancials
}) {
  const sessionLabel = selectedSession?.tradeDate
    ? new Date(selectedSession.tradeDate).toLocaleDateString("vi-VN")
    : "Hôm nay";

  return e(
    "div",
    { className: "sdp-insight-deck" },
    e(
      "div",
      { className: "sdp-deck-grid" },
      
      // Card 1: AI Advisory Card (Active & synced to session)
      e(
        "div",
        {
          className: `sdp-deck-card sdp-glass-card sdp-advisory-insight ${
            advisory ? signalColorClass(advisory.signal) : ""
          }`
        },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, "🤖 Khuyến Nghị Trí Tuệ Nhân Tạo AI"),
          e("span", { className: "sdp-card-badge" }, "Cố Vấn Phân Tích")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loadingDeferred
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", {
                  className: "sdp-skeleton sdp-skeleton-lg",
                  style: { width: "100%", height: "90px" }
                })
              )
            : advisory
            ? e(
                "div",
                { className: "sdp-advisory-content" },
                e(
                  "div",
                  { className: "sdp-advisory-headline" },
                  e(
                    "div",
                    { className: `sdp-advisory-badge-large ${signalColorClass(advisory.signal)}` },
                    signalLabel(advisory.signal)
                  ),
                  e(
                    "div",
                    { className: "sdp-advisory-meta-info" },
                    e("span", { className: "sdp-session-lbl" }, `Phiên giao dịch: ${sessionLabel}`),
                    advisory.confidence_score != null &&
                      e(
                        "span",
                        { className: "sdp-confidence-lbl" },
                        `Độ tin cậy: ${(Number(advisory.confidence_score) * 100).toFixed(0)}%`
                      )
                  )
                ),
                advisory.summary &&
                  e("p", { className: "sdp-advisory-summary" }, advisory.summary),
                advisory.rationale &&
                  e("p", { className: "sdp-advisory-rationale" }, advisory.rationale),
                advisory.generated_at &&
                  e(
                    "div",
                    { className: "sdp-advisory-footer-meta" },
                    `Cập nhật: ${new Date(advisory.generated_at).toLocaleString("vi-VN")}`
                  )
              )
            : e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "🧠"),
                e("p", null, "Chưa có khuyến nghị AI cho phiên này hoặc hệ thống đang phân tích.")
              )
        )
      ),

      // Card 2: Tin Tức Doanh Nghiệp (Degraded fallback state)
      e(
        "div",
        { className: "sdp-deck-card sdp-glass-card sdp-news-insight" },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, "📰 Tin Tức & Sự Kiện Mới Nhất"),
          e("span", { className: "sdp-card-badge" }, "Tin Doanh Nghiệp")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loadingNews
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", {
                  className: "sdp-skeleton sdp-skeleton-sm",
                  style: { width: "100%", height: "20px", marginBottom: "8px" }
                }),
                e("div", {
                  className: "sdp-skeleton sdp-skeleton-sm",
                  style: { width: "100%", height: "20px" }
                })
              )
            : news && news.length > 0
            ? e(
                "ul",
                { className: "sdp-insight-news-list" },
                news.map((item, idx) =>
                  e(
                    "li",
                    { key: item.id ?? idx, className: "sdp-news-item" },
                    e(
                      "span",
                      { className: "sdp-news-date" },
                      new Date(item.publish_date).toLocaleDateString("vi-VN")
                    ),
                    e(
                      "a",
                      {
                        href: item.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "sdp-news-title"
                      },
                      item.title
                    )
                  )
                )
              )
            : e(
                "div",
                { className: "sdp-degraded-fallback-card" },
                e("div", { className: "sdp-fallback-glow" }),
                e("span", { className: "sdp-fallback-icon" }, "📡"),
                e("h4", null, "Dữ Liệu Đang Di Trú"),
                e(
                  "p",
                  { className: "sdp-fallback-text" },
                  "Dữ liệu tin tức và sự kiện doanh nghiệp tạm thời chưa sẵn sàng hoặc đang được đồng bộ sang nền tảng SaaS Native."
                )
              )
        )
      ),

      // Card 3: Chỉ Số Tài Chính & Cơ Bản (Degraded fallback state)
      e(
        "div",
        { className: "sdp-deck-card sdp-glass-card sdp-financial-insight" },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, "📈 Chỉ Số Tài Chính & Nền Tảng"),
          e("span", { className: "sdp-card-badge" }, "Chỉ Số Cơ Bản")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loadingFinancials
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", {
                  className: "sdp-skeleton sdp-skeleton-lg",
                  style: { width: "100%", height: "80px" }
                })
              )
            : financials
            ? e(
                "div",
                { className: "sdp-financials-table" },
                e(
                  "div",
                  { className: "sdp-fin-row" },
                  e("span", null, "Doanh thu năm"),
                  e("strong", null, financials.revenue || "—")
                )
              )
            : e(
                "div",
                { className: "sdp-degraded-fallback-card" },
                e("div", { className: "sdp-fallback-glow" }),
                e("span", { className: "sdp-fallback-icon" }, "🏦"),
                e("h4", null, "Đồng Bộ Dữ Liệu"),
                e(
                  "p",
                  { className: "sdp-fallback-text" },
                  "Dữ liệu tài chính và các chỉ số cơ bản của doanh nghiệp đang được đồng bộ sang nền tảng SaaS Native."
                )
              )
        )
      )
    )
  );
}
