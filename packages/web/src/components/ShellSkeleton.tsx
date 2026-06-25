import { createElement } from "react";

const baseKeyframes = `
@keyframes shellPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
@keyframes shellShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const pulseStyle: React.CSSProperties = {
  animation: "shellPulse 1.5s ease-in-out infinite",
  background: "var(--shell-border, rgba(255,255,255,0.08))",
  borderRadius: 6,
};

const shimmerStyle: React.CSSProperties = {
  animation: "shellShimmer 2s ease-in-out infinite",
  background: "linear-gradient(90deg, var(--shell-border, rgba(255,255,255,0.06)) 0%, var(--shell-surface, rgba(255,255,255,0.12)) 50%, var(--shell-border, rgba(255,255,255,0.06)) 100%)",
  backgroundSize: "200% 100%",
  borderRadius: 6,
};

function getItemStyle(index: number, animStyle: React.CSSProperties): React.CSSProperties {
  return {
    ...animStyle,
    animationDelay: `${index * 0.08}s`,
  };
}

function Pulse({ style, index = 0 }: { style?: React.CSSProperties; index?: number }) {
  return createElement(
    "div",
    { style: { ...pulseStyle, ...(index > 0 ? getItemStyle(index, pulseStyle) : {}), ...style } },
  );
}

function Shimmer({ style, index = 0 }: { style?: React.CSSProperties; index?: number }) {
  return createElement(
    "div",
    { style: { ...shimmerStyle, ...(index > 0 ? getItemStyle(index, shimmerStyle) : {}), ...style } },
  );
}

export function ShellSkeleton({
  variant,
  count = 1,
  anim = "pulse",
}: {
  variant: "metric" | "table-row" | "chart" | "card";
  count?: number;
  anim?: "pulse" | "shimmer";
}) {
  const items = Array.from({ length: count }, (_, i) => i);
  const Bar = anim === "shimmer" ? Shimmer : Pulse;

  const baseSurface: React.CSSProperties = {
    background: "var(--shell-surface, rgba(15,23,42,0.65))",
    border: "1px solid var(--shell-border, rgba(255,255,255,0.08))",
    borderRadius: 12,
  };

  switch (variant) {
    case "metric":
      return createElement(
        "div",
        { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
        createElement("style", null, baseKeyframes),
        ...items.map((i) =>
          createElement(
            "div",
            {
              key: i,
              style: {
                ...baseSurface,
                flex: "1 1 140px",
                padding: 16,
                transition: "opacity 0.3s ease",
              },
            },
            createElement(Bar, { style: { width: "60%", height: 12, marginBottom: 8 }, index: i }),
            createElement(Bar, { style: { width: "40%", height: 22 }, index: i }),
          ),
        ),
      );

    case "table-row":
      return createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        createElement("style", null, baseKeyframes),
        ...items.map((i) =>
          createElement(
            "div",
            {
              key: i,
              style: {
                display: "flex",
                gap: 16,
                padding: "12px 16px",
                ...baseSurface,
                transition: "opacity 0.3s ease",
              },
            },
            createElement(Bar, { style: { width: "30%", height: 14 }, index: i }),
            createElement(Bar, { style: { width: "20%", height: 14 }, index: i }),
            createElement(Bar, { style: { flex: 1, height: 14 }, index: i }),
            createElement(Bar, { style: { width: "15%", height: 14 }, index: i }),
          ),
        ),
      );

    case "chart":
      return createElement(
        "div",
        {
          style: {
            ...baseSurface,
            padding: 16,
          },
        },
        createElement("style", null, baseKeyframes),
        createElement(Bar, { style: { width: "50%", height: 14, marginBottom: 12 } }),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              height: 160,
            },
          },
          ...items.map((i) =>
            createElement(Bar, {
              key: i,
              index: i,
              style: {
                flex: 1,
                height: `${30 + Math.sin(i * 1.5) * 60 + 60}px`,
                borderRadius: "6px 6px 0 0",
              },
            }),
          ),
        ),
      );

    case "card":
      return createElement(
        "div",
        {
          style: {
            ...baseSurface,
            padding: 20,
          },
        },
        createElement("style", null, baseKeyframes),
        createElement(Bar, { style: { width: "100%", height: 120, marginBottom: 12 } }),
        createElement(Bar, { style: { width: "70%", height: 14, marginBottom: 8 } }),
        createElement(Bar, { style: { width: "50%", height: 12 } }),
      );
  }
}
