import { createDrawingObject, replaceLastPoint } from "../../lib/drawing/shared.js";
import { chartPointToPixel } from "../../lib/drawing/coordinateUtils.js";
export const ELLIOTT_POINT_COUNT = {
    elliottImpulse: 6, // (0)(1)(2)(3)(4)(5)
    elliottCorrection: 4, // (0)(A)(B)(C)
    elliottTriangle: 6, // (0)(A)(B)(C)(D)(E)
    elliottDoubleCombo: 4, // (0)(W)(X)(Y)
    elliottTripleCombo: 6, // (0)(W)(X)(Y)(XX)(Z)
};
export const ELLIOTT_LABELS = {
    elliottImpulse: ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
    elliottCorrection: ["(0)", "(A)", "(B)", "(C)"],
    elliottTriangle: ["(0)", "(A)", "(B)", "(C)", "(D)", "(E)"],
    elliottDoubleCombo: ["(0)", "(W)", "(X)", "(Y)"],
    elliottTripleCombo: ["(0)", "(W)", "(X)", "(Y)", "(XX)", "(Z)"],
};
export function calculateElliottWaveGeometry(drawing, scales) {
    if (drawing.points.length < 2) {
        return null;
    }
    const waveType = drawing.type;
    const pointCount = ELLIOTT_POINT_COUNT[waveType] ?? drawing.points.length;
    const pixels = drawing.points
        .slice(0, pointCount)
        .map((p) => chartPointToPixel(p, scales));
    const labels = drawing.waveLabels ?? ELLIOTT_LABELS[waveType] ?? [];
    return { pixels, labels };
}
function makeElliottTool(type) {
    const pointCount = ELLIOTT_POINT_COUNT[type];
    return {
        name: type,
        createDraft: (startPoint) => createDrawingObject(type, Array.from({ length: pointCount }, () => startPoint)),
        updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
        render: () => undefined,
    };
}
export const ElliottImpulse = makeElliottTool("elliottImpulse");
export const ElliottCorrection = makeElliottTool("elliottCorrection");
export const ElliottTriangle = makeElliottTool("elliottTriangle");
export const ElliottDoubleCombo = makeElliottTool("elliottDoubleCombo");
export const ElliottTripleCombo = makeElliottTool("elliottTripleCombo");
