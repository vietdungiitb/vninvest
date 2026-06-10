import { describe, it, expect, beforeEach } from "vitest";
import { setGlobalTimezone, getGlobalTimezone, formatWithTimezone } from "../timezoneFormatter";
describe("timezoneFormatter helper tests", () => {
    beforeEach(() => {
        // Reset múi giờ mặc định trước mỗi bài test
        setGlobalTimezone("Asia/Ho_Chi_Minh");
    });
    describe("TC-AUT-01: Timezone Translation math", () => {
        // Epoch: 1716613200000 = 2024-05-25T05:00:00Z
        const testEpoch = 1716613200000;
        it("should format Vietnam Time (UTC+7) correctly", () => {
            setGlobalTimezone("Asia/Ho_Chi_Minh");
            expect(getGlobalTimezone()).toBe("Asia/Ho_Chi_Minh");
            const formatted = formatWithTimezone(testEpoch, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour12: false
            });
            // "25/05/2024, 12:00:00" hoặc định dạng vi-VN tương ứng
            expect(formatted).toContain("25");
            expect(formatted).toContain("05");
            expect(formatted).toContain("2024");
            expect(formatted).toContain("12:00:00");
        });
        it("should format New York Time (UTC-4 DST) correctly", () => {
            setGlobalTimezone("America/New_York");
            expect(getGlobalTimezone()).toBe("America/New_York");
            const formatted = formatWithTimezone(testEpoch, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour12: false
            });
            // 05:00:00 UTC - 4 tiếng = 01:00:00 ngày 25/05/2024
            expect(formatted).toContain("25");
            expect(formatted).toContain("05");
            expect(formatted).toContain("2024");
            expect(formatted).toContain("01:00:00");
        });
        it("should format UTC Time (UTC+0) correctly", () => {
            setGlobalTimezone("UTC");
            expect(getGlobalTimezone()).toBe("UTC");
            const formatted = formatWithTimezone(testEpoch, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour12: false
            });
            expect(formatted).toContain("25");
            expect(formatted).toContain("05");
            expect(formatted).toContain("2024");
            expect(formatted).toContain("05:00:00");
        });
    });
    describe("TC-AUT-02: Formatter Caching efficiency", () => {
        it("should handle 1000 format calls with high performance and no exceptions", () => {
            const testEpoch = 1716613200000;
            const startTime = performance.now();
            for (let i = 0; i < 1000; i++) {
                const formatted = formatWithTimezone(testEpoch, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                });
                expect(formatted).toContain("12:00");
            }
            const endTime = performance.now();
            const elapsed = endTime - startTime;
            // Caching giúp chạy 1000 lần rất nhanh (thông thường dưới 50ms)
            expect(elapsed).toBeLessThan(100);
        });
    });
    describe("TC-AUT-03: Fallback Protection on invalid inputs", () => {
        it("should fallback to UTC instead of throwing if timezone is invalid", () => {
            const testEpoch = 1716613200000;
            // Ép kiểu bypass TypeScript để test trường hợp bị truyền tham số sai từ JS/runtime
            setGlobalTimezone("Invalid/Timezone");
            const formatted = formatWithTimezone(testEpoch, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            });
            // Múi giờ không hợp lệ -> Fallback sang UTC -> Giờ hiển thị phải là 05:00:00
            expect(formatted).toContain("05:00:00");
        });
    });
});
