#!/usr/bin/env node
// Gate — nginx SPA whitelist vs routeCatalog (admin fleet 404 fix).
// Every "/admin/*" path declared in src/app/routeCatalog.js must be served as SPA
// by a `location ^~ <prefix>` block with `try_files ... /index.html` in
// docker/nginx.conf. Otherwise nginx `location ^~ /admin/` proxies the route to
// Django, which 404s via admin catch_all_view (staff) / 302s to login (anonymous).
// NOTE: a regex location would NOT work here — `^~` suppresses regex evaluation,
// so only `^~` prefix blocks (longest match wins) are accepted as coverage.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const catalogPath = path.join(webRoot, "src", "app", "routeCatalog.js");
const nginxPath = path.join(webRoot, "docker", "nginx.conf");

function fail(msg) {
  console.error(`✗ check:admin-spa-routes — FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(catalogPath)) fail(`routeCatalog not found: ${catalogPath}`);
if (!fs.existsSync(nginxPath)) fail(`nginx.conf not found: ${nginxPath}`);

const catalog = fs.readFileSync(catalogPath, "utf8");
const nginx = fs.readFileSync(nginxPath, "utf8");

// 1. All /admin/* paths declared in routeCatalog.
const catalogAdminPaths = [
  ...new Set(
    [...catalog.matchAll(/path:\s*"(\/admin\/[^"]*)"/g)].map((match) => match[1]),
  ),
].sort();
if (catalogAdminPaths.length === 0) fail("no /admin/* paths found in routeCatalog");

// 2. SPA locations in nginx.conf: `location ^~ <prefix>` whose block serves index.html.
const spaPrefixes = [];
const locRe = /location\s+\^~\s+(\S+)\s*\{([^}]*)\}/g;
let m;
while ((m = locRe.exec(nginx)) !== null) {
  const prefix = m[1];
  const body = m[2];
  if (prefix.startsWith("/admin") && /try_files[^;]*\/index\.html/.test(body)) {
    spaPrefixes.push(prefix);
  }
}
if (!nginx.includes("location ^~ /admin/")) {
  fail("generic `location ^~ /admin/` block missing — Django admin proxy assumption broken");
}

// 3. Every catalog path must be covered by nginx longest-prefix ^~ match.
const orphans = catalogAdminPaths.filter(
  (p) => !spaPrefixes.some((pre) => p === pre || p.startsWith(pre)),
);
if (orphans.length > 0) {
  fail(
    `uncovered SPA routes (would 404 via Django):\n  - ${orphans.join("\n  - ")}\nAdd \`location ^~ <prefix>\` blocks in docker/nginx.conf before the generic /admin/ block.`,
  );
}

// 4. Info-only: SPA prefixes with no catalog route (intentional legacy whitelist).
const legacy = spaPrefixes.filter(
  (pre) => !catalogAdminPaths.some((p) => p === pre || p.startsWith(pre)),
);

console.log(
  `✓ check:admin-spa-routes — PASS (${catalogAdminPaths.length} catalog /admin/* paths covered by ${spaPrefixes.length} SPA locations${legacy.length > 0 ? `; legacy extra: ${legacy.join(", ")}` : ""})`,
);
