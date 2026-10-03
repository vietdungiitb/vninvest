import "vninvestcharts-widget/dist/index.css";
import { createElement, useEffect, useCallback, useState, lazy, Suspense } from "react";
import { useWatchlist } from "./WatchlistContext";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useI18n } from "../../../context/LangContext.js";

const Chart = lazy(() => import("vninvestcharts-widget").then((m: unknown) => ({ default: (m as Record<string, unknown>).VNInvestCharts as unknown as React.ComponentType<Record<string, unknown>> }))) as unknown as React.ComponentType<Record<string, unknown>>;
const api = coreApiAdapter as unknown as {
  getWhaleAnalyticsSnapshot: (symbol: string, opts?: Record<string, unknown>) => Promise<unknown>;
  getStockNews: (symbol: string, params?: Record<string, unknown>) => Promise<unknown>;
  getWhaleFeedAggregate: (symbol: string, params?: Record<string, unknown>) => Promise<unknown>;
  getWhaleFeed: (symbol: string) => Promise<unknown>;
  getAdvisoryLatest: (symbol: string) => Promise<unknown>;
};

function formatTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

function formatVolume(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("vi-VN");
}

export function WatchlistDetailPanel() {
  const { activeSymbolDetail, setActiveSymbolDetail } = useWatchlist();
  const { t } = useI18n();
  const [whaleData, setWhaleData] = useState<unknown[] | null>(null);
  const [newsData, setNewsData] = useState<unknown[] | null>(null);
  const [advisoryData, setAdvisoryData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleClose = useCallback(() => {
    setActiveSymbolDetail(null);
  }, [setActiveSymbolDetail]);

  useEffect(() => {
    if (!activeSymbolDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSymbolDetail, handleClose]);

  useEffect(() => {
    if (!activeSymbolDetail) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg("");
    setWhaleData(null);
    setNewsData(null);
    setAdvisoryData(null);
    const sym = activeSymbolDetail;
    const today = new Date().toISOString().slice(0, 10);
    Promise.allSettled([
      api.getWhaleFeedAggregate(sym, { session_date: today, limit: 5, sort: "desc" } as Record<string, unknown>).catch(() => api.getWhaleFeed(sym)),
      api.getStockNews(sym, { page_size: 5 } as Record<string, unknown>),
      api.getAdvisoryLatest(sym),
      api.getWhaleAnalyticsSnapshot(sym, { timeframe: "session", compact: 1 } as Record<string, unknown>),
    ]).then((results) => {
      if (cancelled) return;
      const [whaleRes, newsRes, advisoryRes, whaleSnapRes] = results;
      // Whale flow
      if (whaleRes.status === "fulfilled" && whaleRes.value) {
        const v: unknown = whaleRes.value;
        const arr = Array.isArray(v) ? v : ((v as Record<string, unknown>).results as unknown[] ?? (v as Record<string, unknown>).data as unknown[] ?? []);
        if (Array.isArray(arr) && arr.length > 0) setWhaleData(arr.slice(0, 5) as unknown[]);
        else if (whaleSnapRes.status === "fulfilled" && whaleSnapRes.value) {
          const snap = whaleSnapRes.value as Record<string, unknown>;
          const feed = (snap.whale_feed ?? snap.feed ?? snap.results) as unknown[];
          if (Array.isArray(feed) && feed.length > 0) setWhaleData(feed.slice(0, 5) as unknown[]);
          else setWhaleData([]);
        } else setWhaleData([]);
      } else {
        if (whaleSnapRes.status === "fulfilled" && whaleSnapRes.value) {
          const snap = whaleSnapRes.value as Record<string, unknown>;
          const feed = (snap.whale_feed ?? snap.results) as unknown[];
          if (Array.isArray(feed)) setWhaleData(feed.slice(0, 5) as unknown[]);
          else setWhaleData([]);
        } else setWhaleData([]);
      }
      // News
      if (newsRes.status === "fulfilled" && newsRes.value) {
        const v: unknown = newsRes.value;
        const arr = Array.isArray(v) ? v : ((v as Record<string, unknown>).results as unknown[] ?? []);
        setNewsData(Array.isArray(arr) ? (arr.slice(0, 5) as unknown[]) : []);
      } else setNewsData([]);
      // Advisory
      if (advisoryRes.status === "fulfilled" && advisoryRes.value) {
        setAdvisoryData(advisoryRes.value as Record<string, unknown>);
      } else if (whaleSnapRes.status === "fulfilled" && whaleSnapRes.value) {
        const snap = whaleSnapRes.value as Record<string, unknown>;
        const adv = (snap.advisory ?? snap.latest_advisory) as Record<string, unknown>;
        setAdvisoryData(adv ?? null);
      } else setAdvisoryData(null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setErrorMsg((err as Error)?.message ?? "Không thể tải chi tiết.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSymbolDetail]);

  // Deep link ?detail=SYMBOL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const detail = params.get("detail");
    if (detail && !activeSymbolDetail) setActiveSymbolDetail(detail.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSymbolDetail) {
      const url = new URL(window.location.href);
      url.searchParams.set("detail", activeSymbolDetail);
      window.history.replaceState(null, "", url.toString());
      // Scroll lock
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    } else {
      const url = new URL(window.location.href);
      if (url.searchParams.has("detail")) {
        url.searchParams.delete("detail");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [activeSymbolDetail]);

  if (!activeSymbolDetail) return null;

  const renderWhaleSection = () => {
    if (loading && whaleData === null) {
      return createElement("div", { className: "watchlistPage__slideOverFlowList", style: { opacity: 0.6, fontSize: "0.8rem", padding: "8px 0" } }, t("common.loading", { defaultValue: "Đang tải..." }));
    }
    if (errorMsg && whaleData === null) {
      return createElement("div", { style: { color: "var(--soc-c-f87171, #f87171)", fontSize: "0.8rem", padding: "8px 0" } }, errorMsg);
    }
    if (!whaleData || whaleData.length === 0) {
      return createElement("div", { style: { color: "var(--text-muted, #94a3b8)", fontSize: "0.8rem", padding: "8px 0" } }, t("watchlist.detail.no_whale_flow", { defaultValue: "Không có lệnh lớn trong phiên." }));
    }
    return createElement(
      "ul",
      { className: "watchlistPage__slideOverFlowList" },
      whaleData.map((item: unknown, idx: number) => {
        const r = item as Record<string, unknown>;
        const ts = String(r.ts ?? r.created_at ?? r.executed_at ?? "");
        const time = ts ? new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `—`;
        const side = String(r.side ?? r.signal_type ?? "").toUpperCase();
        const isBuy = side.includes("BUY") || side === "B" || Number(r.matched_value ?? 0) > 0 && String(r.side ?? "").toLowerCase().includes("buy");
        const vol = r.matched_value ?? r.volume ?? r.size ?? "";
        const volStr = vol ? formatVolume(vol) : "";
        const label = volStr ? `${isBuy ? "MUA" : side.includes("SELL") ? "BÁN" : side || (isBuy ? "MUA" : "BÁN")} ${volStr}` : (String(r.description ?? side ?? "—"));
        return createElement(
          "li",
          { key: String((r.event_id ?? r.id ?? idx)), className: "watchlistPage__slideOverFlowItem" },
          createElement("span", { className: "watchlistPage__slideOverFlowTime" }, time),
          createElement("span", { className: isBuy ? "watchlistPage__slideOverFlowBuy" : "watchlistPage__slideOverFlowSell" }, label)
        );
      })
    );
  };

  const renderAdvisorySection = () => {
    if (loading && advisoryData === null && whaleData === null) {
      return createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        createElement("div", { style: { height: "12px", background: "rgba(148,163,184,0.12)", borderRadius: "6px", animation: "pulse 1.5s infinite" } }),
        createElement("div", { style: { height: "12px", width: "70%", background: "rgba(148,163,184,0.12)", borderRadius: "6px" } })
      );
    }
    if (advisoryData) {
      const r = advisoryData as Record<string, unknown>;
      const summary = String(r.summary ?? r.content ?? r.signal ?? r.message ?? "");
      const bias = String(r.bias_label ?? r.bias ?? r.trend ?? "");
      const rsi = r.rsi_14 ?? r.rsi;
      const score = r.display_score ?? r.event_score ?? r.score;
      const text = summary || (bias ? `Định hướng: ${bias}` : "") || `RSI ${rsi ?? "—"} · Điểm ${score ?? "—"}`;
      if (!text) return createElement("p", { className: "watchlistPage__slideOverSectionText" }, t("watchlist.detail.no_advisory", { defaultValue: "Chưa có advisory." }));
      return createElement(
        "p",
        { className: "watchlistPage__slideOverSectionText" },
        createElement("strong", null, t("watchlist.detail.quick_view", { defaultValue: "Nhận định nhanh:" })),
        ` ${text}`
      );
    }
    return createElement("p", { className: "watchlistPage__slideOverSectionText" }, t("watchlist.detail.no_advisory", { defaultValue: "Chưa có advisory." }));
  };

  const renderNewsSection = () => {
    if (loading && newsData === null) {
      return createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        createElement("div", { style: { height: "36px", background: "rgba(148,163,184,0.10)", borderRadius: "8px" } }),
        createElement("div", { style: { height: "36px", background: "rgba(148,163,184,0.10)", borderRadius: "8px" } })
      );
    }
    if (!newsData || newsData.length === 0) {
      return createElement("div", { style: { color: "var(--text-muted, #94a3b8)", fontSize: "0.8rem", padding: "8px 0" } }, t("watchlist.detail.no_news", { defaultValue: "Chưa có tin tức." }));
    }
    return createElement(
      "div",
      { className: "watchlistPage__slideOverNewsList" },
      newsData.map((item: unknown, idx: number) => {
        const r = item as Record<string, unknown>;
        const title = String(r.title ?? r.headline ?? r.name ?? `Tin ${activeSymbolDetail}`);
        const url = String(r.url ?? r.link ?? r.href ?? "#");
        const source = String(r.source ?? r.publisher ?? "");
        const ts = String(r.published_at ?? r.created_at ?? r.ts ?? "");
        const meta = ts ? `${formatTimeAgo(ts)}${source ? ` - ${source}` : ""}` : source;
        const isExternal = url !== "#";
        return createElement(
          "article",
          { key: String((r.id ?? idx)), className: "watchlistPage__slideOverNewsItem" },
          createElement(
            "a",
            { href: url, className: "watchlistPage__slideOverNewsLink", target: isExternal ? "_blank" : undefined, rel: isExternal ? "noreferrer" : undefined },
            title
          ),
          meta ? createElement("span", { className: "watchlistPage__slideOverNewsMeta" }, meta) : null
        );
      })
    );
  };

  return createElement(
    "div",
    { className: "watchlistPage__slideOverOverlay", onClick: handleClose, role: "presentation" },
    createElement(
      "div",
      {
        className: "watchlistPage__slideOver",
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        role: "dialog",
        "aria-modal": "true",
        "aria-label": `Chi tiết ${activeSymbolDetail}`
      },
      // Header
      createElement(
        "div",
        { className: "watchlistPage__slideOverHeader" },
        createElement(
          "h2",
          { className: "watchlistPage__slideOverTitle" },
          activeSymbolDetail,
          createElement(
            "span",
            { className: "watchlistPage__slideOverBadge" },
            "Realtime"
          )
        ),
        createElement(
          "button",
          { className: "watchlistPage__slideOverClose", onClick: handleClose, "aria-label": t("common.close", { defaultValue: "Đóng" }) },
          "\u2715"
        )
      ),

      // Chart — lazy widget (W-15, 3.1)
      createElement(
        "div",
        { className: "watchlistPage__slideOverChart" },
        createElement(
          Suspense,
          { fallback: createElement("div", { style: { height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "0.85rem" } }, t("common.loading", { defaultValue: "Đang tải..." })) },
          createElement(Chart, {
            key: activeSymbolDetail,
            symbol: activeSymbolDetail,
            theme: "dark",
            showToolbar: false,
            showFooter: false
          })
        )
      ),

      // AI Advisor
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection watchlistPage__slideOverSection--ai" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83E\uDDE0 AI Advisor"
        ),
        renderAdvisorySection()
      ),

      // Whale Flow
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83D\uDC0B Whale Order Flow"
        ),
        renderWhaleSection()
      ),

      // News
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection watchlistPage__slideOverSection--news" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83D\uDCF0 Tin t\u1EE9c li\u00EAn quan"
        ),
        renderNewsSection()
      )
    )
  );
}
