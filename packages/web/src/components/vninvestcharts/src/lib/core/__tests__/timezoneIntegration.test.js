import { describe, it, expect, beforeEach } from "vitest";
import { setGlobalTimezone } from "../../utils/timezoneFormatter";
import { createKlineXAxisFormatter, createSmartDateFormatter } from "../DynamicChart";
// Helper tạo dữ liệu nến giả lập với khoảng cách 1 giờ (Intraday)
function makeIntradayData() {
    const baseTime = 1716613200000; // 2024-05-25T05:00:00Z (12:00:00 Việt Nam)
    const data = [];
    for (let i = 0; i < 5; i++) {
        data.push({
            date: new Date(baseTime + i * 3600 * 1000), // Cách nhau 1 giờ
            open: 100 + i,
            high: 105 + i,
            low: 95 + i,
            close: 102 + i,
            volume: 1000,
            indicatorValues: {}
        });
    }
    return data;
}
describe("Core Chart Timezone Integration Tests", () => {
    beforeEach(() => {
        // Trả về múi giờ mặc định trước mỗi bài test
        setGlobalTimezone("Asia/Ho_Chi_Minh");
    });
    describe("TC-AUT-04: X-Axis Adaptive Formatter Timezone Sync", () => {
        it("should dynamically translate X-axis ticks to local Ho_Chi_Minh time", () => {
            setGlobalTimezone("Asia/Ho_Chi_Minh");
            const data = makeIntradayData();
            const formatter = createKlineXAxisFormatter(data);
            const firstTick = data[0].date; // 05:00:00 UTC -> 12:00:00 VN
            const formatted = formatter(firstTick);
            // Kỳ vọng nhãn là "12:00" theo múi giờ Việt Nam
            expect(formatted).toBe("12:00");
        });
        it("should dynamically translate X-axis ticks to UTC time when global timezone changes", () => {
            setGlobalTimezone("UTC");
            const data = makeIntradayData();
            const formatter = createKlineXAxisFormatter(data);
            const firstTick = data[0].date; // 05:00:00 UTC
            const formatted = formatter(firstTick);
            // Kỳ vọng nhãn là "05:00" theo múi giờ UTC
            expect(formatted).toBe("05:00");
        });
        it("should dynamically translate X-axis ticks to New York time", () => {
            setGlobalTimezone("America/New_York");
            const data = makeIntradayData();
            const formatter = createKlineXAxisFormatter(data);
            const firstTick = data[0].date; // 05:00:00 UTC -> 01:00:00 NY
            const formatted = formatter(firstTick);
            expect(formatted).toBe("01:00");
        });
    });
    describe("TC-AUT-05: Tooltip/Legend Dynamic Localizer Timezone Sync", () => {
        const fallbackDateFormat = (d) => d.toISOString();
        it("should format tooltip dates respecting the global Ho_Chi_Minh timezone", () => {
            setGlobalTimezone("Asia/Ho_Chi_Minh");
            const data = makeIntradayData();
            const tooltipFormatter = createSmartDateFormatter(data, fallbackDateFormat);
            const firstTick = data[0].date;
            const formatted = tooltipFormatter(firstTick);
            // Intraday với ít hơn 50 bars (data.length = 5) trả về HH:MM:SS
            // 05:00:00 UTC -> 12:00:00 VN
            expect(formatted).toBe("12:00:00");
        });
        it("should format tooltip dates respecting the global UTC timezone", () => {
            setGlobalTimezone("UTC");
            const data = makeIntradayData();
            const tooltipFormatter = createSmartDateFormatter(data, fallbackDateFormat);
            const firstTick = data[0].date;
            const formatted = tooltipFormatter(firstTick);
            // 05:00:00 UTC -> 05:00:00 UTC
            expect(formatted).toBe("05:00:00");
        });
        it("should format tooltip dates respecting the global New York timezone", () => {
            setGlobalTimezone("America/New_York");
            const data = makeIntradayData();
            const tooltipFormatter = createSmartDateFormatter(data, fallbackDateFormat);
            const firstTick = data[0].date;
            const formatted = tooltipFormatter(firstTick);
            // 05:00:00 UTC -> 01:00:00 NY
            expect(formatted).toBe("01:00:00");
        });
    });
});
