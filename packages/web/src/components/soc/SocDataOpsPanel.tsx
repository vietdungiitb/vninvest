import { createElement, useMemo } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { DataOpsProvider, useDataOps } from "./DataOpsContext.js";
import { SocDataInventorySection } from "./SocDataInventorySection.js";
import { SocDataOpsOperationsSection } from "./SocDataOpsOperationsSection.js";
import { SocDataOpsMonitorSection } from "./SocDataOpsMonitorSection.js";
import { SocDataOpsConfigSection } from "./SocDataOpsConfigSection.js";
import { SocSchedulerBoard } from "./SocSchedulerBoard.js";
import styles from "./soc.module.css";

const DATAOPS_SUB_TABS = [
  { key: "inventory", icon: "BarChart3" },
  { key: "operations", icon: "Rocket" },
  { key: "monitor", icon: "Radio" },
  { key: "scheduler", icon: "Clock" },
  { key: "config", icon: "Settings" },
];

const HERO_METRIC_DEFS = [
    { key: "totalRows", icon: "Database", colorVar: "--soc-c-22d3ee", bgVar: "rgba(var(--soc-rgb-22d3ee) / 0.12)" },
    { key: "queuePending", icon: "Clock", colorVar: "--soc-c-fbbf24", bgVar: "rgba(var(--soc-rgb-fbbf24) / 0.12)" },
    { key: "running", icon: "Play", colorVar: "--soc-c-34d399", bgVar: "rgba(var(--soc-rgb-34d399) / 0.12)" },
    { key: "failed", icon: "AlertTriangle", colorVar: "--soc-c-f87171", bgVar: "color-mix(in srgb, var(--soc-c-f87171) 12%, transparent)" },
] as const;

  const HERO_METRIC_COLORS: Record<string, string> = {
    totalRows: "var(--soc-c-22d3ee)",
    queuePending: "var(--soc-c-fbbf24)",
    running: "var(--soc-c-34d399)",
    failed: "var(--soc-c-f87171)",
  };

function DataOpsContent() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { activeSubTab, runs, inventory, loading, error } = state;

  const resolveLabel = (tabKey: string): string => {
    const i18nKey = `soc.dataops.subtab.${tabKey}`;
    const translated = t(i18nKey);
    if (translated && translated !== i18nKey) return translated;
    return tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
  };

  const heroMetrics = useMemo(() => {
    const totalRows = inventory?.summary?.total_rows ?? 0;
    const queuePending = runs.filter((r) => r.status === "queued" || r.status === "pending").length;
    const running = runs.filter((r) => r.status === "running").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    return { totalRows, queuePending, running, failed };
  }, [runs, inventory]);

  const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const renderSubTabContent = () => {
    let content;
    let title = "";
    let subtitle = "";

    switch (activeSubTab) {
      case "inventory":
        title = t("soc.dataops.subtab.inventory");
        subtitle = t("soc.dataops.inventory_section_desc", { defaultValue: "Báo cáo dung lượng, độ phủ và queue tiers." });
        content = createElement(SocDataInventorySection);
        break;
      case "operations":
        title = t("soc.dataops.subtab.operations");
        subtitle = t("soc.dataops.operations_section_desc", { defaultValue: "Bề mặt vận hành chạy bù backfill và planner." });
        content = createElement(SocDataOpsOperationsSection);
        break;
      case "monitor":
        title = t("soc.dataops.subtab.monitor");
        subtitle = t("soc.dataops.monitor_section_desc", { defaultValue: "Ma trận cào song song, parity gates và health." });
        content = createElement(SocDataOpsMonitorSection);
        break;
      case "scheduler":
        title = t("soc.scheduler.board_title");
        subtitle = t("soc.dataops.scheduler_section_desc", { defaultValue: "Trạng thái kích hoạt và nhịp điệu của các tác vụ hệ thống." });
        content = createElement(SocSchedulerBoard, { domain: "dataops" });
        break;
      case "config":
        title = t("soc.dataops.subtab.config");
        subtitle = t("soc.dataops.config_section_desc", { defaultValue: "Chỉnh sửa tệp cấu hình runtime và vết kiểm toán." });
        content = createElement(SocDataOpsConfigSection);
        break;
      default:
        return createElement("p", { className: styles.emptyState }, t("soc.dataops.subtab_not_found"));
    }

    return createElement(
      ShellPanel,
      { title, subtitle },
      content,
    );
  };

  const isLoading = loading.inventory || loading.runs;

  return createElement(
    "div",
    null,

    /* ── 1. Page Header ── */
    createElement(
      "div",
      { className: styles.dataopsPageHeader },
      createElement(
        "div",
        { className: styles.dataopsEyebrow },
        createElement(LucideIcon, { name: "Database", className: "h-3.5 w-3.5" }),
        "DATAOPS",
      ),
      createElement("h2", { className: styles.dataopsTitle }, t("soc.dataops.page_title")),
      createElement("p", { className: styles.dataopsDescription }, t("soc.dataops.page_description")),
    ),

    /* ── 1.5 Error Banner ── */
    error
      ? createElement("div", { className: styles.bannerNotice, style: { marginBottom: "0.75rem" } }, error)
      : null,

    /* ── 2. Summary Metrics ── */
    isLoading
      ? createElement(
          "div",
          { className: styles.dataopsHeroMetrics },
          ...Array.from({ length: 4 }, (_, i) =>
            createElement("div", {
              key: i,
              className: `${styles.skeleton} ${styles.dataopsSkeletonMetric}`,
            }),
          ),
        )
      : createElement(
          "div",
          { className: styles.dataopsHeroMetrics },
          ...HERO_METRIC_DEFS.map((def) => {
            const value = heroMetrics[def.key as keyof typeof heroMetrics];
            const labelKey = `soc.dataops.metric_${def.key === "totalRows" ? "total_datasets" : def.key === "queuePending" ? "queue_pending" : def.key === "running" ? "running" : "errors_24h"}`;
            return createElement(
              "div",
              { key: def.key, className: styles.dataopsHeroMetricCard },
              createElement(
                "div",
                {
                  className: styles.dataopsHeroMetricIcon,
                  style: { background: def.bgVar },
                },
                createElement(LucideIcon, { name: def.icon, className: "h-5 w-5" }),
              ),
              createElement(
                "div",
                { className: styles.dataopsHeroMetricBody },
                createElement("div", { className: styles.dataopsHeroMetricLabel }, t(labelKey)),
                createElement(
                  "div",
                  { className: styles.dataopsHeroMetricValue, style: { color: HERO_METRIC_COLORS[def.key] } },
                  def.key === "totalRows" ? formatNumber(value) : String(value),
                ),
              ),
            );
          }),
        ),

    /* ── 3. Subtab Bar ── */
    createElement(
      "nav",
      {
        className: styles.dataopsSubtabBar,
        role: "tablist",
        "aria-label": t("soc.dataops.subtabs"),
      },
      ...DATAOPS_SUB_TABS.map((tab) =>
        createElement(
          "button",
          {
            key: tab.key,
            role: "tab",
            "aria-selected": activeSubTab === tab.key,
            className: `${styles.dataopsSubtabItem} ${activeSubTab === tab.key ? styles.dataopsSubtabItemActive : ""}`,
            onClick: () => actions.setActiveSubTab(tab.key),
          },
          createElement(LucideIcon, { name: tab.icon, className: styles.dataopsSubtabIcon }),
          resolveLabel(tab.key),
        ),
      ),
    ),

    /* ── 4. Content Area ── */
    createElement(
      "div",
      { className: styles.dataopsContentArea },
      renderSubTabContent(),
    ),
  );
}

export function SocDataOpsPanel() {
  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(DataOpsProvider, null, createElement(DataOpsContent)),
  );
}
