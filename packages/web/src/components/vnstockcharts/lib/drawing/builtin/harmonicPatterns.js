import { createDrawingObject, replaceNextPoint } from "../shared.js";
import { chartPointToPixel } from "../coordinateUtils.js";
export const PATTERN_POINT_COUNT = {
    xabcdPattern: 5, // X·A·B·C·D
    cypherPattern: 5, // X·A·B·C·D
    headAndShoulders: 7, // LS·LV·H·RV·RS·NL·NR
    trianglePattern: 5, // H1·L1·H2·L2·apex
    threeDrivesPattern: 7, // S·1·A·2·B·3·E
};
export const PATTERN_POINT_LABELS = {
    xabcdPattern: ["X", "A", "B", "C", "D"],
    cypherPattern: ["X", "A", "B", "C", "D"],
    headAndShoulders: ["LS", "LV", "H", "RV", "RS", "NL", "NR"],
    trianglePattern: ["H1", "L1", "H2", "L2", "apex"],
    threeDrivesPattern: ["S", "1", "A", "2", "B", "3", "E"],
};
/** Whether the pattern has a dashed closing line from first to last point */
export const PATTERN_HAS_CLOSING_LINE = {
    xabcdPattern: true,
    cypherPattern: true,
    headAndShoulders: false, // neckline is the closing element
    trianglePattern: true,
    threeDrivesPattern: false,
};
export function calculateHarmonicPatternGeometry(drawing, scales) {
    if (drawing.points.length < 2) {
        return null;
    }
    const patternType = drawing.type;
    const pointCount = PATTERN_POINT_COUNT[patternType] ?? drawing.points.length;
    const pixels = drawing.points.slice(0, pointCount).map((p) => chartPointToPixel(p, scales));
    const labels = PATTERN_POINT_LABELS[patternType] ?? [];
    const hasClosingLine = PATTERN_HAS_CLOSING_LINE[patternType] ?? false;
    return {
        pixels,
        labels,
        hasClosingLine,
        isHeadAndShoulders: patternType === "headAndShoulders",
    };
}
function makeHarmonicTool(type) {
    const pointCount = PATTERN_POINT_COUNT[type];
    return {
        name: type,
        createDraft: (startPoint) => createDrawingObject(type, Array.from({ length: pointCount }, () => startPoint)),
        updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
        render: () => undefined,
    };
}
export const XabcdPattern = makeHarmonicTool("xabcdPattern");
export const CypherPattern = makeHarmonicTool("cypherPattern");
export const HeadAndShoulders = makeHarmonicTool("headAndShoulders");
export const TrianglePattern = makeHarmonicTool("trianglePattern");
export const ThreeDrivesPattern = makeHarmonicTool("threeDrivesPattern");
