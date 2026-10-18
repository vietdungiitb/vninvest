import { createElement } from "react";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIUsageDashboard } from "../components/AIUsageDashboard.js";
import { AiHubNav } from "../components/AiHubNav.js";
import { Breadcrumb } from "../components/Breadcrumb.js";

const e = createElement;

interface AIUsageAnalyticsPageProps {
  className?: string;
}

export function AIUsageAnalyticsPage({ className = "" }: AIUsageAnalyticsPageProps) {
  const { t } = useI18n();
return e("div", { className: `${styles.page} ${className}` }, [
    // R4.4 AC2: breadcrumb 3 mức /settings -> /settings/ai -> tab con.
    e(Breadcrumb, { key: "breadcrumb" }),
    e(AiHubNav, { key: "tabs" }),
    e("h1", { key: "title", className: styles.pageTitle }, t("routes.aiUsageAnalytics")),
    e("p", { key: "desc", className: styles.pageDesc }, t("aiUsageAnalytics.description")),
    e(AIUsageDashboard, { key: "panel" }),
  ]);
}
