/**
 * SM-P4.5 — StockDetailPage
 * Trang chi tiet co phieu: thong tin, lich su gia, order-flow events, advisory.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useStockDetail({ env = DEFAULT_ENV, symbol } = {}) {
  const [state, setState] = useState({
    loading: true, error: null, profile: null, prices: [], orderFlow: [], advisory: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!symbol) return;
    mountedRef.current = true;
    async function load() {
      try {
        const adapter = coreApiAdapter({ env });
        const [profileRes, pricesRes, orderFlowRes, advisoryRes] = await Promise.allSettled([
          adapter.getStockProfile(symbol),
          adapter.getDailyPrices(symbol),
          adapter.getOrderFlowEvents(symbol),
          adapter.getAdvisoryLatest(symbol),
        ]);
        if (!mountedRef.current) return;
        setState({
          loading: false, error: null,
          profile: profileRes.status === "fulfilled" ? profileRes.value : null,
          prices: pricesRes.status === "fulfilled" ? (pricesRes.value?.results ?? []) : [],
          orderFlow: orderFlowRes.status === "fulfilled" ? (orderFlowRes.value?.results ?? orderFlowRes.value ?? []) : [],
          advisory: advisoryRes.status === "fulfilled" ? advisoryRes.value : null,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, loading: false, error: err?.message || "Khong the tai chi tiet co phieu." }));
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [env, symbol]);

  return state;
}

export function StockDetailPage({ env = DEFAULT_ENV, symbol, className = "" }) {
  const { loading, error, profile, prices, orderFlow, advisory } = useStockDetail({ env, symbol });

  if (!symbol) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-empty" }, "Vui long chon ma co phieu.")
  );

  if (loading) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-loading" }, "Dang tai du lieu " + symbol + "...")
  );

  if (error) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-error" }, error)
  );

  return e("div", { className: "core-stock-detail-page " + className },
    e("header", { className: "core-page-header" },
      e("h1", null, symbol),
      profile ? e("span", { className: "core-stock-meta" },
        [profile.company_name, profile.exchange, profile.industry].filter(Boolean).join(" — ")
      ) : null
    ),
    advisory ? e("section", { className: "core-advisory-panel" },
      e("h2", null, "Khuyen nghi AI"),
      e("div", { className: "core-advisory-signal core-signal-" + (advisory.signal || "").toLowerCase() }, advisory.signal || ""),
      advisory.summary ? e("p", { className: "core-advisory-summary" }, advisory.summary) : null,
      advisory.generated_at
        ? e("small", { className: "core-advisory-timestamp" },
            "Cap nhat: " + new Date(advisory.generated_at).toLocaleString("vi-VN"))
        : null
    ) : null,
    e("section", { className: "core-orderflow-section" },
      e("h2", null, "Tin hieu dong tien (" + orderFlow.length + ")"),
      orderFlow.length === 0
        ? e("p", { className: "core-empty" }, "Khong co tin hieu dong tien nao.")
        : e("table", { className: "core-orderflow-table" },
            e("thead", null, e("tr", null,
              e("th", null, "Loai tin hieu"), e("th", null, "Chieu"), e("th", null, "Suc manh"),
              e("th", null, "Ca map"), e("th", null, "CVD"), e("th", null, "Gia"),
              e("th", null, "KL"), e("th", null, "Thoi diem")
            )),
            e("tbody", null, orderFlow.map((ev) =>
              e("tr", { key: ev.event_id, className: "core-event-row core-side-" + ev.side },
                e("td", null, ev.signal_type),
                e("td", null, ev.side),
                e("td", null, ev.strength != null ? Number(ev.strength).toFixed(2) : "—"),
                e("td", null, ev.whale_intensity != null ? Number(ev.whale_intensity).toFixed(2) : "—"),
                e("td", null, ev.cvd_at_signal != null ? Number(ev.cvd_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.price_at_signal != null ? Number(ev.price_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.volume_at_signal != null ? Number(ev.volume_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.triggered_at ? new Date(ev.triggered_at).toLocaleString("vi-VN") : "—")
              )
            ))
          )
    ),
    e("section", { className: "core-prices-section" },
      e("h2", null, "Lich su gia (" + prices.length + " phien)"),
      prices.length === 0
        ? e("p", { className: "core-empty" }, "Chua co du lieu gia.")
        : e("table", { className: "core-prices-table" },
            e("thead", null, e("tr", null,
              e("th", null, "Ngay"), e("th", null, "Mo cua"), e("th", null, "Cao nhat"),
              e("th", null, "Thap nhat"), e("th", null, "Dong cua"), e("th", null, "Khoi luong")
            )),
            e("tbody", null, prices.slice(0, 30).map((p) =>
              e("tr", { key: p.date },
                e("td", null, p.date),
                e("td", null, Number(p.open).toLocaleString("vi-VN")),
                e("td", null, Number(p.high).toLocaleString("vi-VN")),
                e("td", null, Number(p.low).toLocaleString("vi-VN")),
                e("td", null, Number(p.close).toLocaleString("vi-VN")),
                e("td", null, Number(p.volume).toLocaleString("vi-VN"))
              )
            ))
          )
    )
  );
}
