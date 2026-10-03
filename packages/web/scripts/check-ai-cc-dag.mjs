#!/usr/bin/env node
/**
 * check:ai-cc-dag — DAG verification for IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md
 *
 * Entry 229. Verifies 4 properties the plan CLAIMS in section 3.1. The first draft of the
 * plan claimed "0 cycle" WITHOUT running anything; this script found 2 mutual dependency
 * pairs (R0.4<->R0.5, R0.7<->R0.9). This script exists so that claim can never be
 * re-asserted without evidence again.
 *
 * Exit 0 = all 4 properties hold. Exit 1 = at least one fails.
 *
 * Usage: node scripts/check-ai-cc-dag.mjs [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md"
);
const VERBOSE = process.argv.includes("--verbose");

/** Numbers declared in plan section 3.1. A slice added without updating these fails the gate. */
const DECLARED = { nodes: 46, edges: 61 };

function fail(msg) {
  console.error(`check:ai-cc-dag - FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(PLAN)) {
  fail(`plan not found: ${PLAN}`);
}

const raw = fs.readFileSync(PLAN, "utf8");

// 1) Collect every slice section: "### Rx.y · title" ... up to the next slice or a "---" rule.
const sectionRe = /###\s+(R\d\.\d+)\s+·[\s\S]*?(?=\n###\s+R\d\.\d|\n---\n|$)/g;
const deps = new Map();
let m;
while ((m = sectionRe.exec(raw)) !== null) {
  const id = m[1];
  const depField = m[0].match(/\*\*Phụ thuộc:\*\*\s*(.+)/);
  const list = [];
  if (depField) {
    // strip parentheticals, then collect Rx.y tokens
    const cleaned = depField[1].replace(/\(.*?\)/g, "");
    for (const t of cleaned.match(/R\d\.\d/g) || []) {
      if (!list.includes(t)) list.push(t);
    }
  }
  deps.set(id, list);
}

if (deps.size === 0) fail("no slice sections found — did the plan format change?");

// 2) Dangling reference check
const dangling = [];
for (const [id, list] of deps) {
  for (const n of list) {
    if (!deps.has(n)) dangling.push(`${id} -> ${n}`);
  }
}

// 3) Cycle detection (iterative DFS with 3-state colouring: 1 = on stack, 2 = done)
const colour = new Map();
const cycles = [];
function visit(node) {
  colour.set(node, 1);
  for (const next of deps.get(node) || []) {
    if (!deps.has(next)) continue;
    if (colour.get(next) === 1) cycles.push(`${node} -> ${next}`);
    else if (!colour.has(next)) visit(next);
  }
  colour.set(node, 2);
}
for (const id of deps.keys()) {
  if (!colour.has(id)) visit(id);
}

// 4) Mutual pair check (a subtler cycle shape worth naming explicitly)
const mutual = [];
for (const [id, list] of deps) {
  for (const n of list) {
    if (deps.has(n) && (deps.get(n) || []).includes(id)) mutual.push(`${id} <-> ${n}`);
  }
}

// 5) Root nodes (slices with no dependencies) — the plan claims 5
const roots = [...deps.keys()].filter((k) => (deps.get(k) || []).length === 0).sort();

// 6) Edge count
const edges = [...deps.values()].reduce((a, l) => a + l.length, 0);

const errors = [];
if (dangling.length) errors.push(`${dangling.length} dangling ref(s): ${dangling.join(", ")}`);
if (cycles.length) errors.push(`${cycles.length} cycle(s): ${[...new Set(cycles)].join(", ")}`);
if (mutual.length) errors.push(`${mutual.length} mutual pair(s): ${[...new Set(mutual)].join(", ")}`);
if (deps.size !== DECLARED.nodes) {
  errors.push(`node count ${deps.size} != declared ${DECLARED.nodes} in section 3.1`);
}
if (edges !== DECLARED.edges) {
  errors.push(`edge count ${edges} != declared ${DECLARED.edges} in section 3.1`);
}

if (errors.length) {
  for (const e of errors) console.error(`  - ${e}`);
  fail(`${errors.length} DAG invariant(s) broken`);
}

console.log(`check:ai-cc-dag - PASS (${deps.size} nodes, ${edges} edges, 0 cycle, 0 dangling, ${roots.length} roots)`);
if (VERBOSE) {
  console.log(`  roots: ${roots.join(", ")}`);
  for (const id of [...deps.keys()].sort()) {
    const list = deps.get(id);
    if (list.length) console.log(`  ${id} <- ${list.join(", ")}`);
  }
}
