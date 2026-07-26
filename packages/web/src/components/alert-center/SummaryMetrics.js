import React from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellMetric } from "../../components/ShellPageTemplate.js";
import shell from "../../components/ShellPageTemplate.module.css";

const { createElement } = React;
const e = createElement;

export function SummaryMetrics({ summary, _alertsCount, highSeverityCount, aiSuggestCount, _lane, _appliedSymbol }) {
  const { t } = useI18n();
  return e("section", { className: `${shell.metrics}` }, [
    e(ShellMetric, { key: "unseen", label: t("alertCenter.summary.unseen"), value: String(summary?.unseen ?? 0) }),
    e(ShellMetric, { key: "high", label: t("alertCenter.summary.highCritical"), value: String(highSeverityCount) }),
    e(ShellMetric, {
      key: "ai",
      label: t("alertCenter.summary.aiSuggest"),
      value: String(aiSuggestCount),
    }),
    e(ShellMetric, { key: "sym", label: t("alertCenter.summary.symbolFilter"), value: appliedSymbol || t("alertCenter.summary.symbolFilterAll") }),
  ]);
}
