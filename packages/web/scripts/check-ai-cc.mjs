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
import { join, dirname, resolve, sep } from "node:path";
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
// là **so LUONG** (hai `<nav>` trùng nhãn hoặc trùng class), không phải "thiếu pattern".
//
// Vì sao khoá trên **hậu quả** chứ không khoá trên tên class (hazard 12):
// rule viết theo chuỗi `"hubNav"` sẽ bị bỏ qua ngay khi tác giả đặt tên class khác.
// Rule này kiểm **hậu quả** — trong hub AI CC không được có hai `<nav>` trùng
// `aria-label` hoặc trùng class — nên đổi tên class, đổi khoá i18n, hay tách nav
// sang file khác đều không thoát.

/**
 * Mọi file thuộc cây render của `/settings/ai`: BFS từ trang hub theo **import
 * TƯƠNG ĐỐI** (hazard 7 — "ai là của riêng trang này" là một khẳng định về đồ thị
 * import, phải DUYỆT chứ không được đoán bằng mắt).
 *
 * Vì sao không dùng "mọi file có nhắc `aiCommandCenter.`": đó là **phạm vi rộng hơn
 * mức cần**. Hai trang khác nhau cùng dùng một class là chuyện bình thường (đo được:
 * `.auditPager` là nav phân trang ở cả `/settings/ai/audit` và `/settings/ai/traces`).
 * Với cây render thì "2 `<nav>` cùng class" **chắc chắn** là cùng một trang.
 */
function hubClosure(root) {
  const startRel = "packages/web/src/pages/AICommandCenterPage.tsx";
  const seen = new Set();
  const out = [];
  const queue = [startRel];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = join(root, rel);
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    out.push({ name: rel, text });
    // Import tương đối: from "./x.js" | from "../y/z"  (bỏ phần mở rộng .js/.ts)
    const dir = dirname(abs);
    for (const m of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      // TS/ESM: import thường ghi "\u2026/AiHubNav.js" nhưng file thật là .tsx.
      // Phai thử CẢ "giữ đuôi" lẫn "bóc đuôi rồi nối lại" (đo: giữ nguyên cách cũ
      // thì BFS không bao giờ tới AiHubNav.tsx ⇒ rule im lặng trên 0 <nav>).
      const bases = [m[1], m[1].replace(/\.(js|jsx|ts|tsx)$/, "")];
      for (const b of bases) {
        for (const ext of ["", ".tsx", ".ts", ".jsx", ".js"]) {
          const cand = resolve(dir, b + ext);
          const relC = cand.replace(root + sep, "").replace(/\\/g, "/");
          if (!/\.(tsx|ts|jsx|js)$/.test(relC)) continue;
          if (!seen.has(relC)) queue.push(relC);
        }
      }
    }
  }
  return out;
}

/**
 * Rút ra mọi `<nav>` kèm `aria-label: t("KEY")` và các `styles.*` class của nó.
 *
 * Repo dùng lẫn lộn `e("nav", …)` (createElement) và `<nav>` (JSX); `e(` có thể
 * xuống dòng trước `"nav"`; repo cũng dùng cả nháy đơn (`e('nav', …)`). Vì vậy
 * OPENER nhận CẢ HAI loại nháy.
 *
 * Cách đúng: chia file theo các điểm MỞ nav, rồi trong mỗi đoạn tới điểm mở kế
 * tiếp, tìm `aria-label` và `styles.*`. Không cần cân bằng ngoặc.
 */
function navRecords(texts) {
  const out = [];
  const OPENER = /(?:<nav\b|e\(\s*["']nav["'])/g;
  for (const text of texts) {
    const starts = [];
    for (const m of text.matchAll(OPENER)) starts.push(m.index);
    starts.push(text.length);
    for (let i = 0; i < starts.length - 1; i++) {
      const segment = text.slice(starts[i], starts[i + 1]);
      const labels = [...segment.matchAll(/aria-label["']?\s*:\s*t\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
      const classes = [...new Set([...segment.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
      out.push({ labels, classes });
    }
  }
  return out;
}

const CUSTOM_CHECKS = [
  {
    id: "AC10-single-navigation-system",
    collect: hubClosure,
    run(entries) {
      const recs = navRecords(entries.map((e) => e.text));
      if (recs.length === 0) return "khong tim thay <nav> nao trong hub AI CC de kiem";

      const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
      const byLabel = new Map();
      // Trùng CLASS tính trên TOÀN BỘ cây render của hub, không phải toàn repo:
      // đã đo cây render = 29 file và CHỈ 1 file có `<nav>` (`AiHubNav.tsx`), nên
      // "2 nav cùng class trong cây này" chắc chắn là cùng một trang. Trước đây đếm
      // toàn repo thì báo trùng `.auditPager` giả — class đó là nav phân trang ở
      // `/settings/ai/audit` và `/settings/ai/traces`, hai ROUTE khác nhau, nằm ngoài
      // cây render này.
      const byClass = new Map();
      for (const entry of entries) {
        for (const r of navRecords([entry.text])) {
          for (const l of r.labels) bump(byLabel, l);
          for (const c of r.classes) bump(byClass, c);
        }
      }
      const dupLabel = [...byLabel].filter(([, n]) => n > 1);
      const dupClass = [...byClass].filter(([, n]) => n > 1);

      const problems = [];
      if (dupLabel.length) {
        problems.push(
          "cung mot nhan cho >1 <nav>: " + dupLabel.map(([k, n]) => `"${k}" x${n}`).join(", ") +
          " — hai thanh dieu huong se bi trinh doc giong het nhau",
        );
      }
      if (dupClass.length) {
        problems.push(
          "cung mot class cho >1 <nav> trong cay render cua hub: " +
          dupClass.map(([k, n]) => `styles.${k} x${n}`).join(", ") +
          " — hai thanh dieu huong se trong giong het nhau",
        );
      }
      return problems.length ? problems.join(" | ") : null;
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
  // Rule CAU TRUC dung `collect` (quet de quy); rule khop-chuoi dung `files`.
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
      const entries = c.collect
      ? c.collect(root)
      : c.files.map((f) => ({ name: f, text: readFileSync(join(root, f), "utf8") }));
      err = c.run(entries);
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
  const hubFiles = hubClosure(REPO);
  const custom = CUSTOM_CHECKS[0];

  /** Chay rule tren (tai lieu goc + cac file gia chen them). */
  const runOn = (extra = []) => {
    try {
      return custom.run([...hubFiles, ...extra]);
    } catch (e) {
      return "lo: " + e.message;
    }
  };
  const named = (name) => ({ name: "mutation", text: name });

  // (1) Ban dich: nav thu 2 trong page, giong het ban goc.
  const dupNav = { name: "page", text: `e("nav", { key: "hub-nav-dup", className: styles.hubNav, "aria-label": t("aiCommandCenter.title") }, [
    e(Link, { key: "x", to: "#runtime", className: styles.hubNavLink }, t("aiCommandCenter.tabRuntime")),
  ]),
` };
  const e1 = runOn([dupNav]);
  caught += e1 ? 1 : 0;
  console.log(e1 ? `  PASS  ${custom.id} bat duoc nav trung ban sao` : `  FAIL  ${custom.id} KHONG bat duoc nav trung ban sao`);

  // (2) PARAPHRASE — doi ten class, giu nguyen hien tuong. Case ma tac gia
  //     KHONG viet khi dinh nghia rule (hazard 12).
  const e2 = runOn([{ name: "page", text: dupNav.text.replace("styles.hubNav", "styles.sectionNavBar").replace("styles.hubNavLink", "styles.sectionTab") }]);
  caught += e2 ? 1 : 0;
  console.log(e2 ? `  PASS  ${custom.id} bat duoc PARAPHRASE (doi ten class)` : `  FAIL  ${custom.id} KHONG bat duoc PARAPHRASE`);

  // (3) MUTATION M5 — nav thu 2 tach ra **file thu ba**. Ban rule hardcode 2 file
  //     se LOT; ban nay phai bat. Day la ca hai khai bao FILES nen file gia phai
  //     chua "aiCommandCenter." de lot vao pham vi quet de quy.
  const e3 = runOn([named('e("nav", { "aria-label": t("aiCommandCenter.title") }, []);')]);
  caught += e3 ? 1 : 0;
  console.log(e3 ? `  PASS  ${custom.id} bat duoc nav o FILE THU BA (M5)` : `  FAIL  ${custom.id} LOt o FILE THU BA`);

  // (4) MUTATION M6 — hai nav CUNG class nhung KHAC nhan. Day la mau thu hai
  //     cua AC5.1 ("2 phan tu dung cung class") ma rule ban dau CHUA cai.
  const e4 = runOn([{ name: "page", text: 'e("nav", { className: styles.hubNav, "aria-label": t("aiCommandCenter.fallbackTitle") }, []);' }]);
  caught += e4 ? 1 : 0;
  console.log(e4 ? `  PASS  ${custom.id} bat duoc 2 nav CUNG CLASS khac nhan (M6)` : `  FAIL  ${custom.id} KHONG bat duoc 2 nav cung class`);

  // (5) Case am THAT: hai nav KHAC nhan, KHAC class, deu hop le — gate phai im
  //     lang. Case (ban dau) chi assert `run() === null`, ma baseline cung null
  //     ⇒ xanh du co tiem hay khong = tautology. Case nay them MOT nav thu 3
  //     KHAC class + KHAC nhan: neu detector co bat nham, se FAIL.
  const e5 = runOn([named('e("nav", { className: styles.somethingElse, "aria-label": t("aiCommandCenter.fallbackTitle") }, []);')]);
  caught += e5 === null ? 1 : 0;
  console.log(e5 === null ? `  PASS  ${custom.id} im lang khi 2 nav KHAC nhan va KHAC class` : `  FAIL  ${custom.id} bao loi gia: ${e5}`);

  // (6) Case am THAT thu 2: nav dung nhay don `e('nav', …)`. Repo da dung
  //     style nay o Breadcrumb.tsx:96 nen detector phai nhan.
  const e6 = runOn([named("e('nav', { \"aria-label\": t('aiCommandCenter.title') }, []);")]);
  caught += e6 ? 1 : 0;
  console.log(e6 ? "  PASS  " + custom.id + " bat duoc nhay don e('nav')" : "  FAIL  " + custom.id + " KHONG bat duoc nhay don");

  const total = CHECKS.length + 6 + 1;
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
