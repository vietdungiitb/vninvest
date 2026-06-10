let globalTimezone = "Asia/Ho_Chi_Minh";
// Memory-friendly Formatter Cache Map
const formatterCache = new Map();
export function setGlobalTimezone(tz) {
    if (globalTimezone === tz) {
        return;
    }
    globalTimezone = tz;
    formatterCache.clear();
}
export function getGlobalTimezone() {
    return globalTimezone;
}
export function getCachedFormatter(locale, options) {
    const cacheKey = JSON.stringify({ locale, options });
    if (!formatterCache.has(cacheKey)) {
        formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
    }
    return formatterCache.get(cacheKey);
}
/**
 * Định dạng mốc thời gian tuân thủ múi giờ SSOT toàn cục.
 * Hỗ trợ cache formatter để tối ưu hóa hiệu năng render 60 FPS.
 */
export function formatWithTimezone(date, options = {}) {
    const d = typeof date === "number" ? new Date(date) : date;
    const tz = getGlobalTimezone();
    const extendedOptions = {
        ...options,
        timeZone: tz
    };
    try {
        const formatter = getCachedFormatter("vi-VN", extendedOptions);
        return formatter.format(d);
    }
    catch (e) {
        // Fallback an toàn: ép về UTC + en-US để tránh throw lặp lại.
        const fallbackOptions = {
            ...extendedOptions,
            timeZone: "UTC"
        };
        const formatter = getCachedFormatter("en-US", fallbackOptions);
        return formatter.format(d);
    }
}
