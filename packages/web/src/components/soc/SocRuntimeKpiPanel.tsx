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
        { className: `styles.emptyState`,  },
        createElement(
          "svg",
          {
            width: 48,
            height: 48,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.5,
            },
          createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }),
        ),
        createElement("p", { }, t("soc.runtime_kpi.coming_soon")),
        createElement("p", { }, t("soc.runtime_kpi.description")),
      ),
    ),
  );
}
