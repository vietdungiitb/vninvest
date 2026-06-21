import { createElement } from "react";
import { StockContextDeck } from "./StockContextDeck.js";
import { AIAdvisoryWarningBanner } from "./AIAdvisoryWarningBanner.js";

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

export function StockDetailTabs({
  symbol,
  activeTab,
  setActiveTab,
  profile,
  loadingProfile,
  snapshot,
  orderFlowData,
  whaleFeed,
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
  const tabsList = [
    { id: "giao-dich", label: "Giao dịch" },
    { id: "ho-so", label: "Hồ sơ" },
    { id: "co-dong", label: "Cổ đông" },
    { id: "von-co-tuc", label: "Vốn và cổ tức" },
    { id: "tin-tuc", label: "Tin tức" },
    { id: "su-kien", label: "Lịch sử sự kiện" },
    { id: "thong-ke", label: "Thống kê" },
    { id: "tai-chinh", label: "Tài chính" }
  ];

  // Helper renderers
  function renderGiaoDich() {
    const sessionLabel = selectedSession?.tradeDate
      ? new Date(selectedSession.tradeDate).toLocaleDateString("vi-VN")
      : "Hôm nay";

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
          e("h3", null, "🤖 Khuyến Nghị Trí Tuệ Nhân Tạo AI"),
          e(
            "div",
            { style: { display: "flex", gap: "8px", alignItems: "center" } },
            e(
              "button",
              {
                className: "sdp-advisory-header-btn",
                type: "button",
                onClick: onOpenConfigDrawer,
                title: "Cấu hình nguồn và chỉ báo AI",
                style: { background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.4)", color: "#a5b4fc", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600" }
              },
              "⚙️ Cài đặt"
            ),
            e(
              "button",
              {
                className: "sdp-advisory-header-btn",
                type: "button",
                onClick: onRefreshAdvisory,
                title: "Làm mới thông minh với cấu hình đã chọn",
                disabled: loadingDeferred,
                style: { background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#6ee7b7", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600", opacity: loadingDeferred ? 0.6 : 1 }
              },
              loadingDeferred ? "Đang phân tích..." : "↻ Làm mới"
            ),
            e("span", { className: "sdp-card-badge" }, "Cố Vấn Phân Tích")
          )
        ),
        e(
          "div",
          { className: "sdp-card-content" },
          loadingDeferred
            ? e("div", { className: "sdp-card-loader" }, e("div", { className: "sdp-skeleton sdp-skeleton-lg", style: { width: "100%", height: "80px" } }))
            : advisory
            ? e(
                "div",
                { className: "sdp-advisory-content" },
                e(
                  "div",
                  { className: "sdp-advisory-headline" },
                  e("div", { className: `sdp-advisory-badge-large ${signalColorClass(advisory.signal)}` }, signalLabel(advisory.signal)),
                  e(
                    "div",
                    { className: "sdp-advisory-meta-info" },
                    e("span", { className: "sdp-session-lbl" }, `Phiên giao dịch: ${sessionLabel}`),
                    advisory.confidence_score != null && e("span", { className: "sdp-confidence-lbl" }, `Độ tin cậy: ${(Number(advisory.confidence_score) * 100).toFixed(0)}%`)
                  )
                ),
                advisory.summary && e("p", { className: "sdp-advisory-summary" }, advisory.summary),
                advisory.rationale && e("p", { className: "sdp-advisory-rationale" }, advisory.rationale),
                advisory.generated_at && e("div", { className: "sdp-advisory-footer-meta" }, `Cập nhật: ${new Date(advisory.generated_at).toLocaleString("vi-VN")}`)
              )
            : e(
                "div",
                { className: "sdp-deck-empty" },
                e("span", { className: "sdp-empty-icon" }, "🧠"),
                e("p", null, "Chưa có khuyến nghị AI cho phiên này hoặc hệ thống đang phân tích.")
              )
        )
      ),
      // StockContextDeck (Shark Alerts, depth, strength matrix)
      e(StockContextDeck, {
        symbol,
        selectedSession,
        snapshot,
        orderFlowData,
        whaleFeed,
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
              e("h3", { className: "sdp-section-title" }, "ℹ️ Thông tin Tổng quan"),
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
                e("h4", null, "Ngành nghề kinh doanh & Mô hình"),
                e("p", { style: { whiteSpace: "pre-line", color: "#94a3b8", fontSize: "0.9rem", lineHeight: "1.6" } }, overview.business_model)
              )
            ),
            // Section 2: Officers (Ban Lãnh Đạo)
            e(
              "div",
              { className: "sdp-profile-section sdp-glass-card", style: { marginTop: "20px" } },
              e("h3", { className: "sdp-section-title" }, "👥 Ban Lãnh Đạo (Officers)"),
              officers.length > 0
                ? e(
                    "table",
                    { className: "sdp-premium-table" },
                    e("thead", null, e("tr", null, e("th", null, "Họ tên"), e("th", null, "Chức vụ"), e("th", null, "Năm bắt đầu"))),
                    e(
                      "tbody",
                      null,
                      officers.map((off, i) => e("tr", { key: i }, e("td", null, off.name), e("td", null, off.position), e("td", null, off.from_date || "—")))
                    )
                  )
                : e("p", { className: "sdp-empty-placeholder" }, "Không có thông tin ban lãnh đạo.")
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
            e("h3", { className: "sdp-section-title" }, "🏛️ Cơ Cấu Cổ Đông Lớn"),
            shareholders.length > 0
              ? e(
                  "table",
                  { className: "sdp-premium-table" },
                  e("thead", null, e("tr", null, e("th", null, "Tên cổ đông"), e("th", { style: { textAlign: "right" } }, "Số cổ phần nắm giữ"), e("th", { style: { textAlign: "right" } }, "Tỷ lệ %"))),
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
              : e("p", { className: "sdp-empty-placeholder" }, "Không có dữ liệu cổ đông lớn.")
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
            e("h3", { className: "sdp-section-title" }, "💸 Vốn điều lệ & Cổ tức"),
            e(
              "div",
              { className: "sdp-overview-grid" },
              e("div", { className: "sdp-overview-item" }, e("span", null, "Vốn điều lệ:"), e("strong", { className: "text-cyan" }, overview.charter_capital ? `${overview.charter_capital.toLocaleString("vi-VN")} tỷđ` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, "Số CP niêm yết:"), e("strong", null, overview.listed_volume ? `${fmtCompact(overview.listed_volume * 1000000)} CP` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, "Số CP lưu hành:"), e("strong", null, profile.outstanding_shares ? `${profile.outstanding_shares.toLocaleString("vi-VN")} CP` : "—")),
              e("span", { className: "sdp-overview-divider" }),
              e("div", { className: "sdp-overview-item" }, e("span", null, "Tỷ suất cổ tức:"), e("strong", { className: "text-green" }, divYieldVal != null ? `${(divYieldVal * 100).toFixed(2)}%` : "—"))
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
            e("h3", { className: "sdp-section-title" }, "📰 Tin Tức Mới Nhất"),
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
            e("p", null, "Không tìm thấy tin tức phù hợp với mã cổ phiếu.")
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
            e("h3", { className: "sdp-section-title" }, "🗓️ Lịch Sử Sự Kiện Doanh Nghiệp"),
            events.length > 0
              ? e(
                  "table",
                  { className: "sdp-premium-table" },
                  e("thead", null, e("tr", null, e("th", null, "Ngày"), e("th", null, "Sự kiện"))),
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
              : e("p", { className: "sdp-empty-placeholder" }, "Không có lịch sử sự kiện doanh nghiệp nổi bật.")
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
            e("h3", { className: "sdp-section-title" }, "📈 Chỉ Số Định Giá Định Kỳ (Thống Kê)"),
            e(
              "div",
              { className: "sdp-stats-grid" },
              e("div", { className: "sdp-stat-box" }, e("span", null, "Chỉ số P/E:"), e("strong", { className: "text-green" }, getRatioValue("p_e"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Chỉ số P/B:"), e("strong", { className: "text-cyan" }, getRatioValue("p_b"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Lợi nhuận EPS:"), e("strong", null, getRatioValue("trailing_eps"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Tỷ suất ROE:"), e("strong", null, getRatioValue("roe") !== "—" ? `${getRatioValue("roe")}%` : (getRatioValue("roe_trailling") !== "—" ? `${getRatioValue("roe_trailling")}%` : "—"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Tỷ suất ROA:"), e("strong", null, getRatioValue("roa") !== "—" ? `${getRatioValue("roa")}%` : (getRatioValue("roa_trailling") !== "—" ? `${getRatioValue("roa_trailling")}%` : "—"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Hệ số Beta:"), e("strong", null, getRatioValue("beta"))),
              e("div", { className: "sdp-stat-box" }, e("span", null, "Giá trị sổ sách (BVPS):"), e("strong", null, getRatioValue("book_value_per_share_bvps")))
            )
          )
    );
  }

  function renderTaiChinh() {
    const incList = financials?.income_statement || [];
    const balList = financials?.balance_sheet || [];

    // Find all quarterly periods across arrays
    const getPeriods = (list) => {
      if (!list || list.length === 0) return [];
      const keys = Object.keys(list[0]).filter(k => k !== "item" && k !== "item_id");
      return keys.slice(0, 4); // Limit to last 4 periods
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
              e("h3", { className: "sdp-section-title" }, "📊 Kết quả kinh doanh ( Income Statement )"),
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
                        e("th", null, "Chỉ tiêu"),
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
                : e("p", { className: "sdp-empty-placeholder" }, "Không có dữ liệu báo cáo thu nhập.")
            ),
            // Bal Table
            e(
              "div",
              { className: "sdp-glass-card" },
              e("h3", { className: "sdp-section-title" }, "⚖️ Bảng cân đối kế toán ( Balance Sheet )"),
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
                        e("th", null, "Chỉ tiêu"),
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
                : e("p", { className: "sdp-empty-placeholder" }, "Không có dữ liệu bảng cân đối kế toán.")
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
