import { createElement, useState, useCallback, useEffect } from "react";
import { useSearchParams as useRouterSearchParams } from "react-router-dom";
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

const STORAGE_KEY = "soc_active_tab";

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
  const [searchParams, setSearchParams] = useRouterSearchParams();

  const getInitialTab = () => {
    const urlTab = searchParams.get("tab");
    if (urlTab && SOC_TABS.some((tb) => tb.key === urlTab)) return urlTab;
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && SOC_TABS.some((tb) => tb.key === saved)) return saved;
    } catch { /* noop */ }
    return "overview";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab && SOC_TABS.some((tb) => tb.key === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch { /* noop */ }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

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

  const TAB_DESCRIPTIONS: Record<string, string> = {
    overview: "soc.tabs.overview_description",
    signals: "soc.tabs.signals_description",
    dataops: "soc.tabs.dataops_description",
    prefetch: "soc.tabs.prefetch_description",
    screener: "soc.tabs.screener_description",
    vnbroker: "soc.tabs.vnbroker_description",
    "runtime-kpi": "soc.tabs.runtime_kpi_description",
    "dnse-backfill": "soc.tabs.dnse_backfill_description",
  };

  return createElement(
    ShellPageChrome,
    {
      title: t("soc.pages.soc_page_title"),
      description: t(TAB_DESCRIPTIONS[activeTab] || TAB_DESCRIPTIONS.overview),
    },
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" } },
      createElement("span", { style: { fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: "var(--accent-cyan, #22d3ee)" } }, "OPERATIONS CENTER"),
      createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 0 4px rgba(16,185,129,0.15)", display: "inline-block" } }),
      createElement("span", { style: { fontSize: "0.68rem", color: "var(--text-muted, #94a3b8)" } }, "LIVE"),
    ),
    createElement(SocTabNavigation, {
      tabs: SOC_TABS,
      activeTab,
      onChange: handleTabChange,
    }),
    renderTabContent(),
  );
}
