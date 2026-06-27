import { createElement } from "react";
import { useI18n } from "../context/LangContext.js";
import { AIUsageDashboard } from "../components/AIUsageDashboard.js";

const e = createElement;

interface AIUsageAnalyticsPageProps {
  className?: string;
}

export function AIUsageAnalyticsPage({ className = "" }: AIUsageAnalyticsPageProps) {
  useI18n();
  return e("div", { className: `core-ai-usage-analytics-page ${className}` },
    e(AIUsageDashboard, null),
  );
}
