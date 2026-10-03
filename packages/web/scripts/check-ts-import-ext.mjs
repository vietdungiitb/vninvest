#!/usr/bin/env node
// Import-extension guard (F-01 lock).
// Fails on truly dangling relative imports: `from "./x.js"` where neither
// `x.js` nor `x.ts`/`x.tsx` exists on disk. (Note: `.js` imports that map to
// a `.ts`/`.tsx` sibling are the repo's ESM-style convention and resolve fine
// under `moduleResolution: bundler` + Vite — those are NOT violations.)
// The F-01 blocker was an import added before its source file existed;
// tsc and the build raced a mutating tree, so this cheap pre-check locks the
// failure mode directly regardless of tool timing.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");
const EXT_RE = /\.(js|jsx|ts|tsx)$/;

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collect(p, out);
    else if (EXT_RE.test(p)) out.push(p);
  }
  return out;
}

const importRe = /from\s+['"](\.[^'"]+)['"]/g;
const violations = [];

for (const file of collect(SRC)) {
  const txt = fs.readFileSync(file, "utf8");
  let m;
  while ((m = importRe.exec(txt)) !== null) {
    const spec = m[1];
    if (!spec.endsWith(".js")) continue;
    const abs = path.resolve(path.dirname(file), spec);
    if (fs.existsSync(abs)) continue;
    const base = abs.slice(0, -3);
    if (fs.existsSync(`${base}.ts`) || fs.existsSync(`${base}.tsx`)) continue; // ESM-style .js→.ts mapping: OK
    violations.push(
      `${path.relative(process.cwd(), file)} imports ${spec} — target does not exist (.js/.ts/.tsx all missing).`,
    );
  }
}

if (violations.length > 0) {
  console.error("✗ check:ts-imports — dangling relative imports (target missing):");
  for (const v of violations.slice(0, 20)) console.error(`  ${v}`);
  if (violations.length > 20) console.error(`  ... and ${violations.length - 20} more`);
  console.error("Fix: create the target module or correct the import specifier.");
  process.exit(1);
}
console.log("✓ check:ts-imports — PASS (no dangling relative imports)");
