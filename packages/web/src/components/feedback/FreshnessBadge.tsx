import { createElement } from "react";

export type FreshnessState = "fresh" | "delayed" | "stale" | "empty";

/** Label do caller truyền qua `t()` — component không tự hardcode text. */
export function FreshnessBadge({ state, label, note }: {
  state: FreshnessState;
  label: string;
  note?: string;
}) {
  return createElement(
    "span",
    {
      "data-testid": `freshness-${state}`,
      "data-state": state,
      "data-note": note,
      title: note,
      className: `freshness-badge freshness-badge--${state}`,
      style: {
        background: state === "fresh" ? "rgba(52,211,153,0.14)" : "rgba(245,158,11,0.18)",
        border: `1px solid ${state === "fresh" ? "rgba(52,211,153,0.4)" : "rgba(245,158,11,0.45)"}`,
        color: state === "fresh" ? "#34d399" : "#fbbf24",
        borderRadius: "9999px",
        padding: "2px 8px",
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
      },
    },
    label,
  );
}
