#!/usr/bin/env node
/**
 * check-token-conflict — UI Standardization W0 / slice S2.
 *
 * WHAT IT CHECKS (scope "base", mode B of the plan):
 *   The same CSS custom property is declared in MORE THAN ONE base block with
 *   DIFFERENT values. Base blocks = `@theme { }` + every `:root { }` (NO
 *   attribute selector) of exactly 3 pinned files:
 *     packages/web/src/index.css
 *     packages/web/src/theme/tokens.css
 *     packages/web/src/components/soc/soc.tokens.css
 *   `:root[data-theme="light"]` blocks are DELIBERATELY EXCLUDED — a light
 *   override is an intentional re-definition, not a conflict.
 *
 * Scope "root-only" (mode A) = the same, but the `@theme` block is skipped.
 *
 * WHY IT IS A GATE AND NOT A NOTE: the plan measured 13 conflicts (mode B) /
 * 11 (mode A) on `dev@e7b008f25`. Those conflicts have a RUNTIME cost: the
 * same `--bg-panel` resolves to `#0f172a` on `/dashboard` and to
 * `rgba(8 23 52 / .4)` on `/admin/users` — same theme, different value,
 * depending on which CSS chunk the route loaded.
 *
 * BASELINE-LOCKED (same contract as `scripts/check-lessons.mjs`):
 *   exit 0  <=>  every violation found NOW is already in the baseline file
 *   exit 1  <=>  at least one NEW violation (regression)
 *   exit 2  <=>  cannot verify (missing file / unreadable baseline)
 * The comparison is on the SET of violation ids, never on a count, and the
 * baseline is NEVER raised automatically — `--update-baseline` must be run by
 * hand, and it prints a loud warning.
 *
 * `--self-test` proves the gate really catches the known case
 * `--shadow-sm` conflicting between `@theme` and `:root` (plan AC-2).
 *
 * Usage:
 *   node packages/web/scripts/check-token-conflict.mjs
 *   node packages/web/scripts/check-token-conflict.mjs --scope root-only
 *   node packages/web/scripts/check-token-conflict.mjs --print-count
 *   node packages/web/scripts/check-token-conflict.mjs --self-test
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..", "..", "..");
const GATE = "check-token-conflict";

/** Scope of the check — pinned to 3 files, never "scan the whole repo". */
const FILES = [
  "packages/web/src/index.css",
  "packages/web/src/theme/tokens.css",
  "packages/web/src/components/soc/soc.tokens.css",
];

const SCOPES = {
  base: { label: "mode B (@theme + moi khoi :root)", skipTheme: false },
  "root-only": { label: "mode A (chi :root thuan)", skipTheme: true },
};

// ───────────────────────────────────────────────────────────── CSS parsing ────

/**
 * Extract the base blocks of a CSS file.
 *   - `@theme { ... }`  → kind "@theme"
 *   - `:root { ... }`   → kind ":root"
 *   - `:root[...] { }`  → SKIPPED (light-theme override = intentional)
 * Brace matching is done by counting so a nested block cannot break it.
 */
function baseBlocks(src) {
  const out = [];
  const re = /(^|[^-\w])(@theme|:root)(?![\w-])/g;
  let m;
  while ((m = re.exec(src))) {
    const after = m.index + m[0].length;
    // skip whitespace/comments between the selector and `{`
    let i = after;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] !== "{") continue;
    // a `:root` followed by `[` is an attribute selector → light override
    if (m[2] === ":root" && src[after] === "[") continue;
    const start = i + 1;
    let depth = 1;
    let j = start;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") depth -= 1;
      j += 1;
    }
    out.push({
      kind: m[2],
      body: src.slice(start, j - 1),
      // `m.index` points at the character BEFORE the keyword (the regex eats
      // it) — using it would report every block one line too early.
      line: src.slice(0, m.index + m[0].length - m[2].length).split("\n").length,
    });
    re.lastIndex = j;
  }
  return out;
}

/**
 * Parse the declarations of a block body.
 * Values may span several lines (`--font-sans:\n  a, b;`) so the splitter has
 * to respect parenthesis depth — a naive line-based regex silently DROPS
 * every multi-line declaration and would under-count the conflicts.
 */
function declarations(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  const chunks = [];
  let depth = 0;
  let cur = "";
  let line = 1;
  let chunkLine = 1;
  for (const ch of clean) {
    if (ch === "\n") {
      line += 1;
      if (cur.trim() === "") chunkLine = line;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) {
      chunks.push({ raw: cur, line: chunkLine });
      cur = "";
      chunkLine = line;
      continue;
    }
    if (cur.trim() === "" && !/\s/.test(ch)) chunkLine = line;
    cur += ch;
  }
  if (cur.trim()) chunks.push({ raw: cur, line: chunkLine });

  const out = [];
  for (const c of chunks) {
    const i = c.raw.indexOf(":");
    if (i < 0) continue;
    const name = c.raw.slice(0, i).trim();
    if (!/^--[A-Za-z0-9_-]+$/.test(name)) continue;
    const value = c.raw.slice(i + 1).replace(/\s+/g, " ").replace(/\s*!important$/, "").trim();
    out.push({ name, value, line: c.line });
  }
  return out;
}

// ────────────────────────────────────────────────────────── the measurement ───

function collectConflicts(repo, scopeKey) {
  const scope = SCOPES[scopeKey];
  const byName = new Map();
  for (const rel of FILES) {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) {
      const err = new Error(`khong tim thay file trong scope: ${rel}`);
      err.code = "ENOENT_SCOPE_FILE";
      throw err;
    }
    const src = fs.readFileSync(abs, "utf8");
    for (const blk of baseBlocks(src)) {
      if (scope.skipTheme && blk.kind === "@theme") continue;
      for (const d of declarations(blk.body)) {
        if (!byName.has(d.name)) byName.set(d.name, []);
        byName.get(d.name).push({ file: rel, line: blk.line, value: d.value, kind: blk.kind });
      }
    }
  }

  const violations = [];
  for (const [name, defs] of byName) {
    const values = new Set(defs.map((d) => d.value));
    if (values.size < 2) continue;
    const detail = defs
      .map((d) => `${d.file}:${d.line} (${d.kind}) = ${d.value}`)
      .join("  ||  ");
    // The id carries the VALUES, not only the name: a conflict whose value
    // changed is a DIFFERENT defect (that is the one that breaks a route),
    // and comparing names only would let it pass unnoticed.
    const fingerprint = crypto
      .createHash("sha1")
      .update([...values].sort().join("|"))
      .digest("hex")
      .slice(0, 8);
    violations.push({ id: `${name}@${fingerprint}`, detail });
  }
  violations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return violations;
}

// ───────────────────────────────────────────────────────────── baseline io ───

function baselinePath(repo, scopeKey) {
  const name = scopeKey === "base" ? `${GATE}.json` : `${GATE}.${scopeKey}.json`;
  return path.join(repo, "packages", "web", "scripts", "check-ui-baseline", name);
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

function writeBaseline(file, scopeKey, violations) {
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    gate: GATE,
    scope: scopeKey,
    scopeLabel: SCOPES[scopeKey].label,
    measuredAt: new Date().toISOString(),
    files: FILES,
    violations: violations.map((v) => v.id),
    details: Object.fromEntries(violations.map((v) => [v.id, v.detail])),
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

// ─────────────────────────────────────────────────────────────── cli ─────────

function parseArgs(argv) {
  const out = { scope: "base", printCount: false, selfTest: false, update: false, repo: DEFAULT_REPO, baseline: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--scope") out.scope = argv[++i];
    else if (a === "--repo") out.repo = path.resolve(argv[++i]);
    else if (a === "--baseline") out.baseline = path.resolve(argv[++i]);
    else if (a === "--print-count") out.printCount = true;
    else if (a === "--self-test") out.selfTest = true;
    else if (a === "--update-baseline") out.update = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`check-token-conflict: tham so khong ro: ${a}`);
      process.exit(2);
    }
  }
  if (!SCOPES[out.scope]) {
    console.error(`check-token-conflict: --scope khong hop le (${Object.keys(SCOPES).join("|")}): ${out.scope}`);
    process.exit(2);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────── run ─────────

function run(opts) {
  const scope = opts.scope;
  let violations;
  try {
    violations = collectConflicts(opts.repo, scope);
  } catch (err) {
    console.error(`check-token-conflict: KHONG VERIFY DUOC — ${err.message}`);
    return 2;
  }

  const bFile = opts.baseline || baselinePath(opts.repo, scope);

  if (opts.update) {
    const payload = writeBaseline(bFile, scope, violations);
    console.log(
      `check-token-conflict: DA GHI BASELINE ${bFile} (${payload.violations.length} vi pham, scope ${scope}).`,
    );
    console.log("  ⚠ Baseline da DUOC NANG len — chi lam vay khi vi pham cu da duoc SUA that.");
    console.log("  ⚠ Gate chi chan khi tap vi pham MOI xuat hien; nang baseline de 'lam xanh' la bi cam.");
    return 0;
  }

  const baseline = readBaseline(bFile);
  if (!baseline) {
    console.error(
      `check-token-conflict: KHONG VERIFY DUOC — thieu baseline ${bFile}. ` +
        `Chay 1 lan voi --update-baseline de tao baseline, roi commit file do.`,
    );
    return 2;
  }

  const current = new Set(violations.map((v) => v.id));
  const known = new Set(baseline.violations || []);
  const fresh = violations.filter((v) => !known.has(v.id));
  const gone = [...known].filter((id) => !current.has(id));

  if (opts.printCount) {
    console.log(String(violations.length));
    return 0;
  }

  console.log(
    `check-token-conflict [scope=${scope} · ${SCOPES[scope].label}] — ${violations.length} vi pham hien tai ` +
      `| baseline ${known.size} | file: ${path.relative(opts.repo, bFile).split(path.sep).join("/")}`,
  );
  if (violations.length === 0) {
    console.log("  (khong co vi pham)");
  } else {
    console.log("  TAP VI PHAM HIEN TAI:");
    for (const v of violations) console.log(`    ${v.id}  ${v.detail}`);
  }
  if (fresh.length) {
    console.error(`\n  ✗ ${fresh.length} VI PHAM MOI (khong co trong baseline):`);
    for (const v of fresh) console.error(`    ${v.id}  ${v.detail}`);
    console.error("  ✗ REGRESSION — gate that.");
    return 1;
  }
  if (gone.length) {
    console.log(
      `  ℹ ${gone.length} vi pham trong baseline da het (da duoc sua): ${gone.join(", ")}`,
    );
    console.log("    ⇒ co the hạ baseline bang: node packages/web/scripts/check-token-conflict.mjs --update-baseline");
  }
  console.log("  ✓ khong co vi pham MOI — gate xanh (tap vi pham ⊆ baseline).");
  return 0;
}

// ───────────────────────────────────────────────────────────── self-test ─────

function runSelf(args) {
  // Strip GIT_* — a git hook exports them to every child process, so a
  // self-test that depends on the caller's environment is "PASS when typed,
  // FAIL under the hook" (lesson 17 of agent-lessons).
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    encoding: "utf8",
    env,
    shell: false,
  });
  return { code: res.status ?? -1, out: `${res.stdout || ""}${res.stderr || ""}` };
}

/**
 * Build a SYNTHETIC repo tree with the 3 scoped files.
 *
 * Synthetic on purpose: the real repo already contains 13 conflicts, so a
 * fixture copied from it would already have `--shadow-sm` in the baseline and
 * a mutation of its value would NOT be a "new violation" — the gate would
 * (correctly) stay green and the self-test would prove nothing.
 */
const FIXTURE_FILES = {
  "packages/web/src/index.css": [
    "@theme {",
    "  --color-bg-primary: #020617;",
    "  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);",
    "}",
    "",
  ].join("\n"),
  "packages/web/src/theme/tokens.css": [
    ":root {",
    "  --text-primary: #f1f5f9;",
    "}",
    "",
    ':root[data-theme="light"] {',
    "  --text-primary: #0f172a;",
    "}",
    "",
  ].join("\n"),
  "packages/web/src/components/soc/soc.tokens.css": [":root {", "  --accent-cyan: #22d3ee;", "}", ""].join("\n"),
};

function buildFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "check-token-conflict-"));
  for (const [rel, body] of Object.entries(FIXTURE_FILES)) {
    const dst = path.join(root, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, body, "utf8");
  }
  return root;
}

function selfTest() {
  console.log("check-token-conflict SELF-TEST — chay tren ban sao tam, assert gate BAT\n");
  let failures = 0;
  let total = 0;

  const probe = (name, mutate, expectCode, expectText) => {
    total += 1;
    // Baseline is ALWAYS measured on the PRISTINE copy — otherwise the
    // mutation would be baked into the baseline and the gate would (rightly)
    // report "no new violation". That is exactly the "raise the baseline to
    // hide the regression" anti-pattern the plan forbids.
    const root = buildFixture();
    const bFile = path.join(root, "baseline.json");
    const measured = runSelf(["--repo", root, "--baseline", bFile, "--update-baseline"]);
    const measuredCount = Number((measured.out.match(/DA GHI BASELINE[^\n]*\((\d+)/) || [])[1]);
    // now inject the known violation
    if (mutate) mutate(root);
    const res = runSelf(["--repo", root, "--baseline", bFile]);
    rmSync(root, { recursive: true, force: true });
    const ok =
      expectCode === 0
        ? res.code === 0
        : res.code !== 0 && (!expectText || res.out.includes(expectText));
    if (ok) {
      console.log(`  ok   ${name}  exit=${res.code} (baseline do ${measuredCount ?? "?"} vi pham)`);
    } else {
      failures += 1;
      console.log(
        `  FAIL ${name}\n        mong doi ${expectCode === 0 ? "exit 0" : `exit != 0 chua '${expectText}'`}, nhan exit=${res.code}\n${res.out.trim()}`,
      );
    }
  };

  const appendToSocRoot = (root, line) => {
    const f = path.join(root, "packages/web/src/components/soc/soc.tokens.css");
    const src = fs.readFileSync(f, "utf8");
    fs.writeFileSync(f, src.replace(":root {", `:root {\n  ${line}`), "utf8");
  };

  // CONTROL — the fixture has no conflict at all → the gate must stay green.
  probe("CONTROL: fixture sach → exit 0", null, 0, null);

  // The known case from the plan (AC-2): `--shadow-sm` conflicting between
  // `@theme` (index.css) and `:root` (soc.tokens.css).
  probe(
    "CASE: --shadow-sm xung dot giua @theme va :root → exit != 0",
    (root) => appendToSocRoot(root, "--shadow-sm: 0 2px 8px rgba(0 0 0 / 0.15);"),
    1,
    "--shadow-sm",
  );

  // A second, independent case: a token that only exists in `:root` blocks.
  probe(
    "CASE: --text-primary xung dot giua 2 khoi :root → exit != 0",
    (root) => appendToSocRoot(root, "--text-primary: #e2e8f0;"),
    1,
    "--text-primary",
  );

  // NEGATIVE case: a light-theme override is NOT a conflict.
  probe(
    "CASE: --shadow-sm trong :root[data-theme=light] → van exit 0",
    (root) => {
      const f = path.join(root, "packages/web/src/theme/tokens.css");
      const src = fs.readFileSync(f, "utf8");
      fs.writeFileSync(
        f,
        src.replace(
          ':root[data-theme="light"] {',
          ':root[data-theme="light"] {\n  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.02);',
        ),
        "utf8",
      );
    },
    0,
    null,
  );

  if (failures) {
    console.error(`\ncheck-token-conflict SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-token-conflict SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────── main ─────────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      "Usage: node packages/web/scripts/check-token-conflict.mjs [--scope base|root-only] [--print-count] [--update-baseline] [--self-test]",
    );
    return 0;
  }
  if (opts.selfTest) return selfTest();
  return run(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
