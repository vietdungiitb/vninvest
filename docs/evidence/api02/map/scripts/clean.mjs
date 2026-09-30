import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });


const MAPDIR = "C:/Mujoco Projects/w3-m3/docs/evidence/api02/map/";
const rows = JSON.parse(fs.readFileSync(path.join(OUT, "rows-merged.json"), "utf8"));

// normalise a URL template: collapse each ${...} to {p}, keep it readable & CSV-safe
function cleanPath(p) {
  if (!p || p === "<unresolved>") return p || "";
  let s = p;
  // unbalanced leftovers from the earlier `$`-truncation
  s = s.replace(/\$\{[^}]*$/, "{p}");
  s = s.replace(/\$\{([^{}]*)\}/g, (_m, inner) => {
    const t = inner.trim();
    if (/^query\b/.test(t) || /^\{/.test(t) || /^\s*$/.test(t)) return "{q}";
    return "{p}";
  });
  s = s.replace(/\{p\}\s*$/, "{p}");
  return s;
}
for (const r of rows) r.endpoint_path = cleanPath(r.endpoint_path);

const q = (v) => (/[",\n\r]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
const csv = ["fe_file,line,adapter_fn,endpoint_path,field_read,read_style,nullable_guard,notes"]
  .concat(rows.map((r) => [r.fe_file, r.line, r.adapter_fn, q(r.endpoint_path), r.field_read, r.read_style, r.nullable_guard, q(r.notes)].join(","))).join("\n") + "\n";
fs.writeFileSync(MAPDIR + "fe.csv", csv, "utf8");
fs.writeFileSync(path.join(OUT, "rows-merged.json"), JSON.stringify(rows, null, 1), "utf8");

console.log("rows: " + rows.length);
console.log("distinct endpoints: " + new Set(rows.map((r) => r.endpoint_path)).size);
console.log("paths still containing '$': " + rows.filter((r) => r.endpoint_path.includes("$")).length);
console.log("unresolved paths: " + rows.filter((r) => r.endpoint_path === "<unresolved>").length);
const t = fs.readFileSync(MAPDIR + "fe.csv", "utf8");
console.log("U+FFFD in csv: " + (t.match(/\uFFFD/g) || []).length);
console.log("csv lines: " + t.split("\n").length);
console.log("csv bytes: " + Buffer.byteLength(t, "utf8"));
