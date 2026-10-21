#!/usr/bin/env node
/**
 * check-light-theme.mjs - LIGHT THEME COVERAGE GATE (UI Standardization W1, T3)
 *
 * WHAT IT CHECKS
 *   The light theme of this app is implemented as a PROPERTY-SCOPED override
 *   (the pattern the repo already uses in `index.css:302-389`): for every
 *   Tailwind colour utility used in `packages/web/src`, the light theme must
 *   provide a light-mode value for the SAME property (text / bg / border).
 *
 *   Without this gate a new `bg-slate-900` in a new file silently keeps a dark
 *   surface in light mode -> light text on a light canvas -> invisible UI.
 *   That is exactly the defect class the ADR measured (28/60 samples under AA).
 *
 * WHY PROPERTY-SCOPED (and not a palette remap)
 *   `--color-slate-950` is used BOTH as text (`text-slate-950`, admin) and as a
 *   surface (`bg-slate-950`, 36 files). Remapping the variable would break the
 *   admin text. Remapping per property keeps both.
 *
 * MODES
 *   node packages/web/scripts/check-light-theme.mjs            # check (gate)
 *   node packages/web/scripts/check-light-theme.mjs --update   # rewrite the CSS
 *   node packages/web/scripts/check-light-theme.mjs --self-test
 *
 * EXIT CODES
 *   0  covered
 *   1  a colour utility is used but NOT covered in light mode
 *   2  could not verify (missing file / bad state)
 *
 * The file is written in ASCII on purpose: the repo runs on Windows and a
 * PowerShell round-trip can double-encode UTF-8 comments.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..", "..", "..");
const GATE = "check-light-theme";
const SRC = path.join("packages", "web", "src");
const CSS_OUT = path.join("packages", "web", "src", "theme", "light-theme.css");

// -- mapping tables -----------------------------------------------------------
// Light-mode value per (property, palette, shade). Values come from the SSOT
// light palette in `packages/web/src/theme/tokens.css:65-71`
// (--text-primary #0f172a | --text-secondary #334155 | --bg-panel #ffffff |
//  --bg-panel-soft #f8fafc | --border-default #e2e8f0 | --accent-blue #2563eb).
//
// Dark shades (slate-700+) are already dark enough in light mode (admin uses
// `text-slate-950` on `bg-white`) so they are NOT overridden - that is exactly
// why the mapping is per property, not per variable.

/** text: bright (dark-mode) text must become DARK in light mode. */
const TEXT_LIGHT = {
  white: "#0f172a",
  slate: { 100: "#1e293b", 200: "#334155", 300: "#475569", 400: "#475569", 500: "#64748b", 600: "#334155" },
  gray: { 300: "#475569", 400: "#475569", 500: "#475569" },
  sky: { 200: "#0369a1", 300: "#0369a1", 400: "#0369a1" },
  cyan: { 200: "#0e7490", 300: "#0e7490", 400: "#0e7490", 500: "#0e7490", 600: "#155e75", 700: "#155e75" },
  emerald: { 200: "#047857", 300: "#047857", 400: "#047857", 500: "#047857", 600: "#065f46", 700: "#065f46" },
  teal: { 300: "#0f766e", 400: "#0f766e", 500: "#0f766e", 600: "#115e59" },
  green: { 300: "#15803d", 400: "#15803d", 500: "#15803d", 600: "#166534" },
  rose: { 200: "#be123c", 300: "#be123c", 400: "#be123c", 500: "#be123c", 600: "#be123c", 700: "#9f1239" },
  red: { 300: "#b91c1c", 400: "#b91c1c", 500: "#b91c1c", 600: "#b91c1c" },
  amber: { 200: "#b45309", 300: "#b45309", 400: "#b45309", 500: "#b45309", 600: "#b45309", 700: "#92400e" },
  orange: { 300: "#c2410c", 400: "#c2410c", 500: "#c2410c" },
  yellow: { 300: "#a16207", 400: "#a16207", 500: "#a16207" },
  blue: { 300: "#1d4ed8", 400: "#1d4ed8", 500: "#1d4ed8", 600: "#1d4ed8" },
  indigo: { 300: "#4338ca", 400: "#4338ca", 500: "#4338ca" },
  violet: { 300: "#6d28d9", 400: "#6d28d9", 500: "#6d28d9" },
  purple: { 300: "#6d28d9", 400: "#6d28d9", 500: "#6d28d9" },
  lime: { 300: "#4d7c0f", 400: "#4d7c0f" },
  zinc: { 300: "#52525b", 400: "#52525b" },
  neutral: { 300: "#52525b", 400: "#52525b" },
  stone: { 300: "#57534e", 400: "#57534e" },
};

/** bg: dark surfaces must become LIGHT in light mode (alpha kept). */
const BG_LIGHT = {
  white: "#ffffff",
  slate: {
    50: "#ffffff", 100: "#ffffff", 200: "#f8fafc", 300: "#f1f5f9", 400: "#e2e8f0",
    500: "#cbd5e1", 600: "#cbd5e1", 700: "#e2e8f0", 800: "#e2e8f0", 900: "#f1f5f9", 950: "#ffffff",
  },
  gray: { 50: "#ffffff", 100: "#ffffff", 200: "#f8fafc", 300: "#f1f5f9", 800: "#e2e8f0", 900: "#f1f5f9", 950: "#ffffff" },
  zinc: { 50: "#ffffff", 100: "#ffffff", 200: "#f8fafc", 800: "#e2e8f0", 900: "#f1f5f9", 950: "#ffffff" },
  neutral: { 50: "#ffffff", 100: "#ffffff", 200: "#f8fafc", 800: "#e2e8f0", 900: "#f1f5f9", 950: "#ffffff" },
  stone: { 50: "#ffffff", 100: "#ffffff", 200: "#f8fafc", 800: "#e2e8f0", 900: "#f1f5f9", 950: "#ffffff" },
  rose: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 500: "#f43f5e", 950: "#f43f5e" },
  red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 900: "#b91c1c", 950: "#b91c1c" },
  amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 900: "#b45309", 950: "#b45309" },
  yellow: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 900: "#a16207", 950: "#a16207" },
  orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 900: "#c2410c", 950: "#c2410c" },
  emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 500: "#10b981", 600: "#059669", 700: "#047857", 900: "#047857", 950: "#047857" },
  green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 900: "#15803d", 950: "#15803d" },
  teal: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 900: "#0f766e", 950: "#0f766e" },
  cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 900: "#0e7490", 950: "#0e7490" },
  sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 900: "#0369a1", 950: "#0369a1" },
  blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 900: "#1d4ed8", 950: "#1d4ed8" },
  indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 900: "#4338ca", 950: "#4338ca" },
  violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 900: "#6d28d9", 950: "#6d28d9" },
  purple: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 900: "#7e22ce", 950: "#7e22ce" },
  lime: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 900: "#4d7c0f", 950: "#4d7c0f" },
};

/** border: dark borders must become LIGHT in light mode (alpha kept). */
const BORDER_LIGHT = {
  white: "#cbd5e1",
  slate: { 100: "#e2e8f0", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#cbd5e1", 500: "#cbd5e1", 600: "#cbd5e1", 700: "#cbd5e1", 800: "#cbd5e1", 900: "#cbd5e1", 950: "#cbd5e1" },
  gray: { 100: "#e2e8f0", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#cbd5e1", 500: "#cbd5e1", 700: "#cbd5e1", 800: "#cbd5e1", 900: "#cbd5e1" },
  zinc: { 200: "#e2e8f0", 300: "#cbd5e1", 400: "#cbd5e1", 700: "#cbd5e1", 800: "#cbd5e1" },
  neutral: { 200: "#e2e8f0", 300: "#cbd5e1", 400: "#cbd5e1", 700: "#cbd5e1", 800: "#cbd5e1" },
  stone: { 200: "#e2e8f0", 300: "#cbd5e1", 400: "#cbd5e1", 700: "#cbd5e1", 800: "#cbd5e1" },
  rose: { 200: "#fecdd3", 300: "#fda4af", 500: "#fb7185", 700: "#e11d48", 900: "#e11d48" },
  red: { 200: "#fecaca", 300: "#fca5a5", 500: "#f87171", 700: "#dc2626", 900: "#dc2626" },
  amber: { 200: "#fde68a", 300: "#fcd34d", 500: "#fbbf24", 700: "#d97706", 900: "#d97706" },
  emerald: { 200: "#a7f3d0", 300: "#6ee7b7", 500: "#34d399", 700: "#059669", 900: "#059669" },
  green: { 200: "#bbf7d0", 300: "#86efac", 500: "#4ade80", 700: "#16a34a", 900: "#16a34a" },
  teal: { 200: "#99f6e4", 300: "#5eead4", 500: "#2dd4bf", 700: "#0d9488", 900: "#0d9488" },
  cyan: { 200: "#a5f3fc", 300: "#67e8f9", 500: "#22d3ee", 700: "#0891b2", 900: "#0891b2" },
  sky: { 200: "#bae6fd", 300: "#7dd3fc", 500: "#38bdf8", 700: "#0284c7", 900: "#0284c7" },
  blue: { 200: "#bfdbfe", 300: "#93c5fd", 500: "#60a5fa", 700: "#2563eb", 900: "#2563eb" },
  indigo: { 200: "#c7d2fe", 300: "#a5b4fc", 500: "#818cf8", 700: "#4f46e5", 900: "#4f46e5" },
  violet: { 200: "#ddd6fe", 300: "#c4b5fd", 500: "#a78bfa", 700: "#7c3aed", 900: "#7c3aed" },
  purple: { 200: "#e9d5ff", 300: "#d8b4fe", 500: "#c084fc", 700: "#9333ea", 900: "#9333ea" },
};

/** T1 - the app's own `--color-*` tokens get a light value. */
const TOKEN_LIGHT = {
  "--color-bg-primary": "#f8fafc",
  "--color-bg-secondary": "#ffffff",
  "--color-bg-tertiary": "#f1f5f9",
  "--color-bg-panel": "#ffffff",
  "--color-bg-panel-hover": "#f1f5f9",
  "--color-bg-input": "#ffffff",
  "--color-bg-input-hover": "#f8fafc",
  "--color-text-primary": "#0f172a",
  "--color-text-secondary": "#334155",
  "--color-text-muted": "#64748b",
  "--color-text-inverse": "#ffffff",
  "--color-border-primary": "#e2e8f0",
  "--color-border-secondary": "#cbd5e1",
  "--color-border-focus": "#2563eb",
  "--color-border-error": "#dc2626",
  "--color-accent-primary": "#0891b2",
  "--color-accent-secondary": "#0e7490",
  "--color-accent-hover": "#0e7490",
  // Semantic tones (W1-A): the bright tones are unreadable on a light canvas
  // (measured on staging build e03762ea8: success-500 = 2.54:1 on white).
  "--color-success-400": "#047857",
  "--color-success-500": "#047857",
  "--color-warning-400": "#b45309",
  "--color-warning-500": "#b45309",
  "--color-danger-400": "#b91c1c",
  "--color-danger-500": "#dc2626",
  "--color-info-400": "#1d4ed8",
  "--color-info-500": "#1d4ed8",
};

/**
 * Extra light rules that are NOT Tailwind utilities, so they cannot be
 * generated from the scan. `.th` (table header cell) takes its colour from a
 * CSS module, so the dark value survived in light mode (2.45:1 measured on
 * /admin/users, staging build e03762ea8, 2026-10-21).
 */
const EXTRA_LIGHT_RULES = [{ selector: ".th", decl: "color: #475569;" }];

const PROP_OF = { text: "color", bg: "background-color", border: "border-color" };
const PROP_ALIAS = { text: "text", bg: "bg", border: "border" };
const TABLES = { text: TEXT_LIGHT, bg: BG_LIGHT, border: BORDER_LIGHT };

// -- scanning ----------------------------------------------------------------
const CODE_EXT = /\.(tsx?|jsx?)$/;
const CSS_EXT = /\.css$/;
const TEST_RE = /(__tests__|\.test\.|\.spec\.)/;

/**
 * Tailwind colour utility in a class string:
 *   `text-slate-400` | `bg-slate-900/30` | `text-white` | `bg-white`
 * The palette token is either a bare name (`white`) or `<palette>-<shade>`.
 */
const UTIL_RE = /\b(text|bg|border)-(white|black|[a-z]+-\d{2,3})(\/(\d{1,3}))?\b/g;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function scan(repo) {
  const root = path.join(repo, SRC);
  if (!fs.existsSync(root)) {
    const err = new Error(`khong tim thay thu muc scope ${SRC}`);
    err.code = "NO_SCOPE";
    throw err;
  }
  const used = new Map(); // `${prop}:${palette}:${shade}` -> { alpha:Set, files:Set }
  let scanned = 0;
  for (const abs of walk(root)) {
    if (TEST_RE.test(abs.split(path.sep).join("/"))) continue;
    if (!CODE_EXT.test(abs) && !CSS_EXT.test(abs)) continue;
    scanned += 1;
    const rel = path.relative(repo, abs).split(path.sep).join("/");
    const src = fs.readFileSync(abs, "utf8");
    const chunks = [...src.matchAll(/["'`]([^"'`\n]{0,400})["'`]/g)].map((m) => m[1]);
    if (CSS_EXT.test(abs)) chunks.push(src);
    for (const chunk of chunks) {
      for (const m of chunk.matchAll(UTIL_RE)) {
        const prop = m[1];
        const paletteToken = m[2];
        const alpha = m[4] || "";
        const dash = paletteToken.lastIndexOf("-");
        const palette = dash > 0 ? paletteToken.slice(0, dash) : paletteToken;
        const shade = dash > 0 ? paletteToken.slice(dash + 1) : "";
        const key = `${prop}:${palette}:${shade}`;
        if (!used.has(key)) used.set(key, { alpha: new Set(), files: new Set() });
        const u = used.get(key);
        u.alpha.add(alpha);
        u.files.add(rel);
      }
    }
  }
  return { scanned, used };
}

/** The light value for a (prop, palette, shade), or null when it needs no override. */
function lightValue(prop, palette, shade) {
  const table = TABLES[prop];
  if (!table) return null;
  if (palette === "white") return table.white || null;
  const shades = table[palette];
  if (!shades) return null;
  return shades[shade] || null;
}

// -- css generation ----------------------------------------------------------
function buildCss(used) {
  const lines = [];
  lines.push("/* AUTO-GENERATED - sinh boi `node packages/web/scripts/check-light-theme.mjs --update`.");
  lines.push(" * KHONG sua tay. Muon doi: doi mapping trong script roi chay --update.");
  lines.push(" *");
  lines.push(" * Light theme = override THEO PROPERTY (khong remap bien palette) vi");
  lines.push(" * `--color-slate-950` duoc dung ca lam CHU (admin) lan lam NEN (36 file).");
  lines.push(" * Gia tri lay tu SSOT `packages/web/src/theme/tokens.css:65-71`.");
  lines.push(" */");
  lines.push("");
  lines.push("/* -- T1: token cua app (ho --color-*) -- */");
  lines.push(':root[data-theme="light"] {');
  for (const [k, v] of Object.entries(TOKEN_LIGHT)) lines.push(`  ${k}: ${v};`);
  lines.push("}");
  lines.push("");

  lines.push("/* -- rule light bo sung (khong phai class Tailwind) -- */");
  for (const extra of EXTRA_LIGHT_RULES) {
    lines.push(`:root[data-theme="light"] ${extra.selector} {`);
    lines.push(`  ${extra.decl}`);
    lines.push("}");
  }
  lines.push("");

  for (const prop of ["text", "bg", "border"]) {
    const groups = new Map(); // `${palette}-${shade}` -> { value, alphas:Set }
    for (const [key, u] of used) {
      const [p, palette, shade] = key.split(":");
      if (p !== prop) continue;
      const value = lightValue(prop, palette, shade);
      if (!value) continue;
      const gk = shade ? `${palette}-${shade}` : palette;
      if (!groups.has(gk)) groups.set(gk, { value, alphas: new Set() });
      for (const a of u.alpha) groups.get(gk).alphas.add(a);
    }
    if (!groups.size) continue;
    const decl = PROP_OF[prop];
    const alias = PROP_ALIAS[prop];
    lines.push(`/* -- T2: ${alias}-* -> gia tri sang -- */`);
    for (const [gk, g] of [...groups.entries()].sort()) {
      const plain = `.${alias}-${gk}`;
      // Alpha variants: Tailwind uses `color-mix(... N%, transparent)`; keeping the
      // alpha matters or translucent cards become OPAQUE in light mode.
      const alphas = [...g.alphas].filter((a) => a).sort((a, b) => Number(a) - Number(b));
      lines.push(`:root[data-theme="light"] ${plain} {`);
      lines.push(`  ${decl}: ${g.value};`);
      lines.push("}");
      for (const a of alphas) {
        lines.push(`:root[data-theme="light"] .${alias}-${gk}\\/${a} {`);
        lines.push(`  ${decl}: color-mix(in oklab, ${g.value} ${a}%, transparent);`);
        lines.push("}");
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// -- gate --------------------------------------------------------------------
function coverage(used, css) {
  const missing = [];
  for (const [key, u] of used) {
    const [prop, palette, shade] = key.split(":");
    const value = lightValue(prop, palette, shade);
    if (!value) continue; // this utility needs no light override (already dark)
    const gk = shade ? `${palette}-${shade}` : palette;
    const plain = `.${PROP_ALIAS[prop]}-${gk}`;
    if (!css.includes(plain)) {
      missing.push({ key, plain, files: [...u.files].slice(0, 4), count: u.files.size });
    }
  }
  return missing;
}

function parseArgs(argv) {
  const out = { update: false, selfTest: false, repo: DEFAULT_REPO };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--update") out.update = true;
    else if (a === "--self-test") out.selfTest = true;
    else if (a === "--repo") out.repo = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`check-light-theme: tham so khong ro: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function runSelf() {
  console.log("check-light-theme SELF-TEST - chay tren ban sao tam, assert gate BAT\n");
  let failures = 0;
  let total = 0;
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || ".", "check-light-theme-"));
  const mk = (files) => {
    for (const [rel, body] of Object.entries(files)) {
      const p = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body, "utf8");
    }
  };
  const sh = (args) => {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
      encoding: "utf8",
      cwd: tmp,
    });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
  };

  // CASE 0: no CSS generated yet => "khong verify duoc" (exit 2), NOT green.
  total += 1;
  mk({
    "packages/web/src/index.css": ":root { --color-bg-primary: #020617; }\n",
    "packages/web/src/pages/A.tsx": 'export const A = () => <div className="text-slate-950 bg-white" />;\n',
  });
  const noCss = sh(["--repo", tmp]);
  if (noCss.code === 2) console.log("  ok   CASE: chua sinh CSS -> exit 2 (khong verify duoc)");
  else {
    failures += 1;
    console.log(`  FAIL CASE: chua sinh CSS -> mong doi exit 2, nhan ${noCss.code}\n${noCss.out}`);
  }

  // CONTROL: clean fixture + generated CSS => 0 violations.
  total += 1;
  sh(["--repo", tmp, "--update"]);
  const ctl = sh(["--repo", tmp]);
  if (ctl.code === 0) console.log("  ok   CONTROL: fixture sach -> 0 vi pham -> exit 0");
  else {
    failures += 1;
    console.log(`  FAIL CONTROL: fixture sach -> mong doi exit 0, nhan ${ctl.code}\n${ctl.out}`);
  }

  // CASE: a dark colour utility that is NOT covered => gate must fail.
  total += 1;
  mk({
    "packages/web/src/pages/B.tsx": 'export const B = () => <div className="text-slate-400" />;\n',
  });
  const c1 = sh(["--repo", tmp]);
  if (c1.code === 1) console.log("  ok   CASE: text-slate-400 chua duoc phu -> exit 1");
  else {
    failures += 1;
    console.log(`  FAIL CASE: text-slate-400 chua duoc phu -> mong doi exit 1, nhan ${c1.code}\n${c1.out}`);
  }

  // CASE: after --update the class is covered => gate green.
  total += 1;
  const upd = sh(["--repo", tmp, "--update"]);
  const c2 = sh(["--repo", tmp]);
  if (upd.code === 0 && c2.code === 0) console.log("  ok   CASE: --update roi kiem lai -> exit 0");
  else {
    failures += 1;
    console.log(`  FAIL CASE: --update roi kiem lai -> update=${upd.code} check=${c2.code}\n${c2.out}`);
  }

  // CASE: a NEW class added later => gate must fail again (regression guard).
  total += 1;
  mk({
    "packages/web/src/pages/C.tsx": 'export const C = () => <div className="bg-slate-900" />;\n',
  });
  const c3 = sh(["--repo", tmp]);
  if (c3.code === 1) console.log("  ok   CASE: class moi them sau -> exit 1 (chong hoi quy)");
  else {
    failures += 1;
    console.log(`  FAIL CASE: class moi them sau -> mong doi exit 1, nhan ${c3.code}\n${c3.out}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  if (failures) {
    console.error(`\ncheck-light-theme SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-light-theme SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("Usage: node packages/web/scripts/check-light-theme.mjs [--update] [--self-test]");
    return 0;
  }
  if (opts.selfTest) return runSelf();

  let scanResult;
  try {
    scanResult = scan(opts.repo);
  } catch (err) {
    console.error(`check-light-theme: KHONG VERIFY DUOC - ${err.message}`);
    return 2;
  }
  const cssPath = path.join(opts.repo, CSS_OUT);

  if (opts.update) {
    const css = buildCss(scanResult.used);
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, css, "utf8");
    console.log(`check-light-theme: DA GHI ${path.relative(opts.repo, cssPath)} (${css.split("\n").length} dong).`);
    console.log("  Sinh lai bang script - KHONG sua tay (nguon suyet = mapping trong script).");
    return 0;
  }

  if (!fs.existsSync(cssPath)) {
    console.error(
      `check-light-theme: KHONG VERIFY DUOC - thieu ${path.relative(opts.repo, cssPath)}. ` +
        `Chay 1 lan voi --update de sinh, roi commit file do.`,
    );
    return 2;
  }
  const css = fs.readFileSync(cssPath, "utf8");
  const missing = coverage(scanResult.used, css);

  console.log(
    `check-light-theme - ${scanResult.used.size} mau Tailwind dung trong ${scanResult.scanned} file ` +
      `| file: ${path.relative(opts.repo, cssPath).split(path.sep).join("/")}`,
  );
  if (!missing.length) {
    console.log("  OK - moi mau deu duoc phu o light mode (theo property).");
    return 0;
  }
  console.error(`\n  X ${missing.length} mau CHUA duoc phu o light mode:`);
  for (const m of missing) {
    console.error(`    ${m.plain}  (${m.count} file, vd ${m.files.join(", ")})`);
  }
  console.error("  X REGRESSION - mau moi/toi se giu mau toi o light mode => chu khong doc.");
  console.error("  X Chay: node packages/web/scripts/check-light-theme.mjs --update");
  return 1;
}

process.exit(main());
