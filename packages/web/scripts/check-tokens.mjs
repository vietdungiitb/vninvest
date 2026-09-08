#!/usr/bin/env node
// P0-1 planned gate — tokens:check allowlist
// Fails on hard hex outside allowlist (semantic/status/chart/private)
import fs from "node:fs";
import path from "node:path";

const roots = ["src/components", "src/pages", "src/layouts", "src/theme"];
const allowHex = new Set([
  "#00b4d8", // --accent-shell private (tokens.css:49) — allowed until V1 convergence
  "#050a14", // --sdp-page-bg private
  "#10b981", "#f59e0b", "#ef4444", // status
  "#ff7f50", "#12c7e8", // V1 drift allowlist (will converge)
  "#020617", "#0f172a", "#1e293b", // @theme base (index.css)
]);

function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectFiles(p));
    else if (p.endsWith(".css") || p.endsWith(".module.css")) out.push(p);
  }
  return out;
}

const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
let violations = [];
for (const root of roots) {
  for (const file of collectFiles(root)) {
    const txt = fs.readFileSync(file, "utf8");
    // ignore :root token definitions in tokens.css — they are the source
    if (file.endsWith("tokens.css")) continue;
    const matches = txt.match(hexRe) || [];
    for (const m of matches) {
      const lower = m.toLowerCase();
      if (!allowHex.has(lower)) {
        violations.push(`${file}: ${lower}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("✗ check:tokens — hard hex outside allowlist:");
  for (const v of violations.slice(0, 20)) console.error("  " + v);
  if (violations.length > 20) console.error(`  ... and ${violations.length - 20} more`);
  console.error("Allowlist: status/chart/private only — migrate hard hex to var(--token)");
  process.exit(1);
}
console.log(`✓ check:tokens — PASS (${allowHex.size} allowlisted hex, 0 violations outside)`);
