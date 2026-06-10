import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { applyDrawingTemplate, applyDrawingTemplateToDrawing, clearDrawingTemplate, loadDrawingTemplate, loadDrawingTemplateData, saveDrawingTemplate, validateDrawingStyleTemplate, } from "./drawingStyleRegistry";
// ─── DT-5 tests ───────────────────────────────────────────────────────────────
describe("validateDrawingStyleTemplate", () => {
    it("DT5-01: accepts valid DrawingStyle fields", () => {
        const result = validateDrawingStyleTemplate({
            stroke: "#ff0000",
            strokeWidth: 2,
            opacity: 0.8,
            strokeDasharray: "dashed",
        });
        expect(result).toEqual({ stroke: "#ff0000", strokeWidth: 2, opacity: 0.8, strokeDasharray: "dashed" });
    });
    it("DT5-02: rejects non-hex stroke (XSS prevention)", () => {
        const result = validateDrawingStyleTemplate({ stroke: "red; background: url(evil)" });
        expect(result).toBeNull();
    });
    it("DT5-03: rejects strokeWidth out of range", () => {
        const result = validateDrawingStyleTemplate({ strokeWidth: 999 });
        expect(result).toBeNull();
    });
    it("DT5-04: rejects negative strokeWidth", () => {
        const result = validateDrawingStyleTemplate({ strokeWidth: -1 });
        expect(result).toBeNull();
    });
    it("DT5-05: rejects opacity > 1", () => {
        const result = validateDrawingStyleTemplate({ opacity: 1.5 });
        expect(result).toBeNull();
    });
    it("DT5-06: rejects null", () => {
        expect(validateDrawingStyleTemplate(null)).toBeNull();
    });
    it("DT5-07: rejects array", () => {
        expect(validateDrawingStyleTemplate(["#ff0000"])).toBeNull();
    });
    it("DT5-08: returns null for empty object (no recognized fields)", () => {
        expect(validateDrawingStyleTemplate({ unknown: "value" })).toBeNull();
    });
    it("DT5-09: accepts valid 3-char hex colour", () => {
        const result = validateDrawingStyleTemplate({ stroke: "#f00" });
        expect(result).toEqual({ stroke: "#f00" });
    });
});
describe("saveDrawingTemplate + loadDrawingTemplate round-trip", () => {
    // Mock localStorage
    const localStorageMock = (() => {
        let store = {};
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, value) => { store[key] = value; },
            removeItem: (key) => { delete store[key]; },
            clear: () => { store = {}; },
        };
    })();
    beforeAll(() => {
        vi.stubGlobal("localStorage", localStorageMock);
    });
    afterEach(() => {
        localStorageMock.clear();
    });
    it("DT5-10: save + load round-trip returns same data", () => {
        const style = { stroke: "#123456", strokeWidth: 2, opacity: 1 };
        const saved = saveDrawingTemplate("trendLine", style);
        expect(saved).toBe(true);
        const loaded = loadDrawingTemplate("trendLine");
        expect(loaded).toEqual({ stroke: "#123456", strokeWidth: 2, opacity: 1 });
    });
    it("DT5-11: save returns false for invalid style", () => {
        const result = saveDrawingTemplate("trendLine", { stroke: "javascript:alert(1)" });
        expect(result).toBe(false);
    });
    it("DT5-12: loadDrawingTemplate returns null when no template saved", () => {
        const result = loadDrawingTemplate("fibonacci");
        expect(result).toBeNull();
    });
    it("DT5-13: clearDrawingTemplate removes the saved entry", () => {
        saveDrawingTemplate("ray", { stroke: "#abcdef", strokeWidth: 1, opacity: 1 });
        clearDrawingTemplate("ray");
        expect(loadDrawingTemplate("ray")).toBeNull();
    });
    it("DT5-14: corrupted localStorage data is discarded", () => {
        localStorageMock.setItem("rsc-drawing-template-rectangle", "not json{{{{");
        const result = loadDrawingTemplate("rectangle");
        expect(result).toBeNull();
    });
    it("DT5-15: applyDrawingTemplate merges template onto baseStyle", () => {
        saveDrawingTemplate("hLine", { stroke: "#ff0000", strokeWidth: 3, opacity: 1 });
        const base = { stroke: "#000000", strokeWidth: 1, opacity: 1 };
        const result = applyDrawingTemplate("hLine", base);
        expect(result.stroke).toBe("#ff0000");
        expect(result.strokeWidth).toBe(3);
    });
    it("DT5-16: applyDrawingTemplate returns baseStyle unchanged when no template", () => {
        const base = { stroke: "#000000", strokeWidth: 1, opacity: 1 };
        const result = applyDrawingTemplate("polyline", base);
        expect(result).toEqual(base);
    });
    it("DT5-17: default template persists segment styles and visibility", () => {
        saveDrawingTemplate("pitchfork", { stroke: "#ff0000" }, {
            segmentStyles: { median: { stroke: "#00ff00" } },
            segmentVisible: { leftFork: false },
        });
        const loaded = loadDrawingTemplateData("pitchfork");
        expect(loaded).toEqual({
            style: { stroke: "#ff0000" },
            segmentStyles: { median: { stroke: "#00ff00" } },
            segmentVisible: { leftFork: false },
        });
        const draft = createDrawingObject("pitchfork", [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], {
            segmentStyles: { rightFork: { stroke: "#123456" } },
            segmentVisible: { rightFork: true },
        });
        const applied = applyDrawingTemplateToDrawing("pitchfork", draft);
        expect(applied.style.stroke).toBe("#ff0000");
        expect(applied.segmentStyles).toEqual({
            rightFork: { stroke: "#123456" },
            median: { stroke: "#00ff00" },
        });
        expect(applied.segmentVisible).toEqual({
            rightFork: true,
            leftFork: false,
        });
    });
});
import { listTemplates, saveTemplate, deleteTemplate, loadTemplate, loadTemplateData, exportAllTemplates, importAllTemplates } from "./drawingTemplateStorage";
describe("drawingTemplateStorage — Named Templates CRUD", () => {
    const localStorageMock = (() => {
        let store = {};
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, value) => { store[key] = value; },
            removeItem: (key) => { delete store[key]; },
            clear: () => { store = {}; },
            length: 0,
            key: (index) => Object.keys(store)[index] ?? null,
        };
    })();
    beforeAll(() => {
        vi.stubGlobal("localStorage", localStorageMock);
    });
    afterEach(() => {
        localStorageMock.clear();
    });
    it("saves and lists multiple templates per tool type", () => {
        expect(listTemplates("trendLine")).toEqual([]);
        saveTemplate("trendLine", "Classic Blue", { stroke: "#0000ff", strokeWidth: 2 });
        saveTemplate("trendLine", "Danger Red", { stroke: "#ff0000", strokeWidth: 4 });
        expect(listTemplates("trendLine")).toEqual(["Classic Blue", "Danger Red"]);
    });
    it("loads correct style for named template", () => {
        saveTemplate("rectangle", "Gold Zone", { stroke: "#ffd700", opacity: 0.5 });
        const loaded = loadTemplate("rectangle", "Gold Zone");
        expect(loaded).toEqual({ stroke: "#ffd700", opacity: 0.5 });
    });
    it("loads segment style and visibility payload for named template", () => {
        saveTemplate("pitchfork", "Fork Style", { stroke: "#ffd700" }, {
            segmentStyles: { median: { stroke: "#00ff00" } },
            segmentVisible: { leftFork: false },
        });
        const loaded = loadTemplateData("pitchfork", "Fork Style");
        expect(loaded).toEqual({
            style: { stroke: "#ffd700" },
            segmentStyles: { median: { stroke: "#00ff00" } },
            segmentVisible: { leftFork: false },
        });
    });
    it("deletes template and removes from index", () => {
        saveTemplate("text", "Disclaimer", { stroke: "#aaaaaa" });
        saveTemplate("text", "Header", { stroke: "#ffffff" });
        expect(listTemplates("text")).toEqual(["Disclaimer", "Header"]);
        deleteTemplate("text", "Disclaimer");
        expect(listTemplates("text")).toEqual(["Header"]);
        expect(loadTemplate("text", "Disclaimer")).toBeNull();
    });
    it("exportAllTemplates includes all saved templates", () => {
        saveTemplate("trendLine", "T1", { stroke: "#111111" });
        saveTemplate("rectangle", "R1", { stroke: "#222222" });
        // Setup mock length/key manually to match localStorage mock
        const storeKeys = ["rsc-drawing-template-trendLine-T1", "rsc-drawing-template-rectangle-R1"];
        vi.spyOn(localStorageMock, "length", "get").mockReturnValue(2);
        vi.spyOn(localStorageMock, "key").mockImplementation((index) => storeKeys[index] ?? null);
        const exported = exportAllTemplates();
        expect(exported["rsc-drawing-template-trendLine-T1"]).toEqual({ stroke: "#111111" });
        expect(exported["rsc-drawing-template-rectangle-R1"]).toEqual({ stroke: "#222222" });
    });
    it("importAllTemplates overwrites and can be listed", () => {
        const data = {
            "rsc-drawing-template-arrow-Boom": { stroke: "#00ff00", strokeWidth: 5 },
        };
        importAllTemplates(data);
        expect(listTemplates("arrow")).toEqual(["Boom"]);
        expect(loadTemplate("arrow", "Boom")).toEqual({ stroke: "#00ff00", strokeWidth: 5 });
    });
});
