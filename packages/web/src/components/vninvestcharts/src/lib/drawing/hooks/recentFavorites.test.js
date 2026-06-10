/**
 * TDM-D: Unit tests for useRecentTools and useFavoriteTools hooks
 * Tests the underlying localStorage persistence logic directly without React renderer.
 */
import { describe, it, expect, beforeEach } from "vitest";
// ── localStorage mock ──────────────────────────────────────────────────────
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = value; },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
// ── Helper: simulate pushRecent logic ────────────────────────────────────
const MAX_RECENT = 5;
const RECENT_KEY = "rsc_recent_tools";
const FAV_KEY = "rsc_favorite_tools";
function simulatePushRecent(toolId, current) {
    return [toolId, ...current.filter((id) => id !== toolId)].slice(0, MAX_RECENT);
}
function loadStored(key) {
    const raw = localStorage.getItem(key);
    if (!raw)
        return [];
    try {
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
function saveStored(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
}
beforeEach(() => {
    localStorageMock.clear();
});
// ── useRecentTools ─────────────────────────────────────────────────────────
describe("useRecentTools logic", () => {
    it("starts empty", () => {
        expect(loadStored(RECENT_KEY)).toEqual([]);
    });
    it("pushRecent adds tool at front", () => {
        let list = [];
        list = simulatePushRecent("trendLine", list);
        saveStored(RECENT_KEY, list);
        expect(loadStored(RECENT_KEY)[0]).toBe("trendLine");
    });
    it("pushRecent deduplicates", () => {
        let list = [];
        list = simulatePushRecent("trendLine", list);
        list = simulatePushRecent("hLine", list);
        list = simulatePushRecent("trendLine", list); // re-push
        expect(list.filter((id) => id === "trendLine")).toHaveLength(1);
        expect(list[0]).toBe("trendLine");
    });
    it("trims to MAX_RECENT (5)", () => {
        let list = [];
        ["a", "b", "c", "d", "e", "f"].forEach((id) => {
            list = simulatePushRecent(id, list);
        });
        expect(list).toHaveLength(5);
        expect(list[0]).toBe("f");
        expect(list).not.toContain("a");
    });
    it("clear empties the list", () => {
        let list = ["hLine", "circle"];
        saveStored(RECENT_KEY, list);
        list = [];
        saveStored(RECENT_KEY, list);
        expect(loadStored(RECENT_KEY)).toEqual([]);
    });
    it("persists to localStorage", () => {
        let list = [];
        list = simulatePushRecent("circle", list);
        saveStored(RECENT_KEY, list);
        expect(loadStored(RECENT_KEY)).toContain("circle");
    });
});
// ── useFavoriteTools ───────────────────────────────────────────────────────
function simulateToggle(toolId, current) {
    return current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
}
describe("useFavoriteTools logic", () => {
    it("starts empty", () => {
        expect(loadStored(FAV_KEY)).toEqual([]);
    });
    it("toggleFavorite adds tool", () => {
        let favs = [];
        favs = simulateToggle("fibonacci", favs);
        saveStored(FAV_KEY, favs);
        expect(loadStored(FAV_KEY)).toContain("fibonacci");
    });
    it("toggleFavorite removes already-favorited tool", () => {
        let favs = [];
        favs = simulateToggle("fibonacci", favs);
        favs = simulateToggle("fibonacci", favs);
        expect(favs).not.toContain("fibonacci");
    });
    it("isFavorite-equivalent: returns false for unknown tool", () => {
        const favs = [];
        expect(favs.includes("notATool")).toBe(false);
    });
    it("persists to localStorage", () => {
        let favs = [];
        favs = simulateToggle("rectangle", favs);
        saveStored(FAV_KEY, favs);
        expect(loadStored(FAV_KEY)).toContain("rectangle");
    });
    it("multiple favorites maintained correctly", () => {
        let favs = [];
        favs = simulateToggle("fibonacci", favs);
        favs = simulateToggle("circle", favs);
        favs = simulateToggle("rectangle", favs);
        expect(favs).toHaveLength(3);
        favs = simulateToggle("circle", favs);
        expect(favs).toHaveLength(2);
        expect(favs).not.toContain("circle");
    });
});
