import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";

const { createElement } = React;
const e = createElement;

function renderSummaryCard(t, labelKey, value, modifier = "") {
  return e("div", { key: labelKey, className: `${styles["core-alert-center-summary-card"]} ${modifier}`.trim() }, [
    e("div", { key: "label", className: styles["core-alert-center-summary-label"] }, t(labelKey)),
    e("div", { key: "value", className: styles["core-alert-center-summary-value"] }, value),
  ]);
}

export function SummaryMetrics({ summary, alertsCount, highSeverityCount, aiSuggestCount, lane, appliedSymbol }) {
  const { t } = useI18n();
  return e("section", { className: styles["core-alert-center-summary-grid"] }, [
    renderSummaryCard(t, "alertCenter.summary.total", String(summary?.total ?? alertsCount)),
    renderSummaryCard(t, "alertCenter.summary.unseen", String(summary?.unseen ?? 0)),
    renderSummaryCard(t, "alertCenter.summary.highCritical", String(highSeverityCount), "severity-high"),
    renderSummaryCard(t, "alertCenter.summary.aiSuggest", String(aiSuggestCount), lane === "ai" ? "is-highlighted" : ""),
    renderSummaryCard(t, "alertCenter.summary.symbolFilter", appliedSymbol || t("alertCenter.summary.symbolFilterAll", "Toàn bộ")),
  ]);
}
