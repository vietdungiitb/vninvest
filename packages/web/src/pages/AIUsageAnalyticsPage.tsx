import { createElement } from "react";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIUsageDashboard } from "../components/AIUsageDashboard.js";
import { AiHubNav } from "../components/AiHubNav.js";

const e = createElement;

interface AIUsageAnalyticsPageProps {
  className?: string;
}

export function AIUsageAnalyticsPage({ className = "" }: AIUsageAnalyticsPageProps) {
  const { t } = useI18n();
  return e("div", { className: `${styles.page} ${className}` }, [
    e(AiHubNav, { key: "tabs" }),
    e("h1", { key: "title", className: styles.pageTitle }, t("routes.aiUsageAnalytics")),
    e("p", { key: "desc", className: styles.pageDesc }, t("aiUsageAnalytics.description")),
    e(AIUsageDashboard, { key: "panel" }),
  ]);
}
