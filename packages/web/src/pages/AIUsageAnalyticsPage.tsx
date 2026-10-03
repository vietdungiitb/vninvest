import { createElement } from "react";
import { Link } from "react-router-dom";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIUsageDashboard } from "../components/AIUsageDashboard.js";

const e = createElement;

interface AIUsageAnalyticsPageProps {
  className?: string;
}

export function AIUsageAnalyticsPage({ className = "" }: AIUsageAnalyticsPageProps) {
  const { t } = useI18n();
  return e("div", { className: `${styles.page} ${className}` },
    e(Link, { to: "/settings/ai", className: styles.hubBackLink },
      t("aiCommandCenter.backToHub")
    ),
    e(AIUsageDashboard, null),
  );
}
