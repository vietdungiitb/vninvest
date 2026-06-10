export function canRunHistoryScheduler(state) {
    return state.activeSource !== "offline" && !state.warmupInFlight && !state.backfillInFlight && state.liveBarsLength > 0;
}
