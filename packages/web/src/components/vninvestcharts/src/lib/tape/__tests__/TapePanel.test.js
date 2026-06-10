import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
/**
 * O-T01 → O-T06: TapePanel unit tests.
 *
 * Pattern: manual createRoot + act (no @testing-library/react).
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TapePanel } from "../TapePanel";
// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEntry(overrides = {}) {
    return {
        id: `e-${Math.random()}`,
        ts: "2025-01-01T09:30:00Z",
        price: 45_000,
        volume: 1_000,
        value: 45_000_000,
        side: "buy",
        is_whale: false,
        ...overrides,
    };
}
let container;
let root;
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
});
function render(props) {
    act(() => { root.render(_jsx(TapePanel, { ...props })); });
}
// ── Tests ─────────────────────────────────────────────────────────────────────
describe("TapePanel", () => {
    it("O-T01: renders the panel when show=true", () => {
        render({ show: true, entries: [], isLoading: false, filterBillions: 0 });
        const panel = container.querySelector("[data-testid='tape-panel']");
        expect(panel).not.toBeNull();
    });
    it("O-T02: whale row has distinct background highlight", () => {
        const whale = makeEntry({ is_whale: true, value: 5_000_000_000 });
        render({ show: true, entries: [whale], isLoading: false, filterBillions: 0 });
        const row = container.querySelector("[data-testid='tape-row']");
        expect(row).not.toBeNull();
        // Whale rows get a dark yellow tint background
        expect(row.style.background).not.toBe("transparent");
        expect(row.style.background).not.toBe("");
    });
    it("O-T03: buy side badge has green background", () => {
        const entry = makeEntry({ side: "buy" });
        render({ show: true, entries: [entry], isLoading: false, filterBillions: 0 });
        const badge = container.querySelector("[data-side='buy']");
        expect(badge).not.toBeNull();
        const bg = badge.style.background;
        // Green (#0d6b2e or rgb(13, 107, 46))
        expect(bg === "#0d6b2e" || bg === "rgb(13, 107, 46)").toBe(true);
    });
    it("O-T04: sell side badge has red background", () => {
        const entry = makeEntry({ side: "sell" });
        render({ show: true, entries: [entry], isLoading: false, filterBillions: 0 });
        const badge = container.querySelector("[data-side='sell']");
        expect(badge).not.toBeNull();
        const bg = badge.style.background;
        // Red (#c0392b or rgb(192, 57, 43))
        expect(bg === "#c0392b" || bg === "rgb(192, 57, 43)").toBe(true);
    });
    it("O-T05: shows loading state and no rows when isLoading=true and entries=[]", () => {
        render({ show: true, entries: [], isLoading: true, filterBillions: 0 });
        const loading = container.querySelector("[data-testid='tape-loading']");
        expect(loading).not.toBeNull();
        const rows = container.querySelectorAll("[data-testid='tape-row']");
        expect(rows.length).toBe(0);
    });
    it("O-T06: shows empty state when entries=[] and isLoading=false", () => {
        render({ show: true, entries: [], isLoading: false, filterBillions: 0 });
        const empty = container.querySelector("[data-testid='tape-empty']");
        expect(empty).not.toBeNull();
        const rows = container.querySelectorAll("[data-testid='tape-row']");
        expect(rows.length).toBe(0);
    });
});
