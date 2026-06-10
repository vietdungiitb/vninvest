/**
 * Return true when `barMs` is within the mutable window defined by `opts`.
 */
function isMutableBar(barMs, opts) {
    const nowMs = opts.nowMs ?? Date.now();
    switch (opts.finalityMode) {
        case "immutable":
            return false;
        case "near-now-provisional": {
            const windowMs = opts.provisionalWindowMs ?? 0;
            return barMs >= nowMs - windowMs;
        }
        case "historically-correctable": {
            const lookbackMs = opts.correctionLookbackMs ?? 0;
            if (lookbackMs <= 0)
                return false;
            return barMs >= nowMs - lookbackMs;
        }
    }
}
export function resolveFetchWindow(timeframe) {
    const to = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const lookbackDays = (() => {
        switch (timeframe) {
            case "1m":
            case "3m":
            case "5m":
                return 7;
            case "15m":
            case "30m":
                return 14;
            case "1h":
                return 30;
            case "4h":
                return 90;
            case "1d":
                return 365;
            default:
                return 30;
        }
    })();
    return { from: new Date(to.getTime() - lookbackDays * oneDay), to };
}
export function resolveTimeframeMs(timeframe) {
    switch (timeframe) {
        case "1m":
            return 60_000;
        case "3m":
            return 3 * 60_000;
        case "5m":
            return 5 * 60_000;
        case "15m":
            return 15 * 60_000;
        case "30m":
            return 30 * 60_000;
        case "1h":
            return 60 * 60_000;
        case "2h":
            return 2 * 60 * 60_000;
        case "4h":
            return 4 * 60 * 60_000;
        case "1d":
            return 24 * 60 * 60_000;
        case "1w":
            return 7 * 24 * 60 * 60_000;
        case "1M":
            return 30 * 24 * 60 * 60_000;
        default:
            return 24 * 60 * 60_000;
    }
}
export function computeLoadedHistoryWindow(bars) {
    if (bars.length === 0) {
        return null;
    }
    return {
        startMs: bars[0].date.getTime(),
        endMs: bars[bars.length - 1].date.getTime(),
    };
}
export function resolveRetentionWindow(visibleDomain, timeframe) {
    const visibleStartMs = visibleDomain[0].getTime();
    const visibleEndMs = visibleDomain[1].getTime();
    const spanMs = Math.max(resolveTimeframeMs(timeframe), visibleEndMs - visibleStartMs);
    return {
        startMs: visibleStartMs - spanMs,
        endMs: visibleEndMs + spanMs,
    };
}
export function trimBarsToRetentionWindow(bars, visibleDomain, timeframe) {
    if (!visibleDomain || bars.length === 0) {
        return bars;
    }
    const retentionWindow = resolveRetentionWindow(visibleDomain, timeframe);
    const trimmedBars = bars.filter((bar) => {
        const timestamp = bar.date.getTime();
        return timestamp >= retentionWindow.startMs && timestamp <= retentionWindow.endMs;
    });
    if (trimmedBars.length === 0 || trimmedBars.length === bars.length) {
        return bars;
    }
    return trimmedBars;
}
export function mergeBarPagesByDate(previousBars, nextBars) {
    return nextBars.reduce((mergedBars, nextBar) => mergeBarsByDate(mergedBars, nextBar), previousBars);
}
export function mergeBarsByDate(previousBars, nextBar) {
    if (previousBars.length === 0) {
        return [nextBar];
    }
    const lastBar = previousBars[previousBars.length - 1];
    if (lastBar.date.getTime() === nextBar.date.getTime()) {
        return [...previousBars.slice(0, -1), nextBar];
    }
    if (lastBar.date.getTime() < nextBar.date.getTime()) {
        return [...previousBars, nextBar];
    }
    const existingIndex = previousBars.findIndex((bar) => bar.date.getTime() === nextBar.date.getTime());
    if (existingIndex >= 0) {
        return previousBars.map((bar, index) => (index === existingIndex ? nextBar : bar));
    }
    return [...previousBars, nextBar].sort((left, right) => left.date.getTime() - right.date.getTime());
}
/**
 * Finality-aware variant of `mergeBarPagesByDate`.
 *
 * When `opts` is provided each incoming bar is only allowed to overwrite an
 * existing bar when `isMutableBar` returns true for that bar's timestamp.
 * Bars with new timestamps are always inserted regardless of finality.
 */
export function mergeBarPagesByDateWithFinality(previousBars, nextBars, opts) {
    return nextBars.reduce((mergedBars, nextBar) => mergeBarsByDateWithFinality(mergedBars, nextBar, opts), previousBars);
}
/**
 * Finality-aware variant of `mergeBarsByDate`.
 *
 * Rules:
 *  - New timestamp → always insert.
 *  - Existing timestamp + mutable → overwrite (same as legacy behaviour).
 *  - Existing timestamp + immutable → keep existing bar, discard incoming.
 */
/**
 * Filter `incomingBars` so that bars whose timestamps already exist in
 * `residentBars` are kept only when they fall within the mutable window.
 *
 * Use this BEFORE passing bars to `HistoryChunkStore.prepend / append` when
 * you want finality-aware merge without changing the chunkStore internals.
 *
 * Bars with entirely new timestamps pass through unconditionally.
 */
export function filterBarsForFinalityMerge(incomingBars, residentBars, opts) {
    if (incomingBars.length === 0 || residentBars.length === 0) {
        return incomingBars;
    }
    let incomingStartMs = incomingBars[0].date.getTime();
    let incomingEndMs = incomingStartMs;
    for (const bar of incomingBars) {
        const barMs = bar.date.getTime();
        if (barMs < incomingStartMs) {
            incomingStartMs = barMs;
        }
        if (barMs > incomingEndMs) {
            incomingEndMs = barMs;
        }
    }
    const residentStartMs = residentBars[0].date.getTime();
    const residentEndMs = residentBars[residentBars.length - 1].date.getTime();
    if (incomingEndMs < residentStartMs || incomingStartMs > residentEndMs) {
        return incomingBars;
    }
    if (opts.finalityMode === "historically-correctable" || opts.finalityMode === "near-now-provisional") {
        const nowMs = opts.nowMs ?? Date.now();
        let cutoffMs;
        if (opts.finalityMode === "near-now-provisional") {
            const windowMs = opts.provisionalWindowMs ?? 0;
            cutoffMs = nowMs - windowMs;
        }
        else {
            const lookbackMs = opts.correctionLookbackMs ?? 0;
            cutoffMs = lookbackMs > 0 ? nowMs - lookbackMs : Infinity;
        }
        const residentTs = new Set(residentBars.map((b) => b.date.getTime()));
        return incomingBars.filter((bar) => {
            const barMs = bar.date.getTime();
            if (!residentTs.has(barMs))
                return true;
            return barMs >= cutoffMs;
        });
    }
    if (opts.finalityMode === "immutable") {
        const residentTs = new Set(residentBars.map((b) => b.date.getTime()));
        return incomingBars.filter((bar) => !residentTs.has(bar.date.getTime()));
    }
    return incomingBars;
}
export function mergeBarsByDateWithFinality(previousBars, nextBar, opts) {
    if (previousBars.length === 0) {
        return [nextBar];
    }
    const barMs = nextBar.date.getTime();
    const lastBar = previousBars[previousBars.length - 1];
    if (lastBar.date.getTime() === barMs) {
        // Tail overwrite: only allowed when bar is mutable.
        if (!isMutableBar(barMs, opts)) {
            return previousBars; // keep existing
        }
        return [...previousBars.slice(0, -1), nextBar];
    }
    if (lastBar.date.getTime() < barMs) {
        return [...previousBars, nextBar];
    }
    const existingIndex = previousBars.findIndex((bar) => bar.date.getTime() === barMs);
    if (existingIndex >= 0) {
        if (!isMutableBar(barMs, opts)) {
            return previousBars; // keep existing
        }
        return previousBars.map((bar, index) => (index === existingIndex ? nextBar : bar));
    }
    return [...previousBars, nextBar].sort((left, right) => left.date.getTime() - right.date.getTime());
}
