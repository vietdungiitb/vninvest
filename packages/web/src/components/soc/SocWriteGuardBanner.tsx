import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocWriteGuardBannerProps {
  owner?: string;
  writer?: string;
  surface?: string;
}

export function SocWriteGuardBanner({ owner, writer, surface }: SocWriteGuardBannerProps) {
  const { t } = useI18n();

  return createElement(
    "div",
    { className: styles.guardBanner, role: "status", "aria-live": "polite" },
    createElement(
      "svg",
      {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        className: "s5_0_SocWriteGuardBanner", 
      },
      createElement("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
      createElement("path", { d: "M9 12l2 2 4-4" }),
    ),
    createElement(
      "div",
      { className: "s5_1_SocWriteGuardBanner",  },
      createElement("div", { className: "s5_2_SocWriteGuardBanner",  }, t("soc.guard.read_only_title")),
      createElement("div", { className: "s5_3_SocWriteGuardBanner",  },
        t("soc.guard.read_only_desc", { owner: owner || t("soc.guard.unknown"), writer: writer || t("soc.guard.unknown"), surface: surface || t("soc.guard.unknown") }),
      ),
    ),
  );
}
