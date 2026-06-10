/**
 * Tool group configuration for drawing toolbar inside the widget.
 * Covers 9 groups (48 tools).
 * Each group has id (for tracking) and labelKey (for i18n lookup in tool.group.*).
 */
export const TOOL_GROUPS_V2 = [
    {
        id: "cursor",
        labelKey: "tool.group.cursor",
        tools: ["cursor", "crosshair"],
    },
    {
        id: "lines",
        labelKey: "tool.group.lines",
        tools: ["trendLine", "ray", "extendedLine", "hLine", "vLine", "polyline", "arrow"],
    },
    {
        id: "channels",
        labelKey: "tool.group.channels",
        tools: ["channel", "parallelChannel", "pitchfork", "regressionChannel"],
    },
    {
        id: "fibonacci",
        labelKey: "tool.group.fibonacci",
        tools: [
            "fibonacci",
            "fibExtension",
            "fibArc",
            "fibTimeZone",
            "fibChannel",
            "fibSpeedResistanceFan",
            "trendBasedFibTime",
            "fibCircles",
            "fibSpiral",
            "fibSpeedResistanceArcs",
            "fibWedge",
            "pitchfan",
        ],
    },
    {
        id: "gann",
        labelKey: "tool.group.gann",
        tools: ["gannFan", "gannBox", "gannSquare", "gannSquareFixed"],
    },
    {
        id: "shapes",
        labelKey: "tool.group.shapes",
        tools: ["rectangle", "circle", "ellipse", "triangle", "text", "callout", "priceLabel"],
    },
    {
        id: "measurement",
        labelKey: "tool.group.measurement",
        tools: ["dateAndPriceRange", "longPosition", "shortPosition", "priceRange", "dateRange", "barsCount"],
    },
    {
        id: "patterns",
        labelKey: "tool.group.patterns",
        tools: [
            "abcdPattern",
            "xabcdPattern",
            "cypherPattern",
            "headAndShoulders",
            "trianglePattern",
            "threeDrivesPattern",
        ],
    },
    {
        id: "elliott",
        labelKey: "tool.group.elliott",
        tools: [
            "elliottImpulse",
            "elliottCorrection",
            "elliottTriangle",
            "elliottDoubleCombo",
            "elliottTripleCombo",
        ],
    },
    {
        id: "cycles",
        labelKey: "tool.group.cycles",
        tools: ["cyclicLines", "timeCycles", "sineLine"],
    },
];
