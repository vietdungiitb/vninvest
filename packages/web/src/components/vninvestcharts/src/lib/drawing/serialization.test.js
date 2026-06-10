import { describe, expect, it } from "vitest";
import { exportDrawingsJSON, importDrawingsJSON, DRAWING_SCHEMA_VERSION } from "./serialization";
describe("serialization — Schema Versioning & Migration", () => {
    const mockDrawing = {
        id: "test-line",
        type: "trendLine",
        points: [
            { x: 1000, y: 50 },
            { x: 2000, y: 100 },
        ],
        style: {
            stroke: "#ff0000",
            strokeWidth: 2,
        },
        createdAt: 123456789,
        updatedAt: 123456789,
    };
    it("round-trips with schema wrapper (schemaVersion=1)", () => {
        const json = exportDrawingsJSON([mockDrawing]);
        const parsed = JSON.parse(json);
        expect(parsed.schemaVersion).toBe(DRAWING_SCHEMA_VERSION);
        expect(parsed.drawings).toBeDefined();
        expect(parsed.drawings).toHaveLength(1);
        const imported = importDrawingsJSON(json);
        expect(imported).toHaveLength(1);
        expect(imported[0].id).toBe("test-line");
        expect(imported[0].type).toBe("trendLine");
    });
    it("imports legacy flat array without error (v0 flat array)", () => {
        const legacy = JSON.stringify([mockDrawing]);
        const imported = importDrawingsJSON(legacy);
        expect(imported).toHaveLength(1);
        expect(imported[0].id).toBe("test-line");
    });
    it("migrates fibLevels to fibLevelConfigs on legacy payload", () => {
        const legacyDrawing = {
            id: "legacy-fib",
            type: "fibonacci",
            points: [
                { x: 1000, y: 100 },
                { x: 2000, y: 200 },
            ],
            style: {
                stroke: "#0000ff",
                strokeWidth: 1,
            },
            fibLevels: [0, 0.382, 0.618, 1],
        };
        const legacyPayload = JSON.stringify({
            schemaVersion: 0,
            drawings: [legacyDrawing],
        });
        const imported = importDrawingsJSON(legacyPayload);
        expect(imported).toHaveLength(1);
        expect(imported[0].fibLevelConfigs).toBeDefined();
        expect(imported[0].fibLevelConfigs).toHaveLength(4);
        expect(imported[0].fibLevelConfigs[1].ratio).toBe(0.382);
        expect(imported[0].fibLevelConfigs[1].visible).toBe(true);
    });
});
