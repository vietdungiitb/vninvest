/**
 * KF-03-T01 — Canonical indicator series key and normalization rules.
 *
 * An indicator is uniquely identified by the combination of:
 *   sourceId · timeframe · transformKey · indicatorType · normalizedParams
 *
 * If all five components are equal, the indicator MUST resolve to the same
 * data series regardless of which pane or axis it is displayed on.
 */
/**
 * Serialize params into a canonical string that is stable regardless of key
 * insertion order in the original object.
 *
 * Rules:
 * - Keys are sorted alphabetically before serialisation.
 * - `undefined` values are omitted.
 * - Numbers that are not finite are replaced with `null`.
 * - The result is a compact JSON string or `"{}"` for an empty/absent params map.
 */
export function normalizeIndicatorParams(params) {
    if (!params || Object.keys(params).length === 0) {
        return "{}";
    }
    const sortedKeys = Object.keys(params).sort();
    const normalizedEntries = {};
    for (const key of sortedKeys) {
        const value = params[key];
        if (value === undefined) {
            continue;
        }
        if (typeof value === "number") {
            normalizedEntries[key] = Number.isFinite(value) ? value : null;
        }
        else {
            normalizedEntries[key] = value;
        }
    }
    return JSON.stringify(normalizedEntries);
}
/**
 * Build a stable canonical string key from an `IndicatorSeriesKeyInput`.
 *
 * The resulting string is suitable for use as a `Map` key.  All components are
 * pipe-delimited so that no field can bleed into another (field values must not
 * contain `|`; the serialised params section is JSON so it is unambiguous).
 */
export function buildIndicatorSeriesKeyString(input) {
    const transformKey = input.transformKey ?? "raw";
    const normalizedParams = normalizeIndicatorParams(input.params);
    return `${input.sourceId}|${input.timeframe}|${transformKey}|${input.indicatorType}|${normalizedParams}`;
}
/**
 * Build a structured `IndicatorSeriesKey` from an input descriptor.
 */
export function buildIndicatorSeriesKey(input) {
    return {
        sourceId: input.sourceId,
        timeframe: input.timeframe,
        transformKey: input.transformKey ?? "raw",
        indicatorType: input.indicatorType,
        normalizedParams: normalizeIndicatorParams(input.params),
    };
}
/**
 * Convert a structured `IndicatorSeriesKey` back to a canonical string.
 */
export function indicatorSeriesKeyToString(key) {
    return `${key.sourceId}|${key.timeframe}|${key.transformKey}|${key.indicatorType}|${key.normalizedParams}`;
}
/**
 * Equality check for two structured keys.
 */
export function indicatorSeriesKeysEqual(a, b) {
    return (a.sourceId === b.sourceId &&
        a.timeframe === b.timeframe &&
        a.transformKey === b.transformKey &&
        a.indicatorType === b.indicatorType &&
        a.normalizedParams === b.normalizedParams);
}
