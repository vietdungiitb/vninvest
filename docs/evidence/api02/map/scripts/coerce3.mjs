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

// MONEY-ish field names, searched repo-wide (independent of the call-site field list)
const MONEY = [
  "total_market_value","total_unrealized_pnl","total_unrealized_pnl_pct","total_cost","total_cost_basis",
  "total_value","total_equity","total_assets","total_liabilities","total_cash","total_pnl","total_return",
  "market_value","market_cap","market_cap_bn","avg_price","current_price","cost_price","entry_price",
  "nav","cash","cash_balance","available_cash","buying_power","unrealized_pnl","realized_pnl",
  "net_value","net_asset_value","equity","equity_value","position_value","avg_cost","roi",
  "total_deposits","total_withdrawals","profit","loss","pnl","pnl_pct","return_pct",
];

const COERCE = [
  { id: "||0", re: (f) => new RegExp("\\b" + f + "\\b\\s*(\\|\\||\\?\\?)\\s*0\\b") },
  { id: "Number(x||0)", re: (f) => new RegExp("Number\\(\\s*[^)\\n]*\\b" + f + "\\b\\s*(\\|\\||\\?\\?)\\s*0") },
  { id: "Number(..)||0", re: (f) => new RegExp("Number\\(\\s*[^)\\n]*\\b" + f + "\\b[^)\\n]*\\)\\s*(\\|\\||\\?\\?)\\s*0") },
];

const rows = [];
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    for (const f of MONEY) {
      for (const c of COERCE) {
        if (c.re(f).test(L)) rows.push({ fe_file: rel, line: i + 1, field: f, kind: c.id, src: L.trim().slice(0, 210) });
      }
    }
  }
}
const seen = new Set();
const uniq = rows.filter((r) => {
  const k = r.fe_file + "|" + r.line + "|" + r.field;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log("=== MONEY-FIELD reads carrying a falsy-numeric default (PROD) ===");
console.log("total: " + uniq.length + "\n");
for (const r of uniq) console.log(`${r.fe_file}:${r.line}  ${r.field}  [${r.kind}]\n    ${r.src}\n`);
fs.writeFileSync(path.join(OUT, "money-coerced.json"), JSON.stringify(uniq, null, 1));

// Also: money fields read WITHOUT any guard at all (bare p.field) — for contrast
const bare = [];
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    for (const f of MONEY) {
      const re = new RegExp("\\?\\.\\b" + f + "\\b|\\.\\b" + f + "\\b");
      if (re.test(L) && !/(\?\?|\|\|)/.test(L)) bare.push({ fe_file: rel, line: i + 1, field: f, src: L.trim().slice(0, 190) });
    }
  }
}
const s2 = new Set();
const ub = bare.filter((r) => { const k = r.fe_file + "|" + r.line + "|" + r.field; if (s2.has(k)) return false; s2.add(k); return true; });
console.log("=== MONEY-FIELD reads on a line with NO ?? / || at all: " + ub.length + " ===");
fs.writeFileSync(path.join(OUT, "money-bare.json"), JSON.stringify(ub, null, 1));
