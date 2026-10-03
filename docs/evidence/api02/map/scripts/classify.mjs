import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });
const R = "C:/Mujoco Projects/w3-m3/packages/web/src/";
const rows = JSON.parse(fs.readFileSync("C:/Users/PHAMVI~1/AppData/Local/Temp/opencode/api02/rows-final.json", "utf8"));
const nb = rows.filter((r) => r.field_read === "<no local read>");
const cat = new Map();
const add = (k, r) => { if (!cat.has(k)) cat.set(k, []); cat.get(k).push(r); };
for (const r of nb) {
  const L = fs.readFileSync(R + r.fe_file, "utf8").split(/\r?\n/)[r.call_line - 1].trim();
  const before = L.slice(0, L.indexOf("." + r.adapter_fn));
  if (/^\s*(const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(async\s*)?\(/.test(L) || /=>\s*$/.test(before)) add("D) deferred loader / callback passed on", r);
  else if (/^\s*return\b/.test(L)) add("B) returned directly to caller", r);
  else if (/\.then\s*\(/.test(L) || /\.catch\s*\(/.test(L)) add("C) .then()/.catch() chain, handled inline", r);
  else if (/^\s*(await\s+)?[A-Za-z_$][\w$]*\??\.\s*$/.test(before + ".") || /^\s*await\s*$/.test(before)) add("A) fire-and-forget (result discarded)", r);
  else if (/^\s*(const|let|var)\s/.test(before)) add("E) assigned, form not recognised", r);
  else add("F) other", r);
}
console.log("=== 260 rows with no recognised local field read, by shape ===");
for (const [k, v] of [...cat.entries()].sort()) console.log(`  ${k.padEnd(46)} ${v.length}`);
console.log("\n--- samples ---");
for (const [k, v] of [...cat.entries()].sort()) {
  console.log("\n" + k);
  for (const r of v.slice(0, 4)) {
    const L = fs.readFileSync(R + r.fe_file, "utf8").split(/\r?\n/)[r.call_line - 1].trim();
    console.log(`   ${r.fe_file}:${r.call_line}  ${L.slice(0, 120)}`);
  }
}
