/**
 * De xuat danh sach thuoc tinh cu the thay cho `transition: all`.
 *
 * VAY SAO KHONG THE BAN TAY GHI "background, color, border": `transition: all`
 * co nghia la BAT KY thuoc tinh nao doi deu chuyen. Thay bang danh sach sai thì
 * mat chuyen dong; danh sach qua rong thi chuyen dong thua.
 * ⇒ Phai COMPUTE: doc tung rule block + bien the `:hover`/`:focus`/`:active`
 *   cung selector, gom cac thuoc tinh thuc su bien doi (hazard 7 - doc ten
 *   trong bundle roi ket luan).
 *
 * Chay:
 *   node ../../docs/audit-uiux/scripts/propose-transition-props.mjs packages/web/src
 *   node ../../docs/audit-uiux/scripts/propose-transition-props.mjs packages/web/src --apply
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? "packages/web/src";
const APPLY = process.argv.includes("--apply");

// Thuoc tinh KHONG nen transition: khong ai chuyen bang CSS (chi JS doi) va
// chi lam ton tai layout khi keo theo tat ca.
const NEVER = new Set([
  "all", "content", "cursor", "pointer-events", "will-change", "box-sizing",
  "position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  "display", "overflow", "visibility", "flex", "flex-grow", "flex-shrink",
  "flex-basis", "flex-direction", "flex-wrap", "align-items", "justify-content",
  "gap", "grid-template", "grid-template-columns", "grid-template-rows",
  "font-family", "font-size", "line-height", "letter-spacing", "text-transform",
  "white-space", "word-break", "list-style",
]);

// Thuoc tinh nen uu tien composite/paint: giu lai truoc, cho animation re.
const PREFERRED = [
  "transform", "opacity", "color", "background-color", "background",
  "border-color", "border", "box-shadow", "filter", "outline-color",
  "outline", "fill", "stroke",
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "__tests__", "tests"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

/** SỬA CHỮA: các rule đã bị script v1 làm mất duration (0s => mất chuyển động). */
function findMissingDuration(root) {
  const bad = [];
  for (const f of walk(root)) {
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((ln, i) => {
      // `transition: a, b;` — danh sách thuoc tinh, KHONG co thoi gian
      if (/^\s*transition\s*:\s*[a-zA-Z-]+(\s*,\s*[a-zA-Z-]+)+\s*;\s*$/.test(ln)) {
        bad.push({ file: f, line: i, text: ln });
      }
    });
  }
  return bad;
}

/** tach cac rule block, tra [{selector, body, startLine, endLine}] */
function parseBlocks(txt) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const startLine = txt.slice(0, m.index).split(/\r?\n/).length;
    blocks.push({
      selector: m[1].trim().replace(/\s+/g, " "),
      body: m[2],
      startLine,
      endLine: startLine + m[2].split(/\r?\n/).length,
    });
  }
  return blocks;
}

const DECL = /^\s*(-{0,2}[a-z-]+)\s*:\s*([^;]+);/gm;
/** {prop: value} của một block */
function declMap(body) {
  const o = {};
  let m;
  const re = new RegExp(DECL.source, "gm");
  while ((m = re.exec(body)) !== null) {
    o[m[1].replace(/^--/, "")] = m[2].trim().replace(/\s+/g, " ");
  }
  return o;
}

/** selector goc cua `.foo:hover` -> `.foo` */
function baseOf(sel) {
  return sel.replace(/::?[a-z-]+(\([^)]*\))?/g, "").replace(/:where\(|\)$/g, "").trim();
}

/** Thuoc tinh THUC SU doi gia tri giua base va bien the state. */
function changedProps(baseDecls, variants) {
  const changed = new Set();
  for (const v of variants) {
    for (const [k, val] of Object.entries(v)) {
      if (NEVER.has(k)) continue;
      if (!(k in baseDecls)) {
        // thuoc tinh chi xuat hien o state (vd border-color o :hover)
        changed.add(k);
      } else if (baseDecls[k] !== val) {
        changed.add(k);
      }
    }
  }
  return changed;
}

const changes = [];
for (const f of walk(ROOT)) {
  const txt = fs.readFileSync(f, "utf8");
  const blocks = parseBlocks(txt);
  const byBase = new Map();
  for (const b of blocks) {
    const base = baseOf(b.selector);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(b);
  }

  for (const b of blocks) {
    if (!/transition\s*:\s*all\b/.test(b.body)) continue;
    const base = baseOf(b.selector);
    const family = byBase.get(base) ?? [];
    const self = declMap(b.body);
    // bien the state = cung ho va khac selector goc
    const variants = family
      .filter((x) => x !== b && /::?(hover|focus|focus-visible|active|disabled|checked|selected)/.test(x.selector))
      .map((x) => declMap(x.body));
    // neu khong tim thay bien the nao: chi giu thuoc tinh paint/composite.
    // Rest (padding, border-radius, font-weight, text-align…) la TINH, khong bao
    // gio doi giua cac state nen chuyen chung vo ich - danh sach sai hon `all`.
    const changed = variants.length
      ? changedProps(self, variants)
      : new Set(Object.keys(self).filter((k) => !NEVER.has(k) && PREFERRED.includes(k)));
    changed.delete("transition");

    const ordered = [
      ...PREFERRED.filter((p) => changed.has(p)),
      ...[...changed].filter((p) => !PREFERRED.includes(p)).sort(),
    ];
    changes.push({
      file: f, startLine: b.startLine, endLine: b.endLine,
      selector: b.selector, ordered,
      hasVariant: variants.length > 0,
      // duration goc cua `transition: all ...` — de khôi phuc khi sua
      duration: (/transition\s*:\s*all\b([^;]*);/.exec(b.body) ?? [])[1]?.trim() ?? "",
    });
  }
}

console.log("=".repeat(78));
console.log("DE XUT transition props —", changes.length, "rule co `transition: all`");
console.log("=".repeat(78));

// Gom theo file, sua TU DUOI LEN: `transition: all` nam tren nhieu dong cua
// cung mot file, sua xong dong truoc se LAM LECH so dong cua dong sau.
// Vong lap theo thu tu phat hien chi sua duoc 38/51; chay nguoc lai sua het.
const byFile = new Map();
for (const c of changes) {
  if (!byFile.has(c.file)) byFile.set(c.file, []);
  byFile.get(c.file).push(c);
}

let applied = 0;
for (const [file, list] of byFile) {
  if (!APPLY) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  // `startLine` la dong cua SELECTOR; phai quet trong khoi [start, end] de tim
  // dong that su chua `transition: all` (co the cach dong selector mot vai dong).
  for (const c of [...list].sort((a, b) => b.startLine - a.startLine)) {
    for (let i = c.startLine - 1; i < Math.min(c.endLine, lines.length); i += 1) {
      const m = /^(\s*)transition\s*:\s*all\b([^;]*);/.exec(lines[i] ?? "");
      if (!m) continue;
      // PHẢI GIỮ PHẦN THỜI GIAN. `transition: color, background;` KHÔNG có
      // duration ⇒ CSS mặc định `transition-duration: 0s` ⇒ hover chớp tức thay
      // vì mất hẳn chuyển động. Đây là regression thật do script v1 gây ra
      // (bị audit Stage 5 bắt: 49 khai báo không còn số thời gian).
      const tail = (m[2] ?? "").trim();
      const duration = tail || "0.2s";
      const list2 = c.ordered.length ? c.ordered.join(", ") : "opacity";
      lines[i] = `${m[1]}transition: ${list2} ${duration};`;
      applied += 1;
      break;
    }
  }
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}

  console.log(`\n${"-".repeat(78)}`);
  console.log(`co bien the hover/focus: ${changes.filter((c) => c.hasVariant).length}/${changes.length}`);
  console.log(`doan khong duoc: ${changes.filter((c) => !c.ordered.length).length}`);
  console.log(APPLY ? `da sua ${applied}/${changes.length}` : `chua sua gi (them --apply de ap dung)`);

  // ---------------------------------------------------------------
  // SUA CHUA: rule bi script v1 bo mat thoi gian chuyen dong.
  // `transition: color, background;` => duration mac dinh 0s => mat animation.
  // Ban nay them `0.2s` (gia tri pho bien nhat cua repo) va ghi ro lai.
  // ---------------------------------------------------------------
  const missing = findMissingDuration(ROOT);
  console.log(`\n${"-".repeat(78)}`);
  console.log(`rule thieu duration (0s => mat chuyen dong): ${missing.length}`);
  for (const m of missing.slice(0, 8)) {
    console.log(`   ${m.file}:${m.line + 1}  ${m.text.trim()}`);
  }
  if (missing.length > 8) console.log(`   … +${missing.length - 8} nữa`);
  if (APPLY && missing.length) {
    let fixed = 0;
    for (const f of [...new Set(missing.map((m) => m.file))]) {
      const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
      missing.filter((m) => m.file === f).forEach((m) => {
        const ln = lines[m.line];
        const mm = /^(\s*)transition\s*:\s*([a-zA-Z-]+(?:\s*,\s*[a-zA-Z-]+)+)\s*;\s*$/.exec(ln ?? "");
        if (!mm) return;
        lines[m.line] = `${mm[1]}transition: ${mm[2]} 0.2s;`;
        fixed += 1;
      });
      fs.writeFileSync(f, lines.join("\n"), "utf8");
    }
    console.log(`da khoi phuc duration cho ${fixed}/${missing.length} rule`);
  }
