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

// A) the dual-read idiom:  X.data ?? X   /   X.data || X   /  X?.data ?? X
const DUAL = [
  { id: "a.data ?? a", re: /\b([A-Za-z_$][\w$]*)\s*(?:\?\.)?\.data\s*(\?\?|\|\|)\s*(?:\1\b|\1\s*(?:\?\.)?\.)/g },
  { id: "res.data ?? res", re: /\b(res|resp|response|payload|data|json|body|out|result)\s*(?:\?\.)?\.data\s*(\?\?|\|\|)\s*\1\b/g },
  { id: "?.data ??", re: /\?\.\s*data\s*(\?\?|\|\|)/g },
  { id: "['data']", re: /\[\s*['"]data['"]\s*\]/g },
];
const hits = [];
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const d of DUAL) {
      d.re.lastIndex = 0;
      if (d.re.test(lines[i])) hits.push({ fe_file: rel, line: i + 1, id: d.id, src: lines[i].trim().slice(0, 200) });
    }
  }
}
const s = new Set();
const uh = hits.filter((h) => { const k = h.fe_file + "|" + h.line + "|" + h.id; if (s.has(k)) return false; s.add(k); return true; });
console.log("=== A) `.data` DUAL-READ / wrapper-expecting sites (PROD) = " + uh.length + " ===");
for (const h of uh) console.log(`${h.fe_file}:${h.line}  [${h.id}]  ${h.src}`);

// B) every read of a `.data` MEMBER (field after .data) => field expected under a wrapper
const FIELD = [];
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const re = /(?:\??\.)\s*data\s*(?:\??\.)\s*([A-Za-z_$][\w$]*)|(?:\??\.)\s*data\s*\[\s*['"]([^'"]+)['"]\s*\]/g;
    let m;
    while ((m = re.exec(lines[i]))) {
      const f = m[1] || m[2];
      if (["length","map","filter","forEach","reduce","slice","some","every","find","sort","concat","join","includes","toString","keys","entries","values","get","has","push"].includes(f)) continue;
      FIELD.push({ fe_file: rel, line: i + 1, field: f, src: lines[i].trim().slice(0, 190) });
    }
  }
}
const s2 = new Set();
const uf = FIELD.filter((h) => { const k = h.fe_file + "|" + h.line + "|" + h.field; if (s2.has(k)) return false; s2.add(k); return true; });
console.log("\n=== B) reads of a FIELD under `.data` (PROD) = " + uf.length + " ===");
for (const h of uf) console.log(`${h.fe_file}:${h.line}  .data.${h.field}   ${h.src}`);

fs.writeFileSync(path.join(OUT, "dualread.json"), JSON.stringify(uh, null, 1));
fs.writeFileSync(path.join(OUT, "datafield.json"), JSON.stringify(uf, null, 1));
