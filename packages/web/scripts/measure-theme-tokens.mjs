#!/usr/bin/env node
/**
 * measure-theme-tokens.mjs — ĐO theme token + contrast THẬT trên staging (CHỈ ĐO).
 *
 * Mục đích (AC-1 của `docs/PLAN_UI_STANDARDIZATION_W0.md`):
 *   Lấy bằng chứng **tái lập được** cho câu hỏi "light theme có dùng được không",
 *   KHÔNG sửa 1 dòng CSS nào (NG-1 / NG-4 / NG-5 / NG-6 của plan).
 *
 * Chạy:
 *   node packages/web/scripts/measure-theme-tokens.mjs
 *   node packages/web/scripts/measure-theme-tokens.mjs --json
 *   BASE_URL=http://localhost:5173 node packages/web/scripts/measure-theme-tokens.mjs
 *
 * Exit code:
 *   0 = đo xong, HOẶC in `CHUA CHAY: <ly do>` (máy không có staging / browser /
 *       mạng) — vì `scripts/pre-push-gate.mjs:307` coi exit ≠ 0 là FAIL ⇒ gate sẽ
 *       chặn push oan (plan N1).
 *   1 = `CONTROL FAIL` — phép đo hỏng ⇒ **mọi số khác trong lô này vô giá trị**
 *       (L-V01) ⇒ KHÔNG được đọc số khác.
 *   2 = lỗi nội bộ script.
 *
 * BẰNG CHỨNG ĐÚNG SAI (L-V01): script này có **control có đáp án biết trước** —
 *   `#fff` trên `#000` phải ra **21.00:1**, `#777` trên `#fff` phải ra **4.48:1**.
 *   Control chạy qua **ĐÚNG** đường đo của script (cùng hàm parse màu + cùng
 *   hàm contrast) ⇒ control đúng là bằng chứng phép đo đúng.
 *
 * MÀU `oklch`/`color-mix` (L-V06): `getComputedStyle` có thể trả `oklch(...)`.
 *   Script **ép về rgba** trong chính browser qua canvas 1×1 + span tạm ⇒ không
 *   parse chuỗi bằng regex ⇒ `null` (đọc hỏng) không bao giờ bị nhầm là "trong suốt".
 *
 * ⚠ Script này KHÔNG ghi file nào vào repo (không screenshot) ⇒ không làm bẩn
 *   working tree (L-V03).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');

const BASE_URL = (process.env.BASE_URL || 'https://docker.edusuccess.vn').replace(/\/+$/, '');
const USER = process.env.MEASURE_USER || 'testuser@vninvest.vn';
const PASS = process.env.MEASURE_PASS || 'TestPass123!';
const AS_JSON = process.argv.includes('--json');
const SIMULATE = !process.argv.includes('--no-simulate');

const SSH_HOST = process.env.STAGING_SSH_HOST || 'root@14.225.255.47';
const SSH_KEY = process.env.STAGING_SSH_KEY || join(homedir(), '.ssh', 'id_ed25519');
const SSH_REPO = process.env.STAGING_REPO_DIR || '/opt/vninvest';

const ROUTES = [
  { id: 'admin-users', path: '/admin/users' },
  { id: 'operations-center-vnbroker', path: '/operations-center?tab=vnbroker' },
  { id: 'dashboard', path: '/dashboard' },
  // route DUY NHẤT render `.pfm-modal__panel` / `.pfm-drawer__panel`
  // (PortfolioFormDialog.tsx:94 · PortfolioManageDrawer.tsx:251) — dùng để chứng minh
  // `--bg-panel-solid` CÓ thật trên route đó (PortfoliosPage.tsx:32 import soc.tokens.css)
  { id: 'portfolios-manage', path: '/portfolios/manage' },
];

const TOKENS = [
  '--text-primary',
  '--color-bg-primary',
  '--text-muted',
  '--bg-panel',
  '--bg-panel-solid',
];

const CONTROL = [
  { fg: '#ffffff', bg: '#000000', expect: 21.0, tol: 0.01 },
  { fg: '#777777', bg: '#ffffff', expect: 4.48, tol: 0.01 },
];

/**
 * Cặp màu tham chiếu — tính bằng **ĐÚNG** hàm contrast của script (trong browser)
 * ⇒ tái lập được bằng 1 lệnh, không cần đoán.
 */
const REFERENCE_PAIRS = [
  { id: 'R1', fg: '#020617', bg: '#ffffff', note: 'adminUi.tsx:24 text-slate-950 tren panel bg-white (adminUi.tsx:48) — light theme' },
  { id: 'R2', fg: '#f1f5f9', bg: '#ffffff', note: 'sau khi override --color-slate-950: #f1f5f9 (sua nho) — cung panel nen trang' },
  { id: 'R3', fg: '#0f172a', bg: '#f8fafc', note: 'light + canvas sang (#f8fafc) — chu toi cua app' },
  { id: 'R4', fg: '#f1f5f9', bg: '#f8fafc', note: 'light + canvas sang — chu SANG cung cua trang SOC/dashboard' },
  { id: 'R5', fg: '#ffffff', bg: '#020617', note: 'H1 admin, dark theme (do that tren trang)' },
  { id: 'R6', fg: '#020617', bg: '#020617', note: 'H1 admin, light theme (do that tren trang)' },
];

/* ───────────────────────── helpers (Node side) ───────────────────────── */

function log(...args) {
  if (!AS_JSON) console.log(...args);
}

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/* ───────────── token conflict (đếm TĨNH trên 3 file CSS — không cần mạng) ───────────── */

/** Phạm vi theo plan C2: `index.css` (mọi khối `:root` + khối `@theme`) + `theme/tokens.css` + `components/soc/soc.tokens.css`. */
const CONFLICT_FILES = [
  'packages/web/src/index.css',
  'packages/web/src/theme/tokens.css',
  'packages/web/src/components/soc/soc.tokens.css',
];

function cssBlocks(css, file) {
  const out = [];
  const re = /(@theme|:root)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const kind = m[1];
    const open = css.indexOf('{', m.index);
    let selStart = 0;
    for (let i = open - 1; i >= 0; i -= 1) {
      if (css[i] === '}' || css[i] === '{' || css[i] === ';') { selStart = i + 1; break; }
    }
    const selector = css.slice(selStart, open).trim().replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let depth = 0;
    let i = open;
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    const body = css.slice(open + 1, i);
    const tokens = new Map();
    const tre = /--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;
    let t;
    while ((t = tre.exec(body))) tokens.set(t[1], t[2].trim().replace(/\s+/g, ' '));
    out.push({ kind, selector, tokens, file });
    re.lastIndex = i + 1;
  }
  return out;
}

/**
 * Conflict = cùng 1 token được khai ở ≥2 khối VỚI GIÁ TRỊ KHÁC NHAU.
 * Khối `:root[data-theme="light"]` KHÔNG tính (override theo theme là chủ ý).
 *  - mode B (`:root` + `@theme`) = baseline **13**
 *  - mode A (`:root` thuần)      = baseline **11**
 */
function countTokenConflicts() {
  const blocks = [];
  for (const f of CONFLICT_FILES) {
    const abs = resolve(REPO_ROOT, f);
    if (!existsSync(abs)) return { error: `khong tim thay file ${f}` };
    const css = readFileSync(abs, 'utf8');
    for (const b of cssBlocks(css, f)) {
      if (/data-theme/.test(b.selector)) continue;
      blocks.push(b);
    }
  }
  const run = (mode) => {
    const map = new Map();
    blocks.forEach((b, idx) => {
      if (mode === 'A' && b.kind === '@theme') return;
      for (const [tok, val] of b.tokens) {
        if (!map.has(tok)) map.set(tok, []);
        map.get(tok).push({ idx, val, kind: b.kind, file: b.file });
      }
    });
    const out = [];
    for (const [tok, defs] of map) {
      if (defs.length < 2) continue;
      if (new Set(defs.map((d) => d.val)).size === 1) continue; // gia tri giong nhau => khong conflict
      out.push([tok, defs]);
    }
    return out;
  };
  return { blocks, modeB: run('B'), modeA: run('A') };
}

function printTokenConflict() {
  const r = countTokenConflicts();
  if (r.error) {
    log(`CHUA CHAY: ${r.error}`);
    return 0;
  }
  console.log('TOKEN CONFLICT (đếm tĩnh trên 3 file CSS — không cần mạng, không sửa gì)');
  console.log(`Phạm vi: ${CONFLICT_FILES.join('  |  ')}`);
  console.log(`Định nghĩa: cùng token, khác GIÁ TRỊ, khai ở >=2 khối; khối :root[data-theme="light"] bị loại.`);
  console.log('');
  console.log('Các khối đã quét:');
  r.blocks.forEach((b, i) => console.log(`  [${i}] ${b.file.replace('packages/web/src/', '')}  selector="${b.selector}"  tokens=${b.tokens.size}`));
  console.log('');
  for (const [mode, list, baseline] of [['B', r.modeB, 13], ['A', r.modeA, 11]]) {
    const label = mode === 'B' ? 'mode B (:root + @theme)' : 'mode A (:root thuần)';
    console.log(`MODE ${label} => CONFLICT = ${list.length}   (baseline ${baseline})`);
    for (const [tok, defs] of list.sort()) {
      console.log(`   --${tok}`);
      defs.forEach((d) => console.log(`        ${d.file.replace('packages/web/src/', '')} [${d.kind}] = ${d.val}`));
    }
    console.log(list.length === baseline
      ? `   => KHONG DOI so voi baseline ${baseline}`
      : `   => !!! THAY DOI so voi baseline ${baseline} (phai revert) !!!`);
    console.log('');
  }
  return 0;
}

/**
 * Sha **đang chạy** trên staging (để baseline gắn đúng app, O13).
 * Nguồn: env `STAGING_SHA` → SSH vào VPS đọc `git rev-parse HEAD` → fingerprint
 * asset (KHÔNG phải git sha, phải ghi rõ).
 */
function resolveStagingSha() {
  if (process.env.STAGING_SHA) {
    return { sha: process.env.STAGING_SHA, source: 'env STAGING_SHA', branch: null };
  }
  if (existsSync(SSH_KEY)) {
    const r = spawnSync(
      'ssh',
      [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-i', SSH_KEY,
        SSH_HOST,
        `cd ${SSH_REPO} && git rev-parse HEAD && git rev-parse --abbrev-ref HEAD`,
      ],
      { encoding: 'utf8', timeout: 30000 },
    );
    if (r.status === 0 && r.stdout) {
      const [sha, branch] = r.stdout.trim().split(/\r?\n/);
      if (sha && /^[0-9a-f]{7,40}$/.test(sha.trim())) {
        return { sha: sha.trim(), branch: (branch || '').trim(), source: `ssh ${SSH_HOST}:${SSH_REPO}` };
      }
    }
  }
  return { sha: null, branch: null, source: null };
}

/* ───────────── hàm đo — chạy TRONG browser (page.evaluate) ───────────── */

/**
 * Toàn bộ phép đo nằm trong 1 hàm để (a) chạy trong ngữ cảnh trang thật và
 * (b) CONTROL đi qua **đúng** đường đo này (L-V01).
 */
function measureInPage({ theme, simulate, controls: controlSpec, tokens: tokenSpec, pairs: pairSpec }) {
  /* --- ép màu về rgba: span tạm + canvas 1x1 (không regex) --- */
  const cv = document.createElement('canvas');
  cv.width = 1;
  cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  function normalizeViaSpan(cssColor) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
    probe.style.color = cssColor;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  }

  function parseColor(cssColor) {
    const raw = String(cssColor == null ? '' : cssColor).trim();
    if (!raw || raw === 'none') return { r: 0, g: 0, b: 0, a: 0, css: raw, ok: true };
    if (raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0, css: raw, ok: true };

    // fast path: rgb()/rgba() — chính xác tuyệt đối
    const m = /^rgba?\(([^)]+)\)$/i.exec(raw);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
        return {
          r: parts[0], g: parts[1], b: parts[2],
          a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1,
          css: raw, ok: true,
        };
      }
    }

    // đường tổng quát: span tạm → canvas 1x1 (giữ được oklch/color-mix)
    const normalized = normalizeViaSpan(raw);
    const sentinel = '#010203';
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = sentinel;
    ctx.fillStyle = normalized;
    const applied = ctx.fillStyle;
    if (applied === sentinel && normalized.toLowerCase() !== sentinel) {
      return { r: 0, g: 0, b: 0, a: 0, css: raw, normalized, ok: false };
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return {
      r: d[0], g: d[1], b: d[2], a: d[3] / 255,
      css: raw, normalized, applied, ok: true,
    };
  }

  function hex(c) {
    if (!c) return 'n/a';
    const h = (n) => Math.round(n).toString(16).padStart(2, '0');
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  }

  function luminance(c) {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrast(fg, bg) {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function over(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  }

  /** Nền THẬT sau 1 element: composite nhiều lớp từ gốc lên element. */
  function effectiveBackground(el) {
    const layers = [];
    let hasImageLayer = false;
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bg = parseColor(cs.backgroundColor);
      const bi = cs.backgroundImage;
      if (bg && bg.a > 0) {
        layers.push({
          tag: node.tagName.toLowerCase(),
          cls: (node.className && typeof node.className === 'string' ? node.className : '')
            .split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
          color: bg.css, rgba: [bg.r, bg.g, bg.b, Number(bg.a.toFixed(3))], hex: hex(bg), alpha: bg.a,
        });
      }
      if (bi && bi !== 'none') {
        hasImageLayer = true;
        layers.push({ tag: node.tagName.toLowerCase(), image: bi.slice(0, 120) });
      }
      node = node.parentElement;
    }
    // base = canvas trắng của trình duyệt
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const l = layers[i];
      if (l.image) continue; // không composite được ảnh/nền gradient
      const c = { r: l.rgba[0], g: l.rgba[1], b: l.rgba[2], a: l.rgba[3] };
      acc = over(c, acc);
    }
    return { layers, hasImageLayer, result: acc };
  }

  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const t of tokenSpec || []) {
      const v = cs.getPropertyValue(t).trim();
      out[t] = v === '' ? null : v;
    }
    return out;
  }

  function collectH1() {
    const list = [];
    const nodes = Array.from(document.querySelectorAll('h1'));
    for (const h of nodes) {
      const rect = h.getClientRects();
      const visible = rect.length > 0 && rect[0].height > 0 && rect[0].width > 0;
      const cs = getComputedStyle(h);
      const fg = parseColor(cs.color);
      const bgInfo = effectiveBackground(h);
      const inChrome = !!h.closest('aside, nav, [class*="sidebar" i], [class*="Sidebar" i]');
      list.push({
        text: (h.textContent || '').trim().slice(0, 70),
        visible,
        inSidebarOrChrome: inChrome,
        color: cs.color,
        colorHex: hex(fg),
        colorAlpha: fg.a,
        bgLayers: bgInfo.layers,
        bgHasImage: bgInfo.hasImageLayer,
        bgComposite: hex(bgInfo.result),
        bgCompositeRgba: [
          Math.round(bgInfo.result.r), Math.round(bgInfo.result.g),
          Math.round(bgInfo.result.b), Number(bgInfo.result.a.toFixed(3)),
        ],
        contrast: Number(contrast(fg, bgInfo.result).toFixed(4)),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      });
    }
    return list;
  }

  /**
   * MẪU CHỮ (không chỉ H1): đo contrast của mọi phần tử có chữ trực tiếp.
   * Dùng để đo **bán kính ảnh hưởng** của 1 phương án sửa: nếu 1 override làm
   * N phần tử rơi dưới WCAG AA thì phương án đó KHÔNG an toàn (không chỉ H1).
   */
  function collectTextSample(limit = 60) {    const out = [];
    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      if (out.length >= limit) break;
      const direct = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!direct) continue;
      const rect = el.getClientRects();
      if (!rect.length || rect[0].height <= 0 || rect[0].width <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (Number(cs.opacity) === 0) continue;
      const fg = parseColor(cs.color);
      if (!fg || fg.a === 0) continue;
      const bgInfo = effectiveBackground(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '')
          .split(/\s+/).filter(Boolean).slice(0, 2).join('.'),
        text: (el.textContent || '').trim().slice(0, 40),
        colorHex: hex(fg),
        bgComposite: hex(bgInfo.result),
        contrast: Number(contrast(fg, bgInfo.result).toFixed(4)),
      });
    }
    const sorted = out.slice().sort((a, b) => a.contrast - b.contrast);
    const below = out.filter((o) => o.contrast < 4.5);
    return {
      count: out.length,
      belowAA: below.length,
      minContrast: out.length ? sorted[0].contrast : null,
      worst: sorted.slice(0, 5),
    };
  }

  /**
   * Bán kính ảnh hưởng của việc override `text-slate-950` TOÀN CỤC:
   * đo contrast của MỌI phần tử đang dùng class `text-slate-950`
   * (adminUi.tsx:24 `text-slate-950` + `adminUi.tsx:48` panel `bg-white`).
   */
  function collectSlate950() {
    const out = [];
    const nodes = Array.from(document.querySelectorAll('[class*="text-slate-950"]'));
    for (const el of nodes) {
      const rect = el.getClientRects();
      if (!rect.length || rect[0].height <= 0) continue;
      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      const bgInfo = effectiveBackground(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
        text: (el.textContent || '').trim().slice(0, 40),
        colorHex: hex(fg),
        bgComposite: hex(bgInfo.result),
        contrast: Number(contrast(fg, bgInfo.result).toFixed(4)),
      });
    }
    return { count: out.length, worst: out.slice().sort((a, b) => a.contrast - b.contrast).slice(0, 5) };
  }

  /* ---- cặp màu tham chiếu — qua ĐÚNG hàm contrast ---- */
  const referencePairs = [];
  for (const p of pairSpec || []) {
    const fg = parseColor(p.fg);
    const bg = parseColor(p.bg);
    referencePairs.push({
      id: p.id, fg: p.fg, bg: p.bg, note: p.note,
      value: Number(contrast(fg, bg).toFixed(4)),
    });
  }

  /* ---- CONTROL: qua ĐÚNG hàm đo này ---- */
  const controls = [];
  for (const c of controlSpec || []) {
    const fg = parseColor(c.fg);
    const bg = parseColor(c.bg);
    const value = Number(contrast(fg, bg).toFixed(4));
    controls.push({
      fg: c.fg, bg: c.bg, expect: c.expect, tol: c.tol, value,
      ok: Math.abs(value - c.expect) <= c.tol,
    });
  }

  /* ---- canvas thật ---- */
  const bodyBgRaw = getComputedStyle(document.body).backgroundColor;
  const bodyBg = parseColor(bodyBgRaw);
  const htmlBgRaw = getComputedStyle(document.documentElement).backgroundColor;
  const htmlBg = parseColor(htmlBgRaw);

  return {
    theme,
    simulate: simulate || null,
    url: location.pathname + location.search,
    dataTheme: document.documentElement.getAttribute('data-theme'),
    tokens: readTokens(),
    canvas: {
      bodyBackgroundColor: bodyBgRaw,
      bodyBackgroundHex: hex(bodyBg),
      bodyBackgroundRgba: [bodyBg.r, bodyBg.g, bodyBg.b, Number(bodyBg.a.toFixed(3))],
      htmlBackgroundColor: htmlBgRaw,
      htmlBackgroundHex: hex(htmlBg),
    },
    h1: collectH1(),
    textSample: collectTextSample(),
    slate950: collectSlate950(),
    referencePairs,
    controls,
  };
}

/* ───────────────────────── chạy ───────────────────────── */

async function main() {
  const args = parseArgs();

  /* 0) chế độ đếm token conflict — TĨNH, không cần mạng */
  if (process.argv.includes('--token-conflict')) {
    return printTokenConflict();
  }

  // 1) sha đang chạy trên staging
  const shaInfo = resolveStagingSha();

  // 2) playwright
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    log(`CHUA CHAY: khong tim thay package 'playwright' (${err.message})`);
    log('  -> Cai: cd packages/web && npm i -D @playwright/test && npx playwright install chromium');
    return 0;
  }

  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch (err) {
    log(`CHUA CHAY: khong khoi dong duoc chromium (${err.message})`);
    log('  -> Cai: cd packages/web && npx playwright install chromium');
    return 0;
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    /* 3) đăng nhập */
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const emailInput = page
      .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 20000 });
    await emailInput.fill(USER);
    await page.locator('input[type="password"]').fill(PASS);
    await page.locator('button[type="submit"]').click();
    // app mở WS/poll nên sự kiện 'load' không fire — chỉ chờ 'domcontentloaded'
    await page.waitForURL('**/dashboard', { timeout: 45000, waitUntil: 'domcontentloaded' });

    /* 4) đo từng route × từng theme */
    const results = [];
    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      let loaded = true;
      let loadNote = '';
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 20000 }).catch(() => {
          loadNote = 'khong tim thay <h1> trong 20s';
        });
        await page.waitForTimeout(900); // để style áp xong
      } catch (err) {
        loaded = false;
        loadNote = err.message;
      }
      if (!loaded) {
        results.push({ route, loaded: false, note: loadNote });
        continue;
      }

      // theme = dark (KHÔNG có data-theme) — theo đúng boot của main.tsx:265
      await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
      await page.waitForTimeout(300);
      const dark = await page.evaluate(measureInPage, { theme: 'default (khong co data-theme)', simulate: null, controls: CONTROL, tokens: TOKENS, pairs: REFERENCE_PAIRS });

      // theme = light
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await page.waitForTimeout(300);
      const light = await page.evaluate(measureInPage, { theme: 'light (data-theme="light")', simulate: null, controls: CONTROL, tokens: TOKENS, pairs: REFERENCE_PAIRS });

      const entry = { route, loaded: true, note: loadNote, dark, light, simulations: [] };

      /* 5) MÔ PHỎNG (inject CSS — KHÔNG sửa app) */
      if (SIMULATE) {
        const sims = [
          {
            id: 'SIM-A',
            label: 'light + CANVAS SANG (--color-bg-primary: #f8fafc) = phuong an (a) lam light theme dung',
            css: ':root[data-theme="light"]{--color-bg-primary:#f8fafc !important;}',
          },
          {
            id: 'SIM-B',
            label: 'light + override --color-slate-950: #f1f5f9 = "sua nho" text-slate-950 toan cuc',
            css: ':root{--color-slate-950:#f1f5f9 !important;}',
          },
        ];
        for (const sim of sims) {
          await page.evaluate((css) => {
            const el = document.createElement('style');
            el.id = '__measure_sim__';
            el.textContent = css;
            document.head.appendChild(el);
          }, sim.css);
          await page.waitForTimeout(250);
          const m = await page.evaluate(measureInPage, { theme: 'light (data-theme="light")', simulate: sim.id, controls: CONTROL, tokens: TOKENS, pairs: REFERENCE_PAIRS });
          await page.evaluate(() => {
            const el = document.getElementById('__measure_sim__');
            if (el) el.remove();
          });
          entry.simulations.push({ id: sim.id, label: sim.label, css: sim.css, measure: m });
        }
      }

      results.push(entry);
    }

    /* 6) in báo cáo */
    const report = {
      measuredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      stagingSha: shaInfo.sha,
      stagingBranch: shaInfo.branch,
      stagingShaSource: shaInfo.source,
      repoRoot: REPO_ROOT,
      routes: results,
    };

    if (AS_JSON) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    /* 7) CONTROL — quyết định exit code */
    const controlResults = results.flatMap((r) => [
      ...(r.dark ? r.dark.controls : []),
      ...(r.light ? r.light.controls : []),
      ...(r.simulations || []).flatMap((s) => s.measure.controls),
    ]);
    const failed = controlResults.filter((c) => !c.ok);
    if (controlResults.length && failed.length) {
      console.error('');
      console.error('CONTROL FAIL: phep do bi hong -> MOI so khac trong lot nay VO GIA TRI (L-V01)');
      for (const f of failed) {
        console.error(`  control ${f.fg} tren ${f.bg}: do duoc ${f.value} (mong doi ${f.expect} +/- ${f.tol})`);
      }
      await browser.close();
      return 1;
    }
    if (!controlResults.length) {
      console.error('');
      console.error('CONTROL FAIL: khong co control nao chay duoc (khong do duoc route nao)');
      await browser.close();
      return 1;
    }

    log('');
    log(`CONTROL OK: ${controlResults.length} lan - #fff tren #000 = 21.00, #777 tren #fff = 4.48`);
    await browser.close();
    return 0;
  } catch (err) {
    console.error('');
    console.error(`CHUA CHAY: ${err.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return 0;
  }
}

function fmt(n, digits = 4) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
}

function printTextSample(ts) {
  if (!ts || !ts.count) return;
  console.log(
    `     mẫu chữ       : ${ts.count} phần tử có chữ · dưới WCAG AA (<4.5) = ${ts.belowAA}`
    + ` · thấp nhất = ${fmt(ts.minContrast)}:1`,
  );
  for (const w of ts.worst.slice(0, 5)) {
    console.log(`        <${w.tag}${w.cls ? ' class="' + w.cls + '"' : ''}> "${w.text}" ${w.colorHex} trên ${w.bgComposite} = ${fmt(w.contrast)}:1`);
  }
}

function printSlate950(s) {
  if (!s || !s.count) {
    console.log('     text-slate-950: (trang KHÔNG có phần tử nào dùng class này)');
    return;
  }
  console.log(`     text-slate-950: ${s.count} phần tử dùng class này · 5 tệ nhất:`);
  for (const w of s.worst) {
    console.log(`        <${w.tag}> "${w.text}" ${w.colorHex} trên ${w.bgComposite} = ${fmt(w.contrast)}:1`);
  }
}

function printReport(report) {
  const line = '─'.repeat(78);
  console.log(line);
  console.log('MEASURE THEME TOKENS — đo thật trên staging (CHỈ ĐO, không sửa token)');
  console.log(line);
  console.log(`Thời điểm đo     : ${report.measuredAt}`);
  console.log(`Staging URL     : ${report.baseUrl}`);
  console.log(`Sha đang chạy   : ${report.stagingSha || '(KHÔNG xác định được)'}`);
  console.log(`  nguồn sha     : ${report.stagingShaSource || '(không có)'}`);
  console.log(`  branch        : ${report.stagingBranch || '(không có)'}`);
  console.log(`Repo (script)   : ${report.repoRoot}`);
  console.log('');

  for (const r of report.routes) {
    console.log(line);
    console.log(`ROUTE: ${r.route.id}  (${r.route.path})`);
    if (!r.loaded) {
      console.log(`  CHUA CHAY: ${r.note}`);
      console.log('');
      continue;
    }
    for (const key of ['dark', 'light']) {
      const m = r[key];
      console.log(`  ── ${m.theme}`);
      console.log(`     url           : ${m.url}   data-theme=${m.dataTheme}`);
      for (const [t, v] of Object.entries(m.tokens)) {
        console.log(`     ${t.padEnd(20)}= ${v === null ? '(KHÔNG định nghĩa)' : v}`);
      }
      console.log(`     canvas thật   : body.backgroundColor = ${m.canvas.bodyBackgroundColor} → ${m.canvas.bodyBackgroundHex}`);
      console.log(`     html bg       : ${m.canvas.htmlBackgroundColor} → ${m.canvas.htmlBackgroundHex}`);
      if (!m.h1.length) {
        console.log('     H1            : (trang KHÔNG có <h1>)');
      }
      for (const h of m.h1) {
        const tag = h.inSidebarOrChrome ? ' [sidebar/shell]' : '';
        console.log(
          `     H1${tag} : "${h.text}" color=${h.color} (${h.colorHex}) size=${h.fontSize} w=${h.fontWeight}`,
        );
        console.log(`        nền composite = ${h.bgComposite} rgba(${h.bgCompositeRgba.join(',')})`
          + `${h.bgHasImage ? '  ⚠ có background-image (không composite được)' : ''}`);
        console.log(`        CONTRAST      = ${fmt(h.contrast)}:1`
          + `${h.contrast < 1.5 ? '   ← VÔ HÌNH' : h.contrast < 4.5 ? '   ← dưới WCAG AA' : ''}`);
        if (h.bgLayers.length) {
          console.log('        lớp nền (ngoài → trong):');
          for (const l of h.bgLayers) {
            console.log(l.image
              ? `          <${l.tag}> background-image: ${l.image}`
              : `          <${l.tag}${l.cls ? ' class="' + l.cls + '"' : ''}> ${l.color} → ${l.hex} (alpha ${l.alpha})`);
          }
        }
      }
      printTextSample(m.textSample);
      printSlate950(m.slate950);
      console.log('');
    }

    for (const s of r.simulations || []) {
      console.log(`  ── MÔ PHỎNG ${s.id}: ${s.label}`);
      console.log(`     css inject: ${s.css}`);
      const h = s.measure.h1[0];
      if (h) {
        console.log(`     H1: "${h.text}" color=${h.colorHex} nền=${h.bgComposite} CONTRAST=${fmt(h.contrast)}:1`);
      }
      for (const other of s.measure.h1.slice(1)) {
        console.log(`     H1 khác: "${other.text}" color=${other.colorHex} nền=${other.bgComposite} CONTRAST=${fmt(other.contrast)}:1`);
      }
      console.log(`     canvas thật: ${s.measure.canvas.bodyBackgroundColor} → ${s.measure.canvas.bodyBackgroundHex}`);
      printTextSample(s.measure.textSample);
      printSlate950(s.measure.slate950);
      console.log('');
    }
  }
  console.log(line);
  console.log('CẶP MÀU THAM CHIẾU (tính bằng cùng hàm contrast của script):');
  const refs = (report.routes.find((r) => r.light) || {}).light?.referencePairs || [];
  for (const p of refs) {
    console.log(`  ${p.id}  ${p.fg} trên ${p.bg} = ${fmt(p.value)}:1   — ${p.note}`);
  }
  console.log(line);
  console.log('CONTROL (L-V01): #fff trên #000 = 21.00 · #777 trên #fff = 4.48');
  console.log(line);
}

const code = await main();
process.exit(code);
