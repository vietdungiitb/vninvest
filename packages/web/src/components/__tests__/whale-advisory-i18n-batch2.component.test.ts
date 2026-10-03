import { describe, it, expect } from "vitest";
import vi from "@/i18n/vi.js";
import en from "@/i18n/en.js";

function keys(value, prefix = "") {
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" ? keys(child, path) : [path];
  });
}

describe("S15 aiAdvisory i18n batch-2", () => {
  it("keeps VI/EN namespace parity", () => {
    const viKeys = new Set(keys(vi.aiAdvisory));
    const enKeys = new Set(keys(en.aiAdvisory));
    expect([...viKeys].filter((key) => !enKeys.has(key))).toEqual([]);
    expect([...enKeys].filter((key) => !viKeys.has(key))).toEqual([]);
  });

  it("contains batch-2 component keys", () => {
    const required = [
      "checklist.title", "checklist.risk", "checklist.history", "checklist.market", "checklist.analysis",
      "checklist.logged", "checklist.remaining", "risk.title", "risk.conservative", "risk.balanced", "risk.aggressive",
      "telemetry.title", "telemetry.refresh", "telemetry.total", "telemetry.recent", "telemetry.empty",
      "thought.phase1", "thought.phase2", "thought.phase3", "explainability.attribution", "explainability.inputSnapshot",
      "delete.title", "delete.message", "selectSymbol", "tab.telemetry", "tab.risk", "tab.history", "refresh",
    ];
    const viKeys = new Set(keys(vi.aiAdvisory));
    const enKeys = new Set(keys(en.aiAdvisory));
    expect(required.filter((key) => !viKeys.has(key))).toEqual([]);
    expect(required.filter((key) => !enKeys.has(key))).toEqual([]);
  });
});
