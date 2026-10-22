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

// W0.5 — SUA SU LAI MOT LAN NUA, LAN NAY LA GOC RE THAT.
//
// `packages/web/package.json` khai `"type": "module"` ⇒ MOI file `.js` trong
// package la ESM ⇒ `__dirname` KHONG TON TAI. Comment cu (18-21) noi nguoc:
// "jest.config.js sets extensionsToTreatAsEsm to [.jsx,.ts,.tsx] only, so this
// .js suite is transformed to CommonJS" — SAI, vi `type: module` da lam .js
// thanh ESM ma khong can setting do.
//
// Hau qua: suite `route-contract` **CHUA BAO GIờ CHAY** ⇒ gate bao ve contract
// API chet trong im lang (ghi nhan o ledger Entry 384) ⇒ 32 method adapter tro
// sai route van duoc merge, va moi loi goi sai trong `src/pages/**` deu ngoai
// tam gate.
//
// Cach sua: dung `process.cwd()` (jest chay voi rootDir = packages/web) + kiem
// tra file manifest ton tai o moi candidate ⇒ khong phu thuoc `__dirname` hay
// `import.meta` (parse-time SyntaxError neu file bi transform CJS).
function resolveHere() {
  const candidates = [
    path.join(process.cwd(), "src", "adapters", "core", "__tests__"),
    path.join(process.cwd(), "packages", "web", "src", "adapters", "core", "__tests__"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "core-route-manifest.json"))) return candidate;
  }
  return candidates[0];
}

const HERE = resolveHere();
// W0.5: gate phai quet TAT CA noi goi core API — khong chi adapter.
// Truoc day chi quet `src/adapters/core/*.js`, nen moi loi goi coreGet/corePost
// trong `src/pages/**` va `src/context/**` deu ngoai tam gate => path sai chi
// lo ra khi user bam (404 im lang).
const SRC_ROOT = path.resolve(HERE, "..", "..", "..");
const SCAN_ROOTS = [
  { dir: path.join(SRC_ROOT, "adapters"), label: "adapters" },
  { dir: path.join(SRC_ROOT, "pages"), label: "pages" },
  { dir: path.join(SRC_ROOT, "context"), label: "context" },
];
const SCAN_EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const SKIP_FILE_RE = /\.(test|spec)\.[^.]+$/;

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

function collectFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "__tests__", "__snapshots__", "dist"].includes(entry.name)) continue;
      collectFiles(full, out);
    } else {
      if (!SCAN_EXTS.has(path.extname(entry.name))) continue;
      if (SKIP_FILE_RE.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

/**
 * W0.5: quet TAT CA file (adapter + page + context) va chi lay chuoi NAM TRONG
 * `coreGet/corePost/corePut/corePatch/coreDelete(...)`.
 *
 * QUAN TRONG: chi `cache key` (vd `useTenantAdminQuery(..., "/partner/usage/trends/")`)
 * KHONG phai URL — neu quet moi chuoi "/partner/..." se bao SAI (false positive).
 * Vi du thuc te: `TenantAdminUsagePage.tsx:185` trong roadmap duoc goi la "sai"
 * nhung no la cache key; URL that la `adapter.getAllUsageTrends()` -> `/partner/usage/trend/`.
 */
function collectAdapterCalls() {
  const calls = [];
  for (const root of SCAN_ROOTS) {
    for (const file of collectFiles(root.dir, [])) {
      const text = fs.readFileSync(file, "utf8");
      let match;
      CALL_RE.lastIndex = 0;
      while ((match = CALL_RE.exec(text)) !== null) {
        const line = text.slice(0, match.index).split("\n").length;
        calls.push({ file: path.relative(SRC_ROOT, file), line, raw: match[1] });
      }
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

  it("scan really covers pages and context (W0.5 guard)", () => {
    const fromPages = calls.filter((c) => c.file.startsWith("pages" + path.sep));
    const fromContext = calls.filter((c) => c.file.startsWith("context" + path.sep));
    const fromAdapters = calls.filter((c) => c.file.startsWith("adapters" + path.sep));
    expect(fromAdapters.length).toBeGreaterThan(300);
    expect(fromPages.length).toBeGreaterThan(5);
    expect(fromContext.length).toBeGreaterThan(0);
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