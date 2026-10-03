import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });

const ROOT = "C:\\Mujoco Projects\\w3-m3\\packages\\web\\src";



const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|dist|\.git/.test(e.name)) continue;
      walk(p, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};
const isProd = (p) =>
  !/(^|[\\/])(node_modules|dist|tests|__tests__|__mocks__)([\\/]|$)/.test(p) && !/\.(test|spec)\.[jt]sx?$/.test(p);

const files = walk(ROOT).filter(isProd).map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));

// A) numeric-default coercion sites.  Capture the full statement (may span lines)
//    Patterns: Number(x) || 0 | Number(x) ?? 0 | parseFloat/parseInt ... || 0
//              x || 0 where x is a payload member read | Number(x || 0)
const NUMDEF = [
  { id: "Number()||0", re: /\b(?:Number|parseFloat|parseInt)\s*\(([^()]*)\)\s*\|\|\s*0\b/g },
  { id: "Number()??0", re: /\b(?:Number|parseFloat|parseInt)\s*\(([^()]*)\)\s*\?\?\s*0\b/g },
  { id: "member||0", re: /\b([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+)\s*\|\|\s*0\b/g },
  { id: "member??0", re: /\b([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+)\s*\?\?\s*0\b/g },
];

// statement window: grab the line plus up to 3 following lines (for multiline exprs)
const hits = [];
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { id, re } of NUMDEF) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lines[i]))) {
        const win = lines.slice(i, Math.min(i + 4, lines.length));
        hits.push({
          file: rel,
          line: i + 1,
          kind: id,
          operand: (m[1] || "").trim().slice(0, 80),
          src: win.join(" ").replace(/\s+/g, " ").trim().slice(0, 220),
        });
      }
    }
  }
}
const byKind = new Map();
for (const h of hits) byKind.set(h.kind, (byKind.get(h.kind) || 0) + 1);
console.log("=== numeric-default coercion sites, PRODUCTION ===");
for (const [k, v] of byKind) console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`  TOTAL lines    ${hits.length}`);

// B) classify: does the operand look like a RESPONSE payload read (member access) or
//    a local/form scalar (bare identifier)?  member access => response read.
const memberish = hits.filter((h) => h.kind.startsWith("member") || /\?\.|\./.test(h.operand));
console.log(`\n  response-member reads (has . or ?.): ${memberish.length}`);
console.log(`  bare-identifier (form/local input) : ${hits.length - memberish.length}`);

fs.writeFileSync(path.join(OUT, "numdef.json"), JSON.stringify(hits, null, 1));
console.log("\n--- RESPONSE-MEMBER ones (the payload-read subset) ---");
for (const h of memberish) console.log(`${h.file}:${h.line}  [${h.kind}]  ${h.src}`);
