#!/usr/bin/env node
// Kiểm chứng THẬT cho xung đột routing nginx giữa SPA và Django admin tại `/admin/`.
//
// VÌ SAO CẦN FILE NÀY
// -------------------
// `location ^~ /admin/advertising` là **PREFIX** ⇒ khớp cả `/admin/advertising/adcampaign/`
// ⇒ **toàn bộ admin của app `advertising` bị SPA nuốt**. Cách sửa
// (`location = /admin/advertising`) nghe hợp lý, nhưng "hợp lý" không phải bằng chứng.
// File này chạy **nginx thật** với `nginx.conf` thật rồi bắn HTTP thật vào từng URL.
//
// Kỹ thuật: mọi `proxy_pass http://$core_api_upstream;` bị thay bằng
// `return 200 "DJANGO";`. Location nào **proxy tới Django** sẽ trả `DJANGO`;
// location nào có `try_files … /index.html` sẽ trả nội dung trang SPA.
// ⇒ Không cần backend thật, và đo **đúng** thứ cần kiểm: nginx chọn location nào.
//
// Chạy:
//   node scripts/verify-admin-nginx-routing.mjs
//   node scripts/verify-admin-nginx-routing.mjs --json
//
// Exit 0 = mọi case đúng · 1 = có case sai · 2 = KHÔNG chạy được (không phải PASS).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// `packages/web/scripts` -> `packages/web` -> `packages` -> repo root
const REPO = path.resolve(here, "..", "..", "..");
const NGINX_CONF = path.join(REPO, "packages", "web", "docker", "nginx.conf");

const IMAGE = process.env.NGINX_IMAGE || "nginx:alpine";
const PORT = Number(process.env.VERIFY_PORT || 18131);
const CONTAINER = process.env.VERIFY_CONTAINER || "vnadminroutetest";

const CASES = [
  { path: "/admin/advertising", expect: "SPA", note: "route SPA — block `=` moi sua" },
  { path: "/admin/advertising/", expect: "DJANGO", note: "app_index cua app `advertising`" },
  { path: "/admin/advertising/adcampaign/", expect: "DJANGO", note: "changelist AdCampaign" },
  { path: "/admin/advertising/adcampaign/1/change/", expect: "DJANGO", note: "form sua AdCampaign" },
  { path: "/admin/advertising/adiusercampaign/", expect: "DJANGO", note: "changelist model khac" },
  { path: "/admin/advertising/adclicklog/9/change/", expect: "DJANGO", note: "form model khac" },
  { path: "/admin/advertising/addailysummary/", expect: "DJANGO", note: "changelist AdDailySummary" },
  { path: "/admin/users", expect: "SPA", note: "SPA, khong trung app_label" },
  { path: "/admin/users/123", expect: "SPA", note: "con cua SPA" },
  { path: "/admin/tenants", expect: "SPA", note: "SPA" },
  { path: "/admin/tenants/9/usage", expect: "SPA", note: "con cua SPA" },
  { path: "/admin/billing", expect: "SPA", note: "SPA" },
  { path: "/admin/usage", expect: "SPA", note: "SPA" },
  { path: "/admin/audit", expect: "SPA", note: "SPA" },
  { path: "/admin/audit-trace", expect: "SPA", note: "SPA" },
  { path: "/admin/analytics", expect: "SPA", note: "SPA" },
  { path: "/admin/overview", expect: "SPA", note: "SPA" },
  { path: "/admin/jobs", expect: "SPA", note: "SPA" },
  { path: "/admin/core/panel", expect: "SPA", note: "SPA operator" },
  { path: "/admin/", expect: "DJANGO", note: "trang chu Django" },
  { path: "/admin/login/", expect: "DJANGO", note: "dang nhap Django" },
  { path: "/admin/logout/", expect: "DJANGO", note: "dang xuat Django" },
  { path: "/admin/identity_access/coretenant/", expect: "DJANGO", note: "app_label khong trung SPA" },
  { path: "/admin/commercial/invoice/", expect: "DJANGO", note: "app_label khac" },
  { path: "/admin/support/supportticket/", expect: "DJANGO", note: "app_label wave 15" },
  { path: "/admin/service_ops/servicehealth/", expect: "DJANGO", note: "app_label wave 15" },
  { path: "/admin/vninvest_core/", expect: "DJANGO", note: "app_label project" },
  { path: "/static/admin/css/base.css", expect: "DJANGO", note: "static -> core-api" },
];

function docker(args, opts = {}) {
  return spawnSync("docker", args, { encoding: "utf8", timeout: 120000, ...opts });
}

// Duong dan BEN TRONG container. Khong duoc dung duong dan host (Windows
// `C:\...`) ben trong noi dung file .conf — nginx parse dang POSIX nen se tra
// `open() "/etc/nginx/C:\..." failed`. Vì vậy ca thu muc tmp duoc mount sang
// mot diem co dinh trong container, moi duong dan trong .conf tro vao do.
const CTMP = "/tmp/vnadminroute";

function buildCandidateConf() {
  const conf = fs.readFileSync(NGINX_CONF, "utf8");

  // Thu muc tinh -> SPA toi gian
  let out = conf.replace(/root\s+[^;]+;/g, `root ${CTMP}/html;`);
  out = out.replace(/alias\s+[^;]+;/g, `root ${CTMP}/html;`);
  // Listen tren MONG container, khong phai loopback cua container: neu bind
  // 127.0.0.1 trong container thi `-p` cua Docker khong dua duoc request vao
  // (no vao network namespace khac). `listen <port>` = 0.0.0.0.
  out = out.replace(/listen\s+[^;]*;/g, `listen ${PORT};`);
  out = out.replace(/ssl_certificate\s+[^;]+;/g, "");
  out = out.replace(/ssl_certificate_key\s+[^;]+;/g, "");

  // `include` tro ra ngoai -> file rong (khong can tai gi)
  out = out.replace(/include\s+[^;]+;/g, `include ${CTMP}/empty.conf;`);

  // ⭐ Bien doi quan trong: moi `proxy_pass` -> tra "DJANGO" ngay tai cho.
  // Giu nguyen `location`/`try_files` => dung thu tu chon location cua nginx,
  // day chinh la thu can kiem.
  const proxyPasses = [...out.matchAll(/proxy_pass\s+[^;]+;/g)];
  out = out.replace(/proxy_pass\s+[^;]+;/g, 'return 200 "DJANGO";');

  return { conf: out, proxyPassCount: proxyPasses.length };
}

// `nginx.conf` cua repo LA SNIPNET conf.d (xem dong 15-18 cua chinh no:
// "this file is copied to /etc/nginx/conf.d/default.conf, so its top level
// IS the http{} context ... do NOT wrap it in http{}").
// => Dung chinh xac cach production ghep no: mot main config toi gian,
//    include file trong. Dung main config that se lam `limit_req_zone`
//    o dong 2 bi bao loi sai (khong dung context).
function buildMainConf() {
  return [
    "user root;",
    "worker_processes 1;",
    "pid /tmp/nginx.pid;",
    "error_log /tmp/nginx-error.log warn;",
    "events { worker_connections 64; }",
    "http {",
    "  access_log off;",
    `  client_body_temp_path ${CTMP}/cb;`,
    `  proxy_temp_path ${CTMP}/px;`,
    `  fastcgi_temp_path ${CTMP}/fc;`,
    `  uwsgi_temp_path ${CTMP}/uw;`,
    `  scgi_temp_path ${CTMP}/sc;`,
    `  include ${CTMP}/default.conf;`,
    "}",
    "",
  ].join("\n");
}

async function waitPort(p, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(`http://127.0.0.1:${p}/__ping`, { redirect: "manual" });
      return true;
    } catch {
      /* chua san sang */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  if (!fs.existsSync(NGINX_CONF)) {
    console.log(`KHONG TIM THAY ${NGINX_CONF}`);
    return 2;
  }
  if (docker(["image", "inspect", IMAGE]).status !== 0) {
    console.log(`KHONG CO IMAGE ${IMAGE} — KHONG verify duoc (khong phai PASS)`);
    return 2;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vnadminroute-"));
  fs.mkdirSync(path.join(tmp, "html"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "html", "index.html"), "SPA_INDEX_PAGE");
  fs.writeFileSync(path.join(tmp, "empty.conf"), "# rong\n");
  const { conf, proxyPassCount } = buildCandidateConf();
  fs.writeFileSync(path.join(tmp, "default.conf"), conf);
  fs.writeFileSync(path.join(tmp, "nginx.conf"), buildMainConf());

  // `nginx -t` truoc: bat loi cau hinh truoc khi bat container
  const syntax = docker(
    [
      "run", "--rm",
      "-v", `${tmp}:${CTMP}`,
      "-v", `${path.join(tmp, "nginx.conf")}:/etc/nginx/nginx.conf:ro`,
      IMAGE, "nginx", "-t",
    ],
    { encoding: "utf8" },
  );
  if (syntax.status !== 0) {
    console.log("nginx -t FAIL (cau hinh khong hop le):");
    console.log((syntax.stdout || "") + (syntax.stderr || ""));
    return 1;
  }
  console.log("nginx -t: OK");

  const run = docker([
    "run", "--rm", "-d", "--name", CONTAINER,
    "-p", `127.0.0.1:${PORT}:${PORT}`,
    "-v", `${path.join(tmp, "nginx.conf")}:/etc/nginx/nginx.conf:ro`,
    "-v", `${tmp}:${CTMP}`,
    IMAGE,
  ]);
  if (run.status !== 0) {
    console.log("KHONG khoi dong duoc container nginx:", (run.stderr || "").trim());
    return 2;
  }

  const up = await waitPort(PORT);
  if (!up) {
    console.log("nginx khong phan hoi. Logs:");
    console.log(docker(["logs", CONTAINER]).stdout || "");
    docker(["rm", "-f", CONTAINER]);
    return 2;
  }

  const verOut = docker(["exec", CONTAINER, "nginx", "-v"], { encoding: "utf8" });
  const nginxVersion =
    (verOut.stderr || verOut.stdout || "").match(/nginx\/([\d.]+)/)?.[1] ?? "?";

  const results = [];
  for (const c of CASES) {
    let got = "KHONG-CU";
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${c.path}`, { redirect: "manual" });
      const text = (await r.text()).slice(0, 300);
      if (text.startsWith("DJANGO")) got = "DJANGO";
      else if (text.includes("SPA_INDEX_PAGE")) got = "SPA";
      else got = `KHAC(${r.status})`;
    } catch {
      got = "LOI";
    }
    results.push({ ...c, got, pass: got === c.expect });
  }

  console.log(
    `verify-admin-nginx-routing — nginx ${nginxVersion} (${IMAGE}), ${proxyPassCount} proxy_pass da thay bang "DJANGO"`,
  );
  for (const r of results) {
    console.log(
      `  ${r.pass ? "PASS" : "FAIL"}  ${r.path.padEnd(40)} expect=${r.expect.padEnd(8)} got=${r.got.padEnd(11)} # ${r.note}`,
    );
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length} case · ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ nginxVersion, image: IMAGE, results }, null, 2));
  }

  docker(["rm", "-f", CONTAINER]);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    try { docker(["rm", "-f", CONTAINER]); } catch { /* bo qua */ }
    process.exit(2);
  });
