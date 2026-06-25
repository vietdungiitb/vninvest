import { createElement, useCallback, useEffect, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
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

const STORAGE_KEY = "soc_active_tab";

export function SocTabNavigation({ tabs, activeTab, onChange }: SocTabNavigationProps) {
  const { t } = useI18n();
  const syncedRef = useRef(false);

  const resolveLabel = (tabKey: string): string => {
    const i18nKey = `soc.tabs.${tabKey}`;
    const translated = t(i18nKey);
    if (translated && translated !== i18nKey) return translated;
    return tabKey.charAt(0).toUpperCase() + tabKey.slice(1).replace(/_/g, " ");
  };

  const handleTabChange = useCallback((key: string) => {
    onChange(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch { /* noop */ }
    const url = new URL(window.location.href);
    if (key) {
      url.searchParams.set("tab", key);
    } else {
      url.searchParams.delete("tab");
    }
    window.history.replaceState(null, "", url.toString());
  }, [onChange]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    let resolved: string | null = null;

    if (tabParam && tabs.some((t) => t.key === tabParam)) {
      resolved = tabParam;
    } else if (!syncedRef.current) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && tabs.some((t) => t.key === saved)) {
          resolved = saved;
        }
      } catch { /* noop */ }
    }

    if (resolved && resolved !== activeTab) {
      syncedRef.current = true;
      handleTabChange(resolved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          onClick: () => handleTabChange(tab.key),
        },
        tab.icon
          ? createElement("span", { className: styles.tabIcon }, tab.icon)
          : null,
        resolveLabel(tab.key),
      )
    ),
  );
}
