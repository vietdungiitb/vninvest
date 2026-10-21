import { createElement, useEffect, useRef } from "react";
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
  const navRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // 9 tab vượt quá bề rộng viewport 1920px ⇒ tab bar cuộn ngang. Khi tab đổi
  // (kể cả khi mở sâu bằng ?tab=), đưa tab đang chọn vào khung nhìn.
  useEffect(() => {
    const node = activeRef.current;
    if (!node) return;
    if (typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeTab]);

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
    {
      ref: navRef,
      className: styles.tabBar,
      role: "tablist",
      "aria-label": t("soc.pages.soc_page_title"),
    },
    tabs.map((tab) =>
      createElement(
        "button",
        {
          key: tab.key,
          ref: tab.key === activeTab ? activeRef : undefined,
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
