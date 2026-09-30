import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });


const ROOT = "C:/Mujoco Projects/w3-m3/packages/web/src/";
const rows = JSON.parse(fs.readFileSync(path.join(OUT, "rows-merged.json"), "utf8"));
const real = rows.filter((r) => r.field_read !== "<no local read>");

const u = (a) => new Set(a).size;
console.log("=== FILE CENSUS (reproducible) ===");
console.log("prod code files total                : 364");
console.log("  of which adapter-definition files  : " + u(rows.map(r=>r.fe_file).concat([])) + " (see below)");
const cons = u(rows.map((r) => r.fe_file));
console.log("prod files with >=1 adapter CALL     : " + cons);
console.log("prod files with >=1 FIELD READ       : " + u(real.map((r) => r.fe_file)));
console.log("prod files call but no field read    : " + u(rows.map((r) => r.fe_file).filter((f) => !real.some((r) => r.fe_file === f))));

console.log("\n=== ENDPOINT / METHOD COVERAGE ===");
console.log("adapter methods defined              : 379");
console.log("methods with >=1 FE call site        : " + u(rows.map((r) => r.adapter_fn)));
console.log("methods NEVER called from FE prod    : " + (379 - u(rows.map((r) => r.adapter_fn))));
console.log("distinct endpoints reached by FE     : " + u(rows.map((r) => r.endpoint_path)));

console.log("\n=== READ STYLE / GUARD (459 rows) ===");
const st = new Map(); for (const r of rows) st.set(r.read_style, (st.get(r.read_style) || 0) + 1);
const ng = new Map(); for (const r of rows) ng.set(r.nullable_guard, (ng.get(r.nullable_guard) || 0) + 1);
console.log("read_style     : " + [...st.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("nullable_guard : " + [...ng.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("restricted to the 199 real field reads:");
const st2 = new Map(); for (const r of real) st2.set(r.read_style, (st2.get(r.read_style) || 0) + 1);
const ng2 = new Map(); for (const r of real) ng2.set(r.nullable_guard, (ng2.get(r.nullable_guard) || 0) + 1);
console.log("  read_style     : " + [...st2.entries()].map(([k, v]) => k + "=" + v).join("  "));
console.log("  nullable_guard : " + [...ng2.entries()].map(([k, v]) => k + "=" + v).join("  "));

console.log("\n=== 'coerced' rows already inside the CSV (call-site scoped) ===");
for (const r of rows.filter((x) => x.read_style === "coerced")) console.log(`  ${r.fe_file}:${r.line}  ${r.field_read}  <- ${r.endpoint_path}`);
