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
        { className: styles.emptyState, style: { padding: "3rem 1rem" } },
        createElement(
          "svg",
          {
            width: 48,
            height: 48,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.5,
            style: { margin: "0 auto 1rem", opacity: 0.4, display: "block" },
          },
          createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }),
        ),
        createElement("p", { style: { fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" } }, t("soc.runtime_kpi.coming_soon")),
        createElement("p", { style: { fontSize: "0.85rem", color: "var(--text-muted)" } }, t("soc.runtime_kpi.description")),
      ),
    ),
  );
}
