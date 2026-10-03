import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });

const ROOT = "C:/Mujoco Projects/w3-m3/packages/web/src/";


const MAPDIR = "C:/Mujoco Projects/w3-m3/docs/evidence/api02/map/";

// reuse method->endpoint by re-deriving from the already-emitted rows is unsafe;
// re-derive quickly (identical logic to emit.mjs, verified 0 unresolved)
const DECL = [
  /^ {4}(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/,
  /^ {4}([a-zA-Z_$][\w$]*)\s*:\s*(?:async\s*)?\(/,
  /^ {4}([a-zA-Z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function\b)/,
  /^ {4}([a-zA-Z_$][\w$]*)\s*:\s*(?:async\s*)?[a-zA-Z_$][\w$]*\s*=>/,
  /^ {4}([a-zA-Z_$][\w$]*)\s*:\s*(?:async\s+)?function/,
  /^ {2}([a-zA-Z_$][\w$]*)\s*(?::\s*(?:async\s*)?\(|\([^)]*\)\s*\{)/,
];
function resolvePathArg(lines, i) {
  for (let k = i; k <= Math.min(i + 2, lines.length - 1); k++) {
    const t = lines.slice(k, k + 3).join("\n").match(/core(?:Get|Post|Put|Patch|Delete)\(\s*[`'"]([^`'"]*)/);
    if (t) return t[1];
  }
  const vm = (lines[i] || "").match(/core(?:Get|Post|Put|Patch|Delete)\s*\(\s*([a-zA-Z_$][\w$]*)\s*[,)(]/);
  if (vm) {
    const v = vm[1];
    for (let k = i; k >= 0; k--) {
      const a = lines[k].match(new RegExp("const\\s+" + v + "\\s*=\\s*\\([^)]*\\)\\s*=>\\s*[`'\"]([^`'\"]*)"));
      if (a) return a[1];
      const d = lines[k].match(new RegExp("(?:const|let|var)\\s+" + v + "\\s*=\\s*[`'\"]([^`'\"]*)"));
      if (d) { let p = d[1]; for (let j = k + 1; j <= i; j++) { const x = lines[j].match(new RegExp(v + "\\s*\\+=\\s*[`'\"]?([^`'\"$]*)")); if (x) p += x[1]; } return p; }
    }
  }
  return "<unresolved>";
}
const methods = new Map(); const seen = new Set();
for (const f of fs.readdirSync(ROOT + "adapters/core").filter((x) => x.endsWith(".js") && !["transport.js", "index.js", "coreAdapter.js"].includes(x)).map((x) => `adapters/core/${x}`).concat(["adapters/coreApiAdapter.js"])) {
  const lines = fs.readFileSync(ROOT + f, "utf8").split(/\r?\n/);
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    for (const rx of DECL) { const m = lines[i].match(rx); if (m) { cur = { name: m[1], line: i + 1 }; break; } }
    if (!/core(?:Get|Post|Put|Patch|Delete)\s*\(/.test(lines[i]) || !cur) continue;
    const verb = lines[i].match(/core(Get|Post|Put|Patch|Delete)\s*\(/)[1];
    const p = resolvePathArg(lines, i);
    const k = cur.name + "|" + verb + "|" + p + "|" + cur.line;
    if (seen.has(k)) continue; seen.add(k);
    if (!methods.has(cur.name)) methods.set(cur.name, []);
    methods.get(cur.name).push({ verb, path: p, src: `${f}:${cur.line}` });
  }
}
const names = [...methods.keys()].sort((a, b) => b.length - a.length);
const callRe = new RegExp("\\.\\b(" + names.join("|") + ")\\s*\\(", "g");

const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (/node_modules|dist/.test(e.name)) continue; walk(p, o); } else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) o.push(p); } return o; };
const isProd = (p) => !/(^|[\\/])(node_modules|dist|tests|__tests__|__mocks__)([\\/]|$)/.test(p) && !/\.(test|spec)\.[jt]sx?$/.test(p);
const consumers = walk(ROOT).filter(isProd).filter((f) => !path.relative(ROOT, f).replace(/\\/g, "/").startsWith("adapters/"));

const extra = [];
for (const f of consumers) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    callRe.lastIndex = 0;
    let m;
    while ((m = callRe.exec(lines[i]))) {
      const fn = m[1];
      // find the .then( / .catch( that consumes this call, within the next 6 lines
      let thenLine = -1, param = null;
      for (let j = i; j <= Math.min(i + 6, lines.length - 1); j++) {
        const seg = lines[j];
        if (j === i && !/\)?\s*$/.test(seg)) { /* call may span lines */ }
        const tm = seg.match(/\.(?:then|catch)\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)?\s*\)?\s*(?:=>)?/);
        if (tm) { thenLine = j; param = tm[1] || null; break; }
        if (j > i && /;\s*$/.test(seg) && !/\($/.test(seg.trim())) break;
      }
      if (thenLine < 0 || !param) continue;
      // scan the then-body (up to 12 lines) for reads of `param`
      const fre = new RegExp("\\b" + param + "\\s*(\\?\\.|\\.)\\s*([A-Za-z_$][\\w$]*)", "g");
      const used = new Set();
      for (let j = thenLine; j <= Math.min(thenLine + 12, lines.length - 1); j++) {
        fre.lastIndex = 0;
        let fm;
        while ((fm = fre.exec(lines[j]))) {
          const field = fm[2];
          if (!/^[a-z_][a-z0-9_]*$/i.test(field)) continue;
          if (used.has(field)) continue;
          used.add(field);
          const L = lines[j];
          const guard = /(\?\?|\|\||Number\.isFinite|Number\.isNaN|isFinite|!==\s*null|!=\s*null|\?\s*[^:]+:)/.test(L) ? "Y" : "N";
          const coerced = /(\|\||\?\?)\s*0\b/.test(L);
          for (const b of methods.get(fn) || []) {
            extra.push({ fe_file: rel, line: j + 1, call_line: i + 1, adapter_fn: fn, endpoint_path: b.path, verb: b.verb, adapter_src: b.src, field_read: field, read_style: coerced ? "coerced" : fm[1] === "?." ? "optional" : "flat", nullable_guard: guard, notes: L.trim().slice(0, 150) });
          }
        }
        if (/^\s*\}\s*\)/.test(lines[j])) break;
      }
    }
  }
}
const s = new Set();
const ux = extra.filter((r) => { const k = [r.fe_file, r.line, r.adapter_fn, r.field_read].join("|"); if (s.has(k)) return false; s.add(k); return true; });
console.log("extra field reads recovered from multi-line .then() chains: " + ux.length + "  in " + new Set(ux.map((r) => r.fe_file)).size + " files");

// merge with existing rows
const base = JSON.parse(fs.readFileSync(path.join(OUT, "rows-final.json"), "utf8"));
const key = (r) => [r.fe_file, r.line, r.adapter_fn, r.endpoint_path, r.field_read].join("|");
const bset = new Set(base.map(key));
const merged = base.slice();
for (const r of ux) if (!bset.has(key(r))) { merged.push(r); bset.add(key(r)); }
merged.sort((a, b) => (a.fe_file === b.fe_file ? a.line - b.line : a.fe_file < b.fe_file ? -1 : 1));

const q = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
const csv = ["fe_file,line,adapter_fn,endpoint_path,field_read,read_style,nullable_guard,notes"]
  .concat(merged.map((r) => [r.fe_file, r.line, r.adapter_fn, q(r.endpoint_path), r.field_read, r.read_style, r.nullable_guard, q(r.notes)].join(","))).join("\n") + "\n";
fs.writeFileSync(MAPDIR + "fe.csv", csv, "utf8");
fs.writeFileSync(path.join(OUT, "rows-merged.json"), JSON.stringify(merged, null, 1), "utf8");

const st = new Map(); for (const r of merged) st.set(r.read_style, (st.get(r.read_style) || 0) + 1);
const ng = new Map(); for (const r of merged) ng.set(r.nullable_guard, (ng.get(r.nullable_guard) || 0) + 1);
console.log("FINAL CSV rows: " + merged.length);
console.log("  read_style    : " + [...st.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("  nullable_guard: " + [...ng.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("  rows with a real field read : " + merged.filter((r) => r.field_read !== "<no local read>").length);
console.log("  distinct endpoints          : " + new Set(merged.map((r) => r.endpoint_path)).size);
console.log("  distinct consumer files     : " + new Set(merged.map((r) => r.fe_file)).size);
