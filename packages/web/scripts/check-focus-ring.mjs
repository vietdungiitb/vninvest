#!/usr/bin/env node
/**
 * check-focus-ring — UI Standardization W0 / slice S2.
 *
 * WHAT IT CHECKS: a class string (or a CSS `:focus` rule) that REMOVES the
 * browser focus outline (`focus:outline-none` / `focus-visible:outline-none`
 * / `outline: none`) WITHOUT putting a visible replacement in its place
 * (a `ring`, a `shadow` or a `border` on the same selector).
 *
 * Removing the outline without a replacement makes the control unusable for
 * keyboard users — the exact defect measured on the 2 files below.
 *
 * SCOPE (pinned):
 *   packages/web/src/**  ·  .js/.jsx/.ts/.tsx (class strings)
 *   packages/web/src/**  ·  .css                (`:focus` rules)
 *   EXCLUDED: test files (`__tests__/`, `*.test.*`, `*.spec.*`)
 *   Measured on `dev@e7b008f25`: **2 violating files**
 *     packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx
 *     packages/web/src/components/dashboard/PortfolioHeatmap.js
 *   Both are OUTSIDE the W0 scope — the owner of the fix is W1–W3.
 *
 * GRANULARITY: the contract is per FILE ("this file removes the focus ring
 * without a replacement"), so the violation id is the file path. That keeps
 * the id stable when a line moves — a line-number id would report a false
 * regression every time an unrelated line is inserted above it.
 *
 * BASELINE-LOCKED (contract of `scripts/check-lessons.mjs`):
 *   exit 0 <=> every violating file found NOW is already in the baseline
 *   exit 1 <=> at least one NEW violating file (regression)
 *   exit 2 <=> cannot verify
 *
 * Usage:
 *   node packages/web/scripts/check-focus-ring.mjs
 *   node packages/web/scripts/check-focus-ring.mjs --print-violations
 *   node packages/web/scripts/check-focus-ring.mjs --update-baseline
 *   node packages/web/scripts/check-focus-ring.mjs --self-test
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..", "..", "..");
const GATE = "check-focus-ring";

const SRC = path.join("packages", "web", "src");
const CODE_EXT = /\.(jsx?|tsx?)$/;
const TEST_RE = /(__tests__|\.test\.|\.spec\.)/;

/** The class string removes the outline ... */
const KILLS_OUTLINE = /focus(-visible)?:outline-none/;
/**
 * ... and nothing on the same selector puts a replacement back.
 *
 * `ring-none` / `shadow-none` / `border-none` REMOVE the indicator, they do
 * not replace it. Counting them as a replacement is the most common way to
 * make this gate green while the focus ring is still gone.
 */
const HAS_REPLACEMENT = /(^|[^a-z-])(ring(?!-none)|shadow(?!-none)|border(?!-none))/;
/** Inline style that removes the outline (`style={{ outline: "none" }}`). */
const INLINE_OUTLINE_KILL = /outline\s*:\s*["'`]none["'`]/;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Extract the string literals of a JS/TS source file.
 * A template literal that spans several lines is ONE literal — the class
 * string of `CoreDashboardPositionDeck.tsx:288-292` contains `border` in one
 * of its conditional branches, so it is NOT a violation, and splitting it per
 * line would produce a false positive.
 */
function literals(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const start = i;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === c) { i += 1; break; }
        else i += 1;
      }
      out.push({ text: src.slice(start + 1, i - 1), line: src.slice(0, start).split("\n").length });
    } else if (c === "`") {
      const start = i;
      i += 1;
      let depth = 0;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{") { depth += 1; i += 2; continue; }
        if (src[i] === "}" && depth > 0) { depth -= 1; i += 1; continue; }
        if (src[i] === "`" && depth === 0) { i += 1; break; }
        i += 1;
      }
      out.push({ text: src.slice(start + 1, i - 1), line: src.slice(0, start).split("\n").length });
    } else i += 1;
  }
  return out;
}

function collect(repo) {
  const root = path.join(repo, SRC);
  if (!fs.existsSync(root)) {
    const err = new Error(`khong tim thay thu muc scope ${SRC}`);
    err.code = "NO_SCOPE";
    throw err;
  }
  const all = walk(root);
  const isTest = (f) => TEST_RE.test(f.split(path.sep).join("/"));

  const violations = [];
  let scanned = 0;

  for (const abs of all) {
    if (isTest(abs)) continue;
    if (CODE_EXT.test(abs)) {
      scanned += 1;
      const rel = path.relative(repo, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      const lits = literals(src);
      const hits = lits.filter((l) => KILLS_OUTLINE.test(l.text) && !HAS_REPLACEMENT.test(l.text));
      // `style={{ outline: "none" }}` removes the ring without any class.
      // The key and the value are SEPARATE string literals, so the pattern has
      // to be matched on the raw source, not on the literals.
      const inline = [];
      const inlineRe = /outline\s*:\s*["'`]none["'`]/g;
      let im;
      while ((im = inlineRe.exec(src))) {
        const line = src.slice(0, im.index).split("\n").length;
        const around = src.slice(Math.max(0, im.index - 60), im.index + 40).replace(/\s+/g, " ");
        inline.push({ line, text: around });
      }
      if (!hits.length && !inline.length) continue;
      const allHits = [
        ...hits.map((h) => `dong ${h.line}: ${h.text.trim().slice(0, 90)}`),
        ...inline.map((h) => `dong ${h.line}: inline style ${h.text.trim().slice(0, 90)}`),
      ];
      violations.push({
        id: `${rel}#${allHits.length}`,
        detail: allHits.join(" | "),
      });
    } else if (/\.css$/.test(abs)) {
      scanned += 1;
      const rel = path.relative(repo, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      const re = /([^{}]*):focus(-visible)?[^{}]*\{([^{}]*)\}/g;
      let m;
      const hits = [];
      while ((m = re.exec(src))) {
        const body = m[3];
        // `outline: 0` removes the outline just like `outline: none`.
        if (!/outline\s*:\s*(none|0)\b/.test(body)) continue;
        // A declaration that removes the indicator is NOT a replacement:
        // `box-shadow: none` / `border-color: transparent` are no-ops.
        const effective = body
          .replace(/box-shadow\s*:\s*none\s*;?/gi, "")
          .replace(/border[^:;{}]*:\s*transparent\s*;?/gi, "")
          .replace(/border[^:;{}]*:\s*none\s*;?/gi, "")
          .replace(/outline\s*:\s*(none|0)\s*;?/gi, "");
        if (/box-shadow|border/.test(effective)) continue;
        hits.push(`dong ${src.slice(0, m.index).split("\n").length}: ${m[1].trim().slice(0, 70)}`);
      }
      if (!hits.length) continue;
      violations.push({ id: `${rel}#${hits.length}`, detail: hits.join(" | ") });
    }
  }
  violations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { scanned, violations };
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
    scope: SRC.split(path.sep).join("/"),
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
      console.error(`check-focus-ring: tham so khong ro: ${a}`);
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
    console.error(`check-focus-ring: KHONG VERIFY DUOC — ${err.message}`);
    return 2;
  }

  const bFile = opts.baseline || baselinePath(opts.repo);

  if (opts.update) {
    const payload = writeBaseline(bFile, scanned, violations);
    console.log(
      `check-focus-ring: DA GHI BASELINE ${bFile} (${payload.violations.length} vi pham / ${scanned} file da quet).`,
    );
    console.log("  ⚠ Baseline da DUOC NANG len — chi lam vay khi vi pham cu da duoc SUA that.");
    return 0;
  }

  const baseline = readBaseline(bFile);
  if (!baseline) {
    console.error(
      `check-focus-ring: KHONG VERIFY DUOC — thieu baseline ${bFile}. ` +
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
    `check-focus-ring — ${violations.length} vi pham / ${scanned} file da quet ` +
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
    for (const v of fresh) console.error(`    ${v.id}  ${v.detail}`);
    console.error("  ✗ REGRESSION — gate that.");
    return 1;
  }
  if (gone.length) {
    console.log(`  ℹ ${gone.length} vi pham trong baseline da het: ${gone.join(", ")}`);
    console.log("    ⇒ co the ha baseline bang: node packages/web/scripts/check-focus-ring.mjs --update-baseline");
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

function buildFixture(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "check-focus-ring-"));
  for (const [rel, body] of Object.entries(files)) {
    const dst = path.join(root, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, body, "utf8");
  }
  return root;
}

function selfTest() {
  console.log("check-focus-ring SELF-TEST — chay tren ban sao tam, assert gate BAT\n");
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

  const P = path.join("packages", "web", "src", "components", "demo");
  const CLEAN = {
    [path.join(P, "OkButton.tsx")]: 'export const B = () => <button className="focus:outline-none focus:ring-2 focus:ring-primary-400" />;\n',
  };

  probe("CONTROL: co focus:ring thay the → exit 0", CLEAN, null, 0, null);

  probe(
    "CASE: focus:outline-none khong co ring → exit != 0",
    CLEAN,
    (root) => {
      const p = path.join(root, P, "BadButton.tsx");
      writeFileSync(p, 'export const B = () => <button className="p-2 rounded-lg focus:outline-none" />;\n', "utf8");
    },
    1,
    "BadButton.tsx",
  );

  probe(
    "CASE: focus-visible:outline-none khong co ring → exit != 0",
    CLEAN,
    (root) => {
      const p = path.join(root, P, "BadButton2.tsx");
      writeFileSync(p, 'export const B = () => <button className="focus-visible:outline-none" />;\n', "utf8");
    },
    1,
    "BadButton2.tsx",
  );

  probe(
    "CASE: CSS :focus { outline: none } khong co box-shadow → exit != 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "styles", "bad.css");
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, ".x:focus {\n  outline: none;\n}\n", "utf8");
    },
    1,
    "bad.css",
  );

  probe(
    "NEGATIVE: CSS :focus { outline: none; box-shadow: ... } → van exit 0",
    CLEAN,
    (root) => {
      const p = path.join(root, "packages", "web", "src", "styles", "ok.css");
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, ".x:focus {\n  outline: none;\n  box-shadow: 0 0 0 2px #06b6d4;\n}\n", "utf8");
    },
    0,
    null,
  );

  probe(
    "NEGATIVE: template literal nhieu dong co border → van exit 0",
    CLEAN,
    (root) => {
      const p = path.join(root, P, "Tpl.tsx");
      writeFileSync(
        p,
        "export const B = ({on}) => (\n  <button\n    className={`flex items-center gap-2 ${\n      on ? 'bg-emerald-600/20 border border-emerald-500/30'\n      : 'text-slate-500 border border-transparent'\n    } focus-visible:outline-none`}\n  />\n);\n",
        "utf8",
      );
    },
    0,
    null,
  );

  if (failures) {
    console.error(`\ncheck-focus-ring SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-focus-ring SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

// ────────────────────────────────────────────────────────────────── main ───────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      "Usage: node packages/web/scripts/check-focus-ring.mjs [--print-violations] [--update-baseline] [--self-test]",
    );
    return 0;
  }
  if (opts.selfTest) return selfTest();
  return run(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
