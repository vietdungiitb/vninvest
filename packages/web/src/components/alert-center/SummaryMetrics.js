import React from "react";

const { createElement } = React;
const e = createElement;

function renderSummaryCard(label, value, modifier = "") {
  return e("div", { key: label, className: `core-alert-center-summary-card ${modifier}`.trim() }, [
    e("div", { key: "label", className: "core-alert-center-summary-label" }, label),
    e("div", { key: "value", className: "core-alert-center-summary-value" }, value),
  ]);
}

export function SummaryMetrics({ summary, alertsCount, highSeverityCount, aiSuggestCount, lane, appliedSymbol }) {
  return e("section", { className: "core-alert-center-summary-grid" }, [
    renderSummaryCard("Tổng số alert", String(summary?.total ?? alertsCount)),
    renderSummaryCard("Chưa đọc", String(summary?.unseen ?? 0)),
    renderSummaryCard("Mức Cao & Siêu Cao", String(highSeverityCount), "severity-high"),
    renderSummaryCard("AI Suggest", String(aiSuggestCount), lane === "ai" ? "is-highlighted" : ""),
    renderSummaryCard("Bộ lọc mã", appliedSymbol || "Toàn bộ"),
  ]);
}
