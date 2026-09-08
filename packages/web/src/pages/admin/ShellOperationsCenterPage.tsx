import { createElement, useState, useCallback } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPageChrome } from "../../components/ShellPageTemplate.js";
import { SocTabNavigation } from "../../components/soc/SocTabNavigation.js";
import { SocOverviewPanel } from "../../components/soc/SocOverviewPanel.js";
import { SocSignalsPanel } from "../../components/soc/SocSignalsPanel.js";
import { SocPrefetchPanel } from "../../components/soc/SocPrefetchPanel.js";
import { SocScreenerPanel } from "../../components/soc/SocScreenerPanel.js";
import { SocVnbrokerPanel } from "../../components/soc/SocVnbrokerPanel.js";
import { SocDataOpsPanel } from "../../components/soc/SocDataOpsPanel.js";
import { SocRuntimeKpiPanel } from "../../components/soc/SocRuntimeKpiPanel.js";
import { SocDnseBackfillPanel } from "../../components/soc/SocDnseBackfillPanel.js";

interface ShellOperationsCenterPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

function useSearchParams() {
  const [params, setParams] = useState(() => new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ));
  const updateParams = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (typeof window !== "undefined") {
      const newUrl = next.toString()
        ? `${window.location.pathname}?${next.toString()}`
        : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
    setParams(next);
  }, []);
  return [params, updateParams] as const;
}

const SOC_TABS = [
  { key: "overview", icon: "BookOpen" },
  { key: "signals", icon: "TrendingUp" },
  { key: "dataops", icon: "Radio" },
  { key: "prefetch", icon: "Zap" },
  { key: "screener", icon: "Search" },
  { key: "vnbroker", icon: "LineChart" },
  { key: "runtime-kpi", icon: "BarChart3" },
  { key: "dnse-backfill", icon: "RefreshCw" },
];

export function ShellOperationsCenterPage(_props: ShellOperationsCenterPageProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParam] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParam("tab", tab);
  }, [setSearchParam]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return createElement(SocOverviewPanel, { onChangeTab: handleTabChange });
      case "signals":
        return createElement(SocSignalsPanel);
      case "prefetch":
        return createElement(SocPrefetchPanel);
      case "screener":
        return createElement(SocScreenerPanel);
      case "vnbroker":
        return createElement(SocVnbrokerPanel);
      case "dataops":
        return createElement(SocDataOpsPanel);
      case "runtime-kpi":
        return createElement(SocRuntimeKpiPanel);
      case "dnse-backfill":
        return createElement(SocDnseBackfillPanel);
      default:
        return createElement(SocOverviewPanel, { onChangeTab: handleTabChange });
    }
  };

  return createElement(
    ShellPageChrome,
    {
      eyebrow: t("soc.pages.breadcrumb_operations"),
      title: t("soc.pages.soc_page_title"),
      description: undefined,
    },
    createElement(SocTabNavigation, {
      tabs: SOC_TABS,
      activeTab,
      onChange: handleTabChange,
    }),
    renderTabContent(),
  );
}
