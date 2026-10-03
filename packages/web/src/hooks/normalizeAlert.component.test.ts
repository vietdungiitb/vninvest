import { describe, it, expect } from "vitest";
import { normalizeAlert } from "./useRealtimeFeedCore.js";

describe("normalizeAlert WS fields (B2)", () => {
  it("map triggered_at/alert_id/value/direction tu WS envelope", () => {
    const out = normalizeAlert({
      event_id: "uuid-1",
      symbol: "VCI",
      ts: "2026-09-18T08:00:00Z",
      data: {
        triggered_at: "2026-09-18T08:00:01Z",
        direction: "buy",
        matched_value: 1000000000,
      },
    } as any);
    expect(out.alert_id).toBe("uuid-1");
    expect(out.triggered_at).toBe("2026-09-18T08:00:01Z");
    expect(out.value).toBe(1000000000);
    expect(out.direction).toBe("buy");
    expect(out.symbol).toBe("VCI");
    // ts uu tien payload.ts (chuan hoa ISO), per spec B2
    expect(out.ts).toBe(new Date("2026-09-18T08:00:00Z").toISOString());
  });

  it("giu nguyen field cu va fallback ts khi thieu triggered_at", () => {
    const out = normalizeAlert({
      event_id: "uuid-2",
      symbol: "HPG",
      side: "BUY",
      matched_value: 500,
      severity: "high",
      ts: "2026-09-18T08:00:00Z",
    } as any);
    expect(out.alert_id).toBe("uuid-2");
    expect(out.triggered_at).toBeNull();
    expect(out.value).toBe(500);
    expect(out.side).toBe("BUY");
    expect(out.severity).toBe("high");
    expect(out.ts).toBe(new Date("2026-09-18T08:00:00Z").toISOString());
  });
});
