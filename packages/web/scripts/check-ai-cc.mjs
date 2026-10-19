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
  // R5.1 (phuong an B): trang Agents da bi GO nen AC8b cu (token system tren
  // trang do) khong con doi tuong. Thay bang AC khoa TINH TRANG: route + tab
  // khong con ton tai trong AiHubNav (trang/page da xoa o file khac).
  {
    id: "AC8b-agents-route-and-tab-absent",
    file: "packages/web/src/components/AiHubNav.tsx",
    patterns: ["AiHubNav"],
    absent: ["/settings/ai/agents", "tabAgents"],
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

// ---------------------------------------------------------------------------
// S4 AC5.1/AC5.2 — rule CAU TRUC, khong phai rule khop chuoi.
// ---------------------------------------------------------------------------
// Vì sao rule riêng: framework `CHECKS` kiem tra "co pattern nay khong". Lỗi S1
// là **so LUONG** (hai `<nav>` cung mang mot `aria-label`), khong phai "thieu pattern".
//
// Vì sao khoá trên `aria-label` chứ không khoá trên ten class (hazard 12):
// rule viết theo chuoi `"hubNav"` se bi bo qua ngay khi tác giả đặt tên class khác.
// Rule này kiểm **hậu quả** — một mốc điều hướng không được gán nhãn trùng lặp —
// nên đổi tên class hay đổi khoá i18n đều không thoát.
const AI_HUB_FILES = [
  "packages/web/src/pages/AICommandCenterPage.tsx",
  "packages/web/src/components/AiHubNav.tsx",
];

/**
 * Trả về mọi cặp `<nav ...>` kèm `aria-label: t("KEY")` trong các file đã cho.
 *
 * Repo dùng lẫn lộn `e("nav", {...})` (createElement) và `<nav>` (JSX), và
 * `e(` có thể xuống dòng trước `"nav"` — regex `e\("nav"` **không** khớp dạng đó
 * (đã đo: gate báo "không tìm thấy <nav> nào" trên chính `AiHubNav.tsx` vốn CÓ nav).
 *
 * Cách đúng: chia file theo các điểm MỞ nav, rồi trong mỗi đoạn tới điểm mở kế
 * tiếp, tìm `aria-label`. Không cần cân bằng ngoặc.
 */
function navAriaLabels(texts) {
  const out = [];
  const OPENER = /(?:<nav\b|e\(\s*"nav")/g;
  for (const text of texts) {
    const starts = [];
    for (const m of text.matchAll(OPENER)) starts.push(m.index);
    starts.push(text.length);
    for (let i = 0; i < starts.length - 1; i++) {
      const segment = text.slice(starts[i], starts[i + 1]);
      const label = /aria-label["']?\s*:\s*t\(\s*["']([^"']+)["']/g;
      for (const l of segment.matchAll(label)) out.push({ key: l[1] });
    }
  }
  return out;
}

const CUSTOM_CHECKS = [
  {
    id: "AC10-single-navigation-system",
    files: AI_HUB_FILES,
    run(texts) {
      const labels = navAriaLabels(texts);
      if (labels.length === 0) return "khong tim thay <nav> nao co aria-label de kiem";
      const byKey = new Map();
      for (const l of labels) byKey.set(l.key, (byKey.get(l.key) || 0) + 1);
      const dup = [...byKey.entries()].filter(([, n]) => n > 1);
      if (dup.length > 0) {
        return (
          "trang AI CC gan cung mot nhan cho >1 <nav>: " +
          dup.map(([k, n]) => `"${k}" x${n}`).join(", ") +
          " — hai thanh dieu huong se trong giong het nhau"
        );
      }
      return null;
    },
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
  for (const c of CUSTOM_CHECKS) {
    let err;
    try {
      const texts = c.files.map((f) => readFileSync(join(root, f), "utf8"));
      err = c.run(texts);
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
  // ------------------------------------------------------------------
  // Self-test cho rule CAU TRUC. Bắt buộc co case **PARAPHRASE** — mot cau
  // hinh ma tac gia KHONG viet khi dinh nghia rule. Neu thieu, rule chi bao ve
  // hien tuong da bi, va lan sau tac gia viet lai theo cach khac se lot qua
  // (hazard 12).
  // ------------------------------------------------------------------
  const pageText = readFileSync(join(REPO, AI_HUB_FILES[0]), "utf8");
  const navText = readFileSync(join(REPO, AI_HUB_FILES[1]), "utf8");
  const custom = CUSTOM_CHECKS[0];

  // (1) Ban dich: chen them MOT <nav> trong page, giong het ban goc.
  const dupNav = `e("nav", { key: "hub-nav-dup", className: styles.hubNav, "aria-label": t("aiCommandCenter.title") }, [\n    e(Link, { key: "x", to: "#runtime", className: styles.hubNavLink }, t("aiCommandCenter.tabRuntime")),\n  ]),\n`;
  let err1 = null;
  try {
    err1 = custom.run([pageText.replace("      // Summary Cards", dupNav + "      // Summary Cards"), navText]);
  } catch (e) {
    err1 = "lo: " + e.message;
  }
  if (err1) {
    caught += 1;
    console.log(`  PASS  ${custom.id} bat duoc nav trung ban sao`);
  } else {
    console.log(`  FAIL  ${custom.id} KHONG bat duoc nav trung ban sao`);
  }

  // (2) PARAPHRASE — tac gia doi ten class va doi bieu thuc, van phai bi bat.
  //     Day la case ma tac gia KHONG viet khi dinh nghia rule.
  const paraphrased = dupNav
    .replace("styles.hubNav", "styles.sectionNavBar")
    .replace("styles.hubNavLink", "styles.sectionTab")
    .replace("t(\"aiCommandCenter.title\")", "t(\"aiCommandCenter.title\") /* giu nguyen nhan */");
  let err2 = null;
  try {
    err2 = custom.run([pageText.replace("      // Summary Cards", paraphrased + "      // Summary Cards"), navText]);
  } catch (e) {
    err2 = "lo: " + e.message;
  }
  if (err2) {
    caught += 1;
    console.log(`  PASS  ${custom.id} bat duoc PARAPHRASE (doi ten class, giu nguyen hien tuong)`);
  } else {
    console.log(`  FAIL  ${custom.id} KHONG bat duoc PARAPHRASE`);
  }

  // (3) Case am: hai <nav> KHAC nhan deu hop le — gate phai im lang.
  const twoDistinct = `e("nav", { key: "nav-b", "aria-label": t("aiCommandCenter.fallbackTitle") }, []),\n`;
  let err3 = null;
  try {
    err3 = custom.run([pageText.replace("      // Summary Cards", twoDistinct + "      // Summary Cards"), navText]);
  } catch (e) {
    err3 = "lo: " + e.message;
  }
  if (err3 === null) {
    caught += 1;
    console.log(`  PASS  ${custom.id} im lang khi 2 nav KHAC nhan (khong bao loi gia)`);
  } else {
    console.log(`  FAIL  ${custom.id} bao loi gia: ${err3}`);
  }

  const total = CHECKS.length + 3 + 1;
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
