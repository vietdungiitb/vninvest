import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { DataOpsProvider, useDataOps } from "./DataOpsContext.js";
import { SocDataInventorySection } from "./SocDataInventorySection.js";
import { SocDataOpsOperationsSection } from "./SocDataOpsOperationsSection.js";
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
        content = createElement(SocSchedulerBoard, { hideHeaderTitle: true });
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
      content
    );
  };

  return createElement(
    "div",
    null,
    createElement(
      "nav",
      {
        className: `styles.tabBar s5_0_SocDataOpsPanel`,
        role: "tablist",
        "aria-label": t("soc.dataops.subtabs"),
        
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
  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(DataOpsProvider, null, createElement(DataOpsContent)),
  );
}
