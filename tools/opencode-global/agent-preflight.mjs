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
 *   4. (2026-09-28) Không xác định được dòng claim nào là của tôi
 *      -> check 1-3 đều phải "đoán" dòng nào thuộc về mình. Đoán sai thì hoặc
 *         TỰ KHÓA commit của chính mình, hoặc im lặng cho phép sửa file của
 *         agent khác. Đo bằng negative test trên 8 temp git repo.
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

/** Tien to branch -> phan ten con lai. Dung chung de quy tac "ten agent == ten branch". */
const BRANCH_PREFIX_RE = /^(feat|fix|docs|chore|cleanup)\//;

/**
 * O dau la "dau tieu cot" cua bang claim. CLAIMS.md con chua cac bang phu
 * (bang chu giai trang thai `| Trạng thái | Ý nghĩa |`) — neu khong loai, chung
 * bi parser doc thanh dong claim va sinh canh bao `foreign-claim` gia.
 */
const CLAIM_HEADER_CELLS = new Set(["agent", "slug", "ten-agent", "tên agent"]);

// Quy tac trich danh sach deny list nam o deny-extract.mjs — dung chung cho
// preflight va verify-deny-extract.mjs de hai noi khong lech nhau.
const { loadDenyListWithReport } = await import(
  new URL("./deny-extract.mjs", import.meta.url).href
);

const denyReport = loadDenyListWithReport(REPO, DEFAULT_DENY_LIST, ["docs/CLAIMS.md", "CLAIMS.md"]);
const DENY_LIST = denyReport.list;
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

/**
 * Dong claim THAT trong bang 7 cot cua CLAIMS.md.
 *
 * Loai 3 loai dong hay gap nham:
 *   - dong tieu (`| agent | branch | ...`)  — CLAIM_HEADER_CELLS
 *   - dong phan cach (`|---|---|`)          — /^-{2,}$/
 *   - dong cua bang phu (bang chu giai trang thai chi 2-4 cot)
 * Ma khong loai, mot dong `| in-progress | Đang sửa |` se bi coi la claim cua
 * agent ten `in-progress` va bien file noi dung thanh file dang bi giu.
 */
function isClaimRow(cells) {
  if (cells.length < 8) return false;
  const a = (cells[1] || "").replace(/`/g, "");
  if (!a) return false;
  if (/^-{2,}$/.test(a)) return false;
  if (CLAIM_HEADER_CELLS.has(a.toLowerCase())) return false;
  return true;
}

/**
 * Claim cua CHINH minh — dinh danh bang 2 dieu kien, KHONG doan.
 *
 *   (a) ten agent === ten branch bo tie ten      — quy tac chuan
 *   (b) cot `branch` cua dong === branch hien tai — dung khi ten agent viet
 *                                                   kieu khac (vd `core-team`)
 *
 * KHONG dung `branch.includes(agent)`: do la nguon cua 2 false-negative im
 * lang — agent ten `slice` tren branch `feat/ten-slice` bi tinh la "cua toi"
 * nen check3 BO QUA canh bao file ho dang giu. Do la loi nguy hiem hon
 * self-block vi no im lang cho phep sua file cua nguoi khac.
 *
 * (b) la thu chay duoc vi no doc cot branch, khong doan tu ten. Do la ly do
 * KHONG duoc dung (b) mot minh: dong stale cua agent da chet tren cung branch
 * se bi tinh la cua minh (da do trong negative test R1).
 */
function myClaimKeys() {
  const cf = claimFile();
  if (!cf) return { keys: new Set(), mismatched: [], branch: "", short: "" };
  const text = readFileSync(cf, "utf8");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
  const short = branch.replace(BRANCH_PREFIX_RE, "");
  const keys = new Set();
  const mismatched = [];
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (!isClaimRow(cells)) continue;
    const agent = (cells[1] || "").replace(/`/g, "");
    const claimBranch = (cells[2] || "").replace(/`/g, "");
    if (agent === short) { keys.add(agent); continue; }
    if (claimBranch && claimBranch === branch) {
      keys.add(agent);
      if (agent !== short) mismatched.push({ agent, claimBranch });
    }
  }
  return { keys, mismatched, branch, short };
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
  // Noi dung bi XOA o tren. Mot dong chi doi newline cuoi file se bi git ghi
  // thanh 1 dong xoa + 1 dong them voi noi dung giong het nhau. Do KHONG phai
  // sua claim cua nguoi khac — va no xay ra CHINH xac o truong hop CLAIMS.md
  // khong ket thuc bang LF (gap o PR #20/#23/#31), khi buoc sua dung nhat la
  // chen LF truoc dong moi. Neu khong bo qua, preflight chan chinh thao tac
  // sua ma guide bat buoc.
  const removed = new Set();
  for (const line of diff.out.split("\n")) {
    if (!line.startsWith("-") || line.startsWith("---")) continue;
    removed.add(line.slice(1).trim());
  }
  const foreign = [];
  for (const line of diff.out.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);
    if (!added.trim().startsWith("|")) continue;
    if (removed.has(added.trim())) continue; // chi doi newline cuoi file
    const cells = added.split("|").map((c) => c.trim());
    if (!isClaimRow(cells)) continue;
    const agent = (cells[1] || "").replace(/`/g, "");
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
    if (!isClaimRow(c)) continue;
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
  // Registry CLAIMS.md duoc miễn: MỌI agent deu phai append dong cua minh vao day,
  // nen neu no cung bi "giu" boi agent khac thi khong agent nao khai claim duoc.
  // Ke bao ve cho file nay la check2 (khong commit dong cua nguoi khac), va
  // check1 da bo qua no qua APPEND_ONLY.
  const hit = files.filter((f2) => held.has(f2) && !APPEND_ONLY.has(f2));
  if (!hit.length) return;
  violations.push({
    id: "claimed-in-progress",
    file: hit.join(", "),
    fix: "Agent khác đang claim file này với trạng thái in-progress.\n" +
         "  AGENT_PROTOCOL.md §3: DỪNG, không sửa. Hỏi coordinator.",
  });
}

/**
 * CHECK 4 — danh tinh claim (thay the cho viec "doan xem dong nao la cua minh").
 *
 * VANDU: ban o `feat/ten-slice`, dong claim cua ban ghi ten agent `ten-agent`.
 * Khong co quy tac nao khop => preflight co 2 lua chon deu sai:
 *   - coi dong cua ban la cua nguoi khac  => TU KHOA commit cua chinh minh
 *   - bo qua hanh dong                  => bao ve 0, im lang cho phep sua
 *                                           file cua agent khac
 * nen truoc day no im lang chon truong hop 2. Check nay chan, noi ro nguyen
 * nhan, va bat agent sua ten cho dung — thay vi tu quyet.
 *
 * `keys` rong chi bi coi la LOI khi co it nhat 1 dong `in-progress`: repo
 * khong co claim nao thi dung im lang, dung §6 cua guide.
 */
function check4ClaimIdentity() {
  const cf = claimFile();
  if (!cf) return;
  const { keys, mismatched, branch, short } = myClaimKeys();

  for (const m of mismatched) {
    // Nhan ASCII de grep/so sanh khong phu thuoc Unicode normalization (NFC/NFD).
    console.error(
      `[claim-name] dong \`${m.agent}\` khai o branch \`${m.claimBranch}\` nhung ten agent khac ten branch \`${short}\`.\n` +
      `  Preflight van nhan la dong cua ban qua COT BRANCH, nhung nen doi ten agent thanh \`${short}\`\n` +
      `  de lan sau khop theo quy tac (a) — va de agent khac doc khong nham.`,
    );
  }
  if (keys.size) return;

  let inProgress = 0;
  for (const line of readFileSync(cf, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const c = line.split("|").map((x) => x.trim());
    if (!isClaimRow(c)) continue;
    if ((c[5] || "").toLowerCase() === "in-progress") inProgress += 1;
  }
  if (!inProgress) return;

  const unborn = !branch || branch === "HEAD";
  violations.push({
    id: "claim-identity",
    file: unborn ? "HEAD chua resolve" : `branch \`${branch}\``,
    fix: unborn
      ? "Chua co commit nao tren branch nay => `git rev-parse --abbrev-ref HEAD` tra `HEAD`.\n" +
        "  Preflight khong xac dinh duoc ban la ai. Commit mot lan de tao HEAD, roi chay lai."
      : `Khong co dong claim nao khop branch \`${branch}\` (ten agent se la \`${short}\`).\n` +
        `  Va co ${inProgress} dong claim \`in-progress\` cua agent khac.\n` +
        "  Preflight KHONG tu doan dong nao la cua ban — doan sai thi hoac tu khoa\n" +
        "  commit cua chinh minh, hoac im lang cho phep sua file cua nguoi khac.\n" +
        `  Sua cot \`branch\` cua dong claim cua ban thanh \`${branch}\` (tot nhat doi ca ten agent\n` +
        `  thanh \`${short}\` cho khop quy tac).`,
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
  check4ClaimIdentity();

  if (!violations.length) {
    // CANH BAO (khong chan): deny list doc tu tai lieu dang bi bo qua.
    // Khong chan vi se no doi kich ban dong khi mot repo co bang phu 2-3 cot
    // o AGENTS.md — gate hoang loi se bi bo qua, te hon khong co gate.
    for (const n of denyReport.notes) console.error(`agent-preflight: [deny-list] ${n}`);
    if (denyReport.notes.length) {
      console.error(`  Deny list hien tai = ${DENY_LIST.length} path (mac dinh + tai lieu doc duoc).`);
    }
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
