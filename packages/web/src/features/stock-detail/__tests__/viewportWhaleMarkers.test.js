import { jest, describe, expect, test, beforeEach } from "@jest/globals";

// Mock React useMemo to evaluate immediately for pure logic testing
jest.unstable_mockModule("react", () => {
  return {
    useMemo: (fn) => fn(),
  };
});

// Import hook after mock
const { useViewportWhaleMarkers } = await import("../hooks/useViewportWhaleMarkers.js");

describe("useViewportWhaleMarkers Hook", () => {
  const sampleCandles = [
    { time: "2026-05-01", volume: 1000, whaleVolume: 100 },
    { time: "2026-05-02", volume: 2000, whaleVolume: 200 },
    { time: "2026-05-03", volume: 3000, whaleVolume: 300 },
    { time: "2026-05-04", volume: 1500, whaleVolume: 50 },
    { time: "2026-05-05", volume: 9000, whaleVolume: 900 }, // Max volume
    { time: "2026-05-06", volume: 2500, whaleVolume: 120 },
    { time: "2026-05-07", volume: 4500, whaleVolume: 450 },
    { time: "2026-05-08", volume: 1100, whaleVolume: 80 },
    { time: "2026-05-09", volume: 7500, whaleVolume: 750 },
    { time: "2026-05-10", volume: 500, whaleVolume: 20 },
  ];

  test("handles empty candles or out-of-bound ranges gracefully", () => {
    const resultEmpty = useViewportWhaleMarkers([], 0, 10);
    expect(resultEmpty).toBeInstanceOf(Set);
    expect(resultEmpty.size).toBe(0);

    const resultNull = useViewportWhaleMarkers(null, 0, 5);
    expect(resultNull.size).toBe(0);

    // Should auto-clamp safe range
    const resultClamp = useViewportWhaleMarkers(sampleCandles, -5, 100);
    expect(resultClamp.size).toBe(1); // 10% of 10 is 1
  });

  test("assigns exactly 1 whale marker when viewport has 10 candles (10% threshold)", () => {
    // 10 visible candles -> 10% is 1 candle
    const markers = useViewportWhaleMarkers(sampleCandles, 0, 9);
    expect(markers.size).toBe(1);
    // Top whaleVolume is 2026-05-05 (900)
    expect(markers.has("2026-05-05")).toBe(true);
    expect(markers.has("2026-05-09")).toBe(false);
  });

  test("assigns exactly 2 whale markers when viewport has 20 candles", () => {
    const doubleCandles = [
      ...sampleCandles,
      { time: "2026-05-11", volume: 12000, whaleVolume: 1200 }, // Max
      ...sampleCandles.slice(1),
    ]; // 20 candles
    const markers = useViewportWhaleMarkers(doubleCandles, 0, 19);
    expect(markers.size).toBe(2);
    // Top 2 should be 2026-05-11 (1200) and 2026-05-05 (900)
    expect(markers.has("2026-05-11")).toBe(true);
    expect(markers.has("2026-05-05")).toBe(true);
  });

  test("updates whale markers dynamically when changing viewport range (panning/zooming)", () => {
    // Viewport zoom in: index 0 to 3 (4 candles)
    // 10% of 4 is 0 -> Math.max(1, 0) = 1 marker
    // Candles inside slice: 05-01 (100), 05-02 (200), 05-03 (300), 05-04 (50)
    // Top volume is 2026-05-03
    const zoomMarkers = useViewportWhaleMarkers(sampleCandles, 0, 3);
    expect(zoomMarkers.size).toBe(1);
    expect(zoomMarkers.has("2026-05-03")).toBe(true);

    // Pan viewport: shift range to index 3 to 7 (5 candles)
    // Candles: 05-04 (50), 05-05 (900), 05-06 (120), 05-07 (450), 05-08 (80)
    // Top is 2026-05-05
    const panMarkers = useViewportWhaleMarkers(sampleCandles, 3, 7);
    expect(panMarkers.size).toBe(1);
    expect(panMarkers.has("2026-05-05")).toBe(true);
    expect(panMarkers.has("2026-05-03")).toBe(false);
  });

  test("falls back to regular volume if whaleVolume is missing", () => {
    const regularCandles = [
      { time: "C1", volume: 50 },
      { time: "C2", volume: 500 }, // Max
      { time: "C3", volume: 300 },
    ];
    const markers = useViewportWhaleMarkers(regularCandles, 0, 2);
    expect(markers.size).toBe(1);
    expect(markers.has("C2")).toBe(true);
  });
});
