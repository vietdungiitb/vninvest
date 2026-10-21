#!/usr/bin/env node
/**
 * check-heading-contract — UI Standardization W0 / slice S2.
 *
 * WHAT IT CHECKS: a PAGE file under `packages/web/src/pages/**` that renders
 * its own `<h1>`. The shell already provides one `<h1>` per route
 * (`ShellPageTemplate.js` → `ShellPageChrome`), so a page that builds its own
 * `<h1>` produces a route with two `<h1>` — the defect the audit measured on
 * `/admin/users` (2.00:1 headline contrast) and on 12/13 audited routes.
 *
 * DETECTION (both forms the plan asks for):
 *   - JSX:        `<h1`
 *   - imperative: `createElement("h1")` / `createElement('h1')`
 *
 * SCOPE (pinned, never "the whole repo"):
 *   packages/web/src/pages/**  ·  extensions .js/.jsx/.ts/.tsx
 *   EXCLUDED: test files (`__tests__/`, `*.test.*`, `*.spec.*`) — a test file
 *   never renders a heading in the product.
 *   Measured on `dev@e7b008f25`: **99 files scanned, 25 violations** (the
 *   plan's "25 / 99"). Any change to that number must be explainable.
 *
 * ALLOWLIST (pinned):
 *   packages/web/src/components/commercial/**   (the S1 template)
 *   packages/web/src/components/ShellPageTemplate.js  (renders the shell h1)
 *   packages/web/src/pages/admin/adminUi.tsx    (shared admin heading)
 *
 * BASELINE-LOCKED (contract of `scripts/check-lessons.mjs`):
 *   exit 0 <=> every violation found NOW is already in the baseline
 *   exit 1 <=> at least one NEW violating file (regression)
 *   exit 2 <=> cannot verify
 * The comparison is on the SET of file paths, never on a count.
 *
 * Usage:
 *   node packages/web/scripts/check-heading-contract.mjs
 *   node packages/web/scripts/check-heading-contract.mjs --print-violations
 *   node packages/web/scripts/check-heading-contract.mjs --update-baseline
 *   node packages/web/scripts/check-heading-contract.mjs --self-test
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..", "..", "..");
const GATE = "check-heading-contract";

const SRC_PAGES = path.join("packages", "web", "src", "pages");
const CODE_EXT = /\.(jsx?|tsx?)$/;
const TEST_RE = /(__tests__|\.test\.|\.spec\.)/;

/** Allowlist — exact paths or directory prefixes, relative to the repo root. */
const ALLOWLIST = [
  { kind: "dir", rel: path.join("packages", "web", "src", "components", "commercial") },
  { kind: "file", rel: path.join("packages", "web", "src", "components", "ShellPageTemplate.js") },
  { kind: "file", rel: path.join("packages", "web", "src", "pages", "admin", "adminUi.tsx") },
];

function isAllowed(rel) {
  for (const a of ALLOWLIST) {
    if (a.kind === "file" && rel === a.rel) return true;
    if (a.kind === "dir" && rel.startsWith(a.rel + path.sep)) return true;
  }
  return false;
}

// ───────────────────────────────────────────────────────── the measurement ────

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** `<h1` in JSX, or `createElement("h1")` in imperative code. */
function buildsH1(src) {
  const jsx = /<h1[\s/>]/.test(src);
  const imperative = /createElement\(\s*["']h1["']/.test(src);
  return jsx || imperative;
}

function collect(repo) {
  const root = path.join(repo, SRC_PAGES);
  if (!fs.existsSync(root)) {
    const err = new Error(`khong tim thay thu muc scope ${SRC_PAGES}`);
    err.code = "NO_SCOPE";
    throw err;
  }
  const files = walk(root)
    .filter((f) => CODE_EXT.test(f))
    .filter((f) => !TEST_RE.test(f.split(path.sep).join("/")))
    .map((f) => path.relative(repo, f))
    .sort();

  const violations = [];
  for (const rel of files) {
    if (isAllowed(rel)) continue;
    const src = fs.readFileSync(path.join(repo, rel), "utf8");
    if (!buildsH1(src)) continue;
    const lines = src.split("\n");
    const at = lines
      .map((l, i) => (/<h1[\s/>]/.test(l) || /createElement\(\s*["']h1["']/.test(l) ? i + 1 : 0))
      .filter(Boolean);
    violations.push({
      id: rel.split(path.sep).join("/"),
      detail: `dong ${at.slice(0, 3).join(", ")}${at.length > 3 ? ` (+${at.length - 3})` : ""}`,
    });
  }
  return { scanned: files.length, violations };
}

// ───────────────────────────────────────────────────────────── baseline io ───

function baselinePath(repo) {
  return path.join(repo, "packages", "web", "scripts", "check-ui-baseline", `${GATE}.json`);
}

function readBaseline(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    const e = new Error(`baseline khong doc duoc (JSON hong): ${err.message}`);
    e.code = "BAD_BASELINE";
    throw e;
  }
}

function writeBaseline(file, scanned, violations) {
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    gate: GATE,
    scope: SRC_PAGES.split(path.sep).join("/"),
    measuredAt: new Date().toISOString(),
    scannedFiles: scanned,
    violations: violations.map((v) => v.id),
    details: Object.fromEntries(violations.map((v) => [v.id, v.detail])),
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

// ─────────────────────────────────────────────────────────────────── cli ──────

function parseArgs(argv) {
  const out = { printViolations: false, selfTest: false, update: false, repo: DEFAULT_REPO, baseline: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") out.repo = path.resolve(argv[++i]);
    else if (a === "--baseline") out.baseline = path.resolve(argv[++i]);
    else if (a === "--print-violations") out.printViolations = true;
    else if (a === "--self-test") out.selfTest = true;
    else if (a === "--update-baseline") out.update = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`check-heading-contract: tham so khong ro: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────── run ──────

function run(opts) {
  let scanned = 0;
  let violations = [];
  try {
    ({ scanned, violations } = collect(opts.repo));
  } catch (err) {
    console.error(`check-heading-contract: KHONG VERIFY DUOC — ${err.message}`);
    return 2;
  }

  const bFile = opts.baseline || baselinePath(opts.repo);

  if (opts.update) {
    const payload = writeBaseline(bFile, scanned, violations);
    console.log(
      `check-heading-contract: DA GHI BASELINE ${bFile} (${payload.violations.length} vi pham / ${scanned} file da quet).`,
    );
    console.log("  ⚠ Baseline da DUOC NANG len — chi lam vay khi vi pham cu da duoc SUA that.");
    return 0;
  }

  const baseline = readBaseline(bFile);
  if (!baseline) {
    console.error(
      `check-heading-contract: KHONG VERIFY DUOC — thieu baseline ${bFile}. ` +
        `Chay 1 lan voi --update-baseline de tao baseline, roi commit file do.`,
    );
    return 2;
  }

  const known = new Set(baseline.violations || []);
  const fresh = violations.filter((v) => !known.has(v.id));
  const gone = [...known].filter((id) => !violations.some((v) => v.id === id));

  if (opts.printViolations) {
    for (const v of violations) console.log(v.id);
    return 0;
  }

  console.log(
    `check-heading-contract — ${violations.length} vi pham / ${scanned} file da quet ` +
      `| baseline ${known.size} | file: ${path.relative(opts.repo, bFile).split(path.sep).join("/")}`,
  );
  if (violations.length === 0) {
    console.log("  (khong co vi pham)");
  } else {
    console.log("  TAP VI PHAM HIEN TAI:");
    for (const v of violations) console.log(`    ${v.id}  (${v.detail})`);
  }
  if (fresh.length) {
    console.error(`\n  ✗ ${fresh.length} VI PHAM MOI (khong co trong baseline):`);
    for (const v of fresh) console.error(`    ${v.id}`);
    console.error("  ✗ REGRESSION — gate that.");
    return 1;
  }
  if (gone.length) {
    console.log(`  ℹ ${gone.length} vi pham trong baseline da het: ${gone.join(", ")}`);
    console.log("    ⇒ co the ha baseline bang: node packages/web/scripts/check-heading-contract.mjs --update-baseline");
  }
  console.log("  ✓ khong co vi pham MOI — gate xanh (tap vi pham ⊆ baseline).");
  return 0;
}

// ─────────────────────────────────────────────────────────────── self-test ────

function runSelf(args) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    encoding: "utf8",
    env,
    shell: false,
  });
  return { code: res.status ?? -1, out: `${res.stdout || ""}${res.stderr || ""}` };
}

/** Synthetic repo with a `src/pages` tree — no copy of the real sources. */
function buildFixture(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "check-heading-contract-"));
  for (const [rel, body] of Object.entries(files)) {
    const dst = path.join(root, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, body, "utf8");
  }
  return root;
}

function selfTest() {
  console.log("check-heading-contract SELF-TEST — chay tren ban sao tam, assert gate BAT\n");
  let failures = 0;
  let total = 0;

  const probe = (name, base, mutate, expectCode, expectText) => {
    total += 1;
    const root = buildFixture(base);
    const bFile = path.join(root, "baseline.json");
    const measured = runSelf(["--repo", root, "--baseline", bFile, "--update-baseline"]);
    const measuredCount = Number((measured.out.match(/DA GHI BASELINE[^\n]*\((\d+)/) || [])[1]);
    if (mutate) mutate(root);
    const res = runSelf(["--repo", root, "--baseline", bFile]);
    rmSync(root, { recursive: true, force: true });
    const ok =
      expectCode === 0
        ? res.code === 0
        : res.code !== 0 && (!expectText || res.out.includes(expectText));
    if (ok) console.log(`  ok   ${name}  exit=${res.code} (baseline do ${measuredCount ?? "?"} vi pham)`);
    else {
      failures += 1;
      console.log(
        `  FAIL ${name}\n        mong doi ${expectCode === 0 ? "exit 0" : `exit != 0 chua '${expectText}'`}, nhan exit=${res.code}\n${res.out.trim()}`,
      );
    }
  };

  const CLEAN = {
    [path.join("packages", "web", "src", "pages", "GoodPage.tsx")]: "export default function Good(){ return <div>ok</div>; }\n",
  };
  const WITH_H1 = {
    [path.join("packages", "web", "src", "pages", "BadPage.tsx")]: "export default function Bad(){ return <h1>Tiêu đề</h1>; }\n",
  };

  probe("CONTROL: trang khong tu dung h1 → exit 0", CLEAN, null, 0, null);

  probe(
    "CASE: trang tu dung <h1> (JSX) → exit != 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "pages", "BadPage.tsx");
      writeFileSync(p, WITH_H1[path.join("packages", "web", "src", "pages", "BadPage.tsx")], "utf8");
    },
    1,
    "BadPage.tsx",
  );

  probe(
    "CASE: trang tu dung createElement('h1') → exit != 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "pages", "ImperativePage.js");
      writeFileSync(p, "const el = createElement('h1', null, 'Tiêu đề');\n", "utf8");
    },
    1,
    "ImperativePage.js",
  );

  probe(
    "NEGATIVE: file trong allowlist (adminUi.tsx) → van exit 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "pages", "admin", "adminUi.tsx");
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, "export const H = () => <h1>Admin</h1>;\n", "utf8");
    },
    0,
    null,
  );

  probe(
    "NEGATIVE: file test (khong render heading) → van exit 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "pages", "__tests__", "x.component.test.tsx");
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, "const el = <h1>test</h1>;\n", "utf8");
    },
    0,
    null,
  );

  if (failures) {
    console.error(`\ncheck-heading-contract SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-heading-contract SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

// ────────────────────────────────────────────────────────────────── main ───────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      "Usage: node packages/web/scripts/check-heading-contract.mjs [--print-violations] [--update-baseline] [--self-test]",
    );
    return 0;
  }
  if (opts.selfTest) return selfTest();
  return run(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
