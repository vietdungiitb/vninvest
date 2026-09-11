import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { toneColor } from "./socStatusColors.js";
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
    { className: styles.sectionCard,  },
    createElement("div", { className: styles.sectionCardTitle,  }, t("soc.badge.ownership_title")),
    createElement(
      "div",
      { },
      createElement(
        "span",
        {
          className: styles.statusBadge,
          style: {
            background: writable ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
            color: writable ? "var(--color-success-500, #34d399)" : toneColor("danger"),
          },
        },
        createElement("span", {
          className: styles.statusDot,
          style: {
            background: writable ? "var(--color-success-500, #34d399)" : toneColor("danger"),
          },
        }),
        writableLabel,
      ),
      createElement("span", { className: styles.statusBadge,  },
        t("soc.badge.team", { team: teamLabel }),
      ),
      createElement("span", { className: styles.statusBadge,  },
        t("soc.badge.access", { level: accessLabel }),
      ),
    ),
  );
}
