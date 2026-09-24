#!/usr/bin/env node
// P0-1 gate — tokens:check allowlist (HIGH5)
// Fails only on hard hex in rule declarations outside :root and outside allowlist
// Allowlist per §3.1: semantic/status/chart/private effect
import fs from "node:fs";
import path from "node:path";

const roots = ["src/components", "src/pages", "src/layouts", "src/theme"];
// Status / chart / private effect hex allowed in rule usage (outside :root)
const allowHex = new Set([
  "#00b4d8", "#22d3ee", "#06b6d4", "#67e8f9", "#0891b2", // cyan / accent private (+0891b2 for UserSettingsPage gradient)
  "#050a14", "#0b0f19", "#111827", "#070a13", // shell private bg
  "#10b981", "#34d399", "#059669", "#6ee7b7",
  "#f59e0b", "#fbbf24", "#ffbf4d", "#ffb347", "#ffd166", // amber / warning (incl. acPendingBadge)
  "#ef4444", "#f87171", "#fca5a5", // rose / danger
  "#020617", "#0f172a", "#1e293b", "#334155", // @theme base (+334155 border-secondary)
  "#ff7f50", "#12c7e8", "#ff9e7d", // V1 drift (will converge)
  "#e6f3ff", "#9cb2d1", "#6d86a8", "#94a3b8", "#cbd5e1", "#e2e8f0", "#f1f5f9", "#f8fafc", // text (+f8fafc slate-50)
  "#ffffff", "#fff", "#000000", "#475569", // +475569 slate-600
  // chart / private still in use — allow until migration
  "#1d4ed8", "#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
  "#0b1528", "#1e3a5f", "#38bdf8", "#a855f7", "#ec4899", "#f43f5e", "#f472b6",
  "#6366f1", "#a5b4fc", "#c7d2fe", "#d8b4fe", "#e0f7fa", "#fef08a",
  "#0077b6", "#0090c4", "#48cae4", "#5eead4", "#16d7a0", "#b9f6e4", "#ffd9e1", "#ff5e7e", "#ffbf4d",
  "#86efac", "#22c55e", "#4ade80", "#64748b", "#3dd9eb",
]);

function stripRootBlocks(txt) {
  // Remove :root { ... } blocks (token declarations) — hex there is definition, not hard-coded usage
  return txt.replace(/:root\s*\{[^}]*\}/gs, (m) => " ".repeat(m.length));
}

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
    // ignore all :root token declaration blocks (hex there is definition, not usage)
    const stripped = stripRootBlocks(txt);
    // Also ignore tokens.css entirely (pure definitions)
    if (file.endsWith("tokens.css")) continue;
    const matches = stripped.match(hexRe) || [];
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
