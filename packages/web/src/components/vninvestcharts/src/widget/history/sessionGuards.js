function normalizeField(value) {
    if (value === undefined || value === null) {
        return "-";
    }
    return String(value);
}
export function buildSourceRevisionKey(adapterLabel, sourceSemantics) {
    if (!sourceSemantics) {
        return `${adapterLabel}|no-semantics`;
    }
    return [
        adapterLabel,
        normalizeField(sourceSemantics.sourceId),
        normalizeField(sourceSemantics.sourceContractVersion),
        normalizeField(sourceSemantics.coverageMode),
        normalizeField(sourceSemantics.sessionModel),
        normalizeField(sourceSemantics.sessionCalendarId),
        normalizeField(sourceSemantics.timezone),
        normalizeField(sourceSemantics.finalityMode),
        normalizeField(sourceSemantics.correctionLookbackMs),
    ].join("|");
}
export function buildHistorySessionRequestKey(symbol, timeframe, sourceRevisionKey) {
    return `${symbol}:${timeframe}:${sourceRevisionKey}`;
}
