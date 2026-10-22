#!/usr/bin/env node
/**
 * check-experiment-env — QUY ĐỊNH CỨNG: MỌI THỬ NGHIỆM CHẠY TRÊN VPS STAGING.
 * CẤM DÙNG LOCAL DOCKER.
 *
 * Nguồn quy định:
 *   - `docs/STAGING_VPS_RUNBOOK.md` §12 (Owner chốt 2026-10-14, nhắc lại 2026-10-22)
 *   - `docs/AGENT_PROTOCOL.md` §12
 *
 * LÝ DO (đo thật 2026-10-22): host local cạn RAM ⇒ suite test local cho kết quả GIẢ
 * (OOM, `OperationalError`). Container local vẫn ăn RAM host ⇒ cấm luôn.
 *
 * CÁCH GATE HOẠT ĐỘNG (không cần Docker, chạy được ở mọi máy):
 *   Quét các DÒNG ĐƯỢC THÊM trong diff (staged, nếu có; không thì `origin/dev...HEAD`)
 *   và BÁO LỖI nếu dòng đó kêu lệnh Docker **mà không có dấu hiệu chạy trên VPS**.
 *   Dấu hiệu VPS được công nhận: `ssh`, `14.225.255.47`, `docker.edusuccess.vn`,
 *   `vninvest-staging`, `/opt/vninvest`.
 *
 *   => Một agent thêm "docker run ..." vào script thử nghiệm (không có dấu hiệu VPS)
 *      bị CHẶN ngay, kèm lệnh VPS đúng để thay thế.
 *
 * Usage:
 *   node scripts/check-experiment-env.mjs             # gate that
 *   node scripts/check-experiment-env.mjs --self-test # chung minh gate bat loi that
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

/** Lệnh Docker — nếu thêm mới vào diff mà không có dấu hiệu VPS ⇒ vi phạm. */
const DOCKER_PATTERNS = [
  /\bdocker\s+run\b/,
  /\bdocker\s+exec\b/,
  /\bdocker\s+compose\b/,
  /\bdocker-compose\b/,
  /\bdocker\s+build\b/,
  /\bdocker\s+ps\b/,
];

/** Dấu hiệu cho thấy lệnh đó chạy trên VPS staging (được phép). */
const VPS_MARKERS = [
  /ssh\b/,
  /14\.225\.255\.47/,
  /docker\.edusuccess\.vn/,
  /vninvest-staging/,
  /\/opt\/vninvest/,
];

/** File được phép chứa lệnh Docker (tài liệu VPS / script deploy lên VPS). */
const ALLOWED_PATHS = [
  "docs/STAGING_VPS_RUNBOOK.md",
  "docs/AGENT_PROTOCOL.md",
  "docs/lessons/",
];

/** Đường dẫn bị phép chứa lệnh docker (script deploy có chủ đích). */
const ALLOWED_SCRIPT_PATHS = [
  "scripts/deploy-staging.sh",
  "scripts/deploy-server.sh",
  "scripts/deploy-remote.ps1",
  "scripts/ops/deploy_build_on_server.sh",
  "scripts/bootstrap-staging.sh",
  "scripts/ops/dev_compose.ps1",
  "scripts/ops/setup_oc19_github_rulesets.ps1",
  "scripts/portainer_reset_db.ps1",
  "scripts/quality/check_large_files.ps1",
  "scripts/ops/generate_module_tree.py",
  "scripts/ops/prefetch_policy_capture_baseline.ps1",
  "scripts/ops/prefetch_policy_gate_b2_check.ps1",
  "scripts/ops/prefetch_policy_uat_capture.ps1",
  "scripts/ops/realtime_ticker_load_test.py",
  "scripts/ops/sprint22_collect_evidence.ps1",
  "scripts/ops/sprint23_collect_rollout_evidence.ps1",
  "scripts/ops/sprint24_collect_dashboard_evidence.ps1",
  "scripts/ops/sprint27_collect_deploy_evidence.ps1",
  "scripts/ops/sprint29_advisory_auth_smoke.ps1",
  "scripts/ops/sprint29_collect_deploy_evidence.ps1",
  "scripts/ops/sprint29_run_release_gate.ps1",
  "scripts/ops/sprint30_collect_deploy_evidence.ps1",
  "scripts/ops/sprint30_run_release_gate.ps1",
  "scripts/ops/sprint30_runtime_kpi_smoke.ps1",
  "scripts/ops/sprint31_governance_postgres_regression.ps1",
  "scripts/ops/sprint31_refresh_go_no_go_from_tracker.ps1",
  "scripts/ops/sprint31_update_ci_tracker_row.ps1",
  "scripts/ops/sync_vninvest_core.ps1",
  "scripts/ops/portainer_reset_db.ps1",
  "scripts/quality/check_opencore_doc_sync.ps1",
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.prod.yml",
  "docker-compose.staging.yml",
  "docker-compose.beta.yml",
  "docker-compose.ghcr.yml",
  "docker-compose.nginx-proxy.yml",
  "docker-compose.local-build.override.yml",
  "portainer-stack-https.yml",
  "portainer-stack-vninvest.yml",
  "portainer-stack-autohttps.yml",
  ".githooks/",
  ".github/workflows/",
  ".github/workflows-disabled/",
  "docs/",
  "scripts/quality/",
  "packages/core/backend/Dockerfile",
  "packages/web/Dockerfile",
  "packages/opencore/",
];

export function findLocalDockerViolations(addedLines) {
  const out = [];
  for (const { path, line, text } of addedLines) {
    const p = path.replace(/\\/g, "/");
    if (ALLOWED_PATHS.some((a) => p.startsWith(a))) continue;
    if (ALLOWED_SCRIPT_PATHS.some((a) => p === a || p.startsWith(a + "/"))) continue;
    if (!DOCKER_PATTERNS.some((re) => re.test(text))) continue;
    if (VPS_MARKERS.some((re) => re.test(text))) continue;
    out.push({ path, line, text: text.trim().slice(0, 160) });
  }
  return out;
}

/** Lấy các dòNG ĐƯỢC THÊM trong diff. */
export function collectAddedLines(cwd) {
  const run = (args) => {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch {
      return "";
    }
  };
  let diff = "";
  let base = "";
  const staged = run(["diff", "--cached", "--unified=0"]);
  if (staged.trim()) {
    diff = staged;
    base = "staged";
  } else {
    diff = run(["diff", "origin/dev...HEAD", "--unified=0"]);
    base = "origin/dev...HEAD";
  }
  const added = [];
  let path = "";
  let line = 0;
  for (const raw of diff.split("\n")) {
    const m = raw.match(/^\+\+\+ b\/(.+)$/);
    if (m) {
      path = m[1];
      continue;
    }
    const h = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) {
      line = Number(h[1]);
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      added.push({ path, line, text: raw.slice(1) });
      line += 1;
    } else if (!raw.startsWith("-")) {
      line += 1;
    }
  }
  return { added, base };
}

function selfTest() {
  const failures = [];
  const check = (name, cond, detail) => {
    if (!cond) failures.push(`${name}: ${detail}`);
  };

  // 1. Dòng docker KHÔNG có dấu hiệu VPS => phải báo.
  {
    const v = findLocalDockerViolations([
      { path: "scripts/run-test.sh", line: 3, text: "docker run --rm -it myapp pytest" },
    ]);
    check("case 1", v.length === 1, `nhan ${v.length}`);
  }
  // 2. Dòng docker CÓ dấu hiệu VPS => không báo.
  {
    const v = findLocalDockerViolations([
      { path: "scripts/run-test.sh", line: 3, text: 'ssh root@14.225.255.47 "docker run --rm ..."' },
    ]);
    check("case 2", v.length === 0, `nhan ${JSON.stringify(v)}`);
  }
  // 3. File được phép (runbook) => không báo.
  {
    const v = findLocalDockerViolations([
      { path: "docs/STAGING_VPS_RUNBOOK.md", line: 459, text: "docker run --rm --network vninvest-staging_vninvest_network" },
    ]);
    check("case 3", v.length === 0, `nhan ${JSON.stringify(v)}`);
  }
  // 4. Dòng KHÔNG phải docker => không báo.
  {
    const v = findLocalDockerViolations([
      { path: "packages/web/src/main.tsx", line: 10, text: "const x = dockerLikeThing();" },
    ]);
    check("case 4", v.length === 0, `nhan ${JSON.stringify(v)}`);
  }
  // 5. Dòng docker compose local trong script mới => phải báo.
  {
    const v = findLocalDockerViolations([
      { path: "scripts/ops/brand_new_probe.sh", line: 1, text: "docker compose -f docker-compose.dev.yml up -d" },
    ]);
    check("case 5", v.length === 1, `nhan ${v.length}`);
  }
  // 6. Dòng docker trong script ĐÃ có sẵn (allowlist) => không báo.
  {
    const v = findLocalDockerViolations([
      { path: "scripts/ops/sync_vninvest_core.ps1", line: 1, text: "docker exec vninvest-core-api python manage.py" },
    ]);
    check("case 6", v.length === 0, `nhan ${JSON.stringify(v)}`);
  }

  if (failures.length) {
    console.error("check-experiment-env --self-test: FAIL");
    failures.forEach((f) => console.error("  - " + f));
    return 1;
  }
  console.log("check-experiment-env --self-test: PASS (6/6 case)");
  return 0;
}

function main() {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest());
  }
  if (!existsSync(join(REPO, ".git"))) {
    console.error("check-experiment-env: khong phai git repo — CHUA CHAY");
    process.exit(2);
  }
  const { added, base } = collectAddedLines(REPO);
  if (!added.length) {
    console.log("check-experiment-env: PASS (khong co dong moi trong diff)");
    process.exit(0);
  }
  const violations = findLocalDockerViolations(added);
  if (violations.length) {
    console.error(`check-experiment-env: FAIL (${violations.length} loi) — base = ${base}`);
    console.error("  QUY DINH (docs/STAGING_VPS_RUNBOOK.md §12): MOI THU NGHIEM CHAY TREN VPS STAGING.");
    console.error("  CẤM dùng local Docker (host local cạn RAM => ket qua test gia: OOM / OperationalError).");
    console.error("  Lệnh VPS chuẩn: docs/STAGING_VPS_RUNBOOK.md §12.3 (BE) / §12.4 (FE).");
    console.error("  VPS: ssh -i $HOME/.ssh/id_ed25519 root@14.225.255.47 · repo /opt/vninvest");
    violations.forEach((v) => console.error(`  - ${v.path}:${v.line}  ${v.text}`));
    process.exit(1);
  }
  console.log(
    `check-experiment-env: PASS (${added.length} dong moi trong ${base}, 0 lenh docker local chua co dau hieu VPS)`,
  );
  process.exit(0);
}

main();
