import { describe, expect, it } from "vitest";
import { createDateTimeIndexMap } from "./timeIndexMap";
const data = [
    { date: new Date("2025-01-01T00:00:00.000Z") },
    { date: new Date("2025-01-01T00:01:00.000Z") },
    { date: new Date("2025-01-01T00:02:00.000Z") },
];
describe("timeIndexMap", () => {
    it("interpolates index inside known timestamps", () => {
        const map = createDateTimeIndexMap(data);
        const midTime = new Date("2025-01-01T00:00:30.000Z").getTime();
        expect(map.resolveIndexByTime(midTime)).toBeCloseTo(0.5, 6);
    });
    it("extrapolates index outside known timestamps", () => {
        const map = createDateTimeIndexMap(data);
        const beforeFirst = new Date("2024-12-31T23:59:30.000Z").getTime();
        const afterLast = new Date("2025-01-01T00:02:30.000Z").getTime();
        expect(map.resolveIndexByTime(beforeFirst)).toBeCloseTo(-0.5, 6);
        expect(map.resolveIndexByTime(afterLast)).toBeCloseTo(2.5, 6);
    });
    it("resolves time from fractional indexes", () => {
        const map = createDateTimeIndexMap(data);
        const resolved = map.resolveTimeByIndex(1.5);
        expect(resolved).not.toBeNull();
        expect(new Date(resolved).toISOString()).toBe("2025-01-01T00:01:30.000Z");
    });
});
