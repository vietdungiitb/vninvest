/**
 * AlertCenterPage
 * Hub hợp nhất cho alert-center trong packages/web.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import { createElement, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;
const DEFAULT_ENV = {};
const LANE_OPTIONS = Object.freeze([
  { value: "main", label: "Luồng chính" },
  { value: "ai", label: "AI Alerts / AI Suggests" },
]);

function formatAlertValue(value) {
  if (value == null || value === "") {
    return "—";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString("vi-VN") : String(value);
}

function formatAlertTimestamp(value) {
  if (!value) {
    return "—";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return timestamp.toLocaleString("vi-VN");
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function useAlertCenterData({ env = DEFAULT_ENV, lane = "main", symbol = "" } = {}) {
  const mountedRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: { results: [], next: null, previous: null },
    summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
  });

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        setState((currentState) => ({ ...currentState, loading: true, error: "" }));
        const adapter = coreApiAdapter({ env });
        const query = { symbol: symbol || undefined };
        const [payload, summary] = await Promise.all([
          lane === "ai" ? adapter.getAIAlertsFeed(query) : adapter.getAlertCenterFeed(query),
          lane === "ai" ? adapter.getAIAlertsSummary(query) : adapter.getAlertCenterSummary(query),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: "",
          payload: {
            results: payload?.results ?? [],
            next: payload?.next ?? null,
            previous: payload?.previous ?? null,
          },
          summary: {
            total: Number(summary?.total || 0),
            unseen: Number(summary?.unseen || 0),
            by_severity: {
              critical: Number(summary?.by_severity?.critical || 0),
              high: Number(summary?.by_severity?.high || 0),
              medium: Number(summary?.by_severity?.medium || 0),
              low: Number(summary?.by_severity?.low || 0),
            },
          },
        });
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: error?.message || "Không thể tải alert center từ core API.",
          payload: { results: [], next: null, previous: null },
          summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
        });
      }
    }

    load();
    return () => {
      mountedRef.current = false;
    };
  }, [env, lane, symbol]);

  return state;
}

function renderSummaryCard(label, value, modifier = "") {
  return e("div", { className: `core-alert-center-summary-card ${modifier}`.trim() }, [
    e("div", { key: "label", className: "core-alert-center-summary-label" }, label),
    e("div", { key: "value", className: "core-alert-center-summary-value" }, value),
  ]);
}

function renderEvidenceList(evidence) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return "—";
  }

  return e(
    "ul",
    { className: "core-alert-center-evidence-list" },
    entries.slice(0, 3).map(([key, value]) =>
      e("li", { key }, `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    )
  );
}

export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }) {
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const { loading, error, payload, summary } = useAlertCenterData({ env, lane, symbol: appliedSymbol });
  const alerts = payload?.results ?? [];
  const highSeverityCount = Number(summary?.by_severity?.high || 0);
  const aiSuggestCount = alerts.filter((alert) => alert?.alert_family === "ai_suggest").length;

  function handleApply(event) {
    event.preventDefault();
    setAppliedSymbol(normalizeSymbol(symbolDraft));
  }

  return e("div", { className: `core-alert-center-page ${className}`.trim() }, [
    e("header", { key: "header", className: "core-alert-center-header" }, [
      e("div", { key: "copy" }, [
        e("h1", { key: "title" }, "Global Alert Center"),
        e(
          "p",
          { key: "subtitle", className: "core-alert-center-subtitle" },
          "Feed hợp nhất cho whale, dark-flow, signal và lane AI theo delivery truth của từng người dùng."
        ),
      ]),
      e("form", { key: "filters", className: "core-alert-center-filter-bar", onSubmit: handleApply }, [
        e("label", { key: "symbol-label", className: "core-alert-center-filter-field" }, [
          e("span", { key: "symbol-text" }, "Mã cổ phiếu"),
          e("input", {
            key: "symbol-input",
            type: "text",
            value: symbolDraft,
            maxLength: 10,
            placeholder: "Ví dụ: HPG",
            onChange: (event) => setSymbolDraft(normalizeSymbol(event.target.value)),
          }),
        ]),
        e("button", { key: "apply", type: "submit" }, "Lọc feed"),
      ]),
    ]),
    e("section", { key: "lane-switcher", className: "core-alert-center-lane-switcher" },
      LANE_OPTIONS.map((option) =>
        e(
          "button",
          {
            key: option.value,
            type: "button",
            className: `core-alert-center-lane-button${lane === option.value ? " is-active" : ""}`,
            onClick: () => setLane(option.value),
          },
          option.label
        )
      )
    ),
    e("section", { key: "summary", className: "core-alert-center-summary-grid" }, [
      renderSummaryCard("Tổng số alert", String(summary?.total ?? alerts.length)),
      renderSummaryCard("Chưa đọc", String(summary?.unseen ?? 0)),
      renderSummaryCard("Mức cao", String(highSeverityCount)),
      renderSummaryCard("AI suggest", String(aiSuggestCount), lane === "ai" ? "is-highlighted" : ""),
      renderSummaryCard("Bộ lọc mã", appliedSymbol || "Toàn bộ"),
    ]),
    loading ? e("p", { key: "loading", className: "core-loading" }, "Đang tải alert center…") : null,
    error ? e("p", { key: "error", className: "core-error" }, error) : null,
    !loading && !error && alerts.length === 0
      ? e("p", { key: "empty", className: "core-empty" }, "Chưa có alert phù hợp với bộ lọc hiện tại.")
      : null,
    !loading && !error && alerts.length > 0
      ? e("div", { key: "list", className: "core-alert-center-list" },
          alerts.map((alert) =>
            e("article", { key: alert.alert_id, className: `core-alert-center-card severity-${alert.severity || "unknown"}` }, [
              e("div", { key: "top", className: "core-alert-center-card-top" }, [
                e("div", { key: "title-group" }, [
                  e("h2", { key: "title", className: "core-alert-center-card-title" }, alert.title || "Không có tiêu đề"),
                  e(
                    "p",
                    { key: "meta", className: "core-alert-center-card-meta" },
                    `${alert.symbol || "—"} · ${alert.alert_family || alert.alert_type || "—"} · ${alert.lane || lane}`
                  ),
                ]),
                e("span", { key: "severity", className: `core-alert-center-badge severity-${alert.severity || "unknown"}` }, alert.severity || "unknown"),
              ]),
              e("p", { key: "summary", className: "core-alert-center-card-summary" }, alert.summary || alert.body || "Không có tóm tắt."),
              e("div", { key: "metrics", className: "core-alert-center-card-metrics" }, [
                e("span", { key: "value" }, `Giá trị: ${formatAlertValue(alert.value)}`),
                e("span", { key: "direction" }, `Chiều: ${alert.direction || "—"}`),
                e("span", { key: "confidence" }, `Độ tin cậy: ${alert.confidence ?? "—"}`),
                e("span", { key: "freshness" }, `Độ tươi: ${alert.freshness_state || "—"}`),
                e("span", { key: "session-date" }, `Phiên: ${alert.session_date || "—"}`),
                e("span", { key: "time" }, `Kích hoạt: ${formatAlertTimestamp(alert.triggered_at)}`),
              ]),
              e("div", { key: "evidence", className: "core-alert-center-card-evidence" }, [
                e("strong", { key: "label" }, "Evidence"),
                renderEvidenceList(alert.evidence),
              ]),
            ])
          )
        )
      : null,
  ]);
}
