#!/usr/bin/env node
/**
 * Cong ngan sach UI/UX — CHAN THOAI LUI, KHONG CHAN NO SAN.
 *
 * Ban sao nguyen tac tu `packages/core/backend/scripts/check-openapi-schema-budget.py`
 * (cung nam trong repo nay). Ly do ton tai: scanner UI/UX hien tai bao 327 finding.
 * Gate nao bat buoc `0 finding` se do ngay va chan moi thay doi cho den khi sua
 * het mot cong viec nhieu phien — mot thay doi chan la thay doi khong the dung.
 *
 * | Tinh huong                            | Hanh dong                          |
 * |---------------------------------------|------------------------------------|
 * | Tong TANG so voi baseline              | **FAIL** - bi chay, dung ngay      |
 * | Bang baseline                           | PASS, in `0 tang`                  |
 * | BE hon baseline (da sua)               | PASS, **de xuat nang baseline len**  |
 * | Khong co file baseline                  | FAIL - khong cho phep "chua do"     |
 * | Co rule MOI chua co trong baseline     | **FAIL** - khong duoc bo mat quanh   |
 *
 * Cach nay de con so 327 duoc ghi lai MOT lan; mot do chay co the giam dan ma
 * khong phai moi thay doi lai do.
 *
 * Chay:
 *   node scripts/check-uiux-budget.mjs                 # gate (exit 1 neu tang)
 *   node scripts/check-uiux-budget.mjs --write-baseline  # ghi lai baseline
 *   node scripts/check-uiux-budget.mjs --json            # output de reporter
 *   node scripts/check-uiux-budget.mjs --self-test       # negative proof
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, "uiux-baseline.json");
const SCANNER = path.resolve(HERE, "../../../docs/audit-uiux/scripts/scan-ui-guidelines.mjs");
const SRC = path.resolve(HERE, "../src");

/** Chay scanner va lay tong hop theo rule. Scanner in ra text, nen tach bang regex. */
function runScanner() {
  const { execFileSync } = require("node:child_process");
  const out = execFileSync(process.execPath, [SCANNER, SRC], { encoding: "utf8" });
  const totals = {};
  const re = /^## \[(P\d)\] (\S+) — (\d+) hit$/gm;
  let m;
  while ((m = re.exec(out)) !== null) {
    totals[m[2]] = { prio: m[1], count: Number(m[3]) };
  }
  const sum = /TONG = (\d+)/.exec(out);
  return { totals, total: sum ? Number(sum[1]) : NaN };
}

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function main() {
  const args = process.argv.slice(2);
  const selfTest = args.includes("--self-test");

  if (selfTest) {
    // Negative proof: baseline 0 phai FAIL khi hien tai 1.
    const base = { _comment: "x", total: 0, rules: {} };
    const cur = { total: 1, rules: { "CSS-1": { prio: "P1", count: 1 } } };
    const r = compare(cur, base);
    if (!r.increased.length && !r.newRules.length) {
      fail("✗ self-test FAIL: tang so voi baseline phai bi bat");
    }
    console.log(`✓ self-test PASS (${r.increased.length + r.newRules.length} truong hop tang bi phat hien)`);
    return;
  }

  const { totals, total } = runScanner();

  if (Number.isNaN(total)) {
    fail("✗ khong doc duoc ket qua scanner — khong dua ra ket luan");
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify({ total, rules: totals }, null, 2));
    return;
  }

  if (args.includes("--write-baseline")) {
    const payload = {
      _comment:
        "Baseline do bang lenh: node scripts/check-uiux-budget.mjs --write-baseline " +
        "(tu packages/web). Cong nay CHAN THOAI LUI, khong chan no san. " +
        "Giam so voi baseline la tiến bộ - hãy --write-baseline de chot lai.",
      _measured_at: new Date().toISOString().slice(0, 10),
      _scanner: "docs/audit-uiux/scripts/scan-ui-guidelines.mjs",
      _reproduce: "node packages/web/scripts/check-uiux-budget.mjs",
      total,
      rules: totals,
    };
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`✓ da ghi baseline: total=${total}, rules=${Object.keys(totals).length}`);
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    fail(
      `✗ thieu baseline ${BASELINE}\n` +
      `  hien tai: total=${total}\n` +
      `  tao file baseline truoc khi merge, de so nay bat bien khong the tu "chua do" thanh "da do".`,
    );
  }

  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const r = compare({ total, rules: totals }, base);

  const baseTotal = base.total ?? 0;
  const delta = total - baseTotal;
  console.log(`— UI/UX budget — baseline ${base._measured_at ?? "?"} = ${baseTotal}, hien tai = ${total} (${delta >= 0 ? "+" : ""}${delta})`);
  console.log("");

  const rows = Object.keys({ ...base.rules, ...totals }).sort();
  for (const rule of rows) {
    const b = base.rules?.[rule]?.count ?? 0;
    const c = totals[rule]?.count ?? 0;
    const mark = c > b ? "▲" : c < b ? "▼" : "=";
    console.log(`  ${mark} ${rule.padEnd(16)} baseline=${String(b).padStart(4)}  hien tai=${String(c).padStart(4)}  ${totals[rule]?.prio ?? ""}`);
  }
  console.log("");

  if (r.newRules.length) {
    console.error(`✗ check-uiux-budget — FAIL (${r.newRules.length} rule MOI khong co trong baseline)`);
    for (const x of r.newRules) console.error(`   ${x.rule}: ${x.count} hit — rule moi khong duoc bo mat quanh`);
    console.error("  Neu rule moi la vi tri hop le, hay --write-baseline de chot.");
    process.exit(1);
  }
  if (r.increased.length) {
    console.error(`✗ check-uiux-budget — FAIL (${r.increased.length} rule TANG so voi baseline)`);
    for (const x of r.increased) {
      console.error(`   ${x.rule}: ${x.from} -> ${x.to} (+${x.to - x.from})`);
    }
    process.exit(1);
  }

  const msg = `✓ check-uiux-budget — PASS (0 tang so voi baseline${delta < 0 ? `, da giam ${-delta}` : ""})`;
  console.log(msg);
  if (delta < 0) {
    console.log(`  de xuat: node scripts/check-uiux-budget.mjs --write-baseline  (chot ${total})`);
  }
}

function compare(cur, base) {
  const increased = [];
  const newRules = [];
  for (const [rule, v] of Object.entries(cur.rules)) {
    if (!(rule in (base.rules ?? {}))) {
      newRules.push({ rule, count: v.count });
      continue;
    }
    const b = base.rules[rule].count;
    if (v.count > b) increased.push({ rule, from: b, to: v.count });
  }
  if (cur.total > (base.total ?? 0)) {
    // tong tang nghĩa là có rule tăng; nếu không, đó là rule bị mất cùng lúc
    if (increased.length === 0 && Object.keys(cur.rules).length === Object.keys(base.rules ?? {}).length) {
      increased.push({ rule: "(tong)", from: base.total ?? 0, to: cur.total });
    }
  }
  return { increased, newRules };
}

main();
