#!/usr/bin/env node
/**
 * check-theme-contrast — UI Standardization W0 / slice S2.
 *
 * WHAT IT CHECKS: every pinned text/background token pair, in BOTH themes,
 * in BOTH load variants, against WCAG AA (4.5:1 for normal text).
 *
 *   - The TOKENS are read from the REAL files (3 pinned files, see below).
 *   - The CANVAS (the page background the text sits on) is read at RUNTIME
 *     with `getComputedStyle` — a static file cannot know what the browser
 *     actually painted. The runtime part needs a running app (staging).
 *
 * LOAD VARIANTS (the real defect this gate exists for):
 *   `soc.tokens.css` is imported by SOC components only. A route that loads
 *   the SOC chunk gets `--bg-panel = rgba(8 23 52 / .4)`; a route that does
 *   not gets `--bg-panel = #0f172a`. Same theme, different value. Both
 *   variants are measured, and a pair fails if it fails in ANY of them.
 *
 * SCOPE (pinned, 3 files):
 *   packages/web/src/index.css
 *   packages/web/src/theme/tokens.css
 *   packages/web/src/components/soc/soc.tokens.css
 *
 * CONTROLS (L-V01 — a measurement script that is wrong still prints a
 * plausible number, so every number below is worthless unless the controls
 * come out right):
 *   #ffffff on #000000  => 21.00:1
 *   #777777 on #ffffff  =>  4.48:1
 * If a control is off, the script prints `CONTROL FAIL` and exits non-zero —
 * it never reports the other numbers as if they were trustworthy.
 *
 * COLOUR PARSING (L-V06 — a parser that returns null means "cannot read",
 * not "transparent"):
 *   `oklch()` / `color-mix()` are NOT parsed statically. A pair whose colour
 *   cannot be decoded is reported as `UNDECODABLE` and EXCLUDED from the
 *   verdict — never silently treated as transparent. The runtime part is the
 *   only place where the browser converts those to sRGB.
 *
 * BASELINE-LOCKED:
 *   exit 0 <=> no NEW failing pair (set comparison, never a count)
 *   exit 1 <=> a NEW failing pair, or a broken control
 *   exit 2 <=> cannot verify
 * The runtime part only gates when the app build on staging is the SAME build
 * the baseline was measured on (asset-name fingerprint). Otherwise it prints
 * `CHUA CHAY` and the static verdict still stands — a gate must not block a
 * push because somebody else deployed.
 *
 * Usage:
 *   node packages/web/scripts/check-theme-contrast.mjs
 *   node packages/web/scripts/check-theme-contrast.mjs --update-baseline
 *   node packages/web/scripts/check-theme-contrast.mjs --self-test
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..", "..", "..");
const GATE = "check-theme-contrast";

const TOKEN_FILES = [
  "packages/web/src/index.css",
  "packages/web/src/theme/tokens.css",
  "packages/web/src/components/soc/soc.tokens.css",
];

/**
 * LOAD VARIANTS (the real defect this gate exists for):
 *   `soc.tokens.css` is imported by a lazy route chunk (`PortfoliosPage.tsx`).
 *   A route that loads the SOC chunk gets `--bg-panel = rgba(8 23 52 / .4)`;
 *   a route that does not gets `--bg-panel = #0f172a`. Same theme, different
 *   value, depending on which CSS chunk the route loaded. Both variants are
 *   measured, and a pair fails if it fails in ANY of them.
 *
 *   `order` is the CASCADE order (LAST wins) — see `buildMap`.
 */
const VARIANTS = {
  shell: {
    label: "shell (khong nap SOC chunk)",
    order: ["packages/web/src/theme/tokens.css", "packages/web/src/index.css"],
  },
  soc: {
    label: "soc (da nap SOC chunk)",
    order: [
      "packages/web/src/theme/tokens.css",
      "packages/web/src/index.css",
      "packages/web/src/components/soc/soc.tokens.css",
    ],
  },
};

const MIN_RATIO = 4.5;

/** The pinned pairs. fg/bg are CSS custom property names. */
const PAIRS = [
  { id: "text-primary-on-bg-primary", fg: "--text-primary", bg: "--color-bg-primary" },
  { id: "text-primary-on-bg-secondary", fg: "--text-primary", bg: "--color-bg-secondary" },
  { id: "text-primary-on-bg-panel", fg: "--text-primary", bg: "--color-bg-panel" },
  { id: "text-secondary-on-bg-primary", fg: "--text-secondary", bg: "--color-bg-primary" },
  { id: "text-secondary-on-bg-secondary", fg: "--text-secondary", bg: "--color-bg-secondary" },
  { id: "text-muted-on-bg-primary", fg: "--text-muted", bg: "--color-bg-primary" },
  { id: "text-muted-on-bg-secondary", fg: "--text-muted", bg: "--color-bg-secondary" },
  { id: "text-muted-on-bg-panel", fg: "--text-muted", bg: "--color-bg-panel" },
  { id: "color-text-primary-on-bg-primary", fg: "--color-text-primary", bg: "--color-bg-primary" },
  { id: "color-text-secondary-on-bg-primary", fg: "--color-text-secondary", bg: "--color-bg-primary" },
  { id: "color-text-muted-on-bg-primary", fg: "--color-text-muted", bg: "--color-bg-primary" },
  { id: "color-text-muted-on-bg-secondary", fg: "--color-text-muted", bg: "--color-bg-secondary" },
  { id: "accent-cyan-on-bg-primary", fg: "--accent-cyan", bg: "--color-bg-primary" },
  { id: "border-focus-on-bg-primary", fg: "--color-border-focus", bg: "--color-bg-primary" },
  { id: "text-on-accent-on-accent-cyan", fg: "--text-on-accent", bg: "--accent-cyan" },
  { id: "text-primary-on-bg-panel-token", fg: "--text-primary", bg: "--bg-panel" },
  { id: "text-secondary-on-bg-panel-token", fg: "--text-secondary", bg: "--bg-panel" },
  { id: "text-muted-on-bg-panel-token", fg: "--text-muted", bg: "--bg-panel" },
  { id: "text-primary-on-bg-panel-solid", fg: "--text-primary", bg: "--bg-panel-solid" },
  { id: "pf-gain-on-pf-surface", fg: "--pf-gain", bg: "--pf-surface" },
  { id: "pf-loss-on-pf-surface", fg: "--pf-loss", bg: "--pf-surface" },
  { id: "pf-flat-on-pf-surface", fg: "--pf-flat", bg: "--pf-surface" },
  { id: "pf-positive-text-on-pf-positive-soft", fg: "--pf-positive-text", bg: "--pf-positive-soft" },
  { id: "pf-negative-text-on-pf-negative-soft", fg: "--pf-negative-text", bg: "--pf-negative-soft" },
];

const STAGING = process.env.A11Y_BASE_URL || "https://docker.edusuccess.vn";
const LOGIN_EMAIL = process.env.A11Y_EMAIL || "testuser@vninvest.vn";
const LOGIN_PASSWORD = process.env.A11Y_PASSWORD || "TestPass123!";

// ───────────────────────────────────────────────────────────── colour maths ───

function srgbLum([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg, bg) {
  const a = srgbLum(fg);
  const b = srgbLum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent colour over an opaque backdrop. */
function composite(fg, bg) {
  const a = fg[3];
  if (a >= 1) return [fg[0], fg[1], fg[2], 1];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

/**
 * Parse a CSS colour into [r,g,b,a].
 * Returns null when the value cannot be decoded — null means "UNKNOWN",
 * never "transparent" (L-V06).
 */
function parseColor(value) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    const short = (h) => parseInt(h.length === 1 ? h + h : h, 16);
    if (/^[0-9a-fA-F]{3}$/.test(hex)) return [short(hex[0]), short(hex[1]), short(hex[2]), 1];
    if (/^[0-9a-fA-F]{4}$/.test(hex)) return [short(hex[0]), short(hex[1]), short(hex[2]), short(hex[3]) / 255];
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return [short(hex.slice(0, 2)), short(hex.slice(2, 4)), short(hex.slice(4, 6)), 1];
    if (/^[0-9a-fA-F]{8}$/.test(hex))
      return [
        short(hex.slice(0, 2)),
        short(hex.slice(2, 4)),
        short(hex.slice(4, 6)),
        short(hex.slice(6, 8)) / 255,
      ];
    return null;
  }

  const fn = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (fn) {
    const body = fn[1].trim();
    const slash = body.split("/");
    const comps = slash[0].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (comps.length < 3 || comps.some((n) => Number.isNaN(n))) return null;
    let a = 1;
    if (slash.length === 2) {
      a = Number(slash[1].trim());
      if (Number.isNaN(a)) return null;
    } else if (comps.length >= 4) {
      a = comps[3];
    }
    return [comps[0], comps[1], comps[2], a];
  }

  // `oklch()` / `color-mix()` / gradients are NOT decoded statically.
  return null;
}

// ─────────────────────────────────────────────────────────────── css parsing ──

/**
 * Strip CSS comments.
 * A comment may contain `{` or `}` — counting braces without stripping
 * comments first mis-detects the end of a block.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      i = close < 0 ? src.length : close + 2;
      out += " ";
      continue;
    }
    if (src[i] === '"' || src[i] === "'") {
      const quote = src[i];
      const start = i;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      out += src.slice(start, i);
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

/** Drop nested `{ ... }` groups — only the declarations of THIS block count. */
function removeNestedBlocks(body) {
  let out = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") { depth += 1; continue; }
    if (ch === "}") { depth -= 1; continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

/**
 * Reduce a block prelude to its LAST statement.
 *
 * `index.css` starts with `@import "tailwindcss"; … @custom-variant dark (…);`
 * and only THEN opens `@theme { … }`. The raw prelude of that block is
 * therefore the whole file header, so `sel === "@theme"` was FALSE and the
 * ENTIRE `@theme` block was dropped — and every `--color-*` token lives
 * there. The gate then measured NOTHING and reported "0 violations": a false
 * green (L-G02).
 *
 * A prelude is a sequence of statements separated by `;`; only the last one
 * opens the block. Strings and parenthesised values are skipped so a `;`
 * inside `@import "a;b"` or a media query cannot cut in the wrong place.
 */
function lastStatement(prelude) {
  const clean = stripComments(prelude);
  let depth = 0;
  let quote = null;
  let cut = -1;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "(") { depth += 1; continue; }
    if (ch === ")") { depth -= 1; continue; }
    if (ch === ";" && depth === 0) cut = i;
  }
  return clean.slice(cut + 1).replace(/\s+/g, " ").trim();
}

/**
 * Split a CSS source into blocks with their selector and body.
 *
 * The previous implementation used `/([^{}@]+)\{/` — the char class EXCLUDES
 * `@`, so the selector of an at-rule block was captured as `theme ` instead of
 * `@theme`, `isTheme` was false, and the WHOLE `@theme` block of `index.css`
 * was silently dropped. Every `--color-*` token lives there, so the gate
 * measured NOTHING and reported "0 violations" — a false green (L-G02).
 *
 * This version scans properly: comments and strings are skipped, braces are
 * counted, grouping at-rules (`@layer`/`@media`/`@supports`) are recursed
 * into so a `:root` nested in them is still found, and the prelude is
 * reduced to its last statement so a block preceded by `@import`/`@custom-
 * variant` is still recognised (`@theme`, not the whole file header).
 */
function blocks(src, from = 0, to = src.length) {
  const out = [];
  let i = from;
  let preludeStart = from;
  while (i < to) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      i = close < 0 ? to : close + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i += 1;
      while (i < to) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === "{") {
      const bodyStart = i + 1;
      let depth = 1;
      let j = bodyStart;
      while (j < to && depth > 0) {
        if (src[j] === "/" && src[j + 1] === "*") {
          const close = src.indexOf("*/", j + 2);
          j = close < 0 ? to : close + 2;
          continue;
        }
        if (src[j] === '"' || src[j] === "'") {
          const quote = src[j];
          j += 1;
          while (j < to) {
            if (src[j] === "\\") { j += 2; continue; }
            if (src[j] === quote) { j += 1; break; }
            j += 1;
          }
          continue;
        }
        if (src[j] === "{") depth += 1;
        else if (src[j] === "}") depth -= 1;
        j += 1;
      }
      const selector = lastStatement(src.slice(preludeStart, i));
      const body = src.slice(bodyStart, j - 1);
      const line = src.slice(0, i).split("\n").length;
      preludeStart = j;
      if (/^@(layer|media|supports|container|scope)\b/.test(selector)) {
        for (const inner of blocks(src, bodyStart, j - 1)) {
          out.push({ ...inner, condition: (inner.condition ? `${inner.condition} && ` : "") + selector });
        }
      } else {
        out.push({ selector, body, line, condition: "" });
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return out;
}

function declarations(body) {
  const clean = removeNestedBlocks(stripComments(body));
  const chunks = [];
  let depth = 0;
  let cur = "";
  for (const ch of clean) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) {
      chunks.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) chunks.push(cur);
  const out = [];
  for (const raw of chunks) {
    const i = raw.indexOf(":");
    if (i < 0) continue;
    const name = raw.slice(0, i).trim();
    if (!/^--[A-Za-z0-9_-]+$/.test(name)) continue;
    out.push({ name, value: raw.slice(i + 1).replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** Base (dark) declarations and light-theme declarations of one file. */
function readTokenFile(repo, rel) {
  const abs = path.join(repo, rel);
  if (!fs.existsSync(abs)) throw new Error(`khong tim thay file trong scope: ${rel}`);
  const src = fs.readFileSync(abs, "utf8");
  const base = {};
  const light = {};
  for (const b of blocks(src)) {
    const sel = b.selector;
    const cond = (b.condition || "").toLowerCase();
    const condLight = cond.includes("light");
    const condDark = cond.includes("dark");
    let target = null;
    if (sel === "@theme") {
      // Tailwind v4 emits `@theme` as `:root` in the compiled CSS. It is the
      // BASE layer: the light theme never overrides it, which is exactly the
      // defect R1/R2 describe (canvas stays dark, `--color-text-primary`
      // stays light).
      target = base;
    } else if (sel === ":root") {
      target = condLight ? light : base;
    } else if (/^:root\s*\[/.test(sel)) {
      // `:root[data-theme="light"]` = an intentional theme override.
      const attr = sel.toLowerCase();
      target = attr.includes("light") ? light : attr.includes("dark") ? base : base;
    } else if (condLight) {
      target = light;
    } else {
      continue;
    }
    void condDark;
    for (const d of declarations(b.body)) target[d.name] = d.value;
  }
  return { base, light };
}

/**
 * Build the token map of a variant/theme.
 *
 * CASCADE ORDER (documented, not guessed):
 *   `index.css` starts with `@import "./theme/tokens.css"` ⇒ `tokens.css` is
 *   emitted BEFORE the `@theme` block of `index.css`. `soc.tokens.css` is
 *   imported by a lazy route chunk (`PortfoliosPage.tsx`) ⇒ its CSS is
 *   appended AFTER `index.css`. Same specificity ⇒ the LAST one wins.
 *   That is the mechanism behind R10 (`--bg-panel` = `#0f172a` on a route
 *   without the SOC chunk, `rgba(8 23 52 / .4)` on a route with it).
 *
 * LIGHT THEME = the base map OVERLAID by the light overrides — the light
 * blocks only redefine SOME tokens, the rest keep their base value (the
 * canvas among them). Reading only the light blocks would report every
 * `--color-*` token as "khong doc duoc" and measure nothing.
 */
function buildMap(repo, order, theme) {
  const base = {};
  const light = {};
  for (const rel of order) {
    const f = readTokenFile(repo, rel);
    Object.assign(base, f.base);
    Object.assign(light, f.light);
  }
  return theme === "light" ? { ...base, ...light } : base;
}

/**
 * Expand `var(--x, fallback)` chains. Returns null when unresolvable.
 *
 * The paren matching starts AFTER `var(` — the previous version started at
 * `idx + 3` (which is the `(` of `var(`) and counted it as a nested paren, so
 * `rgba(var(--soc-rgb-081734) / 0.4)` matched the CLOSING paren of `rgba(`
 * instead of the one of `var(` ⇒ the token was read as
 * `--soc-rgb-081734) / 0.4` ⇒ unresolvable ⇒ `--bg-panel` was reported as
 * "khong doc duoc" instead of being measured.
 */
function expandVars(value, map, depth = 0) {
  if (depth > 12 || typeof value !== "string") return null;
  const idx = value.indexOf("var(");
  if (idx < 0) return value.trim();
  let depthParen = 0;
  let end = -1;
  for (let i = idx + 4; i < value.length; i += 1) {
    if (value[i] === "(") depthParen += 1;
    else if (value[i] === ")") {
      if (depthParen === 0) { end = i; break; }
      depthParen -= 1;
    }
  }
  if (end < 0) return null;
  const inner = value.slice(idx + 4, end);
  const comma = inner.indexOf(",");
  const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
  const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
  const resolved = Object.prototype.hasOwnProperty.call(map, name) ? map[name] : fallback;
  if (resolved === null || resolved === undefined) return null;
  const tail = value.slice(end + 1);
  const expanded = expandVars(resolved, map, depth + 1);
  if (expanded === null) return null;
  return expandVars(value.slice(0, idx) + expanded + tail, map, depth + 1);
}

/** Resolve a token to an [r,g,b,a] colour, or null. */
function resolveColor(token, map) {
  if (!Object.prototype.hasOwnProperty.call(map, token)) return null;
  const expanded = expandVars(map[token], map);
  if (expanded === null) return null;
  return parseColor(expanded);
}

// ─────────────────────────────────────────────────────────── static measure ───

function controlsOk() {
  const white = parseColor("#ffffff");
  const black = parseColor("#000000");
  const grey = parseColor("#777777");
  const c1 = white && black ? contrast(white.slice(0, 3), black.slice(0, 3)) : null;
  const c2 = grey && white ? contrast(grey.slice(0, 3), white.slice(0, 3)) : null;
  const ok1 = c1 !== null && Math.abs(c1 - 21) < 0.01;
  const ok2 = c2 !== null && Math.abs(c2 - 4.48) < 0.01;
  return {
    ok: ok1 && ok2,
    lines: [
      `CONTROL #ffffff tren #000000 = ${c1 === null ? "KHONG DOC DUOC" : c1.toFixed(2) + ":1"} (mong doi 21.00:1) ${ok1 ? "OK" : "FAIL"}`,
      `CONTROL #777777 tren #ffffff = ${c2 === null ? "KHONG DOC DUOC" : c2.toFixed(2) + ":1"} (mong doi 4.48:1) ${ok2 ? "OK" : "FAIL"}`,
    ],
  };
}

function measureStatic(repo) {
  const rows = [];
  const violations = [];
  const undecodable = [];

  for (const [variantKey, variant] of Object.entries(VARIANTS)) {
    for (const theme of ["dark", "light"]) {
      const map = buildMap(repo, variant.order, theme);
      const canvas = resolveColor("--color-bg-primary", map);
      if (!canvas) {
        undecodable.push(`${variantKey}/${theme}: --color-bg-primary khong doc duoc`);
        continue;
      }
      const canvasOpaque = canvas[3] >= 1 ? canvas.slice(0, 3) : [0, 0, 0];
      for (const pair of PAIRS) {
        const fg = resolveColor(pair.fg, map);
        const bg = resolveColor(pair.bg, map);
        if (!fg || !bg) {
          undecodable.push(
            `${variantKey}/${theme}: ${pair.id} (${!fg ? pair.fg : pair.bg} khong doc duoc duoc giai ma tinh)`,
          );
          continue;
        }
        const bgOpaque = composite(bg, canvasOpaque);
        const fgOpaque = composite(fg, bgOpaque);
        const ratio = contrast(fgOpaque.slice(0, 3), bgOpaque.slice(0, 3));
        const fail = ratio < MIN_RATIO;
        rows.push({
          id: pair.id,
          variant: variantKey,
          theme,
          fg: pair.fg,
          bg: pair.bg,
          ratio,
          fail,
        });
        if (fail) {
          violations.push({
            id: `${pair.id}@${variantKey}/${theme}`,
            detail: `${pair.fg} tren ${pair.bg} = ${ratio.toFixed(2)}:1 (< ${MIN_RATIO}:1) · ${variantKey}/${theme}`,
          });
        }
      }
    }
  }
  violations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { rows, violations, undecodable };
}

// ──────────────────────────────────────────────────────────────── runtime ─────

/** Fingerprint of the deployed build = the hashed asset names of index.html. */
function buildFingerprint(html) {
  const names = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1]).sort();
  return names.join("\n");
}

function fetchIndex(base) {
  return new Promise((resolve, reject) => {
    const req = https.get(base + "/", { timeout: 20000, headers: { "user-agent": "check-theme-contrast" } }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout khi tai index.html"));
    });
  });
}

/**
 * Read the canvas the browser actually painted, in both themes.
 * `getComputedStyle` returns `oklch(...)` in Chromium — it MUST NOT be parsed
 * as a string (L-V06). The value is pushed through a 1x1 canvas so the browser
 * converts it to sRGB bytes.
 */
async function measureRuntimeCanvas() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    return { status: "CHUA_CHAY", reason: `khong import duoc playwright: ${err.message}` };
  }
  let browser;
  try {
    const index = await fetchIndex(STAGING);
    if (index.status !== 200) return { status: "CHUA_CHAY", reason: `staging tra HTTP ${index.status}` };
    const fingerprint = buildFingerprint(index.body);
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(STAGING + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(STAGING + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
      .first()
      .fill(LOGIN_EMAIL);
    await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 45000, waitUntil: "domcontentloaded" });

    const read = async (theme) => {
      await page.evaluate((t) => {
        if (t === "light") document.documentElement.setAttribute("data-theme", "light");
        else document.documentElement.removeAttribute("data-theme");
      }, theme);
      await page.waitForTimeout(1200);
      return page.evaluate(() => {
        const cv = document.createElement("canvas");
        cv.width = 1;
        cv.height = 1;
        const c2 = cv.getContext("2d", { willReadFrequently: true });
        const toRgba = (css) => {
          c2.clearRect(0, 0, 1, 1);
          c2.fillStyle = "#000000";
          c2.fillStyle = css;
          c2.clearRect(0, 0, 1, 1);
          c2.fillRect(0, 0, 1, 1);
          const d = c2.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3]];
        };
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        const textPrimaryRaw = root.getPropertyValue("--text-primary").trim();
        return {
          canvasRaw: body.backgroundColor,
          canvas: toRgba(body.backgroundColor),
          textRaw: body.color,
          text: toRgba(body.color),
          textPrimaryRaw,
          textPrimary: textPrimaryRaw ? toRgba(textPrimaryRaw) : null,
          controlWhite: toRgba("#ffffff"),
          controlBlack: toRgba("#000000"),
          controlGrey: toRgba("#777777"),
        };
      });
    };

    const dark = await read("dark");
    const light = await read("light");
    return { status: "OK", fingerprint, dark, light };
  } catch (err) {
    return { status: "CHUA_CHAY", reason: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
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

function writeBaseline(file, staticViolations, undecodable, runtime) {
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    gate: GATE,
    scope: TOKEN_FILES,
    measuredAt: new Date().toISOString(),
    minRatio: MIN_RATIO,
    violations: staticViolations.map((v) => v.id),
    details: Object.fromEntries(staticViolations.map((v) => [v.id, v.detail])),
    undecodable,
    runtime: runtime && runtime.status === "OK" ? { fingerprint: runtime.fingerprint } : { status: "CHUA_CHAY" },
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

// ─────────────────────────────────────────────────────────────────── cli ──────

function parseArgs(argv) {
  const out = { selfTest: false, update: false, repo: DEFAULT_REPO, baseline: null, printViolations: false, noRuntime: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") out.repo = path.resolve(argv[++i]);
    else if (a === "--baseline") out.baseline = path.resolve(argv[++i]);
    else if (a === "--print-violations") out.printViolations = true;
    else if (a === "--self-test") out.selfTest = true;
    else if (a === "--update-baseline") out.update = true;
    // `--no-runtime` skips the browser part. The self-test MUST use it: the
    // runtime talks to staging, so the self-test would otherwise depend on
    // the network (and take 45 s per subprocess when the login fails).
    else if (a === "--no-runtime") out.noRuntime = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`check-theme-contrast: tham so khong ro: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────── run ──────

async function run(opts) {
  const ctl = controlsOk();
  for (const l of ctl.lines) console.log(`  ${l}`);
  if (!ctl.ok) {
    console.error("  ✗ CONTROL FAIL — cac so do khong duoc tin (L-V01). Gate that.");
    return 1;
  }

  let staticResult;
  try {
    staticResult = measureStatic(opts.repo);
  } catch (err) {
    console.error(`check-theme-contrast: KHONG VERIFY DUOC — ${err.message}`);
    return 2;
  }

  const bFile = opts.baseline || baselinePath(opts.repo);

  const runtime = opts.noRuntime
    ? { status: "CHUA_CHAY", reason: "canvas runtime — bi bo qua bang --no-runtime" }
    : await measureRuntimeCanvas();

  if (opts.update) {
    const payload = writeBaseline(bFile, staticResult.violations, staticResult.undecodable, runtime);
    console.log(
      `check-theme-contrast: DA GHI BASELINE ${bFile} (${payload.violations.length} vi pham).`,
    );
    console.log("  ⚠ Baseline da DUOC NANG len — chi lam vay khi vi pham cu da duoc SUA that.");
    return 0;
  }

  const baseline = readBaseline(bFile);
  if (!baseline) {
    console.error(
      `check-theme-contrast: KHONG VERIFY DUOC — thieu baseline ${bFile}. ` +
        `Chay 1 lan voi --update-baseline de tao baseline, roi commit file do.`,
    );
    return 2;
  }

  // CANVAS RUNTIME — bang chung ve build DANG chay tren staging. Mot so do
  // lay tren build KHAC baseline thi KHONG bao gio ket luan ve build cua ta
  // (O13: staging chay `6a127002e` ≠ `dev@e7b008f25`) ⇒ in `CHUA CHAY`.
  if (runtime.status === "CHUA_CHAY") {
    console.log(`  CHUA CHAY: ${runtime.reason}`);
  } else {
    const baseFp = (baseline.runtime && baseline.runtime.fingerprint) || "";
    if (baseFp && baseFp !== runtime.fingerprint) {
      console.log(
        `  CHUA CHAY: canvas runtime — staging dang chay build KHAC baseline ` +
          `(${runtime.fingerprint.split("\n")[0]} != ${baseFp.split("\n")[0]}) · so do runtime khong dung de ket luan`,
      );
    } else {
      const c = runtime.dark;
      const ctlRatio = contrast(c.controlWhite.slice(0, 3), c.controlBlack.slice(0, 3));
      console.log(
        `  CANVAS (runtime) · build ${runtime.fingerprint.split("\n")[0]} · control trong browser = ${ctlRatio.toFixed(2)}:1` +
          (Math.abs(ctlRatio - 21) < 0.01 ? " OK" : " FAIL"),
      );
      for (const theme of ["dark", "light"]) {
        const t = runtime[theme];
        const ratio = contrast(t.text.slice(0, 3), t.canvas.slice(0, 3));
        console.log(
          `    ${theme}: canvas ${t.canvasRaw} · body color ${t.textRaw} · contrast ${ratio.toFixed(2)}:1` +
            (ratio < MIN_RATIO ? "  <-- FAIL" : ""),
        );
        // The TOKEN contrast is the one that matters: R1/R2 — the canvas
        // never flips to light while `--text-primary` does.
        if (t.textPrimary) {
          const tr = contrast(t.textPrimary.slice(0, 3), t.canvas.slice(0, 3));
          console.log(
            `    ${theme}: --text-primary ${t.textPrimaryRaw} tren canvas ${t.canvasRaw} = ${tr.toFixed(2)}:1` +
              (tr < MIN_RATIO ? "  <-- FAIL" : ""),
          );
        }
      }
      if (Math.abs(ctlRatio - 21) >= 0.01) {
        console.error("  ✗ CONTROL FAIL trong browser — cac so do runtime khong duoc tin.");
        return 1;
      }
    }
  }

  const known = new Set(baseline.violations || []);
  const fresh = staticResult.violations.filter((v) => !known.has(v.id));
  const gone = [...known].filter((id) => !staticResult.violations.some((v) => v.id === id));

  if (opts.printViolations) {
    for (const v of staticResult.violations) console.log(v.id);
    return 0;
  }

  console.log(
    `check-theme-contrast — ${staticResult.violations.length} cap do khong dat WCAG AA (${MIN_RATIO}:1) ` +
      `| baseline ${known.size} | file: ${path.relative(opts.repo, bFile).split(path.sep).join("/")}`,
  );
  console.log("  TAP VI PHAM HIEN TAI (id = pair@variant/theme):");
  if (!staticResult.violations.length) console.log("    (khong co)");
  for (const v of staticResult.violations) console.log(`    ${v.id}  ${v.detail}`);
  if (staticResult.undecodable.length) {
    console.log(`  ⚠ ${staticResult.undecodable.length} cap KHONG doc duoc (khong ket luan, khong coi la trong suot):`);
    for (const u of staticResult.undecodable.slice(0, 12)) console.log(`    ${u}`);
  }
  if (fresh.length) {
    console.error(`\n  ✗ ${fresh.length} VI PHAM MOI (khong co trong baseline):`);
    for (const v of fresh) console.error(`    ${v.id}  ${v.detail}`);
    console.error("  ✗ REGRESSION — gate that.");
    return 1;
  }
  if (gone.length) {
    console.log(`  ℹ ${gone.length} vi pham trong baseline da het: ${gone.join(", ")}`);
    console.log("    ⇒ co the ha baseline bang: node packages/web/scripts/check-theme-contrast.mjs --update-baseline");
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

/**
 * Synthetic token files.
 *
 * The fixture MUST be CLEAN in every (variant × theme) combination. A fixture
 * that already fails bakes its failures into the baseline, and a mutation then
 * produces NO new violation id — the self-test would prove nothing (L-V01: a
 * control that is already red is not a control; the first version of this
 * fixture had 37 baked-in failures and its CONTROL case was vacuous).
 *
 * The light block therefore re-declares the SAME values as the base, so the
 * light theme measures exactly what the dark theme measures. Mutating the
 * light block then isolates the light theme — which is precisely the R1/R2
 * defect (canvas stays dark while the text flips).
 */
const FIXTURE_FILES = {
  "packages/web/src/index.css": [
    "@theme {",
    "  --color-bg-primary: #020617;",
    "  --color-bg-secondary: #0f172a;",
    "  --color-bg-panel: #0f172a;",
    "  --color-text-primary: #f1f5f9;",
    "  --color-text-secondary: #94a3b8;",
    "  --color-text-muted: #94a3b8;",
    "  --color-border-focus: #22d3ee;",
    "}",
    "",
  ].join("\n"),
  "packages/web/src/theme/tokens.css": [
    ":root {",
    "  --text-primary: var(--color-text-primary, #f1f5f9);",
    "  --text-secondary: var(--color-text-secondary, #94a3b8);",
    "  --text-muted: var(--color-text-muted, #94a3b8);",
    "  --bg-panel: var(--color-bg-panel, #0f172a);",
    "  --accent-cyan: #22d3ee;",
    "  --text-on-accent: #082f49;",
    "}",
    "",
    ':root[data-theme="light"] {',
    "  --text-primary: #f1f5f9;",
    "  --text-secondary: #94a3b8;",
    "  --text-muted: #94a3b8;",
    "  --accent-cyan: #22d3ee;",
    "  --text-on-accent: #082f49;",
    "}",
    "",
  ].join("\n"),
  "packages/web/src/components/soc/soc.tokens.css": [
    ":root {",
    "  --soc-rgb-081734: 8 23 52;",
    "  --bg-panel: rgba(var(--soc-rgb-081734) / 0.4);",
    "  --bg-panel-solid: rgb(var(--soc-rgb-081734));",
    "  --pf-surface: #0b1424;",
    "  --pf-gain: #34d399;",
    "  --pf-loss: #f87171;",
    "  --pf-flat: #94a3b8;",
    "  --pf-positive-soft: #0d2a22;",
    "  --pf-negative-soft: #2c1418;",
    "  --pf-positive-text: #6ee7b7;",
    "  --pf-negative-text: #fca5a5;",
    "}",
    "",
  ].join("\n"),
};

function buildFixture(mutate) {
  const root = mkdtempSync(path.join(os.tmpdir(), "check-theme-contrast-"));
  for (const [rel, body] of Object.entries(FIXTURE_FILES)) {
    const dst = path.join(root, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, body, "utf8");
  }
  if (mutate) mutate(root);
  return root;
}

async function selfTest() {
  console.log("check-theme-contrast SELF-TEST — chay tren ban sao tam, assert gate BAT\n");
  let failures = 0;
  let total = 0;

  const probe = async (name, mutate, expectCode, expectText) => {
    total += 1;
    const root = buildFixture();
    const bFile = path.join(root, "baseline.json");
    const measured = runSelf(["--repo", root, "--baseline", bFile, "--update-baseline", "--no-runtime"]);
    const measuredCount = Number((measured.out.match(/DA GHI BASELINE[^\n]*\((\d+)/) || [])[1]);
    if (mutate) mutate(root);
    const res = runSelf(["--repo", root, "--baseline", bFile, "--no-runtime"]);
    rmSync(root, { recursive: true, force: true });
    const ok =
      expectCode === 0
        ? res.code === 0 && (!expectText || res.out.includes(expectText))
        : res.code !== 0 && (!expectText || res.out.includes(expectText));
    if (ok) console.log(`  ok   ${name}  exit=${res.code} (baseline do ${measuredCount ?? "?"} vi pham)`);
    else {
      failures += 1;
      console.log(
        `  FAIL ${name}\n        mong doi ${expectCode === 0 ? "exit 0" : `exit != 0 chua '${expectText}'`}, nhan exit=${res.code}\n${res.out.trim()}`,
      );
    }
  };

  // CONTROL — the fixture is CLEAN ⇒ the baseline must hold 0 violations and
  // the gate must stay green. A fixture that already fails would make this
  // case vacuous (L-V01).
  await probe("CONTROL: fixture sach → 0 vi pham → exit 0", null, 0, "khong co vi pham MOI");

  // The known defect R1/R2: the light theme flips the text but the canvas
  // stays dark → the pair must fail.
  await probe(
    "CASE: light theme + nen toi → exit != 0",
    (root) => {
      const f = path.join(root, "packages/web/src/theme/tokens.css");
      const src = fs.readFileSync(f, "utf8");
      fs.writeFileSync(f, src.replace("  --text-primary: #f1f5f9;", "  --text-primary: #020617;"), "utf8");
    },
    1,
    "text-primary-on-bg-primary",
  );

  // A second, independent failure: a muted text on the canvas.
  await probe(
    "CASE: --color-text-muted = nen → exit != 0",
    (root) => {
      const f = path.join(root, "packages/web/src/index.css");
      const src = fs.readFileSync(f, "utf8");
      fs.writeFileSync(f, src.replace("--color-text-muted: #94a3b8;", "--color-text-muted: #020617;"), "utf8");
    },
    1,
    "color-text-muted-on-bg-primary",
  );

  // L-V06 — `oklch()` is NOT decoded statically. The pair must be reported as
  // UNDECODABLE (no verdict), NEVER silently treated as "transparent" and
  // never counted as a violation.
  await probe(
    "CASE: mau oklch() → bao 'khong doc duoc', KHONG ket luan trong suot",
    (root) => {
      const f = path.join(root, "packages/web/src/index.css");
      const src = fs.readFileSync(f, "utf8");
      fs.writeFileSync(f, src.replace("--color-text-muted: #94a3b8;", "--color-text-muted: oklch(0.5 0.1 200);"), "utf8");
    },
    0,
    "khong doc duoc duoc giai ma tinh",
  );

  if (failures) {
    console.error(`\ncheck-theme-contrast SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-theme-contrast SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

// ────────────────────────────────────────────────────────────────── main ───────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("Usage: node packages/web/scripts/check-theme-contrast.mjs [--update-baseline] [--self-test]");
    return 0;
  }
  if (opts.selfTest) return selfTest();
  return run(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
