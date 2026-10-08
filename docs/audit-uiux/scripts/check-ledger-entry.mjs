#!/usr/bin/env node
/**
 * Cong ngan sach so Entry cua `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
 *
 * VA SAO CAN CO CONG NAY (va sao khong sua lich su)
 * ----------------------------------------------------
 * Ledger hien co **59 so Entry bi trung** (305 header, 243 so khac nhau). Do la
 * **Hazard 2 cua skill `multi-agent-workflow`** — "hai agent chon trung mot so
 * migration/leaf" — ap dung sang ledger: agent TU DOAN so Entry thay vi DOC HEAD
 * that, roi ca hai cung prepend o dau file => mot hunk khong tach duoc.
 *
 * Da do va khong dung tin:
 *   `## Entry 33` va `## Entry 53` la **hai noi dung KHAC nhau** cung so.
 *   `## Entry 62` xuat hien **3 lan** (3 ban **giong nhau**).
 *
 * Vì sao KHÔNG đánh số lại lịch sử (Owner chốt 2026-10-08):
 *   `AGENTS.md`, `docs/CLAIMS.md` va hàng chuc `docs/*.md` tro toi Entry theo
 *   dang "Entry 241", "xem Entry 230". Do lai so se lam hong TAT CA trich dan
 *   do, va khong thay the bang may quet. ⇒ Cong nay CHAN TAI PHAT, khong sua loi.
 *
 * | Tinh huong                                        | Hanh dong                        |
 * |---------------------------------------------------|----------------------------------|
 * | `## Entry N` xuat hien DUNG tan suat baseline     | PASS, kem canh bao               |
 * | `## Entry N` xuat hien NHIEU HON baseline          | **FAIL** — trung moi             |
 * | `N` khong co trong baseline, count = 1             | PASS — Entry moi hop le          |
 * | `N` khong co trong baseline, count >= 2            | **FAIL** — trung moi             |
 *
 * ⚠ **Tai sao luu TAN SUAT chu khong luu TAP SO.** Neu chi luu tap {33,52,...}
 *   thi them `## Entry 33` lan thu 3 van **khong** bi bat, vi 33 da nam trong
 *   tap. Do la lo hong thiet ke, khong phai chi tiet. (AC-0.3 cua
 *   `docs/PLAN_UIUX_WAVE3.md`.)
 *
 * ⚠ **`--next-entry` doc WORKTREE, khong doc HEAD.** Agent dang ghi Entry cua
 *   no chi co o file lam viec, chua commit. Doc HEAD se tra ve so da bi
 *   chiem boi chinh agent dang ghi do.
 *
 * Chay:
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs              # gate
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry # so Entry moi
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs --manifest   # 59 so trung + tieu de
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs --json
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs --write-baseline
 *   node docs/audit-uiux/scripts/check-ledger-entry.mjs --self-test  # bang chung am
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, "ledger-entry-baseline.json");
const LEDGER = path.resolve(HERE, "../../CODE_CHANGE_AUDIT_LEDGER.md");

// ⚠ KHÔNG được bắt buộc dấu `:` sau số. Ledger có **hai** kiểu tiêu đề:
//   `## Entry 255: <title>`  (301 header)
//   `## Entry 250 - <title>` (4 header: 250, 251, 252, 253)
// Bắt buộc `:` thì gate BỎ SÓT 4 header đó ⇒ 250/251 mất phát hiện trùng ⇒
// dem được 57 nhom thay vì 59. Đây chính là loại lỗi "gate đo sai thứ" mà
// `docs/PLAN_UIUX_WAVE3.md` §AC-3.2 cảnh báo.
const RE = /^## Entry (\d+)(?:\s*[:\-–—]\s*|\s+)?(.*)$/gm;

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/** Doc noi dung ledger. `fromHead` = doc ban commit (khong chua viec dang lam). */
function readLedger(fromHead = false) {
  if (fromHead) {
    return execFileSync("git", ["show", `HEAD:${path.relative(process.cwd(), LEDGER).replace(/\\/g, "/")}`], {
      encoding: "utf8",
    });
  }
  if (!fs.existsSync(LEDGER)) fail(`✗ khong tim thay ledger: ${LEDGER}`);
  return fs.readFileSync(LEDGER, "utf8");
}

/**
 * Tan suat xuat hien cua tung so Entry, kem tieu de cua tung ban.
 * @returns {{freq: Record<string, number>, total: number, distinct: number, max: number, titles: Record<string, string[]>}}
 */
function analyze(text) {
  const freq = {};
  const titles = {};
  let total = 0;
  for (const m of text.matchAll(RE)) {
    const n = m[1];
    total += 1;
    freq[n] = (freq[n] ?? 0) + 1;
    (titles[n] ??= []).push(m[2].trim());
  }
  const keys = Object.keys(freq);
  return {
    freq,
    total,
    distinct: keys.length,
    max: keys.length ? Math.max(...keys.map(Number)) : 0,
    titles,
  };
}

/**
 * So tan suat hien tai voi baseline.
 * @returns {{violations: {n: string, base: number, cur: number}[], resolved: {n: string, base: number, cur: number}[], knownDup: number}}
 */
function compare(cur, base) {
  const violations = [];
  const resolved = [];
  let knownDup = 0;
  const baseMap = base.frequencies ?? {};

  for (const [n, c] of Object.entries(cur.freq)) {
    if (n in baseMap) {
      const b = baseMap[n];
      if (b > 1) knownDup += 1;
      if (c > b) violations.push({ n, base: b, cur: c });
      else if (c < b) resolved.push({ n, base: b, cur: c });
    } else if (c >= 2) {
      // So KHONG co trong baseline nhung da xuat hien >= 2 lan => trung moi.
      violations.push({ n, base: 0, cur: c });
    }
    // count === 1 va khong co trong baseline => Entry moi hop le.
  }
  return { violations, resolved, knownDup };
}

function renderManifest(cur) {
  const rows = Object.entries(cur.freq)
    .filter(([, c]) => c > 1)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log(`— So Entry trung trong ${path.relative(process.cwd(), LEDGER)} — ${rows.length} nhom`);
  console.log("");
  for (const [n, c] of rows) {
    console.log(`  Entry ${n.padEnd(5)} x${c}`);
    for (const t of cur.titles[n] ?? []) console.log(`      - ${t.slice(0, 100)}`);
  }
  console.log("");
  console.log("  Owner quyet dinh viec danh so lai lich su hay giu nguyen (gate van chan tai phat).");
}

function main() {
  const args = process.argv.slice(2);
  const selfTest = args.includes("--self-test");

  if (selfTest) {
    // Bang chung AM: phai FAIL khi co trung MOI. Khong self-test => gate chua
    // duoc chung minh la co tac dung (chi thay no xanh la khong du).
    const base = { frequencies: { "33": 2, "52": 3 } };
    const cases = [
      {
        name: "trung moi tren so DA trung (33: 2 -> 3)",
        cur: { freq: { "33": 3, "52": 3 } },
        want: 1,
      },
      {
        name: "trung tren so MOI khong co trong baseline (99: 2 lan)",
        cur: { freq: { "33": 2, "52": 3, "99": 2 } },
        want: 1,
      },
      {
        name: "khop tan suat (khong trung moi)",
        cur: { freq: { "33": 2, "52": 3, "256": 1 } },
        want: 0,
      },
      {
        name: "so moi count=1 la Entry moi hop le",
        cur: { freq: { "33": 2, "52": 3, "300": 1 } },
        want: 0,
      },
    ];
    let bad = 0;
    for (const c of cases) {
      const r = compare(c.cur, base);
      const got = r.violations.length;
      const ok = got === c.want;
      if (!ok) bad += 1;
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.name} — violations=${got}, expected=${c.want}`);
    }
    if (bad > 0) fail(`✗ self-test FAIL (${bad}/${cases.length} truong hop sai)`);
    console.log(`✓ self-test PASS (${cases.length} truong hop)`);
    return;
  }

  const cur = analyze(readLedger());

  if (args.includes("--next-entry")) {
    console.log(cur.max + 1);
    return;
  }

  if (args.includes("--manifest")) {
    renderManifest(cur);
    return;
  }

  // `--write-baseline` phai chay DUOC khi baseline chua ton tai, neu khong thi
  // lenh tao baseline dau tien se tu bao loi "thieu baseline" — bo qua loi cua
  // chinh no (gate cua ta vua that bai chinh vi ly do nay).
  if (!args.includes("--write-baseline") && !fs.existsSync(BASELINE)) {
    fail(
      `✗ thieu baseline ${BASELINE}\n` +
        `  tao bang: node docs/audit-uiux/scripts/check-ledger-entry.mjs --write-baseline`,
    );
  }

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        { total: cur.total, distinct: cur.distinct, max: cur.max, frequencies: cur.freq },
        null,
        2,
      ),
    );
    return;
  }

  if (args.includes("--write-baseline")) {
    // Do baseline tren HEAD mac dinh: neu do tren worktree, mot Entry dang
    // giu cho viec cua agent khac se bi nap thang vao baseline va gate se
    // chấp nhận sai số đó. Dùng `--from-head` de do tren worktree khi can.
    const fromHead = !args.includes("--from-head");
    const curB = analyze(readLedger(fromHead));
    const dups = Object.fromEntries(Object.entries(curB.freq).filter(([, c]) => c > 1));
    const payload = {
      _comment:
        "Tan suat xuat hien cua tung so `## Entry N` trong ledger. Cong CHAN TRUNG MOI, " +
        "khong chan 59 nhom trung co san. KHONG danh so lai lich su — Owner chot 2026-10-08 " +
        "vi se lam hong moi trich dan 'Entry N' trong AGENTS.md / CLAIMS.md / docs/*.",
      _measured_at: new Date().toISOString().slice(0, 10),
      _measured_from: fromHead
        ? "git HEAD (khong bao gio lay viec dang lam trong worktree)"
        : "worktree (CO THE chua viec chua commit cua agent khac)",
      _reproduce: "node docs/audit-uiux/scripts/check-ledger-entry.mjs",
      totals: {
        headers: curB.total,
        distinct: curB.distinct,
        dupGroups: Object.keys(dups).length,
        extras: curB.total - curB.distinct,
        max: curB.max,
      },
      frequencies: dups,
    };
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(
      `✓ da ghi baseline (${fromHead ? "HEAD" : "worktree"}): ${Object.keys(dups).length} so trung, max=${curB.max}`,
    );
    return;
  }

  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const r = compare(cur, base);

  console.log(
    `— Ledger Entry — baseline ${base._measured_at ?? "?"}: ${Object.keys(base.frequencies ?? {}).length} so trung` +
      `, hien tai ${cur.total} header / ${cur.distinct} so khac nhau / max=${cur.max}`,
  );
  console.log("");

  if (r.resolved.length) {
    console.log(`  ▼ ${r.resolved.length} so trung da het (tot)`);
    for (const x of r.resolved) console.log(`     Entry ${x.n}: ${x.base} -> ${x.cur}`);
    console.log("     nen chot lai: --write-baseline");
    console.log("");
  }

  if (r.violations.length) {
    console.error(`✗ check-ledger-entry — FAIL (${r.violations.length} so TRUNG MOI)`);
    for (const x of r.violations) {
      console.error(`   Entry ${x.n}: xuat hien ${x.cur} lan, baseline cho phep ${x.base}`);
    }
    console.error("");
    console.error("  Dung so moi bang lenh, khong tu doan:");
    console.error("    node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry");
    process.exit(1);
  }

  console.log(
    `✓ check-ledger-entry — PASS (0 trung moi; ${r.knownDup} so trung co san van nguyen danh)`,
  );
}

main();