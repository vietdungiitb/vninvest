#!/usr/bin/env node
/**
 * Phan loai hit NAV-1: FALSE POSITIVE cua RULE vs LOI THAT cua CODE.
 *
 * Van dung doc lap voi `nav1-rule.mjs` (khong viet lai regex) de tach:
 *   (A) hit do nhanh regex `|q` khop chuoi KHONG phai tim kiem
 *       (`quantity` khop `q`, `queueTiers` khop `que`, `selectedRequestId`
 *       khop `Req-q-uest`)
 *   (B) hit do tu khoa `page|search|sort` khop mot bien **khong phai** bo loc
 *       (`pageError`, `globalSearchLoading`)
 *   (C) hit la CHINH co che dong bo URL (`searchParams` tu `useSearchParams`)
 *   (D) con lai = ung vien that
 *
 * Chay: node docs/audit-uiux/scripts/nav1-classify.mjs [root]
 */
import fs from "node:fs";
import path from "node:path";
import { codeLines, nav1Candidate, urlSyncedVars } from "./nav1-rule.mjs";

const ROOT = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "packages/web/src";

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

/** Nhanh `q` rong cua `NAME_RE` — biet bien nao khop NHA do, khong phai tu khoa that. */
const REAL_KEYWORDS = ["filter", "search", "sort", "page", "tab", "query"];
function matchesRealKeyword(name) {
  const low = name.toLowerCase();
  return REAL_KEYWORDS.find((k) => low.includes(k)) ?? null;
}

/** Ten bien -> co phai bien trang thai cua tim kiem that (khong phai `pageError`)? */
const NOT_A_QUERY = /\.(Error|Notice|Loading|Ref|Fetching|Count|Len)\b|^use[A-Z]/;

function classify(name, hook, code) {
  if (hook && /use(Router)?SearchParams/.test(hook)) {
    return ["C", "chinh la searchParams cua useSearchParams"];
  }
  const kw = matchesRealKeyword(name);
  if (!kw) {
    return ["A", `khop nhanh \`|q\` rong, khong co tu khoa that`];
  }
  const tail = name.slice(name.toLowerCase().indexOf(kw) + kw.length);
  if (tail && NOT_A_QUERY.test(tail)) {
    return ["B", `khop tu khoa "${kw}" nhung phan duoi "${tail}" khong phai bo loc`];
  }
  return ["D", `ung vien that (${kw})`];
}

const buckets = { A: [], B: [], C: [], D: [] };
for (const f of walk(ROOT)) {
  if (f.endsWith(".css")) continue;
  if (/\.(test|spec)\./.test(path.basename(f))) continue;
  const { lines, trueLine } = codeLines(fs.readFileSync(f, "utf8"));
  const synced = urlSyncedVars(lines);
  lines.forEach((l, i) => {
    const c = nav1Candidate(l, synced);
    if (!c) return;
    const [k, why] = classify(c.name, c.hook, l);
    buckets[k].push({ file: f.replace(/\\/g, "/"), line: trueLine[i], name: c.name, hook: c.hook, why });
  });
}

console.log("=== NAV-1 phan loai ===");
console.log(`root: ${ROOT}`);
const total = Object.values(buckets).reduce((a, b) => a + b.length, 0);
for (const k of ["A", "B", "C", "D"]) {
  console.log(`${k}: ${String(buckets[k].length).padStart(3)}`);
}
console.log(`TONG: ${total}`);
for (const k of ["A", "B", "C"]) {
  console.log(`\n--- ${k} (false positive cua rule) ---`);
  for (const r of buckets[k]) console.log(`  ${r.file}:${r.line}  ${r.name}  — ${r.why}`);
}