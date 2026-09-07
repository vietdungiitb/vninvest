import { createElement } from "react";
import { StockContextDeck } from "./StockContextDeck.js";
import { AIAdvisoryWarningBanner } from "./AIAdvisoryWarningBanner.js";
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

function signalColorClass(signal) {
  const s = String(signal || "").toLowerCase();
  if (s === "buy" || s === "strong_buy") return "sdp-signal-buy";
  if (s === "sell" || s === "strong_sell") return "sdp-signal-sell";
  return "sdp-signal-neutral";
}

function signalLabel(signal, t) {
  const tk = (k) => `stockDetail.page.${k}`;
  const key = String(signal || "").toLowerCase();
  const map = {
    buy: t(tk("signalBuy"), { defaultValue: "Mua" }),
    strong_buy: t(tk("signalStrongBuy"), { defaultValue: "Mua Mạnh" }),
    sell: t(tk("signalSell"), { defaultValue: "Bán" }),
    strong_sell: t(tk("signalStrongSell"), { defaultValue: "Bán Mạnh" }),
    neutral: t(tk("signalNeutral"), { defaultValue: "Trung lập" }),
    hold: t(tk("signalHold"), { defaultValue: "Giữ" }),
    watch: t(tk("signalWatch"), { defaultValue: "Theo dõi" }),
  };
  return map[key] || signal || "—";
}

export function StockDetailTabs({
  symbol,
  activeTab,
  setActiveTab,
  profile,
  loadingProfile,
  snapshot,
  orderFlowData,
  whaleFeed,
  whaleFeedMeta,
  onLoadMoreWhaleFeed,
  advisory,
  selectedSession,
  loadingDeferred,
  news,
  loadingNews,
  financials,
  loadingFinancials,
  onRefreshAdvisory,
  onOpenConfigDrawer
}) {
  const { t } = useI18n();
  const tk = (key) => `stockDetail.page.${key}`;

  const tabsList = [
    { id: "giao-dich", label: t(tk("tabGiaoDich")) },
    { id: "ho-so", label: t(tk("tabHoSo")) },
    { id: "co-dong", label: t(tk("tabCoDong")) },
    { id: "von-co-tuc", label: t(tk("tabVonCoTuc")) },
    { id: "tin-tuc", label: t(tk("tabTinTuc")) },
    { id: "su-kien", label: t(tk("tabSuKien")) },
    { id: "thong-ke", label: t(tk("tabThongKe")) },
    { id: "tai-chinh", label: t(tk("tabTaiChinh")) }
  ];

  // Helper renderers
  function renderGiaoDich() {
    const sessionLabel = selectedSession?.tradeDate
      ? new Date(selectedSession.tradeDate).toLocaleDateString("vi-VN")
      : t(tk("sessionToday"), { defaultValue: "Hôm nay" });

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-giao-dich" },
      // AI Advisory Warning Banner (fallback / key failure status)
      e(AIAdvisoryWarningBanner, {
        personalKeyFailed: advisory?.personal_key_failed,
        personalKeyError: advisory?.personal_key_error,
        usingSystemFallback: advisory?.using_system_fallback,
        fallbackRemaining: advisory?.fallback_quota_remaining,
        fallbackQuotaMax: 5,
        onConfigure: onOpenConfigDrawer,
      }),
      // AI Advisory Card at top of Transactions tab
      e(
        "div",
        { className: `sdp-deck-card sdp-glass-card sdp-advisory-insight ${advisory ? signalColorClass(advisory.signal) : ""}`, style: { marginBottom: "20px" } },
        e(
          "div",
          { className: "sdp-card-header", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          e("h3", null, `🤖 ${t(tk("aiAdvisoryTitle"))}`),
          e(
            "div",
            { style: { display: "flex", gap: "8px", alignItems: "center" } },
            e(
              "button",
              {
                className: "sdp-advisory-header-btn",
                type: "button",
                onClick: onOpenConfigDrawer,
                title: t(tk("advisoryConfigTitle"), { defaultValue: "Cấu hình nguồn và chỉ báo AI" }),
                style: { background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.4)", color: "#a5b4fc", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600" }
              },
              `⚙️ ${t(tk("advisoryConfig"))}`
            ),
            e(
              "button",
              {
                className: "sdp-advisory-header-btn",
                type: "button",
                onClick: onRefreshAdvisory,
                title: t(tk("advisoryRefreshTitle"), { defaultValue: "Làm mới thông minh với cấu hình đã chọn" }),
                disabled: loadingDeferred,
                style: { background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#6ee7b7", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600", opacity: loadingDeferred ? 0.6 : 1 }
              },
              loadingDeferred ? t(tk("advisoryAnalyzing")) : `↻ ${t(tk("advisoryRefresh"))}`
            ),
            e("span", { className: "sdp-card-badge" }, t(tk("advisoryConsultant")))
          )
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loadingDeferred
            ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "80px" } }))
            : advisory && (advisory.advisory_text || advisory.summary || advisory.signal)
            ? e(
                "div",
                { className: "sdp-advisory-content" },
                e(
                  "div",
                  { className: "sdp-advisory-headline" },
                  // T1.1: badge chỉ hiện khi signal tồn tại, fallback không hiển thị badge rỗng
                  advisory.signal
                    ? e("div", { className: `sdp-advisory-badge-large ${signalColorClass(advisory.signal)}` }, signalLabel(advisory.signal, t))
                    : null,
                  e(
                    "div",
                    { className: "sdp-advisory-meta-info" },
                    e("span", { className: "sdp-session-lbl" }, t(tk("sessionLabel"), { label: sessionLabel, defaultValue: `Phiên giao dịch: ${sessionLabel}` })),
                    advisory.confidence_score != null && e("span", { className: "sdp-confidence-lbl" }, t(tk("confidenceLabel"), { value: (Number(advisory.confidence_score) * 100).toFixed(0), defaultValue: `Độ tin cậy: ${(Number(advisory.confidence_score) * 100).toFixed(0)}%` }))
                  )
                ),
                // T1.1: render advisory_text là nội dung chính (Markdown fallback = pre-wrap), backward-compat với record cũ chỉ có advisory_text
                advisory.advisory_text
                  ? e("div", { className: "sdp-advisory-text", style: { whiteSpace: "pre-wrap", lineHeight: "1.65", color: "#e2e8f0", fontSize: "0.92rem", margin: "10px 0 8px", wordBreak: "break-word" } }, advisory.advisory_text)
                  : null,
                advisory.summary && e("p", { className: "sdp-advisory-summary" }, advisory.summary),
                advisory.rationale && e("p", { className: "sdp-advisory-rationale" }, advisory.rationale),
                advisory.generated_at && e("div", { className: "sdp-advisory-footer-meta" }, `Cập nhật: ${new Date(advisory.generated_at).toLocaleString("vi-VN")}`)
              )
            : e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "🧠"),
                e("p", null, t(tk("advisoryEmpty")))
              )
        )
      ),
      // StockContextDeck (Shark Alerts, depth, strength matrix) — T1.4: forward pagination meta (R-8)
      e(StockContextDeck, {
        symbol,
        selectedSession,
        snapshot,
        orderFlowData,
        whaleFeed,
        whaleFeedMeta,
        onLoadMoreWhaleFeed,
        loading: loadingDeferred
      })
    );
  }

  function renderHoSo() {
    const overview = profile?.overview || {};
    const officers = profile?.officers || [];

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-ho-so" },
      loadingProfile
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "200px" } }))
        : e(
            "div",
            { className: "sdp-profile-layout" },
            // Section 1: Overview Grid
            e(
              "div",
              { className: "sdp-profile-section sdp-glass-card" },
              e("h3", { className: "sdp-section-title" }, `ℹ️ ${t(tk("overviewTitle"))}`),
              e(
                "div",
                { className: "sdp-overview-grid" },
                e("div", { className: "sdp-overview-item" }, e("span", null, "Ngày thành lập:"), e("strong", null, overview.founded_date || "—")),
                e("span", { className: "sdp-overview-divider" }),
                e("div", { className: "sdp-overview-item" }, e("span", null, "Ngày niêm yết:"), e("strong", null, overview.listing_date || "—")),
                e("span", { className: "sdp-overview-divider" }),
                e("div", { className: "sdp-overview-item" }, e("span", null, "Website:"), e("strong", null, overview.website ? e("a", { href: overview.website, target: "_blank", rel: "noreferrer" }, overview.website) : "—")),
                e("span", { className: "sdp-overview-divider" }),
                e("div", { className: "sdp-overview-item" }, e("span", null, "Email:"), e("strong", null, overview.email || "—")),
                e("span", { className: "sdp-overview-divider" }),
                e("div", { className: "sdp-overview-item" }, e("span", null, "Điện thoại:"), e("strong", null, overview.phone || "—")),
                e("span", { className: "sdp-overview-divider" }),
                e("div", { className: "sdp-overview-item sdp-full-width" }, e("span", null, "Địa chỉ:"), e("strong", null, overview.address || "—"))
              ),
              overview.business_model && e(
                "div",
                { className: "sdp-business-model", style: { marginTop: "20px" } },
                e("h4", null, t(tk("businessModel"))),
                e("p", { style: { whiteSpace: "pre-line", color: "#94a3b8", fontSize: "0.9rem", lineHeight: "1.6" } }, overview.business_model)
              )
            ),
            // Section 2: Officers (Ban Lãnh Đạo)
            e(
              "div",
              { className: "sdp-profile-section sdp-glass-card", style: { marginTop: "20px" } },
              e("h3", { className: "sdp-section-title" }, `👥 ${t(tk("officersTitle"))}`),
              officers.length > 0
                ? e(
                    "table",
                    { className: "sdp-premium-table" },
                    e("thead", null, e("tr", null, e("th", null, t(tk("officerName"))), e("th", null, t(tk("officerRole"))), e("th", null, t(tk("officerSince"))))),
                    e(
                      "tbody",
                      null,
                      officers.map((off, i) => e("tr", { key: i }, e("td", null, off.name), e("td", null, off.position), e("td", null, off.from_date || "—")))
                    )
                  )
                : e("p", { className: "sdp-empty-placeholder" }, t(tk("noOfficers")))
            )
          )
    );
  }

  function renderCoDong() {
    const shareholders = profile?.shareholders || [];

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-co-dong" },
      loadingProfile
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "200px" } }))
        : e(
            "div",
            { className: "sdp-glass-card" },
            e("h3", { className: "sdp-section-title" }, `🏛️ ${t(tk("shareholdersTitle"))}`),
            shareholders.length > 0
              ? e(
                  "table",
                  { className: "sdp-premium-table" },
                  e("thead", null, e("tr", null, e("th", null, t(tk("shareholderName"))), e("th", { style: { textAlign: "right" } }, t(tk("shareholderShares"))), e("th", { style: { textAlign: "right" } }, t(tk("shareholderPct"))))),
                  e(
                    "tbody",
                    null,
                    shareholders
                      .slice()
                      .sort((a, b) => (b.ownership_percentage || 0) - (a.ownership_percentage || 0))
                      .map((sh, i) =>
                        e(
                          "tr",
                          { key: i },
                          e("td", null, sh.name),
                          e("td", { style: { textAlign: "right" } }, sh.shares_owned != null ? sh.shares_owned.toLocaleString("vi-VN") : "—"),
                          e("td", { style: { textAlign: "right", fontWeight: "bold", color: "#6366f1" } }, sh.ownership_percentage != null ? `${sh.ownership_percentage.toFixed(2)}%` : "—")
                        )
                      )
                  )
                )
               : e("p", { className: "sdp-empty-placeholder" }, t(tk("noShareholders")))
          )
    );
  }

  function renderVonCoTuc() {
    const overview = profile?.overview || {};
    const divYield = financials?.ratio?.find(r => r.item_id === "dividend_yield")
      ?? snapshot?.dividend_yield
      ?? null;

    const divYieldVal = divYield
      ? (typeof divYield === "object"
          ? (Object.values(divYield).find(v => typeof v === "number") ?? null)
          : Number(divYield))
      : null;

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-von-co-tuc" },
      loadingProfile
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "150px" } }))
        : e(
            "div",
            { className: "sdp-glass-card" },
            e("h3", { className: "sdp-section-title" }, `💸 ${t(tk("capitalTitle"))}`),
            e(
              "div",
              { className: "sdp-overview-grid" },
               e("div", { className: "sdp-overview-item" }, e("span", null, t(tk("charterCapital"))), e("strong", { className: "text-cyan" }, overview.charter_capital ? `${overview.charter_capital.toLocaleString("vi-VN")} tỷđ` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, t(tk("listedVolume"))), e("strong", null, overview.listed_volume ? `${fmtCompact(overview.listed_volume * 1000000)} CP` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, t(tk("outstandingShares"))), e("strong", null, profile.outstanding_shares ? `${profile.outstanding_shares.toLocaleString("vi-VN")} CP` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, t(tk("dividendYield"))), e("strong", { className: "text-green" }, divYieldVal != null ? `${(divYieldVal * 100).toFixed(2)}%` : "—"))
            )
          )
    );
  }

  function renderTinTuc() {
    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-tin-tuc" },
      loadingNews
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-sm", style: { width: "100%", height: "20px", marginBottom: "8px" } }))
        : news && news.length > 0
        ? e(
            "div",
            { className: "sdp-glass-card" },
            e("h3", { className: "sdp-section-title" }, `📰 ${t(tk("newsTitle"))}`),
            e(
              "ul",
              { className: "sdp-insight-news-list" },
              news.slice(0, 15).map((item, idx) =>
                e(
                  "li",
                  { key: item.news_id ?? idx, className: "sdp-news-item" },
                  e("span", { className: "sdp-news-date" }, item.published_at ? new Date(item.published_at).toLocaleDateString("vi-VN") : "—"),
                  e("span", { className: "sdp-news-source" }, item.source || "Google News"),
                  e(
                    "a",
                    { href: item.url, target: "_blank", rel: "noopener noreferrer", className: "sdp-news-title" },
                    item.title
                  )
                )
              )
            )
          )
        : e(
            "div",
            { className: "sdp-deck-empty" },
            e("span", { className: "sdp-empty-icon" }, "📡"),
            e("p", null, t(tk("noNews")))
          )
    );
  }

  function renderSuKien() {
    const events = profile?.events || [];

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-su-kien" },
      loadingProfile
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "150px" } }))
        : e(
            "div",
            { className: "sdp-glass-card" },
            e("h3", { className: "sdp-section-title" }, `🗓️ ${t(tk("eventsTitle"))}`),
            events.length > 0
              ? e(
                  "table",
                  { className: "sdp-premium-table" },
                  e("thead", null, e("tr", null, e("th", null, t(tk("eventDate"))), e("th", null, t(tk("eventName"))))),
                  e(
                    "tbody",
                    null,
                    events.map((ev, i) =>
                      e(
                        "tr",
                        { key: i },
                        e("td", null, ev.date ? new Date(ev.date).toLocaleDateString("vi-VN") : "—"),
                        e("td", null, ev.title || ev.event_description || "—")
                      )
                    )
                  )
                )
               : e("p", { className: "sdp-empty-placeholder" }, t(tk("noEvents")))
          )
    );
  }

  function renderThongKe() {
    const ratioList = financials?.ratio || [];
    const getRatioValue = (itemId) => {
      const row = ratioList.find(r => r.item_id === itemId);
      if (!row) return "—";
      // Find the first column representing a date (e.g. "2026-Q1", "2025-Q4")
      const firstPeriodKey = Object.keys(row).find(k => k !== "item" && k !== "item_id" && row[k] !== null);
      if (!firstPeriodKey) return "—";
      const val = Number(row[firstPeriodKey]);
      return Number.isFinite(val) ? val.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "—";
    };

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-thong-ke" },
      loadingFinancials
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "150px" } }))
        : e(
            "div",
            { className: "sdp-glass-card" },
            e("h3", { className: "sdp-section-title" }, `📈 ${t(tk("statsTitle"))}`),
            e(
              "div",
              { className: "sdp-stats-grid" },
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("pe"))), e("strong", { className: "text-green" }, getRatioValue("p_e"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("pb"))), e("strong", { className: "text-cyan" }, getRatioValue("p_b"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("eps"))), e("strong", null, getRatioValue("trailing_eps"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("roe"))), e("strong", null, getRatioValue("roe") !== "—" ? `${getRatioValue("roe")}%` : (getRatioValue("roe_trailling") !== "—" ? `${getRatioValue("roe_trailling")}%` : "—"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("roa"))), e("strong", null, getRatioValue("roa") !== "—" ? `${getRatioValue("roa")}%` : (getRatioValue("roa_trailling") !== "—" ? `${getRatioValue("roa_trailling")}%` : "—"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("beta"))), e("strong", null, getRatioValue("beta"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, t(tk("bvps"))), e("strong", null, getRatioValue("book_value_per_share_bvps")))
            )
          )
    );
  }

  function renderTaiChinh() {
    const incList = financials?.income_statement || [];
    const balList = financials?.balance_sheet || [];

    // Find all quarterly periods across arrays — T2.4 FE-only: nới từ 4 lên 8 kỳ (BE đã trả đủ, vnbroker_adapter:1059)
    const getPeriods = (list) => {
      if (!list || list.length === 0) return [];
      const keys = Object.keys(list[0]).filter(k => k !== "item" && k !== "item_id");
      return keys.slice(0, 8); // T2.4: hiển thị 8 kỳ gần nhất thay vì 4
    };

    const incPeriods = getPeriods(incList);
    const balPeriods = getPeriods(balList);

    return e(
      "div",
      { className: "sdp-tab-panel sdp-panel-tai-chinh" },
      loadingFinancials
        ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "300px" } }))
        : e(
            "div",
            { className: "sdp-financials-layout" },
            // Inc Table
            e(
              "div",
              { className: "sdp-glass-card", style: { marginBottom: "20px" } },
              e("h3", { className: "sdp-section-title" }, `📊 ${t(tk("incomeTitle"))}`),
              incList.length > 0 && incPeriods.length > 0
                ? e(
                    "table",
                    { className: "sdp-premium-table sdp-table-dense" },
                    e(
                      "thead",
                      null,
                      e(
                        "tr",
                        null,
                        e("th", null, t(tk("metric"))),
                        incPeriods.map(p => e("th", { key: p, style: { textAlign: "right" } }, p))
                      )
                    ),
                    e(
                      "tbody",
                      null,
                      incList.map((row, i) =>
                        e(
                          "tr",
                          { key: i },
                          e("td", { style: { fontWeight: row.item_id.startsWith("i") || row.item_id.startsWith("x") ? "bold" : "normal" } }, row.item),
                          incPeriods.map(p =>
                            e(
                              "td",
                              { key: p, style: { textAlign: "right" } },
                              row[p] != null
                                ? (typeof row[p] === "number"
                                    ? fmtCompact(row[p])
                                    : row[p])
                                : "—"
                            )
                          )
                        )
                      )
                    )
                  )
                 : e("p", { className: "sdp-empty-placeholder" }, t(tk("noIncome")))
            ),
            // Bal Table
            e(
              "div",
              { className: "sdp-glass-card" },
              e("h3", { className: "sdp-section-title" }, `⚖️ ${t(tk("balanceTitle"))}`),
              balList.length > 0 && balPeriods.length > 0
                ? e(
                    "table",
                    { className: "sdp-premium-table sdp-table-dense" },
                    e(
                      "thead",
                      null,
                      e(
                        "tr",
                        null,
                        e("th", null, t(tk("metric"))),
                        balPeriods.map(p => e("th", { key: p, style: { textAlign: "right" } }, p))
                      )
                    ),
                    e(
                      "tbody",
                      null,
                      balList.map((row, i) =>
                        e(
                          "tr",
                          { key: i },
                          e("td", { style: { fontWeight: row.item_id.startsWith("total") || row.item_id.includes("liabilities") ? "bold" : "normal" } }, row.item),
                          balPeriods.map(p =>
                            e(
                              "td",
                              { key: p, style: { textAlign: "right" } },
                              row[p] != null
                                ? (typeof row[p] === "number"
                                    ? fmtCompact(row[p])
                                    : row[p])
                                : "—"
                            )
                          )
                        )
                      )
                    )
                  )
                 : e("p", { className: "sdp-empty-placeholder" }, t(tk("noBalance")))
            )
          )
    );
  }

  // Active panel dispatcher
  function renderActivePanel() {
    switch (activeTab) {
      case "giao-dich":
        return renderGiaoDich();
      case "ho-so":
        return renderHoSo();
      case "co-dong":
        return renderCoDong();
      case "von-co-tuc":
        return renderVonCoTuc();
      case "tin-tuc":
        return renderTinTuc();
      case "su-kien":
        return renderSuKien();
      case "thong-ke":
        return renderThongKe();
      case "tai-chinh":
        return renderTaiChinh();
      default:
        return renderGiaoDich();
    }
  }

  return e(
    "div",
    { className: "sdp-tabs-container" },
    // Tab Headers Bar
    e(
      "div",
      { className: "sdp-tabs-header-bar" },
      tabsList.map(tab =>
        e(
          "button",
          {
            key: tab.id,
            className: `sdp-tab-btn ${activeTab === tab.id ? "sdp-tab-btn-active" : ""}`,
            type: "button",
            onClick: () => setActiveTab(tab.id)
          },
          tab.label
        )
      )
    ),
    // Tab Content Panel
    e("div", { className: "sdp-tabs-content-pane" }, renderActivePanel())
  );
}
