import { describe, it, expect } from "vitest";
import { dedupAlerts } from "../utils/alertDedup.js";

// Replicate fixed logic from DashboardPage.tsx:189

function calcBreadth(quotes: Record<string, any>) {
  let up = 0, down = 0, flat = 0;
  Object.values(quotes).forEach((q: any) => {
    const rawPct = q?.change_pct;
    const change = Number(rawPct ?? q?.change_value ?? q?.change ?? 0);
    if (change > 0.0001) up++;
    else if (change < -0.0001) down++;
    else flat++;
  });
  return { up, down, flat };
}

describe("DashboardPage breadth & dedup (F11)", () => {
  it("breadth ưu tiên change_pct đã normalize (fraction 0.01 không đếm flat)", () => {
    // change_pct = 1.2% (đã normalize từ fraction 0.012), change_value = 0.01 fraction
    const quotes = {
      VCI: { change_pct: 1.2, change_value: 0.01 },
      HPG: { change_pct: -0.5 },
      FPT: { change_pct: 0 },
    };
    expect(calcBreadth(quotes)).toEqual({ up: 1, down: 1, flat: 1 });
  });

  it("breadth với fraction nhỏ 0.01% vẫn đếm up nếu change_pct=0.01", () => {
    const quotes = {
      VCI: { change_pct: 0.01 },
    };
    expect(calcBreadth(quotes)).toEqual({ up: 1, down: 0, flat: 0 });
  });

  it("dedup ưu tiên alert_id trước event_id → id", () => {
    const a1 = { alert_id: "uuid-1", event_id: "evt1", id: "1", symbol: "VCI", ts: "2026-09-08T10:00:00Z" };
    const a2 = { alert_id: "uuid-1", event_id: "evt1", id: "1", symbol: "VCI", ts: "2026-09-08T10:00:00Z" }; // trùng alert_id
    const a3 = { event_id: "evt2", id: "2", symbol: "HPG", ts: "2026-09-08T10:00:00Z" };
    const a4 = { event_id: "evt2", id: "2", symbol: "HPG", ts: "2026-09-08T10:00:00Z" }; // trùng event_id
    const a5 = { id: "3", symbol: "FPT", ts: "2026-09-08T10:00:00Z" };
    const a6 = { id: "3", symbol: "FPT", ts: "2026-09-08T10:00:00Z" }; // trùng id
    expect(dedupAlerts([a1, a2, a3, a4, a5, a6])).toHaveLength(3);
    expect(dedupAlerts([a1, a2])[0].alert_id).toBe("uuid-1");
  });

  it("dedup WS (event_id) và REST (alert_id) cùng UUID không trùng lặp", () => {
    const ws = { event_id: "uuid-1", symbol: "VCI", ts: "2026-09-09T11:30:29Z" }; // WS: event_id = alert_id
    const rest = { alert_id: "uuid-1", symbol: "VCI", ts: "2026-09-09T11:30:29Z" }; // REST: alert_id
    expect(dedupAlerts([ws, rest])).toHaveLength(1);
  });

  it("dedup fallback symbol-ts khi thiếu id/event_id", () => {
    const a1 = { symbol: "VCI", ts: "2026-09-08T10:00:00Z" };
    const a2 = { symbol: "VCI", ts: "2026-09-08T10:00:00Z" };
    expect(dedupAlerts([a1, a2])).toHaveLength(1);
  });
});
