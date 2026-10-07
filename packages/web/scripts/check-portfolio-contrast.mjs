#!/usr/bin/env node
// S-01b - do contrast THAT tren token file, khong phai bang bang tinh.
//
// VAY SAO CAN SLICE NAY:
// `npm run check:contrast` (scripts/check-contrast.mjs:26-34) in ra MOT bang 7 cap
// mau admin TINH SAN - no KHONG doc file nao. Xoa sach toan bo palette portfolio
// thi output y het, van PASS, van exit 0. Gate do khong the bat duoc gi ve
// portfolio, nhung plan v2 dua no vao 4 cho (audit M1).
//
// Gate nay DOC THAT `soc.tokens.css`, tach cac cap `--pf-*: value` / `var(...)`,
// roi tinh WCAG 2.x contrast ratio giua mau chuoi va nen cua theme.
//
// Thoat 1 (FAIL) khi co cap duoi nguong - dung cho pre-push.
// `--self-test` : chay negative proof - them cap co chu dich FAIL va phai bao loi.
//
// Dung:
//   node scripts/check-portfolio-contrast.mjs
//   node scripts/check-portfolio-contrast.mjs --self-test
//   node scripts/check-portfolio-contrast.mjs --tokens <path> --threshold 4.5

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_TOKENS = "src/components/soc/soc.tokens.css";
const DEFAULT_THRESHOLD = 4.5;

function parseArgs(argv) {
  const out = { selfTest: false, tokens: DEFAULT_TOKENS, threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--self-test") out.selfTest = true;
    else if (argv[i] === "--tokens") out.tokens = argv[++i];
    else if (argv[i] === "--threshold") out.threshold = Number(argv[++i]);
  }
  return out;
}

// ---------------------------------------------------------------- color math
function parseColor(value) {
  if (!value) return null;
  let v = String(value).trim();
  const varMatch = v.match(/^var\(\s*--([\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (varMatch) v = String(varMatch[2] ?? "").trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function relativeLuminance([r, g, b]) {
  const chan = [r, g, b].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ------------------------------------------------------------ token reading
// Doc `:root` (dark mac dinh) va `:root[data-theme="light"]` rieng biet.
// Tra { dark: {name: color}, light: {...} }.
export function readTokenFile(text) {
  const blocks = [];
  const rootRe = /:root(?:\[\s*data-theme\s*=\s*"([\w-]+)"\s*\])?\s*\{([^}]*)\}/g;
  let m;
  while ((m = rootRe.exec(text)) !== null) {
    blocks.push({ theme: m[1] || "dark", body: m[2] });
  }
  const out = { dark: {}, light: {} };
  const tokenRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const { theme, body } of blocks) {
    const bucket = theme === "light" ? out.light : out.dark;
    let t;
    while ((t = tokenRe.exec(body)) !== null) {
      bucket[t[1]] = t[2].trim();
    }
  }
  return out;
}

// Danh sach cap can do: [token chuoi, token nen] cho MOI theme.
const PAIRS = [
  ["--pf-gain", "--pf-surface"],
  ["--pf-loss", "--pf-surface"],
  ["--pf-flat", "--pf-surface"],
  ["--pf-accent", "--pf-surface"],
  ["--pf-positive-text", "--pf-positive-soft"],
  ["--pf-negative-text", "--pf-negative-soft"],
];

export function evaluate(tokens, pairs = PAIRS, threshold = 4.5) {
  const rows = [];
  const problems = [];
  for (const theme of ["dark", "light"]) {
    const bucket = tokens[theme] || {};
    for (const [fgName, bgName] of pairs) {
      const fgRaw = bucket[fgName];
      const bgRaw = bucket[bgName];
      if (!fgRaw) {
        problems.push({ theme, fgName, reason: "missing_fg" });
        continue;
      }
      if (!bgRaw) {
        problems.push({ theme, bgName, reason: "missing_bg" });
        continue;
      }
      const fg = parseColor(fgRaw);
      const bg = parseColor(bgRaw);
      if (!fg) {
        problems.push({ theme, fgName, reason: `unparsed_fg:${fgRaw}` });
        continue;
      }
      if (!bg) {
        problems.push({ theme, bgName, reason: `unparsed_bg:${bgRaw}` });
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      const pass = ratio >= threshold;
      rows.push({ theme, fgName, bgName, ratio: Number(ratio.toFixed(2)), pass });
      if (!pass) problems.push({ theme, fgName, bgName, ratio: Number(ratio.toFixed(2)) });
    }
  }
  return { rows, problems, threshold };
}

// ------------------------------------------------------------------- runner
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.selfTest) {
    // Negative proof: hai cap co chu dich phai FAIL.
    const fake = {
      dark: { "--pf-gain": "#777777", "--pf-surface": "#777777" },
      light: { "--pf-gain": "#ffffff", "--pf-surface": "#ffffff" },
    };
    const { problems } = evaluate(fake);
    if (problems.length === 0) {
      console.error("✗ self-test FAIL: mau trung nhau phai bi bao loi");
      process.exit(1);
    }
    console.log(`✓ self-test PASS (${problems.length} cap co chu dich bi phat hien)`);
    return;
  }

  const abs = path.resolve(args.tokens);
  if (!fs.existsSync(abs)) {
    console.error(`✗ khong tim thay token file: ${abs}`);
    process.exit(1);
  }
  const tokens = readTokenFile(fs.readFileSync(abs, "utf8"));
  const { rows, problems, threshold } = evaluate(tokens, PAIRS, args.threshold);

  if (rows.length === 0) {
    console.error(`✗ doc duoc ${abs} nhung khong tim thay cap token --pf-* nao de do.`);
    console.error("  (Neu vua them token, kiem tra co nam trong khoi :root khong)");
    process.exit(1);
  }

  console.log(`— do contrast THAT tren ${path.relative(process.cwd(), abs)} (nguong ${threshold}:1)\n`);
  for (const r of rows) {
    console.log(
      `${r.pass ? "✓" : "✗"} ${r.theme.padEnd(5)} ${r.fgName.padEnd(20)} tren ${r.bgName.padEnd(20)} ${r.ratio.toFixed(2)}:1`,
    );
  }
  console.log("");
  if (problems.length > 0) {
    console.error(`✗ check-portfolio-contrast — FAIL (${problems.length}/${rows.length} cap khong dat)`);
    for (const p of problems) {
      console.error(`   ${p.theme} ${p.fgName}${p.bgName ? ` / ${p.bgName}` : ""} ${p.reason ?? `${p.ratio}:1`}`);
    }
    process.exit(1);
  }
  console.log(`✓ check-portfolio-contrast — PASS (${rows.length} cap × 2 theme >= ${threshold}:1)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
