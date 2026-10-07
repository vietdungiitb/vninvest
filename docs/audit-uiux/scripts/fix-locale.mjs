/**
 * UX-07 — thay `EXPR.toLocaleString()` (khong truyen locale) bang
 * `formatNumber(EXPR, locale)` cua repo.
 *
 * VAN SAO PHAI SU DUNG HELPER CO SAN, KHONG TU CHE (improve-ui §6:
 * "Do not invent values when the repository provides a token or component
 * contract"):
 *   - `src/i18n/index.js:56`  `formatNumber(value, locale, options)`
 *   - `useI18n()` tra san `localeTag` va `formatNumber`
 *   - `LangContext.js:104` fallback cung da dung `toLocaleString('vi-VN')`
 *
 * VAN SAI: `toLocaleString()` khong tham so lay locale cua MAY NGUOI DUNG,
 * khong phai locale app dang chon => doi sang EN van ra "1.234,56" kieu Viet.
 *
 * Chay:
 *   node docs/audit-uiux/scripts/fix-locale.mjs packages/web/src            # xem ke hoach
 *   node docs/audit-uiux/scripts/fix-locale.mjs packages/web/src --apply    # ap dung
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? "packages/web/src";
const APPLY = process.argv.includes("--apply");

// bieu thuc: a, a.b, a?.b, a[0], a["k"], phoi hop nhip
const EXPR = String.raw`([A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*\??\[[^\]\n]+\])*)`;
const CALL = new RegExp(`${EXPR}\\.toLocale(?:String|DateString|TimeString)\\(\\s*\\)`, "g");

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", "__tests__", "tests"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const plan = [];
for (const f of walk(ROOT)) {
  let txt = fs.readFileSync(f, "utf8");
  const before = txt;
  const usesI18n = /useI18n\(\)/.test(txt);
  const hits = [...txt.matchAll(CALL)];
  if (!hits.length) continue;
  if (!usesI18n) {
    plan.push({ f, n: hits.length, skip: "khong goi useI18n() - can truyen locale qua props" });
    continue;
  }

  let n = 0;
  txt = txt.replace(CALL, (_m, expr) => {
    n += 1;
    const clean = expr.replace(/\s+/g, "");
    // `toLocaleDateString()`/`TimeString` van la formatNumber sai - chi ho tro
    // toLocaleString (so). Cac loai kia ghi nhan de sua tay.
    return `formatNumber(${clean}, localeTag)`;
  });

  // dam bao co `localeTag` trong destructure cua useI18n
  const destructure = /const\s*\{([^}]*)\}\s*=\s*useI18n\(\)/;
  if (destructure.test(txt)) {
    txt = txt.replace(destructure, (m, inner) => {
      if (/\blocaleTag\b/.test(inner)) return m;
      return `const {${inner.trimEnd()}, localeTag } = useI18n()`;
    });
  } else {
    // goi useI18n() khong destructure: file phai co bien tu useI18n o noi khac
    // (vd `const i18n = useI18n()`). KHONG doan - bo qua file nay de sua tay.
    plan.push({ f, n, skip: "goi useI18n() nhung khong destructure - sua tay" });
    continue;
  }

  // them import formatNumber tu i18n
  if (!/\bformatNumber\b/.test(before)) {
    // CHU Y: `walk` sinh path bang `path.join` => tren Windows la `\` nen
    // `replace(/^packages\/web\/src\//)` KHONG khop, va so cap `..` bi dem sai
    // (da gap: sinh `../../../i18n` cho file o `src/components/`).
    // Fix: chuan hoa `/` TRUOC khi tinh.
    const norm = f.replace(/\\/g, "/");
    const rel = norm.replace(/^.*?src\//, "");
    const ups = rel.split("/").slice(0, -1).map(() => "..").join("/");
    const importPath = `${ups ? `${ups}/` : ""}i18n`;
    const imp = `import { formatNumber } from "${importPath}";\n`;
    const m = txt.match(/^import .*$/m);
    txt = m ? txt.replace(m[0], imp + m[0]) : imp + txt;
  }

  if (APPLY && txt !== before) {
    fs.writeFileSync(f, txt, "utf8");
  }
  plan.push({ f, n, skip: null });
}

console.log("=".repeat(76));
console.log(APPLY ? "AP DUNG:" : "KE HOACH (them --apply de ap dung):");
console.log("=".repeat(76));
for (const p of plan) {
  console.log(`  ${String(p.n).padStart(2)}  ${p.f}${p.skip ? `\n       ⚠ BO QUA: ${p.skip}` : ""}${p.warn ? `\n       ⚠ ${p.warn}` : ""}`);
}
const total = plan.filter((p) => !p.skip).reduce((a, b) => a + b.n, 0);
console.log(`\ntong se sua: ${total} diem tren ${plan.filter((p) => !p.skip).length} file`);
