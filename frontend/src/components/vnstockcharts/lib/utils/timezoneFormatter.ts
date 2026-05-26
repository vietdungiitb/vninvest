export type WidgetTimezone =
    | "Asia/Ho_Chi_Minh"
    | "UTC"
    | "America/New_York"
    | "Europe/London";

let globalTimezone: WidgetTimezone = "Asia/Ho_Chi_Minh";

// Memory-friendly Formatter Cache Map
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function setGlobalTimezone(tz: WidgetTimezone): void {
    if (globalTimezone === tz) {
        return;
    }
    globalTimezone = tz;
    formatterCache.clear();
}

export function getGlobalTimezone(): WidgetTimezone {
    return globalTimezone;
}

export function getCachedFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const cacheKey = JSON.stringify({ locale, options });
    if (!formatterCache.has(cacheKey)) {
        formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
    }
    return formatterCache.get(cacheKey)!;
}

/**
 * Định dạng mốc thời gian tuân thủ múi giờ SSOT toàn cục.
 * Hỗ trợ cache formatter để tối ưu hóa hiệu năng render 60 FPS.
 */
export function formatWithTimezone(
    date: Date | number,
    options: Intl.DateTimeFormatOptions = {}
): string {
    const d = typeof date === "number" ? new Date(date) : date;
    const tz = getGlobalTimezone();
    
    const extendedOptions: Intl.DateTimeFormatOptions = {
        ...options,
        timeZone: tz
    };

    try {
        const formatter = getCachedFormatter("vi-VN", extendedOptions);
        return formatter.format(d);
    } catch (e) {
        // Fallback an toàn: ép về UTC + en-US để tránh throw lặp lại.
        const fallbackOptions: Intl.DateTimeFormatOptions = {
            ...extendedOptions,
            timeZone: "UTC"
        };
        const formatter = getCachedFormatter("en-US", fallbackOptions);
        return formatter.format(d);
    }
}
