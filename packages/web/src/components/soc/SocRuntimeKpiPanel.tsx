import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import styles from "./soc.module.css";

export function SocRuntimeKpiPanel() {
  const { t } = useI18n();

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      ShellPanel,
      {
        title: t("soc.runtime_kpi.title"),
        subtitle: t("soc.runtime_kpi.subtitle"),
      },
      createElement(
        "div",
        { className: `styles.emptyState s5_0_SocRuntimeKpiPanel`,  },
        createElement(
          "svg",
          {
            width: 48,
            height: 48,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.5,
            className: "s5_1_SocRuntimeKpiPanel", 
          },
          createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }),
        ),
        createElement("p", { className: "s5_2_SocRuntimeKpiPanel",  }, t("soc.runtime_kpi.coming_soon")),
        createElement("p", { className: "s5_3_SocRuntimeKpiPanel",  }, t("soc.runtime_kpi.description")),
      ),
    ),
  );
}
