/**
 * audit-gates.mjs — Phase 2 của docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md
 *
 * MỤC ĐÍCH: gate pass nhưng không kiểm tra gì thì TỆ HƠN không có gate, vì nó tạo cảm
 * giác an toàn giả. Script này đo từng gate có THẬT sự chặn không, bằng cách inject
 * 1 vi phạm đã biết rồi kiểm tra.
 *
 * Đây là script ĐỌC + báo cáo. Không chặn ai. Luôn exit 0 — nếu nó fail thì chính nó
 * lại thành thứ "gate rỗng" mà script này sinh ra.
 *
 *   node scripts/audit-gates.mjs            # đo tất cả gate
 *   node scripts/audit-gates.mjs --list     # chỉ liệt kê
 *
 * CẢNH BÁO: probe ghi file tạm vào cây repo rồi xoá. Có `finally` khôi phục. Nếu bị
 * kill giữa chừng thì chạy `git status --short` và xoá file `__gate_probe__*`.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = join(REPO, "packages", "web");

const GATES = [
  {
    id: "check:dom-landmarks",
    cmd: ["npm", ["run", "--silent", "check:dom-landmarks"]],
    cwd: WEB,
    // gate kiểm tra trạng thái CỐ ĐỊNH, không phải linter: FullLayout.tsx phải có
    // ĐÚNG 1 e('main'). Thêm e('main') thứ 2 -> phải fail.
    inject: () => {
      const f = join(WEB, "src", "layouts", "full", "FullLayout.tsx");
      const backup = readFileSync(f, "utf8");
      writeFileSync(f, backup + "\n// gate probe\ne('main', null);\n", "utf8");
      return [[f, backup]];
    },
  },
  {
    id: "check:tokens",
    cmd: ["npm", ["run", "--silent", "check:tokens"]],
    cwd: WEB,
    // gate quét src/{components,pages,layouts,theme} phần .css / .module.css
    inject: () => {
      const f = join(WEB, "src", "theme", "__gate_probe__.css");
      writeFileSync(f, ".probe{color:#ff00ff;background:#00ff00}\n", "utf8");
      return [f];
    },
  },
  {
    id: "check:admin-spa-routes",
    cmd: ["npm", ["run", "--silent", "check:admin-spa-routes"]],
    cwd: WEB,
    // gate quét TEXT THÔ bằng regex /path:\s*"(\/admin\/...)"/  -> BẮT BUỘC nháy đôi,
    // dùng nháy đơn sẽ không khớp và ta sẽ kết luận nhầm gate rỗng
    inject: () => {
      const f = join(WEB, "src", "app", "routeCatalog.js");
      const backup = readFileSync(f, "utf8");
      writeFileSync(
        f,
        backup.replace(
          "export const routeCatalog = Object.freeze([",
          'export const __gp = [{ id: "p", path: "/admin/p-not-covered" }];\n\nexport const routeCatalog = Object.freeze([\n  ...__gp,',
        ),
        "utf8",
      );
      return [[f, backup]];
    },
  },
  {
    id: "check:i18n-hardcoded",
    cmd: ["npm", ["run", "--silent", "check:i18n-hardcoded"]],
    cwd: WEB,
    // file .js nằm trong allowlist 5 path -> chắc chắn bị quét
    inject: () => {
      const f = join(WEB, "src", "components", "advisory", "__gate_probe__.js");
      writeFileSync(f, "export const x = 'Xác nhận';\n", "utf8");
      return [f];
    },
  },
  {
    id: "check:multi-agent",
    cmd: ["node", ["packages/web/scripts/check-multi-agent.mjs"]],
    cwd: REPO,
    // claim một file thuộc deny list -> gate phải FAIL
    inject: () => {
      const f = join(REPO, "docs", "CLAIMS.md");
      const backup = readFileSync(f, "utf8");
      writeFileSync(
        f,
        backup + "\n| `__gate_probe__` | `feat/probe` | probe | `AGENTS.md` | in-progress | 2026-09-27 | probe |\n",
        "utf8",
      );
      return [[f, backup]];
    },
  },
  {
    id: "check-large-files",
    cmd: ["pwsh", ["-File", "scripts/quality/check_large_files.ps1"]],
    cwd: REPO,
    // file > FailLines (1000 dòng)
    inject: () => {
      const f = join(REPO, "scripts", "quality", "__gate_probe__.py");
      writeFileSync(f, Array.from({ length: 1100 }, (_, i) => `x${i} = ${i}`).join("\n") + "\n", "utf8");
      return [f];
    },
  },
  {
    id: "i18n:scan",
    cmd: ["npm", ["run", "--silent", "i18n:scan"]],
    cwd: WEB,
    // t() với default value chứa cú pháp TypeScript -> esprima không parse được
    inject: () => {
      const f = join(WEB, "src", "components", "__gate_probe_i18n__.tsx");
      writeFileSync(
        f,
        "export const q = (t: any, d: any) => t('probe.key', { time: new Date(d.g as string).toString() });\n",
        "utf8",
      );
      return [f];
    },
    // gate này KHÔNG dựa vào exit code -> phải soi output
    expectOutput: /Unable to parse/,
  },
  {
    id: "check:contrast",
    cmd: ["npm", ["run", "--silent", "check:contrast"]],
    cwd: WEB,
    inject: null, // chưa biết cách phá an toàn
  },
];

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: `${r.stdout || ""}\n${r.stderr || ""}` };
}

function restore(created) {
  for (const item of created) {
    if (Array.isArray(item)) writeFileSync(item[0], item[1], "utf8");
    else rmSync(item, { force: true });
  }
}

function audit(g) {
  const base = run(g.cmd[0], g.cmd[1], g.cwd);
  if (base.code !== 0) {
    return { verdict: "FAIL SẴN", note: `fail ngay cả khi chưa vi phạm (exit ${base.code}) — không thể tin làm gate` };
  }
  if (!g.inject) return { verdict: "CHƯA CÓ CÁCH INJECT", note: "cần người viết cách phá" };

  let created = [];
  try {
    created = g.inject();
    const dirty = run(g.cmd[0], g.cmd[1], g.cwd);
    if (g.expectOutput) {
      const hit = dirty.out.match(g.expectOutput);
      if (!hit) return { verdict: "KHÔNG CHẶN", note: "không thấy lỗi dù vi phạm" };
      // nguy hiểm nhất: CÓ BÁO LỖI nhưng exit 0 -> người đọc tưởng đã kiểm
      return dirty.code !== 0
        ? { verdict: "CHẶN", note: `in lỗi + exit ${dirty.code}` }
        : { verdict: "BÁO LỖI NHƯNG KHÔNG CHẶN", note: "in lỗi rồi exit 0 — tệ hơn không có gate" };
    }
    return dirty.code !== 0
      ? { verdict: "CHẶN", note: `exit ${dirty.code}` }
      : { verdict: "KHÔNG CHẶN", note: "vẫn exit 0 dù vi phạm" };
  } finally {
    restore(created);
  }
}

if (process.argv.includes("--list")) {
  console.log(`${GATES.length} gate:`);
  for (const g of GATES) console.log(`  - ${g.id}`);
  process.exit(0);
}

console.log(`audit-gates — repo: ${REPO}\n`);
const results = [];
for (const g of GATES) {
  process.stdout.write(`  ${g.id.padEnd(26)} `);
  let r;
  try {
    r = audit(g);
  } catch (e) {
    r = { verdict: "LỖI", note: String(e && e.message ? e.message : e) };
  }
  results.push({ id: g.id, ...r });
  console.log(`${r.verdict.padEnd(22)} (${r.note})`);
}

const blocking = results.filter((r) => r.verdict === "CHẶN").length;
const lying = results.filter((r) => r.verdict === "BÁO LỖI NHƯNG KHÔNG CHẶN").length;
const vacuous = results.filter((r) => r.verdict === "KHÔNG CHẶN").length;
const predone = results.filter((r) => r.verdict === "FAIL SẴN").length;
const unknown = results.length - blocking - lying - vacuous - predone;
console.log(
  `\nTÓM TẮT: chặn ${blocking} · báo-lỗi-nhưng-không-chặn ${lying} · không chặn ${vacuous} · fail sẵn ${predone} · chưa rõ ${unknown} / ${GATES.length}`,
);
console.log("Ghi kết quả: docs/evidence/gate-audit/baseline.md");
process.exit(0);
