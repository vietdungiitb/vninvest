import { createElement } from "react";
import { useI18n } from "../../../context/LangContext.js";

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

export function StockContextDeck({
  symbol,
  selectedSession,
  snapshot,
  orderFlowData,
  whaleFeed,
  loading
}) {
  const { t } = useI18n();
  const tk = (key) => `stockDetail.page.${key}`;

  const hasActiveSession = !!selectedSession;
  
  // Calculate Buy/Sell ratios or institutions ratio if available — no fake hardcoded defaults
  const institutionalBuy = orderFlowData?.institutional_buy ?? snapshot?.institutional_buy ?? null;
  const retailBuy = orderFlowData?.retail_buy ?? snapshot?.retail_buy ?? null;
  const totalBuyStrength = (institutionalBuy != null && retailBuy != null) ? (institutionalBuy + retailBuy) : null;

  return e(
    "div",
    { className: "sdp-context-deck" },
    e(
      "div",
      { className: "sdp-deck-grid" },
      
      // Card 1: Khớp lệnh trong ngày & Dòng tiền cá mập
      e(
        "div",
        { className: "sdp-deck-card sdp-glass-card sdp-matched-transactions" },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, `🦈 ${t(tk("sharkTitle"))} ${hasActiveSession ? `(${t(tk("sharkSession"))})` : `(${t(tk("sharkRealtime"))})`}`),
          e("span", { className: "sdp-card-badge" }, "CVD & Dark Flow")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loading
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "20px", marginBottom: "8px" } }),
                e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "20px", marginBottom: "8px" } }),
                e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "20px" } })
              )
            : whaleFeed && whaleFeed.length > 0
            ? e(
                "ul",
                { className: "sdp-matched-list" },
                whaleFeed.slice(0, 5).map((ev, idx) => {
                  const side = (ev.side || "buy").toLowerCase();
                  const isBuy = side === "buy";
                  return e(
                    "li",
                    { key: ev.id ?? ev.event_id ?? idx, className: `sdp-matched-item side-${side}` },
                    e("span", { className: `sdp-indicator-dot ${isBuy ? "dot-buy" : "dot-sell"}` }),
                    e(
                      "span",
                      { className: "sdp-matched-time" },
                      ev.event_time ?? ev.triggered_at
                        ? new Date(ev.event_time ?? ev.triggered_at).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "—"
                    ),
                    e(
                      "span",
                      { className: `sdp-matched-side ${isBuy ? "text-buy" : "text-sell"}` },
                      isBuy ? t(tk("buyActive")) : t(tk("sellActive"))
                    ),
                    e("span", { className: "sdp-matched-vol" }, `${fmtCompact(ev.volume ?? ev.net_volume)} CP`),
                    e("span", { className: "sdp-matched-price" }, fmtPrice(ev.price ?? ev.avg_price))
                  );
                })
              )
            : e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "🌊"),
                e("p", null, t(tk("noWhale")))
              )
        )
      ),

      // Card 2: Độ sâu thị trường & Thanh khoản (Truthful State — no fabricated content)
      e(
        "div",
        { className: "sdp-deck-card sdp-glass-card sdp-market-depth" },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, `📊 ${t(tk("depthTitle"))}`),
          e("span", { className: "sdp-card-badge" }, "Order Book")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loading
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "80px" } })
              )
            : (!snapshot || (snapshot.total_buy_qty == null && snapshot.total_sell_qty == null && snapshot.volume == null && snapshot.turnover == null && snapshot.total_value == null))
            ? e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "📊"),
                e("p", null, t(tk("noDepth")))
              )
            : e(
                "div",
                { className: "sdp-depth-analysis" },
                e(
                  "div",
                  { className: "sdp-depth-bars" },
                  e(
                    "div",
                    { className: "sdp-depth-bar-row" },
                    e("span", { className: "sdp-depth-label" }, t(tk("totalBuy"))),
                    e("span", { className: "sdp-depth-value text-buy" }, snapshot.total_buy_qty != null ? `${fmtCompact(snapshot.total_buy_qty)} CP` : "—")
                  ),
                  e(
                    "div",
                    { className: "sdp-depth-progress-container" },
                    (snapshot.total_buy_qty != null && snapshot.total_sell_qty != null && (snapshot.total_buy_qty + snapshot.total_sell_qty) > 0)
                      ? e("div", {
                          className: "sdp-depth-progress-fill fill-buy",
                          style: {
                            width: `${(snapshot.total_buy_qty / (snapshot.total_buy_qty + snapshot.total_sell_qty)) * 100}%`
                          }
                        })
                      : e("div", {
                          className: "sdp-depth-progress-fill fill-empty",
                          style: { width: "0%" }
                        })
                  ),
                  e(
                    "div",
                    { className: "sdp-depth-bar-row" },
                    e("span", { className: "sdp-depth-label" }, t(tk("totalSell"))),
                    e("span", { className: "sdp-depth-value text-sell" }, snapshot.total_sell_qty != null ? `${fmtCompact(snapshot.total_sell_qty)} CP` : "—")
                  )
                ),
                e(
                  "div",
                  { className: "sdp-depth-stats-grid" },
                  e(
                    "div",
                    { className: "sdp-depth-stat" },
                    e("span", { className: "sdp-depth-stat-lbl" }, t(tk("matchedVolume"))),
                    e("strong", { className: "sdp-depth-stat-val" }, fmtCompact(snapshot.volume ?? snapshot.total_volume))
                  ),
                  e(
                    "div",
                    { className: "sdp-depth-stat" },
                    e("span", { className: "sdp-depth-stat-lbl" }, t(tk("tradeValue"))),
                    e(
                      "strong", 
                      { className: "sdp-depth-stat-val" }, 
                      (snapshot.turnover ?? snapshot.total_value) != null 
                        ? `${fmtCompact(snapshot.turnover ?? snapshot.total_value)}đ` 
                        : snapshot.price != null && snapshot.volume != null 
                          ? `${fmtCompact(snapshot.price * snapshot.volume * 1000)}đ` 
                          : "—"
                    )
                  )
                )
              )
        )
      ),

      // Card 3: Cơ cấu lực mua & Lực bán chủ động (Truthful State — no fabricated ratios)
      e(
        "div",
        { className: "sdp-deck-card sdp-glass-card sdp-force-distribution" },
        e(
          "div",
          { className: "sdp-card-header" },
          e("h3", null, `🛡️ ${t(tk("strengthTitle"))}`),
          e("span", { className: "sdp-card-badge" }, "Institutional / Retail")
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loading
            ? e(
                "div",
                { className: "sdp-card-loader" },
                e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "30px", marginBottom: "12px" } }),
                e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "30px" } })
              )
            : (institutionalBuy == null && retailBuy == null)
            ? e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "🛡️"),
                e("p", null, t(tk("noStrength")))
              )
            : e(
                "div",
                { className: "sdp-strength-breakdown" },
                e(
                  "div",
                  { className: "sdp-strength-row" },
                  e(
                    "div",
                    { className: "sdp-strength-row-info" },
                    e("span", null, t(tk("instBuy"))),
                    e("strong", null, institutionalBuy != null ? `${(institutionalBuy * 100).toFixed(0)}%` : "—")
                  ),
                  e(
                    "div",
                    { className: "sdp-strength-progress" },
                    e("div", { className: "sdp-strength-fill institutional", style: { width: institutionalBuy != null ? `${institutionalBuy * 100}%` : "0%" } })
                  )
                ),
                e(
                  "div",
                  { className: "sdp-strength-row" },
                  e(
                    "div",
                    { className: "sdp-strength-row-info" },
                    e("span", null, t(tk("retailBuy"))),
                    e("strong", null, retailBuy != null ? `${(retailBuy * 100).toFixed(0)}%` : "—")
                  ),
                  e(
                    "div",
                    { className: "sdp-strength-progress" },
                    e("div", { className: "sdp-strength-fill retail", style: { width: retailBuy != null ? `${retailBuy * 100}%` : "0%" } })
                  )
                ),
                e(
                  "div",
                  { className: "sdp-strength-summary" },
                  e("span", { className: "sdp-strength-summary-lbl" }, t(tk("netBuySummary"))),
                  e(
                    "span",
                    { className: `sdp-strength-summary-val ${(totalBuyStrength ?? 0) >= 0.5 ? "text-buy" : "text-sell"}` },
                    totalBuyStrength == null 
                      ? "—" 
                      : totalBuyStrength >= 0.65 
                        ? t(tk("dominateBuy")) 
                        : totalBuyStrength >= 0.5 
                          ? t(tk("activeBuy")) 
                          : t(tk("activeSell"))
                  )
                )
              )
        )
      )
    )
  );
}
