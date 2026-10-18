import { describe, it, expect } from "vitest";
import viDict from "../../i18n/vi.js";
import enDict from "../../i18n/en.js";

const AI_CC_NAMESPACES = [
  "aiCommandCenter",
  "aiUsageAnalytics",
] as const;

function flattenKeys(obj: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (obj === null || typeof obj !== "object") return keys;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of flattenKeys(v, path)) keys.add(nested);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

function nsKeys(dict: unknown, ns: string): Set<string> {
  const flat = flattenKeys(dict);
  const out = new Set<string>();
  for (const k of flat) {
    if (k === ns || k.startsWith(`${ns}.`)) out.add(k);
  }
  return out;
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((k) => !b.has(k)).sort();
}

describe("G-AC1: AI CC i18n key parity vi vs en", () => {
  for (const ns of AI_CC_NAMESPACES) {
    it(`${ns}: key sets equal (vi ⊇ en and en ⊇ vi)`, () => {
      const viKeys = nsKeys(viDict, ns);
      const enKeys = nsKeys(enDict, ns);
      expect(viKeys.size).toBeGreaterThan(0);
      expect(enKeys.size).toBeGreaterThan(0);
      const missingInEn = diff(viKeys, enKeys);
      const missingInVi = diff(enKeys, viKeys);
      expect(
        missingInEn,
        `missing in en: ${missingInEn.join(", ")}`
      ).toEqual([]);
      expect(
        missingInVi,
        `missing in vi: ${missingInVi.join(", ")}`
      ).toEqual([]);
    });
  }

  it("all three namespaces present in both catalogs", () => {
    for (const dict of [viDict, enDict]) {
      for (const ns of AI_CC_NAMESPACES) {
        expect(nsKeys(dict, ns).size).toBeGreaterThan(0);
      }
    }
  });
});
