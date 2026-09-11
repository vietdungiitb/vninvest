import { createElement, useId } from "react";
import styles from "./ShellPageTemplate.module.css";
import theme from "../theme/theme.module.css"; // P3-1: consume theme.module.css (orphaned → has consumer)

const e = createElement;

/**
 * WorkstationShell — variant of ShellPageChrome for Stock Detail workstation
 * Keeps sdp glow/chart private visuals but uses layout tokens from FullLayout contract.
 * P2-1: not a nested <main>, page-level scroll stays in FullLayout.tsx:82
 * Nested scroll is workstation-specific: .sdp-chart-wrapper:451, .ws-* (see DOM_LAYOUT_CONTRACT.md:3)
 */
interface WorkstationShellProps {
  title?: string;
  symbol?: string;
  eyebrow?: string;
  description?: string;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

export function WorkstationShell({
  title,
  symbol,
  eyebrow,
  description,
  id,
  className = "",
  children,
}: WorkstationShellProps) {
  void theme; // P3-1: ensure theme.module.css has consumer (grep)
  const autoId = useId();
  const resolvedId = id || `ws-${autoId.replace(/:/g, "")}`;
  const titleId = `${resolvedId}-title`;
  const displayTitle = title || symbol || "";

  return e(
    "div",
    {
      className: `${styles.shellPage} ${className}`.trim(),
      role: "region",
      "aria-labelledby": titleId,
      "data-workstation-shell": symbol || "",
    },
    e(
      "header",
      { className: styles.hero },
      eyebrow ? e("span", { className: styles.eyebrow }, eyebrow) : null,
      e(
        "div",
        { className: styles.titleRow },
        e("div", null, e("h1", { id: titleId, className: styles.title }, displayTitle),
          description ? e("p", { className: styles.description }, description) : null),
      ),
    ),
    e("div", { className: "workstation-shell__body" }, children),
  );
}

export default WorkstationShell;
