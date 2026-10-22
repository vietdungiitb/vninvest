#!/usr/bin/env node
/**
 * check-page-registry — W0.4: phat hien entry page-registry CHET (khong bao gio
 * duoc render) va registry id BI TRO (resolve toi id khong ton tai).
 *
 * BA LOI PHAT HIEN (moi lo doi theo dung logic resolve cua main.tsx):
 *   A. UNREFERENCED — entry trong `pageRegistry.js` ma KHONG route nao resolve
 *      toi => component cua no khong bao gio render (code chet).
 *      Truoc W0.4 co 5 entry nhu vay (xem ROADMAP_MASTER §4.3 W0.4).
 *   B. DANGLING — resolve cua mot route tro toi registry id khong ton tai =>
 *      runtime in "Could not resolve page component for registryId: X"
 *      (packages/web/src/main.tsx:53).
 *
 * LOGIC RESOLVE (phai khop `resolvePageComponent`, main.tsx:22-57):
 *   1. `routeId === 'X'`   -> registryId = 'Y'   (doi mot-mot)
 *   2. `routeId.startsWith('P')` -> registryId = 'Y' (theo thu tu khai bao)
 *   3. neu khong co rule nao -> registryId = chinh routeId
 *
 * VI SAO KHONG `import()` runtime? `pageRegistry.js` import file `.tsx` =>
 *   node ERR_UNKNOWN_FILE_EXTENSION (gioi hanh cua vite/tsx loader, khong phai
 *   cua gate). Vay nen parse nguon bang regex CO DINH, nhung — theo L-V01 —
 *   parser phai TU KIEM CHUNG (neu khong khop thi bao "PARSER BROKEN — KHONG
 *   ket luan" va exit 2, KHONG bao "0 loi"):
 *     - so id trich duoc === so loi goi `makePageEntry(` (KHONG dem dinh nghia ham)
 *     - moi id trich duoc deu la chuoi hop le
 *     - so cap doi-mot === so `routeId === '` trong main.tsx
 *     - so rule startsWith === so `routeId.startsWith('` trong main.tsx
 *
 * Usage:
 *   node scripts/check-page-registry.mjs             # gate that
 *   node scripts/check-page-registry.mjs --self-test # chung minh gate bat loi that
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, "..");

const REGISTRY_FILE = join(WEB_ROOT, "src", "pages", "pageRegistry.js");
const MAIN_FILE = join(WEB_ROOT, "src", "main.tsx");

/** Giai quyet routeId -> registryId theo dung thu tu cua resolvePageComponent. */
export function resolveRouteId(routeId, rules) {
  if (rules.pairs.has(routeId)) return rules.pairs.get(routeId);
  for (const rule of rules.prefixes) {
    if (routeId.startsWith(rule.prefix)) return rule.registryId;
  }
  return routeId;
}

export function findUnreferenced(registryIds, reachableIds) {
  const used = new Set(reachableIds);
  return registryIds.filter((id) => !used.has(id));
}

export function findDangling(registryIds, resolvedIds) {
  const known = new Set(registryIds);
  return [...new Set(resolvedIds)].filter((id) => !known.has(id));
}

/**
 * Loai comment truoc khi parse.
 * LY DO (control bat duoc 2026-10-22): `main.tsx:36-38` co comment mentioning
 * `routeId.startsWith('portfolio-')` => so dem bi lech 1 => gate bao "PARSER
 * BROKEN" tren nguon that. Comment KHONG phai code — phai loai truoc.
 * - block comment: /* ... *\/
 * - line comment: `//` NHUNG khong phai `://` (trong URL).
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Trich registry id tu nguon `pageRegistry.js`.
 * `broken` = true neu parser khong khop => KHONG duoc ket luan.
 */
export function parseRegistryIds(rawSource) {
  const source = stripComments(rawSource);
  const ids = [];
  const re = /makePageEntry\(\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(source)) !== null) ids.push(m[1]);
  // CHI dem LOI GOI, khong dem DINH NGHIA ham (`function makePageEntry(`).
  const callCount = (source.match(/(?<!function )makePageEntry\(/g) || []).length;
  const malformed = ids.filter((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id));
  return { ids, broken: callCount !== ids.length || malformed.length > 0, callCount, malformed };
}

/** Trich cac rule resolve truc tiep tu `main.tsx` + kiem chung so luong. */
export function parseResolverRules(rawSource) {
  const source = stripComments(rawSource);
  const pairs = new Map();
  const pairRe = /routeId === '([^']+)'\s*\)\s*registryId = '([^']+)'/g;
  let m;
  while ((m = pairRe.exec(source)) !== null) pairs.set(m[1], m[2]);

  const prefixes = [];
  const preRe = /routeId\.startsWith\('([^']+)'\)\s*\)\s*registryId = '([^']+)'/g;
  while ((m = preRe.exec(source)) !== null) prefixes.push({ prefix: m[1], registryId: m[2] });

  const eqCount = (source.match(/routeId === '/g) || []).length;
  const startsCount = (source.match(/routeId\.startsWith\('/g) || []).length;
  const broken = pairs.size !== eqCount || prefixes.length !== startsCount;
  return { pairs, prefixes, broken, eqCount, startsCount };
}

/** Trich cac routeId ma main.tsx truyen vao resolvePageComponent. */
export function parseUsedRouteIds(rawSource) {
  const source = stripComments(rawSource);
  const ids = [];
  const re = /resolvePageComponent\(\s*'([^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) ids.push(m[1]);
  const callCount = (source.match(/(?<!function )resolvePageComponent\(\s*'/g) || []).length;
  return { ids, broken: ids.length !== callCount, callCount };
}

function selfTest() {
  const failures = [];
  const check = (name, cond, detail) => {
    if (!cond) failures.push(`${name}: ${detail}`);
  };

  // 1. Phan bi biet phai bao 1 entry che.
  {
    const orphan = findUnreferenced(["core-dashboard", "dashboard"], ["core-dashboard"]);
    check("case 1", orphan.length === 1 && orphan[0] === "dashboard", `nhan ${JSON.stringify(orphan)}`);
  }
  // 2. Sach => 0.
  {
    const orphan = findUnreferenced(["a", "b"], ["a", "b"]);
    check("case 2", orphan.length === 0, `nhan ${JSON.stringify(orphan)}`);
  }
  // 3. Dangling: id tro sai phai bi bao.
  {
    const dangling = findDangling(["core-dashboard"], ["core-dashboard", "khong-ton-tai"]);
    check("case 3", dangling.length === 1 && dangling[0] === "khong-ton-tai", `nhan ${JSON.stringify(dangling)}`);
  }
  // 4. Resolve doi-mot.
  {
    const rules = { pairs: new Map([["dashboard", "core-dashboard"]]), prefixes: [] };
    check("case 4", resolveRouteId("dashboard", rules) === "core-dashboard", "doi-mot sai");
    check("case 4b", resolveRouteId("support", rules) === "support", "khong co rule => giu nguyen routeId");
  }
  // 5. Resolve startsWith.
  {
    const rules = { pairs: new Map(), prefixes: [{ prefix: "portfolio-", registryId: "portfolio-workspace" }] };
    check("case 5", resolveRouteId("portfolio-overview", rules) === "portfolio-workspace", "startsWith sai");
  }
  // 6. Thu tu rule: doi-mot thang truoc startsWith.
  {
    const rules = {
      pairs: new Map([["portfolio-overview", "core-dashboard"]]),
      prefixes: [{ prefix: "portfolio-", registryId: "portfolio-workspace" }],
    };
    check("case 6", resolveRouteId("portfolio-overview", rules) === "core-dashboard", "thu tu rule sai");
  }
  // 7. Parser tu kiem chung: id viet dau nhay => broken.
  {
    const parsed = parseRegistryIds(
      'makePageEntry("ok-id", "core", () => {});\nmakePageEntry(\'single\', "core", () => {});\n',
    );
    check("case 7", parsed.broken === true, "id sai cu phap phai bao broken");
  }
  // 8. Dinh nghia ham khong phai loi goi.
  {
    const parsed = parseRegistryIds(
      'function makePageEntry(routeId, status, loadComponent) { return null; }\nmakePageEntry("only-one", "core", () => {});\n',
    );
    check("case 8", parsed.broken === false, `broken=true (ids=${parsed.ids.length} calls=${parsed.callCount})`);
  }
  // 9. Parser resolver tren nguon that phai khop.
  {
    const real = readFileSync(MAIN_FILE, "utf8");
    const rules = parseResolverRules(real);
    check(
      "case 9",
      rules.broken === false,
      `rules broken (pairs=${rules.pairs.size}/${rules.eqCount}, prefixes=${rules.prefixes.length}/${rules.startsCount})`,
    );
    const used = parseUsedRouteIds(real);
    check("case 9b", used.broken === false, `used routeIds broken (ids=${used.ids.length}/${used.callCount})`);
  }

  if (failures.length) {
    console.error("check-page-registry --self-test: FAIL");
    failures.forEach((f) => console.error("  - " + f));
    return 1;
  }
  console.log("check-page-registry --self-test: PASS (9/9 case)");
  return 0;
}

function main() {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest());
  }

  for (const f of [REGISTRY_FILE, MAIN_FILE]) {
    if (!existsSync(f)) {
      console.error(`check-page-registry: KHONG TON TAI ${f} — CHUA CHAY`);
      process.exit(2);
    }
  }

  const registrySrc = readFileSync(REGISTRY_FILE, "utf8");
  const mainSrc = readFileSync(MAIN_FILE, "utf8");

  const parsed = parseRegistryIds(registrySrc);
  if (parsed.broken) {
    console.error("check-page-registry: PARSER BROKEN — KHONG ket luan");
    console.error(
      `  registry: so id trich = ${parsed.ids.length}, so loi goi makePageEntry( = ${parsed.callCount}, id sai cu phap = ${parsed.malformed.join(",") || "(khong co)"}`,
    );
    process.exit(2);
  }

  const rules = parseResolverRules(mainSrc);
  if (rules.broken) {
    console.error("check-page-registry: PARSER BROKEN — KHONG ket luan");
    console.error(
      `  resolver: so cap doi-mot = ${rules.pairs.size}, so 'routeId ===' = ${rules.eqCount}, so rule startsWith = ${rules.prefixes.length}, so 'routeId.startsWith(' = ${rules.startsCount}`,
    );
    process.exit(2);
  }

  const used = parseUsedRouteIds(mainSrc);
  if (used.broken) {
    console.error("check-page-registry: PARSER BROKEN — KHONG ket luan");
    console.error(`  used routeIds: trich ${used.ids.length}, so loi goi resolvePageComponent( = ${used.callCount}`);
    process.exit(2);
  }

  const resolved = used.ids.map((id) => resolveRouteId(id, rules));
  const unreferenced = findUnreferenced(parsed.ids, resolved);
  const dangling = findDangling(parsed.ids, resolved);

  const errors = [];
  for (const id of unreferenced) {
    errors.push(
      `UNREFERENCED: registry entry "${id}" khong route nao resolve toi => component khong bao gio render`,
    );
  }
  for (const id of dangling) {
    errors.push(
      `DANGLING: main.tsx resolve toi registry id "${id}" khong ton tai => runtime se in "Could not resolve page component"`,
    );
  }

  if (errors.length) {
    console.error(`check-page-registry: FAIL (${errors.length} loi)`);
    errors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  console.log(
    `check-page-registry: PASS (${parsed.ids.length} registry entry, ${used.ids.length} route da resolve, 0 entry che, 0 id tro sai)`,
  );
  process.exit(0);
}

main();
