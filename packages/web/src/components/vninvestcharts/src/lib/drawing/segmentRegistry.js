/**
 * segmentRegistry.ts  — DT-17
 *
 * Canonical segment key definitions and resolver helpers for per-segment
 * style overrides in the drawing system.
 *
 * Rule: src/lib MUST NOT import from src/demo. This file lives in src/lib.
 */
// ---------------------------------------------------------------------------
// Segment key registry
// ---------------------------------------------------------------------------
/**
 * Maps each multi-segment drawing type to its ordered segment keys.
 * Single-line tools (trendLine, hLine, etc.) are NOT listed here —
 * they have no sub-segments and use drawing.style directly.
 */
export const SEGMENT_KEYS_BY_TYPE = {
    abcdPattern: ["AB", "BC", "CD"],
    xabcdPattern: ["XA", "AB", "BC", "CD", "XD"],
    channel: ["primary", "secondary"],
    parallelChannel: ["upper", "middle", "lower"],
    pitchfork: ["median", "leftFork", "rightFork"],
    gannFan: ["1x8", "1x4", "1x3", "1x2", "1x1", "2x1", "3x1", "4x1", "8x1"],
    elliottImpulse: ["wave-0", "wave-1", "wave-2", "wave-3", "wave-4", "wave-5"],
    elliottCorrection: ["wave-A", "wave-B", "wave-C"],
    elliottTriangle: ["wave-A", "wave-B", "wave-C", "wave-D", "wave-E"],
    regressionChannel: ["center", "upper", "lower"],
    elliottDoubleCombo: ["wave-W", "wave-X", "wave-Y"],
    elliottTripleCombo: ["wave-W", "wave-X1", "wave-Y", "wave-X2", "wave-Z"],
    cypherPattern: ["XA", "AB", "BC", "XC"],
    headAndShoulders: ["leftShoulder", "neckline", "head", "rightShoulder"],
    trianglePattern: ["upper", "lower"],
    threeDrivesPattern: ["drive1", "drive2", "drive3"],
    pitchfan: ["median", "fan1", "fan2"],
    fibChannel: ["upper", "lower"],
    fibSpeedResistanceFan: ["1x4", "1x3", "1x2", "1x1", "2x1", "3x1", "4x1"],
    gannBox: ["diagonal", "horizontal", "vertical"],
    gannSquare: ["diagonal", "horizontal", "vertical"],
    gannSquareFixed: ["diagonal", "horizontal", "vertical"],
    circle: ["center", "edge"],
    triangle: ["p1", "p2", "p3"],
    callout: ["box", "tail"],
};
// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------
/**
 * Returns the segment keys for the given type, or an empty array when the
 * type has no sub-segments.
 */
export function getSegmentKeys(type) {
    return SEGMENT_KEYS_BY_TYPE[type] ?? [];
}
/**
 * Returns true when the drawing type supports per-segment styling.
 */
export function hasSubSegments(type) {
    const keys = SEGMENT_KEYS_BY_TYPE[type];
    return keys !== undefined && keys.length > 0;
}
/**
 * Resolves the effective DrawingStyle for a named segment.
 *
 * Merge rule: base style (drawing.style) overridden by any partial
 * in drawing.segmentStyles[key]. Returns drawing.style unchanged when
 * the key has no override entry.
 */
export function resolveSegmentStyle(drawing, key) {
    const override = drawing.segmentStyles?.[key];
    if (!override)
        return drawing.style;
    return { ...drawing.style, ...override };
}
/**
 * Returns false when drawing.segmentVisible[key] is explicitly false.
 * All other cases (undefined, true) are treated as visible.
 */
export function isSegmentVisible(drawing, key) {
    return drawing.segmentVisible?.[key] !== false;
}
