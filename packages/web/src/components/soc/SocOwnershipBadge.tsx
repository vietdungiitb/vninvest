import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocOwnershipBadgeProps {
  team?: string;
  writable?: boolean;
  accessLevel?: string;
}

export function SocOwnershipBadge({ team, writable, accessLevel }: SocOwnershipBadgeProps) {
  const { t } = useI18n();

  const teamLabel = team || t("soc.badge.unknown_team");
  const accessLabel = accessLevel || t("soc.badge.access_level");
  const writableLabel = writable ? t("soc.badge.writable_yes") : t("soc.badge.writable_no");

  return createElement(
    "div",
    { className: styles.sectionCard, style: { padding: "0.75rem", minWidth: "200px" } },
    createElement("div", { className: styles.sectionCardTitle, style: { fontSize: "0.75rem" } }, t("soc.badge.ownership_title")),
    createElement(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" } },
      createElement(
        "span",
        {
          className: styles.statusBadge,
          style: {
            background: writable ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
            color: writable ? "#34d399" : "#f87171",
          },
        },
        createElement("span", {
          className: styles.statusDot,
          style: {
            background: writable ? "#34d399" : "#f87171",
          },
        }),
        writableLabel,
      ),
      createElement("span", { className: styles.statusBadge, style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" } },
        t("soc.badge.team", { team: teamLabel }),
      ),
      createElement("span", { className: styles.statusBadge, style: { background: "rgba(255, 191, 77, 0.15)", color: "var(--accent-amber)" } },
        t("soc.badge.access", { level: accessLabel }),
      ),
    ),
  );
}
