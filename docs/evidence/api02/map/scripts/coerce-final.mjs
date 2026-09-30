import fs from "node:fs";
import path from "node:path";
const __here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(__here, ".cache");
fs.mkdirSync(OUT, { recursive: true });


const money = JSON.parse(fs.readFileSync(path.join(OUT, "money-coerced.json"), "utf8"));
const numdef = JSON.parse(fs.readFileSync(path.join(OUT, "numdef.json"), "utf8"));

// literal `Number(x) || 0` (the task's literal wording) in production
const literal = numdef.filter((h) => h.kind === "Number()||0");
console.log("=== A) literal  Number(x) || 0   in PRODUCTION = " + literal.length + " ===");

// classify each by hand-verified category
const CATEGORY = {
  "components/workstation/StockOrderBookWidget.jsx": "RESPONSE (order-book volume)",
  "components/AIUsageDashboard.tsx": "RESPONSE (token counts)",
  "features/stock-detail/orderFlowFallback.js": "RESPONSE (order-flow summary)",
  "hooks/useOrderBubbleCoordinates.js": "RESPONSE (order volume)",
  "components/dashboard/PortfolioHeatmap.js": "LOCAL param / already-computed view model",
  "components/soc/SocSignalsPanel.tsx": "REQUEST write (form -> payload.threshold_vnd etc.)",
  "components/support/SupportOpsDashboard.js": "LOCAL param",
  "components/AICommandCenterForm.tsx": "REQUEST write (form -> temperature)",
  "hooks/useRealtimeFeedCore.js": "LOCAL config",
  "pages/tenant-admin/TenantAdminWebhooksPage.tsx": "REQUEST write (form input)",
  "utils/whaleTimeAdapter.js": "LOCAL param",
};
const buckets = new Map();
for (const h of literal) {
  const c = CATEGORY[h.file] || "UNCLASSIFIED";
  if (!buckets.has(c)) buckets.set(c, []);
  buckets.get(c).push(h);
}
for (const [c, v] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${c}  — ${v.length} line(s)`);
  for (const h of v) console.log(`      ${h.file}:${h.line}   ${h.operand}`);
}
const respLines = [...buckets.entries()].filter(([c]) => c.startsWith("RESPONSE")).reduce((a, b) => a + b[1].length, 0);
console.log(`\n  >> of the ${literal.length} literal sites, ${respLines} read a RESPONSE payload field`);

console.log("\n=== B) money-field coerced reads  (X.field || 0 / Number(X.field || 0)) = " + money.length + " ===");
const byFile = new Map();
for (const m of money) {
  if (!byFile.has(m.fe_file)) byFile.set(m.fe_file, new Set());
  byFile.get(m.fe_file).add(m.field);
}
for (const [f, s] of [...byFile.entries()].sort()) console.log(`  ${f}  [${[...s].join(", ")}]`);
console.log(`  >> ${byFile.size} files, ${new Set(money.map((m) => m.field)).size} distinct money fields, ${money.length} read sites`);

// overlap check
const litKeys = new Set(literal.map((h) => h.file + ":" + h.line));
const overlap = money.filter((m) => litKeys.has(m.fe_file + ":" + m.line));
console.log("\n  overlap between A and B: " + overlap.length + (overlap.length ? " -> " + JSON.stringify(overlap) : " (disjoint)"));
console.log("  => TOTAL payload-field falsy-numeric coercion sites: " + (respLines + money.length - overlap.length));
