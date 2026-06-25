import { createElement, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { SocTabNavigation } from "../../components/soc/SocTabNavigation.js";
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

const SOC_TABS = [
  { key: "signals", icon: "\u{1F6EC}" },
  { key: "dataops", icon: "\u{1F4E1}" },
  { key: "prefetch", icon: "\u{26A1}" },
  { key: "screener", icon: "\u{1F50D}" },
  { key: "vnbroker", icon: "\u{1F4E0}" },
  { key: "runtime-kpi", icon: "\u{1F4C8}" },
  { key: "dnse-backfill", icon: "\u{1F504}" },
];

export function ShellOperationsCenterPage(_props: ShellOperationsCenterPageProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("signals");

  const renderTabContent = () => {
    switch (activeTab) {
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
        return createElement(SocSignalsPanel);
    }
  };

  return createElement(
    "main",
    {
      style: {
        background: "radial-gradient(circle at top right, rgba(0, 180, 216, 0.08), transparent 45%), radial-gradient(circle at left center, rgba(255, 127, 80, 0.03), transparent 45%), linear-gradient(160deg, #0b0f19 0%, #111827 50%, #070a13 100%)",
        minHeight: "100vh",
        padding: "24px 28px",
        boxSizing: "border-box",
      },
    },
    createElement(
      "header",
      {
        style: {
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        },
      },
      createElement(
        "div",
        null,
        createElement(
          "span",
          {
            style: {
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--shell-accent, #00b4d8)",
              display: "block",
              marginBottom: "0.25rem",
            },
          },
          t("soc.pages.breadcrumb_operations"),
        ),
        createElement("h1", {
          style: {
            margin: 0,
            fontSize: "28px",
            lineHeight: 1.1,
            color: "var(--shell-ink, #f1f5f9)",
          },
        }, t("soc.pages.soc_page_title")),
      ),
    ),
    createElement(SocTabNavigation, {
      tabs: SOC_TABS,
      activeTab,
      onChange: setActiveTab,
    }),
    renderTabContent(),
  );
}
