import styles from "./ShellPageTemplate.module.css";
import { createElement } from "react";
export function ShellEmptyState(p: {
  icon?: React.ReactNode | null;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaOnClick?: () => void;
  children?: React.ReactNode;
}) {
  return createElement(
    "div",
    { className: `${styles.empty}`, style: { textAlign: "center", padding: "32px 18px" } },
    p.icon || createElement(
      "svg",
      {
        width: 48, height: 48, viewBox: "0 0 48 48", fill: "none",
        style: { margin: "0 auto 16px", opacity: 0.4, display: "block" },
      },
      createElement("rect", { x: 8, y: 12, width: 32, height: 24, rx: 4, stroke: "var(--text-secondary)", strokeWidth: 2, fill: "none" }),
      createElement("path", { d: "M16 20h16M16 26h12M16 32h8", stroke: "var(--text-secondary)", strokeWidth: 2, strokeLinecap: "round" }),
    ),
    p.title ? createElement("p", { style: { fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" } }, p.title) : null,
    p.description ? createElement("p", { style: { fontSize: 13, color: "var(--text-secondary)", marginBottom: p.ctaLabel ? 16 : 0 } }, p.description) : null,
    p.ctaLabel
      ? createElement(
        "button",
        {
          className: `${styles.button}`,
          onClick: p.ctaOnClick,
          style: { padding: "8px 20px", fontSize: 13, fontWeight: 600 },
        },
        p.ctaLabel,
      )
      : null,
    p.children,
  );
}
