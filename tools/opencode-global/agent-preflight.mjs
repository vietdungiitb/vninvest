/**
 * agent-preflight.mjs — Phase 3/4 của docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md
 *
 * Ba check, chọn vì có bằng chứng vi phạm THẬT trong phiên 2026-09-27:
 *
 *   1. Commit file deny list mà commit body không có trailer `Claim-Deny-List: <lý do>`
 *      -> đã phải bypass 2 lần (Entry 233, Entry 237).
 *   2. Staged docs/CLAIMS.md có dòng không thuộc claim của tôi
 *      -> `merge=union` KHÔNG cứu được sau khi đã nuốt vào commit.
 *   3. File sắp sửa có claim `in-progress` của agent khác
 *      -> Hazard 1.
 *
 * NGUYÊN TẮC BẤT BIẾN: chỉ chạy khi được yêu cầu tường minh (`--staged` hoặc
 * `--for <file>`). KHÔNG quét repo mặc định — một gate fail vì trạng thái có sẵn
 * sẽ bị bỏ qua (tiền lệ `off-github-actions`).
 *
 *   node agent-preflight.mjs --staged [--commit-msg "<msg>"]
 *   node agent-preflight.mjs --for <file>
 *   AGENT_PREFLIGHT=0 node agent-preflight.mjs --staged   # kill-switch
 *
 * ĐA REPO: chạy từ `~/.opencode/scripts/` nên áp dụng cho MỌI repo. Deny list đọc
 * từ tài liệu của repo nếu có; nếu không có thì dùng danh sách mặc định.
 * `docs/CLAIMS.md` là TUỲ CHỌN — repo không có registry thì check 2 và 3 tự bỏ qua.
 *
 * Exit: 0 = sạch · 1 = vi phạm · 2 = lỗi cấu hình.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Ưu tiên repo hiện tại (khi chạy tay trong repo), fallback về thư mục chứa script. */
const REPO = process.env.AGENT_PREFLIGHT_REPO
  ? resolve(process.env.AGENT_PREFLIGHT_REPO)
  : spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).status === 0
    ? spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim()
    : resolve(__dirname, "..", "..");

/**
 * Deny list: ưu tiên đọc từ tài liệu của chính repo (nếu có), fallback về mặc định.
 * Nhờ vậy repo khác không cần sửa script mà vẫn có đúng deny list của nó.
 */
const DEFAULT_DENY_LIST = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/CLAIMS.md",
  "docs/CODE_CHANGE_AUDIT_LEDGER.md",
  "docs/CHANGELOG.md",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.prod.yml",
  ".env",
  ".env.example",
];

const DENY_DOC_RE = /^(AGENT_PROTOCOL|AGENTS|CLAUDE)\.md$/i;

// Quy tac trich danh sach deny list nam o deny-extract.mjs — dung chung cho
// preflight va verify-deny-extract.mjs de hai noi khong lech nhau.
const { loadDenyList: loadDenyListFromDocs } = await import(
  new URL("./deny-extract.mjs", import.meta.url).href
);

const DENY_LIST = loadDenyListFromDocs(REPO, DEFAULT_DENY_LIST, ["docs/CLAIMS.md", "CLAIMS.md"]);
const APPEND_ONLY = new Set(["docs/CLAIMS.md", "CLAIMS.md"]);

const TRAILER = "Claim-Deny-List:";

function git(args, opts = {}) {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
  return { code: r.status, out: (r.stdout || "").trim() };
}

function norm(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^"|"$/g, "");
}

function stagedFiles() {
  const r = git(["diff", "--cached", "--name-only"]);
  if (r.code !== 0) return [];
  return r.out.split("\n").map(norm).filter(Boolean);
}

/**
 * Commit message đang soạn.
 *
 * KHÔNG đọc `.git/COMMIT_EDITMSG` làm nguồn chính: file đó chứa message của commit
 * TRƯỚC, không phải commit đang soạn. Lần kiểm thử đầu đã bị che vì message
 * commit trước có nhắc "Claim-Deny-List:" ⇒ check bị bỏ qua ⇒ false negative.
 *
 * Thứ tự ưu tiên: --commit-msg (do hook truyền, lấy từ -m của lệnh git) →
 * COMMIT_EDITMSG (fallback khi chạy tay).
 */
function commitMessage(arg) {
  if (typeof arg === "string" && arg.trim()) return arg;
  const f = join(REPO, ".git", "COMMIT_EDITMSG");
  if (!existsSync(f)) return "";
  try {
    return readFileSync(f, "utf8");
  } catch {
    return "";
  }
}

/** Claim của chính tôi: tìm tên branch hiện tại trong CLAIMS.md. */
function myClaimKeys() {
  const cf = claimFile();
  if (!cf) return { keys: new Set(), text: "" };
  const text = readFileSync(cf, "utf8");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
  const short = branch.replace(/^(feat|fix|docs|chore|cleanup)\//, "");
  const keys = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const agent = (cells[1] || "").replace(/`/g, "");
    if (!agent) continue;
    if (agent === short || branch.includes(agent)) keys.add(agent);
  }
  return { keys, text };
}

const violations = [];

/**
 * Trailer phải nằm ở ĐẦU DÒNG và có nội dung sau nó.
 *
 * KHÔNG dùng `msg.includes(TRAILER)`: một commit body chỉ NHẮC chuỗi
 * "Claim-Deny-List:" (ví dụ bullet "xem lại quy tắc Claim-Deny-List: ...")
 * sẽ bypass trọn vẹn check deny-list. Đã dựng lại được, xem
 * tools/opencode-global/verify-trailer-bypass.mjs — trước khi sửa 2/3 probe
 * trả về exit 0.
 *
 * `m` = nhiều dòng. `^` = đầu dòng. `.+` = phải có ít nhất 1 ký tự lý do,
 * nên `Claim-Deny-List:` trần (không có lý do) vẫn bị chặn.
 */
const TRAILER_RE = /^Claim-Deny-List:\s*\S.*/m;

function check1DenyList(files, msg) {
  const hit = files.filter((f) => DENY_LIST.includes(f) && !APPEND_ONLY.has(f));
  if (!hit.length) return;
  if (TRAILER_RE.test(msg)) return; // đã khai lý do -> cho qua
  violations.push({
    id: "deny-list",
    file: hit.join(", "),
    fix: `File nằm trong deny list (AGENT_PROTOCOL.md §2).\n` +
         `  Nếu bạn LÀ coordinator: thêm trailer vào commit message:\n` +
         `      ${TRAILER} <lý do>\n` +
         `  Nếu KHÔNG phải: ghi yêu cầu vào cột \`note\` của claim rồi báo coordinator.`,
  });
}

/** Registry claim là TUò CHỌN — repo không có thì check 2 và 3 tự bỏ qua. */
function claimFile() {
  for (const c of ["docs/CLAIMS.md", "CLAIMS.md"]) {
    const p = join(REPO, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function check2ForeignClaimLines(files) {
  const cf = claimFile();
  const rel = cf ? cf.slice(REPO.length + 1).replace(/\\/g, "/") : null;
  if (!rel || !files.includes(rel)) return;
  const diff = git(["diff", "--cached", "--unified=0", "--", rel]);
  if (diff.code !== 0 || !diff.out) return;
  const { keys } = myClaimKeys();
  const foreign = [];
  for (const line of diff.out.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);
    if (!added.trim().startsWith("|")) continue;
    const agent = (added.split("|")[1] || "").trim().replace(/`/g, "");
    if (!agent) continue;
    if (keys.size && !keys.has(agent)) foreign.push(agent);
  }
  if (!foreign.length) return;
  violations.push({
    id: "foreign-claim",
    file: `${rel} (+${foreign.join(", +")})`,
    fix: "Staged diff có dòng claim của agent KHÁC.\n" +
         "  `merge=union` KHÔNG cứu được — nó là merge driver, đã commit là mất vết.\n" +
         `  Chạy:  git restore --staged ${rel}`,
  });
}

function check3ClaimedInProgress(files) {
  const cf = claimFile();
  if (!cf) return;
  const { keys } = myClaimKeys();
  const held = new Set();
  for (const line of readFileSync(cf, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const c = line.split("|").map((x) => x.trim());
    const agent = (c[1] || "").replace(/`/g, "");
    const status = (c[5] || "").toLowerCase();
    if (status !== "in-progress") continue;
    if (keys.has(agent)) continue; // của tôi
    const raw = (c[4] || "").replace(/`/g, "");
    for (const p of raw.split(/[,;]/)) {
      const t = norm(p).split(/\s*\(/)[0].trim();
      if (t) held.add(t);
    }
  }
  const hit = files.filter((f2) => held.has(f2));
  if (!hit.length) return;
  violations.push({
    id: "claimed-in-progress",
    file: hit.join(", "),
    fix: "Agent khác đang claim file này với trạng thái in-progress.\n" +
         "  AGENT_PROTOCOL.md §3: DỪNG, không sửa. Hỏi coordinator.",
  });
}

function main() {
  if (process.env.AGENT_PREFLIGHT === "0") {
    console.log("agent-preflight: kill-switch AGENT_PREFLIGHT=0 -> bo qua");
    return 0;
  }
  const args = process.argv.slice(2);
  const mode = args.find((a) => a === "--staged" || a === "--for");
  if (!mode) {
    console.error("agent-preflight: phai chon --staged hoac --for <file>");
    console.error("  (khong co lenh mac dinh: gate khong duoc fail vi trang thai co san)");
    return 2;
  }

  let files = [];
  let cmsg = null;
  if (mode === "--staged") {
    files = stagedFiles();
    if (!files.length) {
      console.log("agent-preflight: khong co gi staged -> OK");
      return 0;
    }
    const i = args.indexOf("--commit-msg");
    if (i >= 0) cmsg = args[i + 1] || "";
  } else {
    const i = args.indexOf("--for");
    const f = norm(args[i + 1] || "");
    if (!f) {
      console.error("agent-preflight: --for can ten file");
      return 2;
    }
    files = [f];
  }

  check1DenyList(files, commitMessage(cmsg));
  check2ForeignClaimLines(files);
  check3ClaimedInProgress(files);

  if (!violations.length) {
    console.log(`agent-preflight: OK (${files.length} file)`);
    return 0;
  }
  console.error(`\nagent-preflight: ${violations.length} VI PHAM\n`);
  for (const v of violations) {
    console.error(`  [${v.id}]  ${v.file}`);
    for (const l of v.fix.split("\n")) console.error(`      ${l}`);
    console.error("");
  }
  console.error("  Đây là CHECK, chưa chặn. Sửa xong chạy lại.");
  return 1;
}

process.exit(main());
