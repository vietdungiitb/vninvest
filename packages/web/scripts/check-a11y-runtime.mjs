#!/usr/bin/env node
/**
 * check-a11y-runtime — UI Standardization W0 / slice S2.
 *
 * WHAT IT CHECKS (runtime, Chromium): 7 classes of a11y defect, measured on
 * the DEPLOYED app (staging), not on the source.
 *
 *   1. h1-count     — more than one VISIBLE <h1> in the document (R5: the
 *                     sidebar renders one, the page renders another)
 *   2. h1-in-main   — more than one <h1> inside the main landmark
 *   3. main-nested  — a main landmark nested inside another one (R6)
 *   4. a11y-name    — an interactive control with NO accessible name, judged
 *                     by the CHROMIUM AX TREE (CDP `Accessibility.getFullAXTree`)
 *   5. focus-ring   — a control that receives keyboard focus but shows NO
 *                     visible focus indicator (measured with a REAL Tab press,
 *                     because `:focus-visible` only matches keyboard focus)
 *   6. contrast     — text below WCAG AA (4.5:1), with the background
 *                     COMPOSITED over every translucent ancestor layer
 *   7. target-size  — an interactive target smaller than 24x24 CSS px
 *   8. overflow-320 — horizontal overflow at a 320px viewport
 *
 * COLOURS ARE NEVER PARSED AS STRINGS (L-V06). `getComputedStyle` returns
 * `oklch(...)` in Chromium, so every colour is pushed through a 1x1 canvas and
 * read back as sRGB bytes. A colour that cannot be decoded is reported as
 * UNDECODABLE and never silently treated as "transparent".
 *
 * BASELINE-LOCKED (contract of `scripts/check-lessons.mjs`):
 *   exit 0 <=> every violation found NOW is already in the baseline
 *   exit 1 <=> at least one NEW violation (regression)
 *   exit 2 <=> cannot verify (missing baseline / broken setup)
 * The comparison is on the SET of violation ids, never on a count.
 *
 * `CHUA CHAY` MODE (O13): a gate that depends on staging must not block a push
 * on a machine that has no staging. When Playwright, staging or the login is
 * unavailable the script prints `CHUA CHAY: <reason>` and exits **0** — it
 * never prints "0 violations" in that case, because that would be a false
 * green (L-G02).
 *
 * `--self-test` runs the SAME measurement code against a LOCAL fixture with
 * known defects, so the gate proves it catches them without needing staging.
 *
 * Usage:
 *   node packages/web/scripts/check-a11y-runtime.mjs
 *   node packages/web/scripts/check-a11y-runtime.mjs --print-violations
 *   node packages/web/scripts/check-a11y-runtime.mjs --update-baseline
 *   node packages/web/scripts/check-a11y-runtime.mjs --self-test
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
const GATE = "check-a11y-runtime";

const STAGING = process.env.A11Y_BASE_URL || "https://docker.edusuccess.vn";
const LOGIN_EMAIL = process.env.A11Y_EMAIL || "testuser@vninvest.vn";
const LOGIN_PASSWORD = process.env.A11Y_PASSWORD || "TestPass123!";

/**
 * PINNED ROUTES. The scope of a gate must be pinned (plan AC-2), not "every
 * route of the app" — a route the test user cannot open would silently
 * measure nothing while looking green.
 */
const ROUTES = [
  "/dashboard",
  "/watchlist",
  "/transactions",
  "/portfolios",
  "/portfolios/manage",
  "/screener",
  "/alert-center",
  "/settings",
  "/ai-advisory",
  "/tenant-admin",
];

const MIN_RATIO = 4.5; // WCAG AA, normal text
const MIN_TARGET = 24; // WCAG 2.5.8 target size (minimum), CSS px
const MAX_TEXT_SAMPLE = 250; // bound the cost of the contrast sweep
const MAX_TARGET_SAMPLE = 200;
const MAX_FOCUS_SAMPLE = 30;
const TAB_LIMIT = 40;

/** AX roles that must expose an accessible name. */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem",
]);

/** DOM selector for the controls the gate looks at. */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="textbox"]',
  '[role="combobox"]',
].join(", ");

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
function over(fg, bg) {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

// ───────────────────────────────────────────────────────── browser-side probe ──

/**
 * Everything that can be read from the DOM, measured in ONE round trip.
 * The function is serialised into the browser, so every helper lives inside.
 */
function domProbe() {
  // This function is SERIALISED into the browser — it cannot see the outer
  // scope, so the constants it needs are declared inside it.
  const MAX_TEXT = 250;
  const MAX_TARGET = 200;
  const MIN_SIZE = 24;
  const INTERACTIVE = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="switch"]',
    '[role="option"]',
    '[role="textbox"]',
    '[role="combobox"]',
  ].join(", ");

  const lum = ([r, g, b]) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratioOf = (fg, bg) => {
    const a = lum(fg);
    const b = lum(bg);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  };

  const cv = document.createElement("canvas");
  cv.width = 1;
  cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  /**
   * Any CSS colour -> sRGB bytes, via the browser.
   * `getComputedStyle` returns `oklch(...)` in Chromium; parsing that string
   * is what L-V06 forbids. The canvas converts it (L-V01 control below).
   */
  const toRgba = (css) => {
    if (!css) return null;
    const v = String(css).trim();
    if (!v || v === "none") return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000000";
    ctx.fillStyle = v; // invalid value keeps the previous fillStyle
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0 && v !== "transparent" && !/transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(v)) {
      // Fully transparent but the author did NOT ask for transparency =>
      // the colour could not be decoded. Do not call it "transparent".
      return null;
    }
    return [d[0], d[1], d[2], d[3] / 255];
  };

  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = String((el.getAttribute && el.getAttribute("class")) || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (cls.length) s += `.${cls.join(".")}`;
    return s;
  };

  const hidden = (el) => {
    if (el.closest("[hidden]")) return true;
    if (el.closest('[aria-hidden="true"]')) return true;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return true;
    const r = el.getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  };

  const effectiveBg = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // undecidable
      const c = toRgba(cs.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      if (c && c[3] >= 1) break;
      node = node.parentElement;
    }
    if (!layers.length) return [255, 255, 255, 1];
    if (layers[layers.length - 1][3] < 1) layers.push([255, 255, 255, 1]);
    let acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i -= 1) {
      const fg = layers[i];
      const a = fg[3];
      acc = [fg[0] * a + acc[0] * (1 - a), fg[1] * a + acc[1] * (1 - a), fg[2] * a + acc[2] * (1 - a), 1];
    }
    return acc;
  };

  const opacityChain = (el) => {
    let p = 1;
    let node = el;
    while (node && node.nodeType === 1) {
      const o = parseFloat(getComputedStyle(node).opacity);
      if (!Number.isNaN(o)) p *= o;
      node = node.parentElement;
    }
    return p;
  };

  const over = (fg, bg) => {
    const a = fg[3];
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
      1,
    ];
  };

  const out = { h1: [], mainCount: 0, nestedMain: 0, hasMain: false, text: [], targets: [], controls: [] };

  const mains = Array.from(document.querySelectorAll("main, [role='main']"));
  out.mainCount = mains.length;
  out.hasMain = mains.length > 0;
  out.nestedMain = document.querySelectorAll(
    "main main, main [role='main'], [role='main'] main, [role='main'] [role='main']",
  ).length;

  const seen = new Map();
  const uniqueId = (el) => {
    const key = describe(el);
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    return n === 0 ? key : `${key}[${n}]`;
  };

  for (const el of Array.from(document.querySelectorAll("h1"))) {
    if (hidden(el)) continue;
    const inMain = !!el.closest("main, [role='main']");
    out.h1.push({ id: uniqueId(el), text: (el.textContent || "").trim().slice(0, 40), inMain });
  }

  // ── contrast: text elements, background composited over every layer ──────
  const textCandidates = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    let hasText = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
    }
    if (hasText) textCandidates.push(el);
    if (textCandidates.length >= MAX_TEXT) break;
  }
  for (const el of textCandidates) {
    if (hidden(el)) continue;
    const cs = getComputedStyle(el);
    const fg = toRgba(cs.color);
    const bg = effectiveBg(el);
    if (!fg || !bg) {
      out.text.push({ id: uniqueId(el), undecodable: true, sample: (el.textContent || "").trim().slice(0, 40) });
      continue;
    }
    const fgA = fg[3] * opacityChain(el);
    const fgOpaque = [fg[0], fg[1], fg[2], 1];
    const bgOpaque = [bg[0], bg[1], bg[2], 1];
    const ratio = ratioOf(
      fgA >= 1 ? fgOpaque : over([fg[0], fg[1], fg[2], fgA], bgOpaque).slice(0, 3),
      bgOpaque,
    );
    out.text.push({
      id: uniqueId(el),
      ratio: Math.round(ratio * 100) / 100,
      color: cs.color,
      bg: `rgb(${bgOpaque.map((n) => Math.round(n)).join(", ")})`,
      sample: (el.textContent || "").trim().slice(0, 40),
    });
  }

  // ── target size ─────────────────────────────────────────────────────────
  const interactive = Array.from(document.querySelectorAll(INTERACTIVE)).slice(0, MAX_TARGET);
  for (const el of interactive) {
    if (hidden(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width * 10) / 10;
    const h = Math.round(r.height * 10) / 10;
    const inline = cs.display === "inline" && el.tagName === "A";
    out.controls.push({ id: uniqueId(el), tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || "" });
    if (inline) continue; // WCAG 2.5.8 exempts links inline in a sentence
    if (w === 0 && h === 0) continue;
    if (w < MIN_SIZE || h < MIN_SIZE) out.targets.push({ id: uniqueId(el), w, h, tag: el.tagName.toLowerCase() });
  }

  return out;
}

// ─────────────────────────────────────────────────────── AX tree (Chromium) ──

/**
 * Interactive controls without an accessible name, according to the AX tree
 * Chromium itself builds (CDP `Accessibility.getFullAXTree`). This is the
 * authority the plan asks for — a hand-rolled "does it have a label?" check
 * would disagree with the browser on dozens of cases.
 */
async function axMissingNames(cdp) {
  await cdp.send("Accessibility.enable");
  await cdp.send("DOM.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const missing = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role && n.role.value;
    if (!role || !INTERACTIVE_ROLES.has(role)) continue;
    const name = n.name && typeof n.name.value === "string" ? n.name.value.trim() : "";
    if (name) continue;
    missing.push({ role, backendDOMNodeId: n.backendDOMNodeId });
  }
  const out = [];
  for (const m of missing) {
    let id = m.role;
    try {
      const { node } = await cdp.send("DOM.describeNode", { backendNodeId: m.backendDOMNodeId });
      const attrs = node.attributes || [];
      const get = (n) => {
        const i = attrs.indexOf(n);
        return i >= 0 ? attrs[i + 1] : "";
      };
      const tag = String(node.nodeName || "").toLowerCase();
      let s = tag || m.role;
      const domId = get("id");
      if (domId) s += `#${domId}`;
      const cls = String(get("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += `.${cls.join(".")}`;
      id = s;
    } catch {
      /* the node may have been detached — keep the role as the id */
    }
    out.push({ id, role: m.role });
  }
  return out;
}

// ─────────────────────────────────────────────────────── focus ring (real Tab) ─

/**
 * Walk the tab order with REAL Tab presses and check that the focused control
 * shows a visible focus indicator.
 *
 * `:focus-visible` only matches keyboard focus, so a programmatic `.focus()`
 * cannot be used for the check itself — it is only used to POSITION the tab
 * order. The element that ends up focused is always the result of a Tab.
 *
 * TWO PHASES, because one is not enough:
 *   A — blur, then press Tab up to `TAB_LIMIT` times: covers the first N tab
 *       stops, including the very first one (which no "focus the element and
 *       press Tab" loop can ever reach, because the element that ends up
 *       focused is always the SUCCESSOR).
 *   B — focus each interactive element, then press Tab: covers the elements
 *       that sit deep in the page, beyond the first N tab stops.
 */
async function scanFocusRings(page, limit) {
  const seen = new Set();
  const bad = [];

  const readFocus = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const cs = getComputedStyle(el);
      const cv = document.createElement("canvas");
      cv.width = 1;
      cv.height = 1;
      const c2 = cv.getContext("2d", { willReadFrequently: true });
      const alphaOf = (css) => {
        c2.clearRect(0, 0, 1, 1);
        c2.fillStyle = "#000000";
        c2.fillStyle = css;
        c2.clearRect(0, 0, 1, 1);
        c2.fillRect(0, 0, 1, 1);
        return c2.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      const ow = parseFloat(cs.outlineWidth) || 0;
      const outlineVisible = ow > 0 && cs.outlineStyle !== "none" && alphaOf(cs.outlineColor) > 0;
      const shadowVisible = !!cs.boxShadow && cs.boxShadow !== "none";
      let s = el.tagName.toLowerCase();
      if (el.id) s += `#${el.id}`;
      const cls = String(el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += `.${cls.join(".")}`;
      return {
        id: s,
        outline: cs.outline,
        outlineWidth: ow,
        boxShadow: cs.boxShadow,
        visible: outlineVisible || shadowVisible,
      };
    });

  const record = (info) => {
    if (!info || info.visible || seen.has(info.id)) return;
    seen.add(info.id);
    bad.push(info);
  };

  // ── phase A: the first N tab stops ──────────────────────────────────────
  try {
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (document.body) document.body.focus();
    });
    for (let i = 0; i < TAB_LIMIT; i += 1) {
      await page.keyboard.press("Tab");
      record(await readFocus());
    }
  } catch {
    /* keyboard not available — phase B still runs */
  }

  // ── phase B: elements beyond the first N tab stops ──────────────────────
  const handles = await page.$$(INTERACTIVE_SELECTOR);
  const n = Math.min(handles.length, limit);
  for (let i = 0; i < n; i += 1) {
    try {
      await handles[i].evaluate((el) => {
        el.scrollIntoView({ block: "center" });
        el.focus();
      });
      await page.keyboard.press("Tab");
      record(await readFocus());
    } catch {
      /* element detached while tabbing — skip */
    }
  }
  return bad;
}

// ─────────────────────────────────────────────────────────── page measurement ──

async function measurePage(page, cdp, label) {
  const violations = [];
  const notes = [];
  const dom = await page.evaluate(domProbe);

  // 1 + 2 — heading contract
  const totalH1 = dom.h1.length;
  const h1InMain = dom.h1.filter((h) => h.inMain).length;
  if (totalH1 > 1) {
    violations.push({
      id: `${label}#h1-count`,
      detail: `${totalH1} <h1> hien thi: ${dom.h1.map((h) => h.text).join(" / ")}`,
    });
  }
  if (h1InMain > 1) {
    violations.push({
      id: `${label}#h1-in-main`,
      detail: `${h1InMain} <h1> trong main landmark`,
    });
  }
  // 3 — nested main
  if (dom.nestedMain > 0) {
    violations.push({
      id: `${label}#main-nested`,
      detail: `${dom.nestedMain} main landmark long nhau`,
    });
  }
  if (!dom.hasMain) notes.push(`${label}: khong tim thay main landmark`);

  // 4 — accessible name (Chromium AX tree)
  const missing = await axMissingNames(cdp);
  const missingSeen = new Set();
  for (const m of missing) {
    const id = `${label}#a11y-name:${m.id}`;
    if (missingSeen.has(id)) continue;
    missingSeen.add(id);
    violations.push({ id, detail: `control <${m.role}> khong co accessible name` });
  }

  // 5 — focus ring (real Tab)
  const noRing = await scanFocusRings(page, MAX_FOCUS_SAMPLE);
  for (const f of noRing) {
    violations.push({
      id: `${label}#focus-ring:${f.id}`,
      detail: `focus khong co chi bao hien thi (outline=${f.outline} · box-shadow=${f.boxShadow})`,
    });
  }

  // 6 — contrast
  for (const t of dom.text) {
    if (t.undecodable) {
      notes.push(`${label}#contrast:${t.id} — mau khong giai ma duoc (khong ket luan)`);
      continue;
    }
    if (t.ratio < MIN_RATIO) {
      violations.push({
        id: `${label}#contrast:${t.id}`,
        detail: `${t.ratio}:1 < ${MIN_RATIO}:1 · ${t.color} tren ${t.bg} · "${t.sample}"`,
      });
    }
  }

  // 7 — target size
  for (const t of dom.targets) {
    violations.push({
      id: `${label}#target-size:${t.id}`,
      detail: `${t.w}x${t.h} px < ${MIN_TARGET}x${MIN_TARGET} px (${t.tag})`,
    });
  }

  return { violations, notes };
}

/** Horizontal overflow at a 320px viewport (WCAG reflow). */
async function measureOverflow320(page) {
  const previous = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const cw = doc.clientWidth;
    const sw = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
    let worst = null;
    let maxRight = cw;
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > maxRight) {
        maxRight = r.right;
        let s = el.tagName.toLowerCase();
        if (el.id) s += `#${el.id}`;
        const cls = String(el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += `.${cls.join(".")}`;
        worst = s;
      }
    }
    return { cw, sw, worst, maxRight: Math.round(maxRight * 10) / 10 };
  });
  if (previous) await page.setViewportSize(previous);
  await page.waitForTimeout(200);
  if (info.sw > info.cw + 1) {
    return {
      id: "#overflow-320",
      detail: `scrollWidth ${info.sw} > clientWidth ${info.cw} · phan tu tran nhat: ${info.worst} (right ${info.maxRight}px)`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────── staging driver ───

function fetchIndex(base) {
  return new Promise((resolve, reject) => {
    const req = https.get(base + "/", { timeout: 20000, headers: { "user-agent": "check-a11y-runtime" } }, (res) => {
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

function buildFingerprint(html) {
  return [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1]).sort().join("\n");
}

/** Wait until the SPA has actually rendered (L-V05: never measure a skeleton). */
async function waitReady(page) {
  await page
    .waitForFunction(
      () => {
        const t = (document.body.innerText || "").trim();
        return t.length > 120 && !/\.\.\.$/.test(t);
      },
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
}

async function login(page) {
  await page.goto(`${STAGING}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${STAGING}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
    .first()
    .fill(LOGIN_EMAIL);
  await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 45000, waitUntil: "domcontentloaded" });
}

/**
 * Measure every pinned route. Returns null when the environment cannot
 * support the measurement at all (the caller then prints `CHUA CHAY`).
 */
async function measureStaging() {
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
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await login(page);
    await waitReady(page);

    const violations = [];
    const notes = [];
    const measured = [];
    for (const route of ROUTES) {
      try {
        await page.goto(`${STAGING}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await waitReady(page);
        const res = await measurePage(page, cdp, route);
        violations.push(...res.violations);
        notes.push(...res.notes);
        const overflow = await measureOverflow320(page);
        if (overflow) violations.push({ id: `${route}${overflow.id}`, detail: overflow.detail });
        measured.push(route);
        console.log(`    ${route} — ${res.violations.length + (overflow ? 1 : 0)} vi pham`);
      } catch (err) {
        notes.push(`${route}: KHONG DO DUOC — ${err.message}`);
        console.log(`    ${route} — KHONG DO DUOC (${err.message.slice(0, 90)})`);
      }
    }
    if (!measured.length) {
      return { status: "CHUA_CHAY", reason: "khong route nao do duoc" };
    }
    return { status: "OK", violations, notes, measured, fingerprint: buildFingerprint(index.body) };
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

function writeBaseline(file, violations, notes, fingerprint, measured) {
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    gate: GATE,
    scope: "staging runtime",
    measuredAt: new Date().toISOString(),
    stagingBuild: fingerprint,
    routesMeasured: measured,
    violations: violations.map((v) => v.id),
    details: Object.fromEntries(violations.map((v) => [v.id, v.detail])),
    notes,
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
      console.error(`check-a11y-runtime: tham so khong ro: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────── run ───────

async function run(opts) {
  const bFile = opts.baseline || baselinePath(opts.repo);

  console.log("check-a11y-runtime — do runtime tren staging (Chromium + AX tree)");
  const result = await measureStaging();

  if (result.status === "CHUA_CHAY") {
    console.log(`  CHUA CHAY: ${result.reason}`);
    console.log("  (khong phai '0 vi pham' — mau chua do duoc, khong ket luan)");
    return 0;
  }

  const violations = result.violations.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (opts.update) {
    const payload = writeBaseline(bFile, violations, result.notes, result.fingerprint, result.measured);
    console.log(
      `check-a11y-runtime: DA GHI BASELINE ${bFile} (${payload.violations.length} vi pham / ${result.measured.length} route).`,
    );
    console.log("  ⚠ Baseline da DUOC NANG len — chi lam vay khi vi pham cu da duoc SUA that.");
    return 0;
  }

  const baseline = readBaseline(bFile);
  if (!baseline) {
    console.error(
      `check-a11y-runtime: KHONG VERIFY DUOC — thieu baseline ${bFile}. ` +
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

  if (baseline.stagingBuild && result.fingerprint && baseline.stagingBuild !== result.fingerprint) {
    console.log(
      `  ℹ staging build KHAC baseline du do (${result.fingerprint.split("\n")[0]} != ${baseline.stagingBuild.split("\n")[0]}) — ` +
        `so sanh van dua tren TAP vi pham, khong tren so build.`,
    );
  }

  console.log(
    `check-a11y-runtime — ${violations.length} vi pham / ${result.measured.length} route da do ` +
      `| baseline ${known.size} | file: ${path.relative(opts.repo, bFile).split(path.sep).join("/")}`,
  );
  console.log("  TAP VI PHAM HIEN TAI:");
  if (!violations.length) console.log("    (khong co)");
  for (const v of violations) console.log(`    ${v.id}  ${v.detail}`);
  if (result.notes.length) {
    console.log(`  ℹ ${result.notes.length} ghi chu (khong ket luan):`);
    for (const n of result.notes.slice(0, 12)) console.log(`    ${n}`);
  }
  if (fresh.length) {
    console.error(`\n  ✗ ${fresh.length} VI PHAM MOI (khong co trong baseline):`);
    for (const v of fresh) console.error(`    ${v.id}  ${v.detail}`);
    console.error("  ✗ REGRESSION — gate that.");
    return 1;
  }
  if (gone.length) {
    console.log(`  ℹ ${gone.length} vi pham trong baseline da het: ${gone.join(", ")}`);
    console.log("    ⇒ co the ha baseline bang: node packages/web/scripts/check-a11y-runtime.mjs --update-baseline");
  }
  console.log("  ✓ khong co vi pham MOI — gate xanh (tap vi pham ⊆ baseline).");
  return 0;
}

// ─────────────────────────────────────────────────────────────── self-test ────

/**
 * A local fixture with KNOWN defects. The same measurement code runs against
 * it, so the self-test proves the gate catches real defects without needing
 * staging. The clean fixture is the CONTROL: it must produce ZERO
 * violations, otherwise the "dirty" result would prove nothing.
 */
const FIXTURE_CLEAN = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background: #ffffff; color: #111111; margin: 0; font: 16px sans-serif; }
  main { padding: 8px; }
  button { min-width: 44px; min-height: 44px; font-size: 16px; }
</style></head><body>
  <main><h1>Tieu de</h1><button>Nut</button></main>
</body></html>`;

const FIXTURE_DIRTY = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background: #ffffff; color: #111111; margin: 0; font: 16px sans-serif; }
  main { padding: 8px; }
  .hidden-focus { outline: none; box-shadow: none; border: 0; min-width: 44px; min-height: 44px; }
  .low-contrast { color: #bbbbbb; background: #ffffff; }
  .tiny { width: 16px; height: 16px; min-width: 16px; min-height: 16px; padding: 0; border: 0; }
  .wide { width: 500px; height: 10px; }
</style></head><body>
  <main>
    <h1>Tieu de 1</h1>
    <h1>Tieu de 2</h1>
    <main><p>main long nhau</p></main>
    <button class="hidden-focus"></button>
    <a href="/x" aria-hidden="true"></a>
    <span class="low-contrast">chu mo nhe</span>
    <span class="tiny" role="button" tabindex="0"></span>
    <div class="wide"></div>
  </main>
</body></html>`;

async function measureFixture(html, label) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const res = await measurePage(page, cdp, label);
    const overflow = await measureOverflow320(page);
    if (overflow) res.violations.push({ id: `${label}${overflow.id}`, detail: overflow.detail });
    return res.violations;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function selfTest() {
  console.log("check-a11y-runtime SELF-TEST — fixture local, assert gate BAT\n");
  let failures = 0;
  let total = 0;

  const expect = async (name, html, label, want) => {
    total += 1;
    let ids = [];
    let err = null;
    try {
      ids = await measureFixture(html, label);
    } catch (e) {
      err = e.message;
    }
    if (err) {
      failures += 1;
      console.log(`  FAIL ${name}\n        loi khi do: ${err}`);
      return;
    }
    const missing = want.filter((w) => !ids.some((v) => v.id.includes(w)));
    if (missing.length === 0) {
      console.log(`  ok   ${name}  (${ids.length} vi pham)`);
    } else {
      failures += 1;
      console.log(
        `  FAIL ${name}\n        thieu cac vi pham: ${missing.join(", ")}\n        thu co: ${ids.map((v) => v.id).join(" | ") || "(khong co)"}`,
      );
    }
  };

  // CONTROL — the clean fixture must produce NOTHING.
  await expect("CONTROL: fixture sach → 0 vi pham", FIXTURE_CLEAN, "fixture", []);

  // The known defects — each one must be caught.
  await expect("CASE: 2 <h1> → h1-count", FIXTURE_DIRTY, "fixture", ["#h1-count"]);
  await expect("CASE: main long nhau → main-nested", FIXTURE_DIRTY, "fixture", ["#main-nested"]);
  await expect("CASE: control khong ten → a11y-name", FIXTURE_DIRTY, "fixture", ["#a11y-name:"]);
  await expect("CASE: mat focus ring → focus-ring", FIXTURE_DIRTY, "fixture", ["#focus-ring:"]);
  await expect("CASE: chu tuong phan thap → contrast", FIXTURE_DIRTY, "fixture", ["#contrast:"]);
  await expect("CASE: muc tieu 16px → target-size", FIXTURE_DIRTY, "fixture", ["#target-size:"]);
  await expect("CASE: tran ngang 320px → overflow-320", FIXTURE_DIRTY, "fixture", ["#overflow-320"]);

  if (failures) {
    console.error(`\ncheck-a11y-runtime SELF-TEST FAILED: ${failures}/${total} case. Gate khong duoc tin.`);
    return 1;
  }
  console.log(`\ncheck-a11y-runtime SELF-TEST PASS: ${total} case theo dac ta.`);
  return 0;
}

// ────────────────────────────────────────────────────────────────── main ───────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      "Usage: node packages/web/scripts/check-a11y-runtime.mjs [--print-violations] [--update-baseline] [--self-test]",
    );
    return 0;
  }
  if (opts.selfTest) return selfTest();
  return run(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
