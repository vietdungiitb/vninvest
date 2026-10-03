import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import styles from "./soc.module.css";

interface TabDef {
  key: string;
  icon: string;
}

interface SocTabNavigationProps {
  tabs: TabDef[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function SocTabNavigation({ tabs, activeTab, onChange }: SocTabNavigationProps) {
  const { t } = useI18n();

  const resolveLabel = (tabKey: string): string => {
    // COC-02: support both hyphen and underscore keys (e.g. runtime-kpi vs runtime_kpi)
    const directKey = `soc.tabs.${tabKey}`;
    const direct = t(directKey);
    if (direct && direct !== directKey) return direct;
    const underscoreKey = `soc.tabs.${tabKey.replace(/-/g, "_")}`;
    const underscored = t(underscoreKey);
    if (underscored && underscored !== underscoreKey) return underscored;
    return tabKey.charAt(0).toUpperCase() + tabKey.slice(1).replace(/[-_]/g, " ");
  };

  return createElement(
    "nav",
    { className: styles.tabBar, role: "tablist", "aria-label": t("soc.pages.soc_page_title") },
    tabs.map((tab) =>
      createElement(
        "button",
        {
          key: tab.key,
          role: "tab",
          "aria-selected": activeTab === tab.key,
          className: `${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`,
          onClick: () => onChange(tab.key),
        },
        tab.icon
          ? createElement(LucideIcon, { name: tab.icon, className: styles.tabIcon })
          : null,
        resolveLabel(tab.key),
      )
    ),
  );
}
