import type { ScreenerCondition, ScreenerRule } from "../../types/screener.js";

interface CanonicalCondition {
  field: string;
  op: string;
  value: number | "" | null;
  logic: string;
}

/**
 * Canonical form of rules_json for dedupe (P0.4 R4.2).
 * - Key order fixed by construction; numbers normalized (6 decimals).
 * - Condition ORDER is significant (left-assoc AND/OR/NOT) — never sorted.
 */
export function canonicalRules(rules: ScreenerCondition[] | null | undefined): string {
  const list = Array.isArray(rules) ? rules : [];
  const norm: CanonicalCondition[] = list.map((c) => ({
    field: String(c?.field ?? ""),
    op: String(c?.op ?? ""),
    value: typeof c?.value === "number" ? Number(c.value.toFixed(6)) : (c?.value ?? null),
    logic: String(c?.logic ?? "AND").toUpperCase(),
  }));
  return JSON.stringify(norm);
}

/** First rule whose config is identical to the candidate (undefined if none). */
export function findDuplicateRule(
  rules: ScreenerRule[],
  candidate: ScreenerCondition[] | null | undefined,
): ScreenerRule | undefined {
  const want = canonicalRules(candidate);
  return (Array.isArray(rules) ? rules : []).find((r) => canonicalRules(r?.rules_json) === want);
}

/** Append " (2)", " (3)", ... until the name is unique (case-insensitive). */
export function uniqueRuleName(baseName: string, rules: ScreenerRule[]): string {
  const taken = new Set((Array.isArray(rules) ? rules : []).map((r) => String(r?.name ?? "").toLowerCase()));
  const base = baseName.trim() || "Rule";
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  for (;;) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
    n += 1;
  }
}
