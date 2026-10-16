/**
 * check-ai-cc.mjs — gate tinh cho AI Command Center R0 (R0.8).
 *
 * Kiem tra tinh cac invariant R0.1-R0.5 tren source (khong can server):
 *   AC1: PUT tu choi provider la (membership check).
 *   AC2: PUT tu choi shape phang (canonical check).
 *   AC3: effective_context dung model user (khong phai luon system).
 *   AC4: CC GET default canonical (khong dict phang/lookback_unit).
 *   AC5: FE chi gui prompt_config khi dirty (helper + callback).
 *
 * Chay: node packages/web/scripts/check-ai-cc.mjs [--self-test]
 * --self-test: dot bien tren ban sao tam, gate PHAI do moi case (chung minh
 * gate bat loi that, khong phai tautology).
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");

const CHECKS = [
  {
    id: "AC1-provider-membership",
    file: "packages/core/backend/src/user_workspace/portfolio_analytics_views.py",
    patterns: ["ProviderChoices", "Nha cung cap AI khong hop le"],
  },
  {
    id: "AC2-flat-shape-rejected",
    file: "packages/core/backend/src/user_workspace/portfolio_analytics_views.py",
    patterns: ["is_canonical_prompt_config(pc)", "Shape phai la canonical v2"],
  },
  {
    id: "AC3-user-model-wins",
    file: "packages/core/backend/src/advisory/views.py",
    patterns: ["user_ai_model or ai_settings.ai_model"],
  },
  {
    id: "AC4-canonical-default",
    file: "packages/core/backend/src/user_workspace/portfolio_analytics_views.py",
    patterns: ["_get_default_prompt_config", "_parse_prompt_config("],
    absent: ["lookback_unit"],
  },
  {
    id: "AC5-dirty-only",
    file: "packages/web/src/pages/AICommandCenterPage.tsx",
    patterns: ["shouldSendPromptConfig", "onPromptConfigEdited"],
  },
  {
    id: "AC6-readiness-struct",
    file: "packages/core/backend/src/user_workspace/portfolio_analytics_views.py",
    patterns: ["build_ai_readiness(provider, api_key_configured)"],
  },
  {
    // R1.6 AC1: chart khong hex/rgba cung — ngoai tru fallback trong
    // CHART_TOKEN_FALLBACK (allowlist tuong minh: SVG attribute khong hieu var()).
    id: "AC7-chart-tokens",
    file: "packages/web/src/components/AIUsageDashboard.tsx",
    patterns: ["chartToken(", "CHART_TOKEN_FALLBACK"],
    absentExcept: [{
      pattern: "#[0-9a-fA-F]{3,8}\\b|rgba?\\(",
      allow: "chartToken(",
      allowBlock: { start: "CHART_TOKEN_FALLBACK", end: "};" },
    }],
  },
  {
    // R1.8 AC5: moi route AI CC chi 1 he token (module css) — khong Tailwind,
    // khong style={{ (rieng hub: khoi quota width DONG duoc giu).
    id: "AC8a-hub-one-token-system",
    file: "packages/web/src/pages/AICommandCenterPage.tsx",
    patterns: ["AiHubNav"],
    absentExcept: [{
      pattern: "(bg|text|border|flex|grid|px|py|mx|my|mt|mb|ml|mr|gap|rounded|shadow|ring|backdrop)-[a-z0-9/\\[\\]]+|style:\\s*\\{",
      allow: "quota",
      allowBlock: { start: 'key: "quota-bar"', end: "quotaFillEmpty" },
    }],
  },
  {
    id: "AC8b-agents-one-token-system",
    file: "packages/web/src/pages/AIAgentFederationPage.tsx",
    patterns: ["AiHubNav"],
    absentExcept: [{
      pattern: "(bg|text|border|flex|grid|px|py|mx|my|mt|mb|ml|mr|gap|rounded|shadow|ring|backdrop)-[a-z0-9/\\[\\]]+|style:\\s*\\{",
      allow: "quota-never-matches-anything",
    }],
  },
  {
    id: "AC8c-usage-one-token-system",
    file: "packages/web/src/pages/AIUsageAnalyticsPage.tsx",
    patterns: ["AiHubNav"],
    absentExcept: [{
      pattern: "(bg|text|border|flex|grid|px|py|mx|my|mt|mb|ml|mr|gap|rounded|shadow|ring|backdrop)-[a-z0-9/\\[\\]]+|style:\\s*\\{",
      allow: "quota-never-matches-anything",
    }],
  },
];

function checkOne(root, check) {
  const text = readFileSync(join(root, check.file), "utf8");
  for (const p of check.patterns || []) {
    if (!text.includes(p)) return `thieu pattern: ${p}`;
  }
  for (const a of check.absent || []) {
    // Chi ap dung cho khoi default GET: cho phep tu nay o comment giai thich.
    const hits = text.split("\n").filter(
      (line) => line.includes(a) && !line.trim().startsWith("#") && !line.trim().startsWith("//") && !line.trim().startsWith("*")
    );
    if (hits.length > 0) return `con chuoi cam: ${a} (${hits.length} dong code)`;
  }
  for (const rule of check.absentExcept || []) {
    const re = new RegExp(rule.pattern);
    // Allowlist theo block: hex/rgba chi duoc nam trong block khai bao
    // (vd CHART_TOKEN_FALLBACK) hoac tren dong co chuoi allow.
    let start = -1;
    let end = -1;
    if (rule.allowBlock) {
      start = text.indexOf(rule.allowBlock.start);
      end = start >= 0 ? text.indexOf(rule.allowBlock.end, start) : -1;
    }
    const hits = text.split("\n").filter((line) => {
      if (!re.test(line) || line.includes(rule.allow)) return false;
      if (start < 0 || end < 0) return true;
      const at = text.indexOf(line);
      return at < start || at > end;
    });
    if (hits.length > 0) return `con mau cung ngoai allowlist: ${hits.length} dong (vd: ${hits[0].trim().slice(0, 60)})`;
  }
  return null;
}

function runGate(root) {
  const failures = [];
  for (const c of CHECKS) {
    let err;
    try {
      err = checkOne(root, c);
    } catch (e) {
      err = `khong doc duoc file: ${e.message}`;
    }
    console.log(`  ${err ? "FAIL" : "PASS"}  ${c.id}`);
    if (err) failures.push(`${c.id}: ${err}`);
  }
  return failures;
}

if (process.argv.includes("--self-test")) {
  console.log("check-ai-cc SELF-TEST — dot bien tung AC, gate PHAI do:\n");
  let caught = 0;
  for (const c of CHECKS) {
    const dir = mkdtempSync(join(tmpdir(), "check-ai-cc-"));
    try {
      const src = join(REPO, c.file);
      const dst = join(dir, "f.py");
      let text = readFileSync(src, "utf8");
      // Dot bien: xoa MOI lan xuat hien pattern dau tien (replace 1 cho
      // khong du — file that co dinh nghia + cho dung).
      const target = (c.patterns || [])[0];
      text = text.split(target).join("/* MUTATED-AWAY */");
      writeFileSync(dst, text);
      const mutated = { ...c, file: "f.py" };
      const err = checkOne(dir, mutated);
      if (err) {
        caught += 1;
        console.log(`  PASS  ${c.id} bat duoc dot bien`);
      } else {
        console.log(`  FAIL  ${c.id} KHONG bat duoc dot bien`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  // Case phu: file khong ton tai phai bao loi (khong im lang PASS).
  let err;
  try {
    err = checkOne(REPO, { id: "ghost", file: "khong/toN-tai.py", patterns: ["x"] });
  } catch {
    err = "khong doc duoc file (dung nhu ky vong)";
  }
  if (err) {
    caught += 1;
    console.log("  PASS  ghost-file bao loi");
  } else {
    console.log("  FAIL  ghost-file im lang PASS");
  }
  const total = CHECKS.length + 1;
  if (caught !== total) {
    console.error(`\ncheck-ai-cc SELF-TEST FAILED: ${caught}/${total}. Gate khong duoc tin.`);
    process.exit(1);
  }
  console.log(`\ncheck-ai-cc SELF-TEST PASS: ${total}/${total}.`);
  process.exit(0);
}

const failures = runGate(REPO);
if (failures.length > 0) {
  console.error("\ncheck-ai-cc: CO DRIFT:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\ncheck-ai-cc: SACH.");
