/**
 * W-B — mapper BE intraday-tape -> widget TapeEntry (fail-before).
 * Mirror widget `mapNativeTape` (side lower->buy/sell else unknown;
 * value=price*volume; id=ts|price|volume|index) + app enrichment:
 * `is_whale = value >= TAPE_WHALE_THRESHOLD_VND` (widget native luon false).
 */
import { describe, it, expect } from "vitest";
import {
  mapTapeTradesToEntries,
  TAPE_WHALE_THRESHOLD_VND,
} from "../VNInvestSignalAdapter.js";

function trade(over = {}) {
  return {
    time: "14:30:05",
    ts: "2026-11-12T14:30:05+07:00",
    price: 28500,
    volume: 1000,
    side: "BUY",
    match_type: "NormalMatch",
    ...over,
  };
}

describe("W-B — mapTapeTradesToEntries", () => {
  it("[] khi trades falsy/khong phai array", () => {
    expect(mapTapeTradesToEntries(null)).toEqual([]);
    expect(mapTapeTradesToEntries(undefined)).toEqual([]);
    expect(mapTapeTradesToEntries({})).toEqual([]);
  });

  it("[] khi trades rong (BE empty-state)", () => {
    expect(mapTapeTradesToEntries([])).toEqual([]);
  });

  it("map side: BUY->buy, SELL->sell, la->unknown", () => {
    const r = mapTapeTradesToEntries([
      trade({ side: "BUY" }),
      trade({ side: "SELL" }),
      trade({ side: "NO" }),
      trade({ side: null }),
    ]);
    expect(r.map((e) => e.side)).toEqual(["buy", "sell", "unknown", "unknown"]);
  });

  it("value = price*volume; coerce string; thieu -> 0 (mirror asFiniteNumber2 ?? 0)", () => {
    const r = mapTapeTradesToEntries([
      trade({ price: "28500", volume: "1000" }),
      trade({ price: null, volume: undefined }),
    ]);
    expect(r[0].value).toBe(28500 * 1000);
    expect(r[1].price).toBe(0);
    expect(r[1].volume).toBe(0);
    expect(r[1].value).toBe(0);
  });

  it("ts uu tien ts roi den time; id = ts|price|volume|index (unique)", () => {
    const r = mapTapeTradesToEntries([
      trade({ ts: "2026-11-12T14:30:05+07:00", price: 1, volume: 2 }),
      trade({ ts: "2026-11-12T14:30:05+07:00", price: 1, volume: 2 }),
      trade({ ts: undefined, time: "14:31:00", price: 1, volume: 1 }),
    ]);
    expect(r[0].ts).toBe("2026-11-12T14:30:05+07:00");
    expect(r[2].ts).toBe("14:31:00");
    expect(r[0].id).not.toBe(r[1].id);
    expect(r[0].id).toBe("2026-11-12T14:30:05+07:00|1|2|0");
  });

  it("is_whale = value >= TAPE_WHALE_THRESHOLD_VND (app enrichment)", () => {
    expect(TAPE_WHALE_THRESHOLD_VND).toBe(5e9);
    const r = mapTapeTradesToEntries([
      trade({ price: 100000, volume: 100000 }), // 1e10 >= 5e9
      trade({ price: 28500, volume: 1000 }), // 2.85e7 < 5e9
    ]);
    expect(r[0].is_whale).toBe(true);
    expect(r[1].is_whale).toBe(false);
  });
});
