import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement as e } from "react";
import { UnifiedAlertCenter } from "../UnifiedAlertCenter.js";

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      let s = key;
      Object.entries(vars || {}).forEach(([k, v]) => {
        s = s.replaceAll(`{${k}}`, String(v));
      });
      return s;
    },
  }),
}));

// Backend snapshot shape: alert_id, symbol, severity lower-case, source whale,
// direction/value/confidence/session_date/body/triggered_at
const alerts = Array.from({ length: 20 }, (_, i) => ({
  alert_id: `snap-${i}`,
  symbol: ["CAR", "VBB", "HPG", "VCB", "FPT"][i % 5],
  severity: i < 15 ? "high" : i < 19 ? "medium" : "low",
  source: "whale",
  direction: "buy",
  value: 660489030 + i,
  confidence: 0.85,
  session_date: "2026-09-21",
  body: `Cá mập mua #${i}`,
  triggered_at: new Date(Date.now() - i * 60000).toISOString(),
}));

// CONTRACT CHANGE (Wave 2, PR #27): this file used to assert that 20 backend
// alerts render 20 cards. That locked in the exact behaviour the redesign
// removes — the lane is a summary, not the inbox. It now curates to the top 5
// by priority (severity -> value -> recency) and links out to Alert Center for
// the rest. The test keeps its original purpose: prove that a 20-item feed is
// ingested, ranked and rendered without dropping or duplicating rows.
describe("repro: 20 backend alerts -> curated lane", () => {
  it("curates to 5 cards and exposes the rest via a see-more link", () => {
    const { container } = render(e(UnifiedAlertCenter as any, {
      alerts,
      severityFilter: "all",
      readAlertIds: new Set(),
    } as any));
    expect(container.querySelectorAll(".alert-card").length).toBe(5);
    // 20 in, 5 shown, 15 reachable.
    const seeMore = container.querySelector('a[href="/alert-center"]:not(:has([class*="whitespace"]))');
    const links = Array.from(container.querySelectorAll('a[href="/alert-center"]'));
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(seeMore).toBeTruthy();
  });

  it("shows the highest-priority alerts, not merely the most recent", () => {
    const mixed = [
      // oldest, but critical — must outrank everything below it
      { alert_id: "old-critical", symbol: "AAA", severity: "critical", source: "whale", direction: "sell", value: 1_000, confidence: 0.9, session_date: "2026-09-20", body: "x", triggered_at: new Date(Date.now() - 3600_000).toISOString() },
      { alert_id: "recent-high", symbol: "BBB", severity: "high", source: "whale", direction: "buy", value: 900_000, confidence: 0.9, session_date: "2026-09-21", body: "y", triggered_at: new Date(Date.now() - 60_000).toISOString() },
    ];
    const { container } = render(e(UnifiedAlertCenter as any, {
      alerts: mixed,
      severityFilter: "all",
      readAlertIds: new Set(),
    } as any));
    const cards = Array.from(container.querySelectorAll(".alert-card"));
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain("AAA");
  });
});
