import { describe, it, expect } from "vitest";
import {
  canonicalRules,
  findDuplicateRule,
  uniqueRuleName,
} from "../screenerRuleDedupe.js";
import type { ScreenerRule } from "../../../types/screener.js";

const A = [
  { field: "rsi_14", op: "lt", value: 30, logic: "AND" },
  { field: "price_vs_sma20_pct", op: "lt", value: 0, logic: "AND" },
] as ScreenerRule["rules_json"];

const RULES: ScreenerRule[] = [
  { id: 1, name: "Oversold", rules_json: A },
  { id: 2, name: "Momentum", rules_json: [{ field: "momentum_20d_pct", op: "gt", value: 20, logic: "AND" }] },
];

describe("canonicalRules (P0.4 R4.2)", () => {
  it("is stable regardless of key order inside a condition", () => {
    const reordered = [
      { logic: "AND", value: 30, op: "lt", field: "rsi_14" },
      { logic: "AND", value: 0, op: "lt", field: "price_vs_sma20_pct" },
    ] as ScreenerRule["rules_json"];
    expect(canonicalRules(reordered)).toBe(canonicalRules(A));
  });

  it("differs on value/field/op/logic change, and is order-sensitive", () => {
    const changedValue = [{ ...A[0], value: 31 }, A[1]] as ScreenerRule["rules_json"];
    expect(canonicalRules(changedValue)).not.toBe(canonicalRules(A));
    // condition order matters (left-assoc logic) — must NOT match
    expect(canonicalRules([A[1], A[0]])).not.toBe(canonicalRules(A));
  });
});

describe("findDuplicateRule", () => {
  it("finds an identical config and ignores the rest", () => {
    const copy = JSON.parse(JSON.stringify(A)) as ScreenerRule["rules_json"];
    expect(findDuplicateRule(RULES, copy)?.id).toBe(1);
    expect(
      findDuplicateRule(RULES, [{ field: "rsi_14", op: "lt", value: 25, logic: "AND" }]),
    ).toBeUndefined();
  });

  it("returns undefined for empty/invalid inputs", () => {
    expect(findDuplicateRule([], A)).toBeUndefined();
    expect(findDuplicateRule(RULES, [])).toBeUndefined();
    expect(findDuplicateRule(RULES, null)).toBeUndefined();
  });
});

describe("uniqueRuleName", () => {
  it("keeps a fresh name and suffixes clashes incrementally", () => {
    expect(uniqueRuleName("New rule", RULES)).toBe("New rule");
    expect(uniqueRuleName("Oversold", RULES)).toBe("Oversold (2)");
    const withTwo: ScreenerRule[] = [...RULES, { id: 3, name: "Oversold (2)", rules_json: A }];
    expect(uniqueRuleName("Oversold", withTwo)).toBe("Oversold (3)");
  });

  it("matches case-insensitively and trims blanks", () => {
    expect(uniqueRuleName("oversold", RULES)).toBe("oversold (2)");
    expect(uniqueRuleName("   ", RULES)).toBe("Rule");
  });
});
