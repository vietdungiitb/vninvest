import { vnExchangeCalendar } from "./ExchangeCalendar.js";
const REGISTRY = new Map([
    ["vn-exchange-calendar", vnExchangeCalendar],
]);
/**
 * Returns the ExchangeCalendar for the given calendarId, or null if unknown.
 */
export function getCalendar(calendarId) {
    if (!calendarId)
        return null;
    return REGISTRY.get(calendarId) ?? null;
}
