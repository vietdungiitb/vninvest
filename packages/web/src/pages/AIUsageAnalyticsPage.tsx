import { createElement } from "react";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIUsageDashboard } from "../components/AIUsageDashboard.js";

const e = createElement;

interface AIUsageAnalyticsPageProps {
  className?: string;
}

export function AIUsageAnalyticsPage({ className = "" }: AIUsageAnalyticsPageProps) {
  useI18n();
  return e("div", { className: `${styles.page} ${className}` },
    e(AIUsageDashboard, null),
  );
}
