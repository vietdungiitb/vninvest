/**
 * tenantreg-d (slice D) — D2 regression gate.
 *
 * `vi.js` and `en.js` each shipped TWO top-level `auth: { ... }` keys inside
 * `const vi = { ... }`. In a JavaScript object literal the LAST duplicate wins,
 * so every key in the first block was unreachable at runtime. That is why
 * `t("auth.resendVerification")` rendered the literal string
 * "auth.resendVerification" instead of the Vietnamese label.
 *
 * Nothing in a JS engine can detect this after the fact: `Object.keys(vi.auth)`
 * only ever reports the surviving block. So the check has to run over the
 * SOURCE TEXT. This test parses the real files with acorn (already present via
 * vite/rollup) and fails on any duplicated TOP-LEVEL key — that is the fatal
 * class, because it silently deletes an entire namespace.
 *
 * This is deliberately a test rather than a lint rule: a rule that does not
 * exist is a comment, not a control.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "acorn";

import vi from "./vi.js";
import en from "./en.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DICTIONARIES = ["vi.js", "en.js"] as const;

type DuplicateHit = { key: string; path: string; line: number; firstLine: number };

function staticKeyName(prop: any): string | null {
  if (!prop || prop.type !== "Property" || prop.computed) return null;
  const { key } = prop;
  if (!key) return null;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

/** Collect every duplicated key in every object literal in the file, with its dotted path. */
function findDuplicateKeys(file: string): DuplicateHit[] {
  const source = readFileSync(join(HERE, file), "utf8");
  const ast = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
  }) as any;
  const hits: DuplicateHit[] = [];

  const walk = (node: any, trail: string) => {
    if (!node || typeof node !== "object" || typeof node.type !== "string") return;

    if (node.type === "ObjectExpression" && Array.isArray(node.properties)) {
      const seen = new Map<string, number>();
      node.properties.forEach((prop: any) => {
        const name = staticKeyName(prop);
        if (name === null) return;
        if (seen.has(name)) {
          hits.push({
            key: name,
            path: trail ? `${trail}.${name}` : name,
            line: prop.loc?.start?.line ?? 0,
            firstLine: seen.get(name) ?? 0,
          });
        } else {
          seen.set(name, prop.loc?.start?.line ?? 0);
        }
      });
    }

    for (const [childKey, value] of Object.entries(node)) {
      if (childKey === "loc" || childKey === "start" || childKey === "end") continue;
      const children = Array.isArray(value) ? value : [value];
      children.forEach((child: any) => {
        if (!child || typeof child !== "object" || typeof child.type !== "string") return;
        // Only descend through a Property's `value`; descending through its
        // `key` (an Identifier) would corrupt the dotted path.
        let next = trail;
        if (node.type === "Property" && childKey === "value") {
          const name = staticKeyName(node);
          if (name !== null) next = trail ? `${trail}.${name}` : name;
        }
        walk(child, next);
      });
    }
  };

  walk(ast, "");
  return hits;
}

describe("tenantreg D2 — no duplicate top-level key in the i18n dictionaries", () => {
  test.each(DICTIONARIES)("%s has no duplicated TOP-LEVEL key", (file) => {
    const topLevel = findDuplicateKeys(file).filter((hit) => !hit.path.includes("."));
    const rendered = topLevel
      .map((hit) => `  ${file}:${hit.line}  duplicate top-level key "${hit.key}" (first seen line ${hit.firstLine})`)
      .join("\n");
    expect(
      topLevel,
      `duplicated top-level keys — the last one silently wins and the earlier one is unreachable:\n${rendered}`,
    ).toEqual([]);
  });

  test.each(DICTIONARIES)("%s exports its dictionary as `const <name> = {...}; export default <name>`", (file) => {
    const source = readFileSync(join(HERE, file), "utf8");
    const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" }) as any;
    const declarations = ast.body.filter((n: any) => n.type === "VariableDeclaration");
    const exportDefault = ast.body.find((n: any) => n.type === "ExportDefaultDeclaration");
    expect(declarations.length, "expected exactly one top-level const declaration").toBe(1);
    expect(exportDefault, "expected `export default <identifier>`").toBeTruthy();

    const init = declarations[0].declarations[0].init;
    expect(init.type).toBe("ObjectExpression");

    const authNames = init.properties
      .map(staticKeyName)
      .filter((name) => name === "auth");
    expect(authNames, "expected exactly one top-level `auth` namespace").toHaveLength(1);
  });
});

/**
 * Nested duplicates are the same bug class, but they live in namespaces owned
 * by other slices (soc, watchlist, whaleHub, whaleAdvisory, routes). Choosing
 * which value survives is a product decision for whoever owns that namespace,
 * so this slice pins the current list instead of silently picking a winner.
 *
 * If this test fails with extra entries, a NEW nested duplicate was introduced.
 * When a namespace owner merges their two blocks, delete their entry here.
 */
const KNOWN_NESTED_DUPLICATES: Record<string, string[]> = {
  "vi.js": [
    "routes.support",
    "soc.screener.config",
    "watchlist.priceUnitHint",
    "whaleAdvisory.description",
    "whaleHub.severityLow",
    "whaleHub.noCampaigns",
  ],
  "en.js": [
    "routes.support",
    "soc.screener.config",
    "watchlist.priceUnitHint",
    "whaleAlertsDashboard.severity",
    "whaleAdvisory.description",
    "whaleHub.severityLow",
    "whaleHub.noCampaigns",
  ],
};

describe("tenantreg D2 — nested duplicate keys are pinned, not silently growing", () => {
  test.each(DICTIONARIES)("%s introduces no new nested duplicate", (file) => {
    const nested = findDuplicateKeys(file)
      .filter((hit) => hit.path.includes("."))
      .map((hit) => hit.path)
      .sort();
    const known = [...(KNOWN_NESTED_DUPLICATES[file] ?? [])].sort();
    expect(nested, `new nested duplicate(s) in ${file}; see KNOWN_NESTED_DUPLICATES`).toEqual(known);
  });
});

/**
 * Proof that the merge did not lose anything the new auth UI depends on:
 * these keys lived ONLY in the overwritten block, so before this change they
 * resolved to the literal key name at runtime.
 */
const RESURRECTED_KEYS = [
  "resendVerification",
  "resendVerificationLoading",
  "resendVerificationSuccess",
  "resendVerificationError",
  "loginErrorInvalidCredentials",
  "loginErrorUnverifiedEmail",
  "loginErrorNetwork",
  "loginErrorServer",
  "loginErrorRateLimited",
];

describe("tenantreg D2 — keys rescued from the overwritten auth block now resolve", () => {
  test.each([
    ["vi", vi],
    ["en", en],
  ] as const)("%s.auth exposes every previously-dead key with a real value", (_locale, dict) => {
    const auth = (dict as any).auth;
    expect(auth, "auth namespace must exist").toBeTruthy();
    RESURRECTED_KEYS.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(auth, key), `auth.${key} missing`).toBe(true);
      expect(typeof auth[key], `auth.${key} must be a string`).toBe("string");
      expect(auth[key].trim().length, `auth.${key} must not be empty`).toBeGreaterThan(0);
      // The bug rendered the raw key path, e.g. "auth.resendVerification".
      expect(auth[key], `auth.${key} still equals its own key path`).not.toBe(`auth.${key}`);
    });
  });

  test("validation.passwordMinLength is interpolation-driven, not a hardcoded 8", () => {
    expect(vi.auth.validation.passwordMinLength).toContain("{min}");
    expect(en.auth.validation.passwordMinLength).toContain("{min}");
    expect(vi.auth.validation.passwordMinLength).not.toMatch(/\b8\b/);
    expect(en.auth.validation.passwordMinLength).not.toMatch(/\b8\b/);
  });
});

describe("tenantreg D2 — auth namespace parity between locales", () => {
  function flatten(obj: any, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === "object" ? flatten(value, path) : [path];
    });
  }

  test("vi.auth and en.auth expose exactly the same key set", () => {
    const viKeys = flatten(vi.auth).sort();
    const enKeys = flatten(en.auth).sort();
    expect(
      { viOnly: viKeys.filter((k) => !enKeys.includes(k)), enOnly: enKeys.filter((k) => !viKeys.includes(k)) },
      "auth namespace drift between locales",
    ).toEqual({ viOnly: [], enOnly: [] });
  });
});
