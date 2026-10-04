/**
 * Every path an adapter sends must exist in the backend URLconf.
 *
 * Why this test exists
 * -------------------
 * 32 adapter methods pointed at routes the backend never served, so they could
 * only ever 404. Nothing caught it: each method had no call site, and no test
 * compared adapter paths to Django's URLconf. `core-route-manifest.json` is
 * generated from the real resolver, so this asserts against the truth rather
 * than a hand-kept list that drifts.
 *
 * Regenerate the manifest after changing backend urls.py:
 *   python packages/core/backend/scripts/dump-core-route-manifest.py
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Jest runs this suite as ESM, so `__dirname` does not exist.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADAPTER_DIR = path.resolve(HERE, "..");

// Read the manifest with fs rather than `import ... from "./x.json"`: ESM JSON
// imports need an import assertion and silently yielded an empty object here,
// which would make the contract test pass vacuously.
const manifest = JSON.parse(
  fs.readFileSync(path.join(HERE, "core-route-manifest.json"), "utf8"),
);
const CORE_BASE = manifest.core_base;

const CALL_RE = /core(?:Get|Post|Put|Patch|Delete)\(\s*[`'"]([^`'"]+)[`'"]/gs;

/** `/core/v1/x/<int:id>/` -> anchored regex. Every converter matches one segment. */
function toRegExp(route) {
  // Normalise the trailing slash BEFORE anchoring: manifest routes end with `/`
  // while the resolved path is stripped, and `body + "/?$"` would make that slash
  // mandatory and fail every call.
  const normalised = route.replace(/\/+$/, "");
  const body = normalised
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/<[^>]+>/g, "[^/]+");
  return new RegExp(`^${body}/?$`);
}

function collectAdapterCalls() {
  const calls = [];
  for (const name of fs.readdirSync(ADAPTER_DIR)) {
    if (!name.endsWith(".js") || name.endsWith(".test.js")) continue;
    const file = path.join(ADAPTER_DIR, name);
    const text = fs.readFileSync(file, "utf8");
    let match;
    CALL_RE.lastIndex = 0;
    while ((match = CALL_RE.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      calls.push({ file: name, line, raw: match[1] });
    }
  }
  return calls;
}

/**
 * Interpolations that build a QUERY STRING, not a path segment.
 *
 * `${qs}`, `${query}`, `${suffix}` and friends expand to `?a=b` or `""`, so
 * `` `/session-facts/VCI/${query}` `` really requests `/session-facts/VCI/`.
 * Position alone cannot tell them apart from a real path param, and guessing
 * wrong hides real 404s, so the set is explicit. Adding a name here means the
 * path up to that point is still checked — only the phantom segment is dropped.
 */
const QUERY_INTERPOLATIONS = new Set([
  "query",
  "qs",
  "suffix",
  "buildSignalsRecentQuery(params)",
]);

/**
 * Reduce a raw call literal to the path the backend actually has to resolve.
 */
function toResolvablePath(raw) {
  let probe = raw;
  for (const name of QUERY_INTERPOLATIONS) {
    probe = probe.split("${" + name + "}").join("");
  }
  probe = probe.replace(/\/\$\{[^}]*\}/g, "/X");
  probe = probe.replace(/\$\{.*/s, "").split("?")[0];
  probe = probe.replace(/\/+$/, "") || "/";
  if (probe.startsWith("/api/")) return probe;
  return `${CORE_BASE}${probe}`;
}

describe("core adapter route contract", () => {
  const matchers = [...manifest.core, ...manifest.public].map(toRegExp);
  const calls = collectAdapterCalls();

  it("finds adapter calls to check (guard against a silently empty scan)", () => {
    expect(calls.length).toBeGreaterThan(300);
  });

  it("manifest is non-empty (guards a vacuous pass)", () => {
    expect(manifest.core.length).toBeGreaterThan(100);
    expect(matchers.length).toBe(manifest.core.length + manifest.public.length);
  });

  it("every adapter call resolves to a backend route", () => {
    const unmatched = calls
      .filter((call) => {
        const path = toResolvablePath(call.raw);
        // Param converters are stricter than the manifest regex (uuid/int), so a
        // second pass with a neutral value keeps those from false-failing.
        const candidates = path.includes("X")
          ? [path, path.replace(/X/g, "1"), path.replace(/X/g, "abc"), path.replace(/X/g, "00000000-0000-0000-0000-000000000000")]
          : [path];
        return !candidates.some((c) => matchers.some((re) => re.test(c)));
      })
      .map((call) => `${call.file}:${call.line} ${call.raw} -> ${toResolvablePath(call.raw)}`);

    expect(unmatched).toEqual([]);
  });
});