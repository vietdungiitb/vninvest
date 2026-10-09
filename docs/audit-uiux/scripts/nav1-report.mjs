#!/usr/bin/env node
/**
 * Bao cao NAV-1 — dung de LAP KE HOACH, khong phai gate.
 *
 * Gate la `packages/web/scripts/check-uiux-budget.mjs`. Script nay in ra **tung
 * bien** va **ly do** bi dem / khong dem, de con so trong ke hoach co lenh tai
 * lap. Khong in so ma khong giai thich duoc.
 *
 * ⚠ Chay cung mo hinh voi scanner (`nav1-rule.mjs`) — KHONG tu viet lai regex.
 * Neu hai noi lech nhau, bao cao se noi doi so voi gate: dang bi "so sai" khi
 * bao cao va gate tinh khac nhau.
 *
 * Chay:
 *   node docs/audit-uiux/scripts/nav1-report.mjs [root]        # bang tong hop
 *   node docs/audit-uiux/scripts/nav1-report.mjs [root] --why  # chi tiet tung bien
 *   node docs/audit-uiux/scripts/nav1-report.mjs [root] --json
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { codeLines, nav1Candidate, urlSyncedVars } from "./nav1-rule.mjs";

const ROOT = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "packages/web/src";
const WHY = process.argv.includes("--why");
const JSON_OUT = process.argv.includes("--json");

const EXTS = new Set([".tsx", ".jsx", ".ts", ".js", ".css"]);
const SKIP_DIR = new Set(["node_modules", "__tests__", "tests", "__mocks__"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}
function isTestFile(f) {
  return /\.(test|spec)\./.test(path.basename(f));
}

const rows = [];
for (const f of walk(ROOT)) {
  if (f.endsWith(".css")) continue;
  if (isTestFile(f)) continue;
  const txt = fs.readFileSync(f, "utf8");
  const { lines, trueLine } = codeLines(txt);
  const synced = urlSyncedVars(lines);
  const cands = [];
  lines.forEach((l, i) => {
    const m = l.match(/const\s*\[\s*(\w*(filter|search|sort|page|tab|query|q)\w*)\s*,/i);
    if (!m) return;
    const c = nav1Candidate(l, synced);
    cands.push({
      name: m[1],
      line: trueLine[i],
      counted: Boolean(c),
      hook: c ? c.hook : null,
      key: synced.get(m[1]) ?? null,
      code: l.trim().slice(0, 96),
    });
  });
  if (cands.length) rows.push({ file: f.replace(/\\/g, "/"), cands });
}

const counted = rows.reduce((a, r) => a + r.cands.filter((c) => c.counted).length, 0);
const escaped = rows.reduce((a, r) => a + r.cands.filter((c) => !c.counted).length, 0);

if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT,
    counted,
    escaped,
    files: rows.length,
    byFile: rows.map((r) => ({
      file: r.file,
      counted: r.cands.filter((c) => c.counted).length,
      escaped: r.cands.filter((c) => !c.counted).length,
      cands: r.cands,
    })),
  }, null, 2));
} else {
  console.log("=== NAV-1 report ===");
  console.log(`root: ${ROOT}`);
  console.log(`file co ung vien: ${rows.length} | COUNTED (gate thay): ${counted} | escaped (bi bo qua): ${escaped}`);
  console.log(`tong ung vien: ${counted + escaped}`);
  if (WHY) {
    for (const r of rows) {
      const c = r.cands.filter((c) => c.counted).length;
      const e = r.cands.length - c;
      console.log(`\n${r.file}  counted=${c} escaped=${e}`);
      for (const cand of r.cands) {
        const mark = cand.counted ? "HIT " : "SKIP";
        const why = cand.counted
          ? `khong dong bo URL (${cand.hook})`
          : `da dong bo URL — key "${cand.key}" cua hook`;
        console.log(`  ${mark} :${cand.line}  ${cand.name.padEnd(22)} ${why}`);
      }
    }
  } else {
    console.log("\n(them --why de in tung bien + ly do)");
    const top = rows
      .map((r) => [r.file, r.cands.filter((c) => c.counted).length])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [f, n] of top) console.log(`  ${String(n).padStart(3)}  ${f}`);
  }
}