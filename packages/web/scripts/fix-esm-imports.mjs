/**
 * fix-esm-imports-v2.mjs
 *
 * More aggressive pass: finds ALL relative import/export specifiers in .js files
 * that don't end with a recognized file extension, and fixes them.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/components/vnstockcharts");

function collectJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      results.push(...collectJsFiles(full));
    } else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
      results.push(full);
    }
  }
  return results;
}

function resolveImport(fileDir, specifier) {
  if (!specifier.startsWith(".")) return specifier;

  // Check if it already ends with a known JS extension
  if (/\.(?:js|mjs|cjs|json|css|svg|png|jpg|csv)$/i.test(specifier)) {
    return specifier;
  }

  const resolved = path.resolve(fileDir, specifier);

  // Directory with index.js?
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    if (fs.existsSync(path.join(resolved, "index.js"))) return specifier + "/index.js";
    if (fs.existsSync(path.join(resolved, "index.ts"))) return specifier + "/index.js";
    return specifier;
  }

  // File with .js?
  if (fs.existsSync(resolved + ".js")) return specifier + ".js";
  if (fs.existsSync(resolved + ".ts")) return specifier + ".js";
  if (fs.existsSync(resolved + ".tsx")) return specifier + ".js";

  return specifier;
}

// Match any from "..." or from '...' in import/export statements
const SPECIFIER_RE = /((?:from|require\()\s*)(['"])([^'"]+)\2/g;

let totalFixed = 0;
let filesChanged = 0;

const jsFiles = collectJsFiles(ROOT);
console.log(`Scanning ${jsFiles.length} .js files in ${ROOT}...`);

for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const dir = path.dirname(filePath);
  let changed = false;

  const newContent = content.replace(SPECIFIER_RE, (match, prefix, quote, specifier) => {
    if (!specifier.startsWith(".")) return match;

    const fixed = resolveImport(dir, specifier);
    if (fixed !== specifier) {
      changed = true;
      totalFixed++;
      const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
      console.log(`  ${rel}: "${specifier}" → "${fixed}"`);
      return `${prefix}${quote}${fixed}${quote}`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    filesChanged++;
  }
}

console.log(`\nDone: ${totalFixed} imports fixed across ${filesChanged} files.`);
