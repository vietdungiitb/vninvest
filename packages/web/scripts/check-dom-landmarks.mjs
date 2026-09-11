#!/usr/bin/env node
// P0-0 BLOCKER1 — planned gate: runtime DOM landmarks
// Verifies: 1 <main>/page, no nested <main>, Shell is region not main
import fs from "node:fs";

const shellPath = "src/components/ShellPageTemplate.js";
const fullLayoutPath = "src/layouts/full/FullLayout.tsx";

function fail(msg) {
  console.error(`✗ check:dom-landmarks — ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

const shell = fs.readFileSync(shellPath, "utf8");
const full = fs.readFileSync(fullLayoutPath, "utf8");

// Shell must not render <main>
if (shell.includes('renderElement(\n    "main"') || shell.match(/renderElement\(\s*"main"/)) {
  fail(`ShellPageTemplate.js still renders <main> — expected <div role="region"> (BLOCKER1)`);
}
ok("ShellPageChrome renders <div> not <main>");

if (!shell.includes('role: "region"') || !shell.includes('aria-labelledby')) {
  fail("ShellPageChrome missing role=region / aria-labelledby (MEDIUM10)");
}
ok("ShellPageChrome has region + aria-labelledby");

const elementMains = (full.match(/e\(\s*['"]main['"]/g) || []).length;
if (elementMains !== 1) {
  fail(`FullLayout.tsx expected 1 element 'main', found ${elementMains}`);
}
ok("FullLayout has exactly one <main> element (frame)");

if (!full.includes('overflow-auto')) {
  fail("FullLayout main missing overflow-auto (BLOCKER2 frame scroll)");
}
ok("FullLayout main has overflow-auto (page-level scroll owner)");

console.log("check:dom-landmarks — PASS (static gate; runtime DOM on 4 routes is planned Playwright at P4 — see IMPLEMENTATION_PLAN §5)");
