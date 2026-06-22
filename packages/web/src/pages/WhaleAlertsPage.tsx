import { createElement, FormEvent, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;

interface WhaleAlert {
  alert_id: string | number;
  symbol: string;
  alert_type: string;
  severity: string;
  title: string;
  value?: number | string | null;
  direction?: string | null;
  session_date: string;
  triggered_at: string;
  [key: string]: unknown;
}

interface AlertCenterFeedResponse {
  results?: WhaleAlert[];
  next?: string | null;
  previous?: string | null;
  [key: string]: unknown;
}

interface WhaleAlertsPageProps {
  symbol?: string;
  sessionDate?: string;
  className?: string;
}

interface WhaleAlertsState {
  loading: boolean;
  error: string | null;
  alerts: WhaleAlert[];
}

function useWhaleAlerts({ symbol = "", sessionDate = "" }: { symbol?: string; sessionDate?: string } = {}): WhaleAlertsState {
  const [state, setState] = useState<WhaleAlertsState>({ loading: true, error: null, alerts: [] });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const res: AlertCenterFeedResponse = await coreApiAdapter.getAlertCenterFeed({ symbol, alert_family: 'whale', session_date: sessionDate });
        if (!mountedRef.current) return;
        setState({ loading: false, error: null, alerts: (res?.results ?? []) as WhaleAlert[] });
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, loading: false, error: err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tải cảnh báo cá mập." }));
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [symbol, sessionDate]);

  return state;
}

export function WhaleAlertsPage({ symbol = "", sessionDate = "", className = "" }: WhaleAlertsPageProps) {
  const [filterSymbol, setFilterSymbol] = useState(symbol);
  const [filterDate, setFilterDate] = useState(sessionDate);
  const [applied, setApplied] = useState({ symbol, sessionDate });

  const { loading, error, alerts } = useWhaleAlerts({
    symbol: applied.symbol,
    sessionDate: applied.sessionDate,
  });

  function handleApply(e: FormEvent) {
    e.preventDefault();
    setApplied({ symbol: filterSymbol.trim().toUpperCase(), sessionDate: filterDate });
  }

  return e("div", { className: "core-whale-alerts-page " + className },
    e("header", { className: "core-page-header" }, e("h1", null, "Cảnh báo cá mập")),
    e("form", { className: "core-filter-bar", onSubmit: handleApply },
      e("label", null, "Mã CP:",
        e("input", { type: "text", value: filterSymbol, onChange: (ev) => setFilterSymbol((ev.target as HTMLInputElement).value.toUpperCase()), placeholder: "VD: VNM", maxLength: 10 })
      ),
      e("label", null, "Ngày:",
        e("input", { type: "date", value: filterDate, onChange: (ev) => setFilterDate((ev.target as HTMLInputElement).value) })
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
