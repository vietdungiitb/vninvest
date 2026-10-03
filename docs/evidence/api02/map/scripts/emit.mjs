import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });

const ROOT = "C:\\Mujoco Projects\\w3-m3\\packages\\web\\src";


const MAPDIR = "C:\\Mujoco Projects\\w3-m3\\docs\\evidence\\api02\\map";

// ---------- method -> endpoint (same logic, verified: 0 unresolved) ----------
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
      if (d) {
        let p = d[1];
        for (let j = k + 1; j <= i; j++) { const x = lines[j].match(new RegExp(v + "\\s*\\+=\\s*[`'\"]?([^`'\"$]*)")); if (x) p += x[1]; }
        return p;
      }
    }
  }
  return "<unresolved>";
}
const methods = new Map();
const seen = new Set();
for (const f of fs.readdirSync(path.join(ROOT, "adapters/core")).filter((f) => f.endsWith(".js") && !["transport.js", "index.js", "coreAdapter.js"].includes(f)).map((f) => `adapters/core/${f}`).concat(["adapters/coreApiAdapter.js"])) {
  const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/);
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    for (const rx of DECL) { const m = lines[i].match(rx); if (m) { cur = { name: m[1], line: i + 1 }; break; } }
    if (!/core(?:Get|Post|Put|Patch|Delete)\s*\(/.test(lines[i]) || !cur) continue;
    const verb = lines[i].match(/core(Get|Post|Put|Patch|Delete)\s*\(/)[1];
    const p = resolvePathArg(lines, i);
    const key = cur.name + "|" + verb + "|" + p + "|" + cur.line;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!methods.has(cur.name)) methods.set(cur.name, []);
    methods.get(cur.name).push({ verb, path: p, src: `${f}:${cur.line}` });
  }
}

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (/node_modules|dist|\.git/.test(e.name)) continue; walk(p, out); }
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};
const isProd = (p) => !/(^|[\\/])(node_modules|dist|tests|__tests__|__mocks__)([\\/]|$)/.test(p) && !/\.(test|spec)\.[jt]sx?$/.test(p);
const all = walk(ROOT);
const prod = all.filter(isProd);
const consumers = prod.filter((f) => !path.relative(ROOT, f).replace(/\\/g, "/").startsWith("adapters/"));

// brace depth per line, ignoring braces inside strings/comments (good enough for this codebase)
function depths(lines) {
  const d = new Array(lines.length).fill(0);
  let cur = 0;
  for (let i = 0; i < lines.length; i++) {
    d[i] = cur;
    const s = lines[i].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$/g, "");
    for (const ch of s) {
      if (ch === "{" || ch === "[" || ch === "(") cur++;
      else if (ch === "}" || ch === "]" || ch === ")") cur--;
    }
  }
  return d;
}

const names = [...methods.keys()].sort((a, b) => b.length - a.length);
const callRe = new RegExp("\\.\\b(" + names.join("|") + ")\\s*\\(", "g");

// Detect a local binding introduced by the adapter call on line i at column `col`.
// Handles:  const x = await adapter.fn(...)      (same line)
//           const x = adapter.fn(...)            (same line, no await)
//           const x =\n   await adapter.fn(...)  (call on a continuation line)
//           const {a,b} = await adapter.fn(...)  (destructured -> returns null here)
function bindOf(lines, i, col, fn) {
  const line = lines[i];
  const prefix = line.slice(0, col); // callRe already consumed the leading '.'
  // normalise TS noise:  `x: SomeType =` -> `x =`,  drop `as any` and wrapping parens
  const norm = (s) =>
    s
      .replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=]+?=/, "$1 $2 =")
      .replace(/\s+as\s+[A-Za-z_$][\w$.]*/g, "")
      .replace(/[()]/g, "");
  for (const p of [prefix, norm(prefix)]) {
    // receiver expression must directly precede the call: `ident` or `ident?`
    if (!/[A-Za-z_$][\w$]*\s*\??$/.test(p)) continue;
    const own = p.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?[A-Za-z_$][\w$]*\s*\??$/);
    if (own) return own;
  }
  // multi-line: assignment opened on a previous line
  for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
    const t = lines[k].trimEnd();
    const om = t.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/);
    if (om) return om;
    if (t && !/[,{[(]$/.test(t) && !/=\s*(?:await\s+)?$/.test(t)) break;
  }
  return null;
}

// assignment index per file: var -> [lineNo,...]  (only adapter-call assignments)
const rows = [];
let noLocal = 0;
for (const f of consumers) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  const dep = depths(lines);
  // pass 1: find call sites and their assigned var + assign line
  const sites = [];
  for (let i = 0; i < lines.length; i++) {
    callRe.lastIndex = 0;
    let m;
    while ((m = callRe.exec(lines[i]))) {
      const fn = m[1];
      const a = bindOf(lines, i, m.index, m[1]);
      sites.push({ fn, callLine: i + 1, varName: a ? a[1] : null, assignLine: a ? i + 1 : null, srcLine: lines[i] });
    }
  }
  for (const s of sites) {
    const bps = methods.get(s.fn) || [];
    for (const b of bps) {
      const base = { fe_file: rel, adapter_fn: s.fn, endpoint_path: b.path, verb: b.verb, call_line: s.callLine, adapter_src: b.src };
      if (!s.varName) {
        // no local binding: either destructured, or returned directly
        const win = lines.slice(Math.max(0, s.callLine - 6), s.callLine + 1).join("\n");
        const dest = win.match(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?\S*\.\s*$/m);
        if (dest) {
          for (const part of dest[1].split(",")) {
            const t = part.trim(); if (!t) continue;
            const dm = t.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/);
            rows.push({ ...base, line: s.callLine, field_read: dm ? dm[1] : t, read_style: "destructured", nullable_guard: "N", notes: "destructured at binding: " + t });
          }
        } else {
          noLocal++;
          rows.push({ ...base, line: s.callLine, field_read: "<no local read>", read_style: "none", nullable_guard: "?", notes: "payload not bound to a local var at this site; fields read by the CALLER" });
        }
        continue;
      }
      // find every read of this var, attributed to the NEAREST PRECEDING assignment of the same var
      const v = s.varName;
      const assignRe = new RegExp("(?:const|let|var)\\s+" + v + "\\s*(?::[^=]+?)?=");
      const assignLines = [];
      for (let j = 0; j < lines.length; j++) if (assignRe.test(lines[j])) assignLines.push(j + 1);
      const fieldRe = new RegExp("\\b" + v + "\\s*(\\?\\.|\\.)\\s*([A-Za-z_$][\\w$]*)|\\b" + v + "\\s*\\[\\s*['\"]([^'\"]+)['\"]\\s*\\]|(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*" + v + "\\b", "g");
      const used = new Set();
      for (let j = 0; j < lines.length; j++) {
        fieldRe.lastIndex = 0;
        let fm;
        while ((fm = fieldRe.exec(lines[j]))) {
          if (fm[3]) continue; // bracket-string handled by fm[2] branch below when opt
          const field = fm[2];
          if (!field) continue;
          const k = j + 1 + "|" + field;
          if (used.has(k)) continue;
          used.add(k);
          // nearest preceding assignment of v, preferring the SAME brace depth
          // (sibling closures reuse var names: ScreenerHistory.tsx has `res` in two scopes)
          let owner = null, ownerSameDepth = null;
          const readDepth = dep[j];
          for (const al of assignLines) {
            if (al <= j + 1) {
              owner = al;
              if (dep[al - 1] === readDepth) ownerSameDepth = al;
            }
          }
          const chosen = ownerSameDepth !== null ? ownerSameDepth : owner;
          if (chosen === null) continue;
          const ownerSite = sites.find((x) => x.assignLine === chosen && x.varName === v);
          if (!ownerSite) continue;
          // audit metadata: which var was tracked, and whether the scope matched
          const conf = ownerSameDepth !== null ? "SAME_SCOPE" : "FALLBACK_SCOPE";
          const L = lines[j];
          const opt = fm[1] === "?.";
          const guard = /(\?\?|\|\||Number\.isFinite|Number\.isNaN|isFinite|typeof\s+[^=]*===\s*['"]number|!==\s*null|!=\s*null|\?\s*[^:]+:)/.test(L) ? "Y" : "N";
          const coerced = /(\|\||\?\?)\s*0\b/.test(L);
          for (const bb of methods.get(ownerSite.fn) || []) {
            rows.push({
              fe_file: rel, line: j + 1, adapter_fn: ownerSite.fn, endpoint_path: bb.path, verb: bb.verb,
              call_line: ownerSite.callLine, adapter_src: bb.src, field_read: field,
              read_style: coerced ? "coerced" : opt ? "optional" : "flat",
              nullable_guard: guard,
              var_read: v, scope_conf: conf,
              notes: `var=${v} ${conf} call@${ownerSite.callLine} | ` + L.trim().slice(0, 130),
            });
          }
        }
      }
    }
  }
}
// dedupe
const seenR = new Set();
const uniqRows = rows.filter((r) => {
  const k = [r.fe_file, r.line, r.adapter_fn, r.endpoint_path, r.field_read].join("|");
  if (seenR.has(k)) return false;
  seenR.add(k); return true;
});
uniqRows.sort((a, b) => (a.fe_file === b.fe_file ? a.line - b.line : a.fe_file < b.fe_file ? -1 : 1));

// ---------- write CSV ----------
fs.mkdirSync(MAPDIR, { recursive: true });
const q = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
const head = "fe_file,line,adapter_fn,endpoint_path,field_read,read_style,nullable_guard,notes";
const csv = [head].concat(uniqRows.map((r) => [r.fe_file, r.line, r.adapter_fn, q(r.endpoint_path), r.field_read, r.read_style, r.nullable_guard, q(r.notes)].join(","))).join("\n") + "\n";
fs.writeFileSync(path.join(MAPDIR, "fe.csv"), csv, "utf8");

console.log("unique adapter methods        : " + methods.size);
console.log("prod code files (all)         : " + prod.length);
console.log("prod consumer files (non-adap): " + consumers.length);
console.log("call sites with no local bind : " + noLocal);
console.log("CSV data rows                 : " + uniqRows.length);
const st = new Map(); for (const r of uniqRows) st.set(r.read_style, (st.get(r.read_style) || 0) + 1);
console.log("read_style: " + [...st.entries()].map(([k, v]) => k + "=" + v).join("  "));
const ng = new Map(); for (const r of uniqRows) ng.set(r.nullable_guard, (ng.get(r.nullable_guard) || 0) + 1);
console.log("nullable_guard: " + [...ng.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("distinct endpoints mapped     : " + new Set(uniqRows.map((r) => r.endpoint_path)).size);
console.log("distinct files with a read    : " + new Set(uniqRows.map((r) => r.fe_file)).size);
console.log("CSV bytes                     : " + Buffer.byteLength(csv, "utf8"));
fs.writeFileSync(path.join(OUT, "rows-final.json"), JSON.stringify(uniqRows, null, 1), "utf8");
