/**
 * Canonical cache key formatter matching CACHE_FILE_CONTRACT.
 */
export function toCacheKey(parts) {
    return [
        parts.source,
        parts.symbol,
        parts.timeframe,
        parts.adjustmentPolicy,
        parts.schemaVersion,
    ].join(":");
}
export function toCacheSemanticScope(sourceSemantics) {
    return {
        sourceContractVersion: sourceSemantics.sourceContractVersion,
        instrumentClass: sourceSemantics.instrumentClass,
        sessionModel: sourceSemantics.sessionModel,
        sessionCalendarId: sourceSemantics.sessionCalendarId,
        timezone: sourceSemantics.timezone,
        finalityMode: sourceSemantics.finalityMode,
        correctionLookbackMs: sourceSemantics.correctionLookbackMs,
    };
}
