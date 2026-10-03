/**
 * find-remaining-extensionless.mjs
 *
 * Finds any remaining relative imports in .js files that don't have
 * a file extension. Prints them so we can fix manually.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/components/vninvestcharts");

function collectJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      results.push(...collectJsFiles(full));
    } else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
      results.push(full);
    }
  }
  return results;
}

const KNOWN_EXTENSIONS = /\.(?:js|mjs|cjs|json|css|svg|png|jpg|jpeg|gif|csv|d\.ts)$/i;
const SPECIFIER_RE = /(?:from|require\()\s*(['"])([^'"]+)\1/g;

const jsFiles = collectJsFiles(ROOT);
let found = 0;

for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  let match;
  while ((match = SPECIFIER_RE.exec(content)) !== null) {
    const specifier = match[2];
    if (!specifier.startsWith(".")) continue;
    if (KNOWN_EXTENSIONS.test(specifier)) continue;
    
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
    console.log(`${rel}:  "${specifier}"`);
    found++;
  }
}

console.log(`\nTotal: ${found} extensionless relative imports remaining.`);
