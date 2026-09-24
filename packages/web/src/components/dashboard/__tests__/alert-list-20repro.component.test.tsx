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

describe("repro: 20 backend alerts phải render 20 card", () => {
  it("list renders all cards with severityFilter=all", () => {
    const { container } = render(e(UnifiedAlertCenter as any, {
      alerts,
      severityFilter: "all",
      readAlertIds: new Set(),
    } as any));
    expect(container.querySelectorAll(".alert-card").length).toBe(20);
  });
});
