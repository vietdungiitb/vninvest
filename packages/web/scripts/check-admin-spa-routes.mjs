#!/usr/bin/env node
// Gate hai chiều — nginx SPA whitelist ↔ Django admin (fix admin fleet 404).
//
// CHIỀU 1 (SPA → nginx): mọi `/admin/*` trong `src/app/routeCatalog.js` phải
// được nginx phục vụ bằng `try_files … /index.html`. Nếu không, nginx rơi xuống
// `location ^~ /admin/` proxy sang Django ⇒ 404 (staff) hoặc 302 login.
// Ghi chú: regex location **không** dùng được ở đây — `^~` chặn đánh giá regex.
//
// CHIỀU 2 (nginx → Django): block `location ^~ /admin/<X>` khi `<X>` trùng
// `app_label` của Django sẽ **nuốt** mọi `/admin/<X>/<model>/…`. Đó là bug O1
// (2026-10-10): `/admin/advertising` vừa là route SPA vừa là app_label ⇒ 6 URL
// admin của app `advertising` chết. Chiều 1 im lặng hoàn toàn với lỗi này.
//
//   node scripts/check-admin-spa-routes.mjs            # kiểm thật
//   node scripts/check-admin-spa-routes.mjs --self-test # tự chứng minh gate bắt được lỗi
//
// Exit 0 = đạt · 1 = có lỗi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const catalogPath = path.join(webRoot, "src", "app", "routeCatalog.js");
const nginxPath = path.join(webRoot, "docker", "nginx.conf");
const backendSrc = path.resolve(webRoot, "..", "core", "backend", "src");

function fatal(msg) {
  console.error(`✗ check:admin-spa-routes — FAIL: ${msg}`);
  process.exit(1);
}

/** Danh sách `app_label` Django thật: app nào có `apps.py` trong backend. */
function readDjangoAppLabels() {
  if (!fs.existsSync(backendSrc)) {
    fatal(
      `backend src not found: ${backendSrc} — không kiểm được chiều ngược lại`,
    );
  }
  return fs
    .readdirSync(backendSrc, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        fs.existsSync(path.join(backendSrc, d.name, "apps.py")),
    )
    .map((d) => d.name)
    .sort();
}

/**
 * Kiểm tra thuần: trả về mảng lỗi (rỗng = đạt). Không `process.exit` để
 * `--self-test` chạy được trên cấu hình cố tình hỏng.
 */
function check(catalog, nginx, djangoAppLabels) {
  const errors = [];

  // 1. Các path `/admin/*` khai trong routeCatalog.
  const catalogAdminPaths = [
    ...new Set(
      [...catalog.matchAll(/path:\s*"(\/admin\/[^"]*)"/g)].map((m) => m[1]),
    ),
  ].sort();
  if (catalogAdminPaths.length === 0) {
    errors.push("no /admin/* paths found in routeCatalog");
    return { errors, stats: { catalogAdminPaths: [], spaPrefixes: [], spaExact: [] } };
  }

  // 2. Block phục vụ SPA: prefix `^~` hoặc exact `=` có `try_files … /index.html`.
  const spaPrefixes = [];
  for (const m of nginx.matchAll(/location\s+\^~\s+(\S+)\s*\{([^}]*)\}/g)) {
    if (m[1].startsWith("/admin") && /try_files[^;]*\/index\.html/.test(m[2])) {
      spaPrefixes.push(m[1]);
    }
  }
  const spaExact = [];
  for (const m of nginx.matchAll(/location\s+=\s+(\/admin\S*)\s*\{([^}]*)\}/g)) {
    if (/try_files[^;]*\/index\.html/.test(m[2])) spaExact.push(m[1]);
  }

  if (!nginx.includes("location ^~ /admin/")) {
    errors.push(
      "generic `location ^~ /admin/` block missing — Django admin proxy assumption broken",
    );
  }

  // 3. CHIỀU 1 — mọi route catalog phải được phục vụ.
  const coveredBy = (p) =>
    spaPrefixes.some((pre) => p === pre || p.startsWith(pre)) ||
    spaExact.includes(p);
  const orphans = catalogAdminPaths.filter((p) => !coveredBy(p));
  if (orphans.length > 0) {
    errors.push(
      `uncovered SPA routes (would 404 via Django):\n  - ${orphans.join("\n  - ")}`,
    );
  }

  // 4. CHIỀU 2 — prefix SPA không được nuốt app_label của Django.
  const swallowed = [];
  for (const pre of spaPrefixes) {
    const seg = pre.replace(/^\/admin\/?/, "").replace(/\/$/, "");
    if (!seg) continue;
    if (!djangoAppLabels.includes(seg)) continue;
    if (spaExact.includes(pre)) continue; // đã dùng `=` ⇒ chỉ khớp đúng URL đó
    swallowed.push(
      `${pre}  (app_label "${seg}" của Django: mọi /admin/${seg}/<model>/ sẽ trả index.html của SPA)`,
    );
  }
  if (swallowed.length > 0) {
    errors.push(
      `SPA prefix nuốt admin của Django:\n  - ${swallowed.join("\n  - ")}\n` +
        `Sửa: đổi \`location ^~ <prefix>\` thành \`location = <prefix>\`. ` +
        `Xác minh bằng: node scripts/verify-admin-nginx-routing.mjs`,
    );
  }

  const legacy = spaPrefixes.filter(
    (pre) =>
      !catalogAdminPaths.some((p) => p === pre || p.startsWith(pre)) &&
      !spaExact.includes(pre),
  );
  return { errors, stats: { catalogAdminPaths, spaPrefixes, spaExact, legacy } };
}

function selfTest(catalog, nginx, labels) {
  const cases = [];
  const run = (name, mutate, expectFail) => {
    const res = check(catalog, mutate(nginx), labels);
    const failed = res.errors.length > 0;
    cases.push({
      name,
      ok: failed === expectFail,
      detail: failed ? `bắt ${res.errors.length} lỗi` : "không bắt lỗi",
      expect: expectFail ? "phải FAIL" : "phải PASS",
    });
  };

  run("T1 cấu hình thật hiện tại phải đạt", (s) => s, false);
  // Lỗi O1: đổi `=` thành `^~` ⇒ chiều 2 phải bắt.
  run(
    "T2 `=` → `^~` (nuốt app_label) phải bị bắt",
    (s) => s.replace("location = /admin/advertising", "location ^~ /admin/advertising"),
    true,
  );
  // Bỏ hẳn block của 1 route ⇒ chiều 1 phải bắt.
  run(
    "T3 xoá block phục vụ 1 route phải bị bắt",
    (s) => s.replace(/location = \/admin\/advertising \{[^}]*\}/, ""),
    true,
  );
  // `replace` chuỗi chỉ thay LẦN ĐẦU, mà `/admin/` xuất hiện nhiều lần ⇒
  // phải `replaceAll`, nếu không gate tưởng đã hỏng mà thực ra vẫn đúng.
  run(
    "T4 mất `location ^~ /admin/` gốc phải bị bắt",
    (s) => s.replaceAll("location ^~ /admin/", "location ^~ /admin-django/"),
    true,
  );

  let passed = 0;
  for (const c of cases) {
    const tag = c.ok ? "PASS" : "FAIL";
    if (c.ok) passed++;
    console.log(
      `  ${tag} ${c.name} — ${c.detail} (${c.expect})`,
    );
  }
  console.log(`\ncheck:admin-spa-routes --self-test: ${passed === cases.length ? "PASS" : "FAIL"} (${passed}/${cases.length})`);
  return passed === cases.length ? 0 : 1;
}

if (!fs.existsSync(catalogPath)) fatal(`routeCatalog not found: ${catalogPath}`);
if (!fs.existsSync(nginxPath)) fatal(`nginx.conf not found: ${nginxPath}`);

const catalog = fs.readFileSync(catalogPath, "utf8");
const nginx = fs.readFileSync(nginxPath, "utf8");
const labels = readDjangoAppLabels();

if (process.argv.includes("--self-test")) {
  process.exit(selfTest(catalog, nginx, labels));
}

const { errors, stats } = check(catalog, nginx, labels);
if (errors.length > 0) {
  console.error(
    `✗ check:admin-spa-routes — FAIL:\n${errors.map((e) => `  ${e}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(
  `✓ check:admin-spa-routes — PASS (${stats.catalogAdminPaths.length} catalog /admin/* paths ` +
    `covered by ${stats.spaPrefixes.length} prefix + ${stats.spaExact.length} exact locations; ` +
    `chiều ngược OK với ${labels.length} app_label Django` +
    `${stats.legacy.length > 0 ? `; legacy extra: ${stats.legacy.join(", ")}` : ""})`,
);