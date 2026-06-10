import { describe, it, expect, beforeEach } from "vitest";
import { createHistoryChunkStore, } from "./chunkStore";
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeBar(minuteOffset, extra) {
    return {
        date: new Date(2024, 0, 1, 0, minuteOffset, 0, 0),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
        index: minuteOffset,
        dataIndex: minuteOffset,
        ...extra,
    };
}
function makeBars(count, startMinute = 0) {
    return Array.from({ length: count }, (_, i) => makeBar(startMinute + i));
}
function tsOf(bar) {
    return bar.date.getTime();
}
// ---------------------------------------------------------------------------
// Mandatory spec test cases (from IMPLEMENTATION_PLAN.md)
// ---------------------------------------------------------------------------
describe("HistoryChunkStore — mandatory spec cases", () => {
    let store;
    beforeEach(() => {
        store = createHistoryChunkStore();
    });
    // -----------------------------------------------------------------------
    // Test case 1: Prepend page cũ hơn không làm logical anchor của viewport nhảy
    // -----------------------------------------------------------------------
    it("prepend of older bars does not alter existing bar timestamps (logical anchor stability)", () => {
        // Seed the store with bars 60–69 (minute offsets)
        const initialBars = makeBars(10, 60);
        store.replaceAll(initialBars);
        const snapshotBefore = store.toSnapshot();
        const anchorTimestamps = snapshotBefore.bars.map(tsOf);
        // Prepend 20 older bars (minute offsets 40–59)
        const olderBars = makeBars(20, 40);
        const patch = store.prepend(olderBars);
        // The 10 existing bars must still be present with unchanged timestamps.
        const snapshotAfter = patch.snapshot;
        const existingInAfter = snapshotAfter.bars.filter((b) => anchorTimestamps.includes(tsOf(b)));
        expect(existingInAfter).toHaveLength(10);
        existingInAfter.forEach((bar, i) => {
            expect(tsOf(bar)).toBe(anchorTimestamps[i]);
        });
        // New bars should be at the head.
        expect(patch.prependedCount).toBe(20);
        expect(snapshotAfter.bars).toHaveLength(30);
        // Result must be chronologically sorted.
        for (let i = 1; i < snapshotAfter.bars.length; i++) {
            expect(tsOf(snapshotAfter.bars[i])).toBeGreaterThan(tsOf(snapshotAfter.bars[i - 1]));
        }
    });
    // -----------------------------------------------------------------------
    // Test case 2: Append live bars chỉ chạm tail chunk
    // -----------------------------------------------------------------------
    it("append of a single live bar only extends the tail, leaving head bars unchanged", () => {
        const initialBars = makeBars(10, 0); // bars 0–9
        store.replaceAll(initialBars);
        const headBar = store.toSnapshot().bars[0];
        // Append one new bar at the tail (minute 10)
        const liveBar = makeBar(10, { close: 999 });
        const patch = store.append([liveBar]);
        expect(patch.appendedCount).toBe(1);
        expect(patch.snapshot.bars).toHaveLength(11);
        // Head bar must be untouched.
        expect(patch.snapshot.bars[0]).toBe(headBar);
        // Tail bar is the new one.
        expect(patch.snapshot.bars[10].close).toBe(999);
        // Sorted order maintained.
        const newBars = patch.snapshot.bars;
        for (let i = 1; i < newBars.length; i++) {
            expect(tsOf(newBars[i])).toBeGreaterThan(tsOf(newBars[i - 1]));
        }
    });
    it("append of a live tick (same timestamp as tail) updates the tail bar in-place", () => {
        const initialBars = makeBars(5, 0);
        store.replaceAll(initialBars);
        const updatedTail = makeBar(4, { close: 555, volume: 9999 });
        const patch = store.append([updatedTail]);
        expect(patch.appendedCount).toBe(1);
        expect(patch.snapshot.bars).toHaveLength(5); // count unchanged
        expect(patch.snapshot.bars[4].close).toBe(555);
        expect(patch.snapshot.bars[4].volume).toBe(9999);
        // Earlier bars untouched.
        for (let i = 0; i < 4; i++) {
            expect(tsOf(patch.snapshot.bars[i])).toBe(tsOf(initialBars[i]));
        }
    });
    // -----------------------------------------------------------------------
    // Test case 3: Trim ngoài resident window không làm mất order hoặc tạo duplicate
    // -----------------------------------------------------------------------
    it("trimToWindow removes out-of-window bars without losing order or creating duplicates", () => {
        // 30 bars at minutes 0–29
        const initialBars = makeBars(30, 0);
        store.replaceAll(initialBars);
        // Keep only bars 10–19 (minute offsets 10 to 19 inclusive)
        const window = {
            startMs: makeBar(10).date.getTime(),
            endMs: makeBar(19).date.getTime(),
        };
        const patch = store.trimToWindow(window);
        expect(patch).not.toBeNull();
        expect(patch.trimmedFromHead).toBe(10); // bars 0–9 removed
        expect(patch.trimmedFromTail).toBe(10); // bars 20–29 removed
        expect(patch.snapshot.bars).toHaveLength(10);
        // Verify chronological order and no duplicates.
        const result = patch.snapshot.bars;
        const seen = new Set();
        for (let i = 0; i < result.length; i++) {
            const ts = tsOf(result[i]);
            expect(seen.has(ts)).toBe(false);
            seen.add(ts);
            if (i > 0) {
                expect(ts).toBeGreaterThan(tsOf(result[i - 1]));
            }
        }
        // First and last bars should be exactly minutes 10 and 19.
        expect(result[0].date.getTime()).toBe(makeBar(10).date.getTime());
        expect(result[result.length - 1].date.getTime()).toBe(makeBar(19).date.getTime());
    });
    it("trimToWindow returns null when all bars are already within the window", () => {
        store.replaceAll(makeBars(5, 10));
        const window = {
            startMs: makeBar(5).date.getTime(),
            endMs: makeBar(20).date.getTime(),
        };
        const patch = store.trimToWindow(window);
        expect(patch).toBeNull();
    });
});
// ---------------------------------------------------------------------------
// Additional coverage
// ---------------------------------------------------------------------------
describe("HistoryChunkStore — additional behavior", () => {
    let store;
    beforeEach(() => {
        store = createHistoryChunkStore();
    });
    it("replaceAll on empty input produces an empty snapshot", () => {
        store.replaceAll(makeBars(5, 0));
        const snap = store.replaceAll([]);
        expect(snap.bars).toHaveLength(0);
        expect(snap.revision).toBeGreaterThan(0);
    });
    it("replaceAll sorts bars by date regardless of input order", () => {
        const unsorted = [makeBar(5), makeBar(2), makeBar(8), makeBar(1)];
        const snap = store.replaceAll(unsorted);
        const timestamps = snap.bars.map(tsOf);
        expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    });
    it("replaceAll deduplicates bars with identical timestamps (last occurrence wins)", () => {
        const bars = [makeBar(0, { close: 10 }), makeBar(0, { close: 20 })];
        const snap = store.replaceAll(bars);
        expect(snap.bars).toHaveLength(1);
        expect(snap.bars[0].close).toBe(20); // second entry wins after sort
    });
    it("prepend ignores bars that are >= current head timestamp", () => {
        store.replaceAll(makeBars(3, 10)); // bars 10, 11, 12
        const overlappingBars = [makeBar(10), makeBar(11), makeBar(5)]; // 10 and 11 overlap
        const patch = store.prepend(overlappingBars);
        // Only bar 5 should be prepended
        expect(patch.prependedCount).toBe(1);
        expect(patch.snapshot.bars).toHaveLength(4);
        expect(patch.snapshot.bars[0].date.getTime()).toBe(makeBar(5).date.getTime());
    });
    it("prepend on empty store appends bars as initial set", () => {
        const bars = makeBars(5, 100);
        const patch = store.prepend(bars);
        expect(patch.prependedCount).toBe(5);
        expect(patch.snapshot.bars).toHaveLength(5);
    });
    it("append bulk page only keeps bars newer than tail", () => {
        store.replaceAll(makeBars(5, 0)); // bars 0–4
        const mixed = [makeBar(3), makeBar(4), makeBar(5), makeBar(6)]; // 3,4 already exist
        const patch = store.append(mixed);
        expect(patch.appendedCount).toBe(2); // only 5 and 6 added
        expect(patch.snapshot.bars).toHaveLength(7);
    });
    it("append older bar not at tail updates the bar in-place", () => {
        store.replaceAll(makeBars(5, 0)); // bars 0–4
        const updatedBar = makeBar(2, { close: 777 });
        const patch = store.append([updatedBar]);
        expect(patch.appendedCount).toBe(1);
        expect(patch.snapshot.bars).toHaveLength(5); // no new bar added
        expect(patch.snapshot.bars[2].close).toBe(777);
    });
    it("revision increments on each mutation", () => {
        const r0 = store.toSnapshot().revision;
        store.replaceAll(makeBars(3, 0));
        const r1 = store.toSnapshot().revision;
        store.prepend(makeBars(2, -5));
        const r2 = store.toSnapshot().revision;
        store.append([makeBar(10)]);
        const r3 = store.toSnapshot().revision;
        store.trimToWindow({ startMs: makeBar(-5).date.getTime(), endMs: makeBar(5).date.getTime() });
        const r4 = store.toSnapshot().revision;
        expect(r1).toBeGreaterThan(r0);
        expect(r2).toBeGreaterThan(r1);
        expect(r3).toBeGreaterThan(r2);
        expect(r4).toBeGreaterThan(r3);
    });
    it("revision does not increment when prepend/append/trim is a no-op", () => {
        store.replaceAll(makeBars(5, 10));
        const r0 = store.toSnapshot().revision;
        // prepend bars >= head → no-op
        store.prepend([makeBar(10)]);
        expect(store.toSnapshot().revision).toBe(r0);
        // append bars <= tail → no-op (bulk path with all bars older than tail)
        // bar at minute 3 is older than tail (14)
        const patch = store.append(makeBars(2, 3));
        expect(patch.appendedCount).toBe(0);
        expect(store.toSnapshot().revision).toBe(r0);
        // trimToWindow with all bars inside → no-op (returns null)
        const result = store.trimToWindow({
            startMs: makeBar(0).date.getTime(),
            endMs: makeBar(100).date.getTime(),
        });
        expect(result).toBeNull();
        expect(store.toSnapshot().revision).toBe(r0);
    });
    it("toSnapshot returns a consistent snapshot that does not change after mutations", () => {
        store.replaceAll(makeBars(3, 0));
        const snap1 = store.toSnapshot();
        const barsBefore = snap1.bars;
        store.append([makeBar(10)]);
        // The snapshot taken before should still reflect old state
        expect(barsBefore).toHaveLength(3);
        // The current snapshot should reflect new state
        expect(store.toSnapshot().bars).toHaveLength(4);
    });
    it("handles prepend on empty store correctly", () => {
        const patch = store.prepend(makeBars(3, 0));
        expect(patch.prependedCount).toBe(3);
        expect(patch.snapshot.bars).toHaveLength(3);
    });
    it("trimToWindow on empty store returns null", () => {
        const result = store.trimToWindow({ startMs: 0, endMs: 9999999999999 });
        expect(result).toBeNull();
    });
    it("multiple prepend calls stack correctly", () => {
        store.replaceAll(makeBars(5, 50)); // bars 50–54
        store.prepend(makeBars(10, 30)); // bars 30–39
        store.prepend(makeBars(10, 10)); // bars 10–19
        const snap = store.toSnapshot();
        expect(snap.bars).toHaveLength(25); // 10 + 10 + 5
        // All chronologically sorted
        for (let i = 1; i < snap.bars.length; i++) {
            expect(tsOf(snap.bars[i])).toBeGreaterThan(tsOf(snap.bars[i - 1]));
        }
    });
    it("trim only from head preserves tail bars", () => {
        store.replaceAll(makeBars(20, 0)); // bars 0–19
        const window = {
            startMs: makeBar(10).date.getTime(),
            endMs: makeBar(99).date.getTime(), // far future → no tail trim
        };
        const patch = store.trimToWindow(window);
        expect(patch).not.toBeNull();
        expect(patch.trimmedFromHead).toBe(10);
        expect(patch.trimmedFromTail).toBe(0);
        expect(patch.snapshot.bars).toHaveLength(10);
    });
    it("trim only from tail preserves head bars", () => {
        store.replaceAll(makeBars(20, 0)); // bars 0–19
        const window = {
            startMs: 0, // covers entire head
            endMs: makeBar(9).date.getTime(),
        };
        const patch = store.trimToWindow(window);
        expect(patch).not.toBeNull();
        expect(patch.trimmedFromHead).toBe(0);
        expect(patch.trimmedFromTail).toBe(10);
        expect(patch.snapshot.bars).toHaveLength(10);
    });
});
