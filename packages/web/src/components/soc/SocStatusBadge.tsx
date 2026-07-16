import { createElement } from "react";
import styles from "./soc.module.css";
import { getStatusBadgeStyle } from "./socStatusColors.js";

interface SocStatusBadgeProps {
  status: string | undefined;
  label?: string;
  dot?: boolean;
}

// Single source of truth for status pills across SOC panels.
// Uses the shared socStatusColors tokens + the .statusBadge shell class.
export function SocStatusBadge({ status, label, dot = true }: SocStatusBadgeProps) {
  const text = label ?? status ?? "";
  return createElement(
    "span",
    { className: styles.statusBadge, style: getStatusBadgeStyle(status) },
    dot
      ? createElement("span", {
          className: styles.statusDot,
          style: { background: "currentColor" },
          "aria-hidden": "true",
        })
      : null,
    text,
  );
}
