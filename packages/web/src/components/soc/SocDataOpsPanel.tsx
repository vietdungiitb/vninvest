import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { DataOpsProvider, useDataOps } from "./DataOpsContext.js";
import { SocDataInventorySection } from "./SocDataInventorySection.js";
import { SocDataOpsBackfillForm } from "./SocDataOpsBackfillForm.js";
import { SocDataOpsMonitorSection } from "./SocDataOpsMonitorSection.js";
import { SocDataOpsConfigSection } from "./SocDataOpsConfigSection.js";
import { SocSchedulerBoard } from "./SocSchedulerBoard.js";
import styles from "./soc.module.css";

const DATAOPS_SUB_TABS = [
  { key: "inventory", icon: "\u{1F4CA}" },
  { key: "operations", icon: "\u{1F680}" },
  { key: "monitor", icon: "\u{1F4E1}" },
  { key: "scheduler", icon: "\u{23F0}" },
  { key: "config", icon: "\u{2699}" },
];

function DataOpsContent() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { activeSubTab } = state;

  const resolveLabel = (tabKey: string): string => {
    const i18nKey = `soc.dataops.subtab.${tabKey}`;
    const translated = t(i18nKey);
    if (translated && translated !== i18nKey) return translated;
    return tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
  };

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case "inventory":
        return createElement(SocDataInventorySection);
      case "operations":
        return createElement(SocDataOpsBackfillForm);
      case "monitor":
        return createElement(SocDataOpsMonitorSection);
      case "scheduler":
        return createElement(SocSchedulerBoard, { domain: "dataops" });
      case "config":
        return createElement(SocDataOpsConfigSection);
      default:
        return createElement("p", { className: styles.emptyState }, t("soc.dataops.subtab_not_found"));
    }
  };

  return createElement(
    "div",
    null,
    createElement(
      "nav",
      {
        className: styles.tabBar,
        role: "tablist",
        "aria-label": t("soc.dataops.subtabs"),
        style: { marginBottom: "1rem" },
      },
      DATAOPS_SUB_TABS.map((tab) =>
        createElement(
          "button",
          {
            key: tab.key,
            role: "tab",
            "aria-selected": activeSubTab === tab.key,
            className: `${styles.tabButton} ${activeSubTab === tab.key ? styles.tabButtonActive : ""}`,
            onClick: () => actions.setActiveSubTab(tab.key),
          },
          tab.icon
            ? createElement("span", { className: styles.tabIcon }, tab.icon)
            : null,
          resolveLabel(tab.key),
        ),
      ),
    ),
    renderSubTabContent(),
  );
}

export function SocDataOpsPanel() {
  const { t } = useI18n();

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      ShellPanel,
      {
        title: t("soc.dataops.title"),
        subtitle: t("soc.dataops.description"),
      },
      createElement(DataOpsProvider, null, createElement(DataOpsContent)),
    ),
  );
}
