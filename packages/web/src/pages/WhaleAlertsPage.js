/**
 * SM-P4.4 — WhaleAlertsPage
 * Trang cảnh báo cá mập: hiển thị danh sách UnifiedAlert từ core API.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import { createElement, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useWhaleAlerts({ env = DEFAULT_ENV, symbol = "", sessionDate = "" } = {}) {
  const [state, setState] = useState({ loading: true, error: null, alerts: [] });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const adapter = coreApiAdapter({ env });
        const res = await adapter.getAlertCenterFeed({ symbol, alert_family: 'whale', session_date: sessionDate });
        if (!mountedRef.current) return;
        setState({ loading: false, error: null, alerts: res?.results ?? res ?? [] });
      } catch (err) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, loading: false, error: err?.message || "Không thể tải cảnh báo cá mập." }));
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [env, symbol, sessionDate]);

  return state;
}

/**
 * @param {{ env?: object, symbol?: string, sessionDate?: string, className?: string }} props
 */
export function WhaleAlertsPage({ env = DEFAULT_ENV, symbol = "", sessionDate = "", className = "" }) {
  const [filterSymbol, setFilterSymbol] = useState(symbol);
  const [filterDate, setFilterDate] = useState(sessionDate);
  const [applied, setApplied] = useState({ symbol, sessionDate });

  const { loading, error, alerts } = useWhaleAlerts({
    env,
    symbol: applied.symbol,
    sessionDate: applied.sessionDate,
  });

  function handleApply(e) {
    e.preventDefault();
    setApplied({ symbol: filterSymbol.trim().toUpperCase(), sessionDate: filterDate });
  }

  return e("div", { className: "core-whale-alerts-page " + className },
    e("header", { className: "core-page-header" }, e("h1", null, "Cảnh báo cá mập")),
    e("form", { className: "core-filter-bar", onSubmit: handleApply },
      e("label", null, "Mã CP:",
        e("input", { type: "text", value: filterSymbol, onChange: (ev) => setFilterSymbol(ev.target.value.toUpperCase()), placeholder: "VD: VNM", maxLength: 10 })
      ),
      e("label", null, "Ngày:",
        e("input", { type: "date", value: filterDate, onChange: (ev) => setFilterDate(ev.target.value) })
      ),
      e("button", { type: "submit" }, "Tìm kiếm")
    ),
    loading ? e("p", { className: "core-loading" }, "Đang tải cảnh báo…") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && alerts.length === 0) ? e("p", { className: "core-empty" }, "Không có cảnh báo nào phù hợp.") : null,
    (!loading && !error && alerts.length > 0) ? e("table", { className: "core-alerts-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Mã CP"), e("th", null, "Loại"), e("th", null, "Mức độ"),
        e("th", null, "Tiêu đề"), e("th", null, "Giá trị"), e("th", null, "Chiều"),
        e("th", null, "Ngày phiên"), e("th", null, "Thời điểm")
      )),
      e("tbody", null,
        alerts.map((a) => e("tr", { key: a.alert_id, className: "core-alert-row core-severity-" + a.severity },
          e("td", null, a.symbol),
          e("td", null, a.alert_type),
          e("td", null, a.severity),
          e("td", null, a.title),
          e("td", null, a.value != null ? Number(a.value).toLocaleString("vi-VN") : "—"),
          e("td", null, a.direction || "—"),
          e("td", null, a.session_date),
          e("td", null, a.triggered_at ? new Date(a.triggered_at).toLocaleString("vi-VN") : "—")
        ))
      )
    ) : null
  );
}
