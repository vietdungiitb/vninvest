#!/usr/bin/env node
/**
 * check-h1-graph — mỗi ROUTE có render `<h1>` hay không, đo bằng ĐỒ THỊ IMPORT THẬT.
 *
 * ⚠ VÌ SAO KHÔNG GREP TÊN FILE (hazard 7 — sai số 2 lần trong lịch sử repo này)
 * ------------------------------------------------------------------------
 * Bản nháp đầu tiên của kế hoạch dùng `build.rollupOptions.input` và
 * `src/app/pageRegistry.js`. CẢ HAI ĐỀU KHÔNG TỒN TẠI. Script này tự đọc:
 *   1. `vite.config.ts` → `root` (không khai báo ⇒ mặc định Vite = thư mục chứa config)
 *   2. `<root>/index.html` → `<script type="module" src="…">`  ← ĐÂY là input của Vite
 *   3. `src/pages/pageRegistry.js` → danh sách route (`makePageEntry`)
 * Không đọc entry từ tài liệu, không đoán theo tên file, không glob `*Page.tsx`.
 *
 * ⚠ AC-3.5 — PHẦN ĐỘNG BẮT BUỘC PHẢI IN RA
 * -----------------------------------------
 * Đồ thị import tĩnh **không nhìn thấy** `<h1>` sinh động (`e(tag, …)` với `tag` là
 * biến). Im lặng ở đây đã sinh 6 vòng finding sai trong lịch sử repo (L-G04).
 * ⇒ Script in riêng mục `PHẦN ĐỘNG` có số đếm được, và route có phần động KHÔNG
 * bao giờ bị kết luận "không có h1" — nó mang verdict riêng.
 *
 * ⚠ HAI TẦNG KẾT LUẬN (tránh nói quá)
 *   `render-reachable` — `<h1>` nằm trong module ta CHỨNG MINH ĐƯỢC là được render.
 *   `closure-only`     — `<h1>` nằm trong closure import nhưng KHÔNG chứng minh được
 *                        được render (import ở nhánh không tới, barrel re-export…).
 *                        Đây là **trên xấp xỉ** (over-approx) ⇒ tách verdict riêng.
 *
 * Chạy:
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs              # báo cáo, exit 0 nếu phân tích xong
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --gate       # gate: exit 1 nếu có vi phạm
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --json       # cho gate khác nuốt
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --self-test  # bằng chứng ÂM (fixture trong __fixtures__/)
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --list-routes
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --app-dir <vite.config.ts>
 *   node docs/audit-uiux/scripts/check-h1-graph.mjs --registry <pageRegistry.js>
 *
 * Exit:
 *   0  phân tích xong / self-test đạt / gate PASS
 *   1  gate FAIL, HOẶC self-test thấy vi phạm bị LỌT, HOẶC không đọc được entry
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const FIXTURES_DIR = path.join(HERE, "__fixtures__");
const DEFAULT_VITE_CONFIG = path.join(REPO_ROOT, "packages/web/vite.config.ts");

const RESOLVE_EXTS = [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"];
const JS_OUTPUT_EXTS = [".js", ".jsx", ".mjs", ".cjs"];
const WALKABLE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const ASSET_EXTS = new Set([".css", ".scss", ".sass", ".less", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".avif"]);

/** `.css` resolve được nhưng KHÔNG phải module JS ⇒ đếm vào asset, KHÔNG đi tiếp. */
function isWalkable(file) {
  const ext = path.extname(file);
  return WALKABLE_EXTS.has(ext) && !file.endsWith(".d.ts");
}

const KHONG_VERIFY = "KHONG VERIFY DUOC";

function toPosix(p) {
  return p.split(path.sep).join("/");
}
function rel(p) {
  const r = path.relative(REPO_ROOT, p);
  return toPosix(r).startsWith("..") ? toPosix(p) : toPosix(r);
}
function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENTRY POINT — đọc từ build config, KHÔNG từ doc (AC-3.1)
// ─────────────────────────────────────────────────────────────────────────────

export function readViteConfig(configPath) {
  const notes = [];
  if (!fs.existsSync(configPath)) return { ok: false, notes: [`${KHONG_VERIFY}: khong tim thay ${rel(configPath)}`] };
  const src = fs.readFileSync(configPath, "utf8");
  const configDir = path.dirname(configPath);

  const hasRollupInput = /\brollupOptions\s*:\s*\{[\s\S]{0,600}?\binput\s*:/.test(src);
  notes.push(
    hasRollupInput
      ? "vite.config.ts: CÓ build.rollupOptions.input"
      : "vite.config.ts: KHÔNG có build.rollupOptions.input (đã đọc thật) ⇒ entry phải lấy từ index.html",
  );

  let root = configDir;
  let rootExplicit = false;
  const rm = src.match(/^\s*root\s*:\s*['"]([^'"]+)['"]/m);
  if (rm) {
    rootExplicit = true;
    root = path.resolve(configDir, rm[1]);
  }
  notes.push(
    rootExplicit
      ? `root = ${rel(root)} (khai báo trong vite.config.ts)`
      : `root = ${rel(root)} (vite.config.ts KHÔNG khai root ⇒ mặc định Vite = thư mục chứa config)`,
  );

  const aliasBlock = extractBalanced(src, "alias:");
  const aliases = [];
  if (!aliasBlock) {
    notes.push(`${KHONG_VERIFY}: không đọc được resolve.alias trong vite.config.ts`);
  } else {
    const re = /(['"])([^'"]+)\1\s*:\s*path\.resolve\(\s*__dirname\s*,\s*(['"])([^'"]+)\3\s*\)/g;
    let m;
    while ((m = re.exec(aliasBlock))) aliases.push({ find: m[2], dir: path.resolve(configDir, m[4]) });
    const keyCount = (aliasBlock.match(/['"][^'"]+['"]\s*:/g) ?? []).length;
    if (aliases.length !== keyCount) {
      notes.push(`${KHONG_VERIFY}: resolve.alias có ${keyCount} khóa nhưng giải được ${aliases.length} (không phải dạng path.resolve(__dirname, …))`);
    }
  }
  return { ok: true, configPath, root, rootExplicit, aliases, notes };
}

function extractBalanced(src, label) {
  const at = src.indexOf(label);
  if (at < 0) return null;
  const open = src.indexOf("{", at + label.length);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

export function readHtmlEntry(root) {
  const htmlPath = path.join(root, "index.html");
  if (!fs.existsSync(htmlPath)) return { ok: false, notes: [`${KHONG_VERIFY}: không tìm thấy ${rel(htmlPath)}`] };
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
    .map((m) => ({ type: /\btype\s*=\s*['"]?module['"]?/i.test(m[1]), src: (m[1].match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i) ?? [])[1], index: m.index }))
    .filter((s) => s.src && s.type);
  if (scripts.length === 0) return { ok: false, notes: [`${KHONG_VERIFY}: ${rel(htmlPath)} không có <script type="module" src=…>`] };
  if (scripts.length > 1) {
    return { ok: false, notes: [`${KHONG_VERIFY}: ${rel(htmlPath)} có ${scripts.length} script module (${scripts.map((s) => s.src).join(", ")}) — không đoán cái nào là entry`] };
  }
  const spec = scripts[0].src;
  if (!spec.startsWith("/") && !spec.startsWith(".")) return { ok: false, notes: [`${KHONG_VERIFY}: entry script là bare specifier "${spec}"`] };
  const entry = path.resolve(root, spec.replace(/^\//, ""));
  if (!fs.existsSync(entry)) return { ok: false, notes: [`${KHONG_VERIFY}: entry "${spec}" → không tồn tại ${rel(entry)}`] };
  return { ok: true, htmlPath, htmlLine: lineOf(html, scripts[0].index), spec, entry, notes: [`entry = ${rel(htmlPath)}:${lineOf(html, scripts[0].index)} <script type="module" src="${spec}">`] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Resolve specifier — bám quy tắc Vite
// ─────────────────────────────────────────────────────────────────────────────

export function resolveSpecifier(spec, importerFile, ctx) {
  if (spec.startsWith(".")) return resolveFileLike(path.resolve(path.dirname(importerFile), spec), importerFile);
  if (spec.startsWith("/")) return resolveFileLike(path.resolve(ctx.root, spec.slice(1)), importerFile);
  const hit = ctx.aliases
    .filter((a) => spec === a.find || spec.startsWith(a.find + "/"))
    .sort((a, b) => b.find.length - a.find.length)[0];
  if (hit) return resolveFileLike(path.join(hit.dir, spec.slice(hit.find.length).replace(/^\//, "")), importerFile);
  return { kind: "external", spec };
}

function resolveFileLike(base, importerFile) {
  const attempts = [];
  const tryOne = (p, rule) => {
    attempts.push(p);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      if (isWalkable(p)) return { kind: "file", file: path.normalize(p), rule, attempts };
      return { kind: "asset", file: path.normalize(p), rule, attempts };
    }
    return null;
  };

  let hit = tryOne(base, "exact");
  if (hit) return hit;

  const ext = path.extname(base);
  if (JS_OUTPUT_EXTS.includes(ext)) {
    // Vite `knownTsOutputRE = /\.(?:js|mjs|cjs|jsx)$/` → thay "js" bằng "ts".
    const stem = base.slice(0, -ext.length);
    const primary = ext.replace("js", "ts");
    hit = tryOne(stem + primary, `ts-output(${ext}→${primary})`);
    if (hit) return hit;
    if (ext === ".js") {
      hit = tryOne(stem + ".tsx", "ts-output(.js→.tsx)");
      if (hit) return hit;
    }
  }

  let exts = [...RESOLVE_EXTS];
  if (/\.(tsx?|mts|cts)$/.test(importerFile)) exts = [".ts", ".tsx", ".mts", ".jsx", ".js", ".mjs", ".json"];
  if (!ext) {
    for (const e of exts) {
      hit = tryOne(base + e, `ext(${e})`);
      if (hit) return hit;
    }
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const e of exts) {
      hit = tryOne(path.join(base, "index" + e), `index(${e})`);
      if (hit) return hit;
    }
  }
  return { kind: ASSET_EXTS.has(ext) || ext === ".json" ? "asset" : "unresolved", base, ext, attempts };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Che comment + string — chống false positive (giữ nguyên độ dài)
// ─────────────────────────────────────────────────────────────────────────────

const REGEX_PREV = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">", "\n"]);
const REGEX_KEYWORDS = new Set(["return", "typeof", "instanceof", "case", "in", "of", "do", "else", "yield", "await", "delete", "void", "new"]);

/**
 * Che comment (luôn) và string (khi `blankStrings=true`).
 * ⚠ Khi `blankStrings=false`, chuỗi ĐƯỢC GIỮ NGUYÊN — dùng để lấy **giá trị**
 * specifier / key. Nếu che cả chuỗi thì không đọc được tên module nào được import.
 */
export function maskSource(text, blankStrings = true) {
  const n = text.length;
  const out = new Array(n);
  const blank = (a, b) => {
    for (let k = a; k < b && k < n; k++) if (text[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  let prevSig = "";
  let prevWord = "";

  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];

    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < n && text[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && c2 === "*") {
      let j = i + 2;
      while (j < n && !(text[j] === "*" && text[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      blank(i, j);
      i = j;
      continue;
    }
    if (blankStrings && (c === '"' || c === "'" || c === "`")) {
      // ⚠ backtick dùng skipTemplateAware (có `${}`); quote thường dùng skipQuoted.
      // Dùng nhầm hàm sẽ nuốt hết phần còn lại của file — đã gặp đúng lỗi này.
      const end = c === "`" ? skipTemplateAware(text, i) : skipQuoted(text, i);
      blank(i, end);
      i = end;
      prevSig = c;
      prevWord = "";
      continue;
    }
    if (!blankStrings && (c === '"' || c === "'" || c === "`")) {
      // giữ nguyên chuỗi, chỉ cần bỏ qua nó để không nhận nhầm `/` bên trong
      const end = c === "`" ? skipTemplateAware(text, i) : skipQuoted(text, i);
      for (let k = i; k < end; k++) out[k] = text[k];
      i = end;
      prevSig = c;
      prevWord = "";
      continue;
    }
    if (c === "/") {
      const isRegex = prevSig === "" || REGEX_PREV.has(prevSig) || REGEX_KEYWORDS.has(prevWord);
      if (isRegex && c2 !== "/" && c2 !== "*") {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          if (text[j] === "\\") { j += 2; continue; }
          if (text[j] === "[") inClass = true;
          else if (text[j] === "]") inClass = false;
          else if (text[j] === "/" && !inClass) { j++; break; }
          else if (text[j] === "\n") break;
          j++;
        }
        blank(i, j);
        i = j;
        prevSig = "/";
        prevWord = "";
        continue;
      }
    }
    out[i] = c;
    if (!/\s/.test(c)) {
      prevSig = c;
      prevWord = /[\w$]/.test(c) ? prevWord + c : "";
    }
    i++;
  }
  for (let k = 0; k < n; k++) if (out[k] === undefined) out[k] = text[k];
  return out.join("");
}

function srcOf(text) {
  return text;
}

function skipQuoted(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "\\") { j += 2; continue; }
    if (src[j] === q || src[j] === "\n") return j + 1;
    j++;
  }
  return src.length;
}

function skipRegexBody(src, i) {
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    if (src[j] === "\\") { j += 2; continue; }
    if (src[j] === "[") inClass = true;
    else if (src[j] === "]") inClass = false;
    else if (src[j] === "/" && !inClass) return j + 1;
    else if (src[j] === "\n") break;
    j++;
  }
  return j;
}

/** Bỏ qua template literal, kể cả phần `${ … }`. */
function skipTemplateAware(src, i) {
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "\\") { j += 2; continue; }
    if (src[j] === "`") return j + 1;
    if (src[j] === "$" && src[j + 1] === "{") {
      j = skipBracedExpr(src, j + 1);
      continue;
    }
    j++;
  }
  return src.length;
}

/**
 * Bỏ qua biểu thức bên trong `${ … }`.
 * ⚠ PHẢI xử lý regex literal. Đã gặp đúng lỗi này: `s.replace(/"/g, '""')` bên
 * trong `${}` khiến scanner nuốt hết phần còn lại của file ⇒ mọi `<h1>` phía sau
 * biến mất khỏi kết quả mà KHÔNG có bất kỳ cảnh báo nào.
 */
function skipBracedExpr(src, i) {
  let depth = 0;
  let j = i;
  let prevSig = "";
  let prevWord = "";
  while (j < src.length) {
    const c = src[j];
    const c2 = src[j + 1];
    if (c === '"' || c === "'") { j = skipQuoted(src, j); prevSig = c; prevWord = ""; continue; }
    if (c === "`") { j = skipTemplateAware(src, j); prevSig = c; prevWord = ""; continue; }
    if (c === "/" && c2 === "/") { while (j < src.length && src[j] !== "\n") j++; continue; }
    if (c === "/" && c2 === "*") {
      j += 2;
      while (j < src.length && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(src.length, j + 2);
      continue;
    }
    if (c === "/" && (prevSig === "" || REGEX_PREV.has(prevSig) || REGEX_KEYWORDS.has(prevWord))) {
      j = skipRegexBody(src, j);
      prevSig = "/";
      prevWord = "";
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return j + 1;
    }
    if (!/\s/.test(c)) {
      prevSig = c;
      prevWord = /[\w$]/.test(c) ? prevWord + c : "";
    }
    j++;
  }
  return src.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Parse 1 module
// ─────────────────────────────────────────────────────────────────────────────

export function parseModule(file) {
  const src = fs.readFileSync(file, "utf8");
  const code = maskSource(src, true); // string đã che → an toàn khi dò JSX/call
  const keepStrings = maskSource(src, false); // comment đã che → đọc được giá trị specifier

  const imports = [];
  const seenSpec = new Set();
  const bindings = new Map(); // tên cục bộ → specifier nguồn
  const addImport = (spec, index) => {
    if (!spec) return;
    if (seenSpec.has(index)) return;
    seenSpec.add(index);
    imports.push({ spec, line: lineOf(src, index) });
  };

  const IMPORT_STMT = /(?:^|[^\w$.])import\s+([^;'"]*?)\s+from\s*(['"])([^'"]+)\2|(?:^|[^\w$.])import\s*(['"])([^'"]+)\4/g;
  for (const m of keepStrings.matchAll(IMPORT_STMT)) {
    const clause = m[1] ?? "";
    const spec = m[3] ?? m[5];
    addImport(spec, m.index);
    // binding cục bộ -> specifier nguồn
    const dflt = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (dflt) bindings.set(dflt[1], spec);
    const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) bindings.set(ns[1], spec);
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const t = part.trim();
        if (!t) continue;
        const name = t.includes(" as ") ? t.split(/\s+as\s+/)[1].trim() : t;
        if (/^[A-Za-z_$][\w$]*$/.test(name)) bindings.set(name, spec);
      }
    }
  }
  for (const m of keepStrings.matchAll(/(?:^|[^\w$.])import\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) addImport(m[2], m.index);
  for (const m of keepStrings.matchAll(/(?:^|[^\w$.])export\s+[^;'"]*?\s+from\s*(['"])([^'"]+)\1/g)) addImport(m[2], m.index);

  // `import(<biến>)` — KHÔNG resolve được
  const dynamicUnresolvable = [];
  for (const m of code.matchAll(/(?:^|[^\w$.])import\s*\(([^)]{0,80}?)\)/g)) {
    const arg = m[1].trim();
    if (arg && !/^(['"])/.test(arg)) {
      dynamicUnresolvable.push({ line: lineOf(src, m.index), snippet: src.slice(m.index, m.index + m[0].length).replace(/\s+/g, " ").slice(0, 100) });
    }
  }

  // alias của createElement
  const ceCallees = new Set(["createElement"]);
  for (const m of keepStrings.matchAll(/(?:^|[^\w$.])import\s+\{([^}]*)\}\s+from\s*(['"])([^'"]+)\2/g)) {
    if (!/react/i.test(m[3])) continue;
    for (const part of m[1].split(",")) {
      const t = part.trim();
      const as = t.match(/^createElement\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (as) ceCallees.add(as[1]);
    }
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?createElement\s*;/g)) ceCallees.add(m[1]);

  // component cục bộ
  // component cục bộ — kèm VỊ TRÍ để biết h1 nằm trong component nào
  const localComponents = new Set();
  const componentDecls = []; // { name, index }
  for (const m of code.matchAll(/\b(?:function|class)\s+([A-Z][\w$]*)/g)) { localComponents.add(m[1]); componentDecls.push({ name: m[1], index: m.index }); }
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Z][\w$]*)\s*=\s*(?:React\.)?(?:memo|forwardRef|lazy)?\s*(?:\(|function\b)/g)) {
    localComponents.add(m[1]);
    componentDecls.push({ name: m[1], index: m.index });
  }
  componentDecls.sort((x, y) => x.index - y.index);
  /** Component cục bộ bao quanh vị trí `at` (null nếu h1 ở cấp module). */
  const enclosingComponent = (at) => {
    let found = null;
    for (const d of componentDecls) { if (d.index < at) found = d.name; else break; }
    return found;
  };

  // ── forwarder: hàm bọc `createElement(<tham số đầu>, …)` ───────────────────
  // KHÔNG có bước này thì `ShellPageTemplate.js:119` `renderElement("h1", …)`
  // bị bỏ sót và 32 route bị kết luận sai. Đây là false negative thật đã gặp.
  const forwarders = new Set();
  const exportedForwarders = new Set();
  for (let pass = 0; pass < 3; pass++) {
    const names = [...ceCallees, ...forwarders].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    if (!names) break;
    const re = new RegExp(
      `(?:function\\s+([A-Za-z_$][\\w$]*)\\s*\\(\\s*([A-Za-z_$][\\w$]*)[^)]*\\)\\s*\\{\\s*return\\s+(?:React\\.)?(?:${names})\\s*\\(\\s*\\2\\b)` +
        `|(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*\\(\\s*([A-Za-z_$][\\w$]*)[^)]*\\)\\s*=>\\s*(?:React\\.)?(?:${names})\\s*\\(\\s*\\4\\b`,
      "g",
    );
    let before = forwarders.size;
    for (const m of code.matchAll(re)) {
      const name = m[1] ?? m[3];
      forwarders.add(name);
      if (new RegExp(`(?:^|[^\\w$.])export\\s+(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`).test(code)) exportedForwarders.add(name);
    }
    if (forwarders.size === before) break;
  }

  // call site createElement
  const calleeAlt = [...ceCallees, ...forwarders].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const callRe = new RegExp(`(?:^|[^\\w$.])((?:React\\.)?(?:${calleeAlt}))\\s*\\(`, "g");

  const h1Sites = [];
  const dynamicSites = [];
  const renderRefs = new Set();
  const componentRefs = []; // { name, local } — tên component được dùng ở vị trí render

  for (const m of code.matchAll(callRe)) {
    const callee = m[1];
    const openParen = m.index + m[0].length - 1;
    let j = openParen + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    const line = lineOf(src, m.index);
    const literal = readStringLiteral(src, j);
    if (literal !== null) {
      if (literal === "h1") h1Sites.push({ line, shape: `${callee}("h1", …)`, multiLine: j - openParen > 1, viaWrapper: forwarders.has(callee), component: enclosingComponent(m.index) });
      continue;
    }
    const cond = readConditionalTags(src, j);
    if (cond) {
      dynamicSites.push({ line, shape: `${callee}(${cond.raw}, …)`, kind: "tag-conditional", at: m.index, tags: cond.tags });
      if (cond.tags.includes("h1")) h1Sites.push({ line, shape: `${callee}(<conditional chứa "h1">)`, multiLine: true });
      continue;
    }
    const ident = readIdentifier(src, j);
    if (ident) {
      const tail = readMemberTail(src, ident.end);
      if (tail === "") {
        if (bindings.has(ident.name)) { renderRefs.add(ident.name); componentRefs.push({ name: ident.name, local: false, owner: enclosingComponent(m.index), at: m.index }); continue; }
        if (localComponents.has(ident.name)) { componentRefs.push({ name: ident.name, local: true, owner: enclosingComponent(m.index), at: m.index }); continue; }
        dynamicSites.push({ line, shape: `${callee}(${ident.name}, …)`, kind: "tag-local-variable", ident: ident.name, viaWrapper: forwarders.has(callee) });
        continue;
      }
      // `Ctx.Provider` / `Ctx.Consumer` là COMPONENT (nội bộ hay import đều vậy) — không phải tag động.
      if (/^\s*\.(Provider|Consumer)\b/.test(src.slice(ident.end, ident.end + 20))) continue;
      dynamicSites.push({ line, shape: `${callee}(${ident.name}${tail}, …)`, kind: "tag-expression", at: m.index });
      continue;
    }
    const head = src.slice(j, j + 40).replace(/\s+/g, " ").split(/[,)]/)[0];
    dynamicSites.push({ line, shape: `${callee}(${head}…, …)`, kind: "tag-expression", at: m.index });
  }

  for (const d of dynamicSites) { d.component = enclosingComponent(d.at ?? 0); delete d.at; }

  for (const m of code.matchAll(/<h1(?=[\s/>])/g)) h1Sites.push({ line: lineOf(src, m.index), shape: "JSX <h1>", multiLine: false, viaWrapper: false, component: enclosingComponent(m.index) });

  // JSX component: `<Foo …>`. ⚠ Loại generic của TypeScript (`useRef<Response>(…)`,
  // `useState<Array<Foo>>(…)`) — ở đó `<` đứng SAU identifier, không phải trước.
  for (const m of code.matchAll(/<([A-Z][\w$]{1,})(?=[\s/>.,:(])/g)) {
    const prev = m.index > 0 ? src[m.index - 1] : "";
    if (/[\w$>]/.test(prev)) continue; // generic TS, không phải thẻ JSX
    const name = m[1];
    if (bindings.has(name) || localComponents.has(name)) {
      renderRefs.add(name);
      componentRefs.push({ name, local: localComponents.has(name), owner: enclosingComponent(m.index), at: m.index });
    } else {
      const line = lineOf(src, m.index);
      dynamicSites.push({ line, shape: `<${name} />`, kind: "tag-jsx-variable", ident: name, at: m.index });
    }
  }

  return { file, src, imports, dynamicUnresolvable, bindings, localComponents, renderRefs: [...renderRefs], componentRefs, h1Sites, dynamicSites, ceCallees: [...ceCallees], forwarders: [...forwarders], exportedForwarders: [...exportedForwarders] };
}

function readStringLiteral(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "\\") { j += 2; continue; }
    if (src[j] === q || src[j] === "\n") break;
    j++;
  }
  return src[j] === q ? src.slice(i + 1, j) : null;
}

function readConditionalTags(src, i) {
  // ⚠ Chỉ chấp nhận biểu thức ĐIỀU KIỆN ngay ở đối số 1 (`c ? 'h1' : 'h2'`).
  // Nới rộng thành `[^?]{1,80}` sẽ khớp nhầm khi đối số 2 mới là conditional
  // (`createElement(ShellField, { label: c ? 'a' : 'b' })`) — đã gặp đúng lỗi này.
  const slice = src.slice(i, i + 200);
  const m = slice.match(/^\s*([A-Za-z_$][\w$.[\]]{0,60}?)\?\s*(['"])([^'"]*)\2\s*:\s*(['"])([^'"]*)\4/);
  return m ? { tags: [m[3], m[5]], raw: slice.slice(0, m[0].length).replace(/\s+/g, " ") } : null;
}

function readIdentifier(src, i) {
  const m = /^\s*([A-Za-z_$][\w$]*)/.exec(src.slice(i));
  return m ? { name: m[1], end: i + m[0].length } : null;
}
function readMemberTail(src, i) {
  let j = i;
  while (j < src.length && /\s/.test(src[j])) j++;
  return src[j] === "." || src[j] === "[" ? src.slice(i, j + 1) : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Đồ thị
// ─────────────────────────────────────────────────────────────────────────────

export class Graph {
  constructor(ctx) {
    this.ctx = ctx;
    this.modules = new Map();
    this.unresolved = new Map();
    this.assets = new Map();
    this.externals = new Map();
    this.rules = new Map();
  }
  module(file) {
    if (this.modules.has(file)) return this.modules.get(file);
    let m = null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      try {
        m = parseModule(file);
      } catch (err) {
        m = { file, imports: [], dynamicUnresolvable: [], bindings: new Map(), localComponents: new Set(), renderRefs: [], h1Sites: [], dynamicSites: [], ceCallees: [], parseError: String((err && err.message) || err) };
      }
    }
    this.modules.set(file, m);
    return m;
  }
  edge(importer, spec) {
    const r = resolveSpecifier(spec, importer, this.ctx);
    if (r.kind === "file") {
      this.rules.set(r.rule, (this.rules.get(r.rule) ?? 0) + 1);
      return r.file;
    }
    if (r.kind === "external") { this.externals.set(spec, (this.externals.get(spec) ?? 0) + 1); return null; }
    if (r.kind === "asset") { this.assets.set(spec, (this.assets.get(spec) ?? 0) + 1); return null; }
    this.unresolved.set(`${importer}|${spec}`, { file: importer, spec, base: r.base, tried: r.attempts.map((a) => toPosix(path.relative(path.dirname(importer), a)) || ".") });
    return null;
  }
}

export function importClosure(graph, start) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    const mod = graph.module(f);
    if (!mod) continue;
    seen.add(f);
    for (const imp of mod.imports) {
      const t = graph.edge(f, imp.spec);
      if (t && !seen.has(t)) queue.push(t);
    }
  }
  return seen;
}

/**
 * Đồ thị RENDER ở mức COMPONENT, không phải mức module.
 *
 * ⚠ Vì sao phải xuống tới component: `ShellPageTemplate.js` vừa chứa `ShellPageChrome`
 * (có `<h1>` ở :119) vừa chứa `ShellField`. `AICommandCenterForm` chỉ render
 * `ShellField` — nếu chỉ đi theo cạnh MODULE thì h1 của `ShellPageChrome` bị quy
 * cho route đó ⇒ dương giả. Đã gặp đúng lỗi này và phải sửa script.
 *
 * Ghi nhận giới hạn: entry module của route được coi là render TẤT CẢ component
 * cục bộ của nó (hàm của route gần như luôn gọi tới chúng) — đây là trên xấp xỉ
 * có kiểm soát, và nó không làm sai kết luận "có h1" (chỉ có thể thừa).
 */
export function renderReachable(graph, start) {
  const names = new Map(); // file -> Set<tên component được render>
  const addName = (f, n) => { let s = names.get(f); if (!s) { s = new Set(); names.set(f, s); } return s.add(n); };
  const namesOf = (f) => names.get(f) ?? new Set();

  // 1) BFS thu module (theo binding được dùng ở vị trí render)
  const visited = new Set();
  const unresolvedRefs = new Set();
  const queue = [start];
  while (queue.length) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    const mod = graph.module(f);
    if (!mod) continue;
    for (const ref of mod.componentRefs) {
      if (ref.local) continue;
      const spec = mod.bindings.get(ref.name);
      if (!spec) {
        if (!mod.localComponents.has(ref.name)) unresolvedRefs.add(`${rel(f)}: <${ref.name}>`);
        continue;
      }
      const t = graph.edge(f, spec);
      if (t && !visited.has(t)) queue.push(t);
    }
  }

  // 2) Entry module của route được coi là render TẤT CẢ component cục bộ của nó.
  {
    const mod = graph.module(start);
    if (mod) for (const n of mod.localComponents) addName(start, n);
  }

  // 3) Fixpoint: chỉ lan truyền khi component CHỦ SỞ HỨNG (owner) đã được render.
  // ⚠ Không làm bước này thì `ShellPanel` (được render) kéo theo `ShellMetric`,
  // `ShellField`, `ShellSelectField` **và `ShellPageChrome`** — trong đó
  // `ShellPageChrome` chỉ được gọi từ chính nó ⇒ h1 của nó bị quy nhầm cho
  // `ai-command-center`. Đã gặp đúng lỗi này và phải sửa script.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const f of visited) {
      const mod = graph.module(f);
      if (!mod) continue;
      const rendered = namesOf(f);
      for (const ref of mod.componentRefs) {
        if (ref.owner && !rendered.has(ref.owner)) continue;
        if (ref.local) { if (addName(f, ref.name).size > rendered.size) changed = true; continue; }
        const spec = mod.bindings.get(ref.name);
        if (!spec) continue;
        const t = graph.edge(f, spec);
        if (!t || !visited.has(t)) continue;
        const before = namesOf(t).size;
        addName(t, ref.name);
        if (namesOf(t).size > before) changed = true;
      }
    }
  }
  return { files: visited, names, unresolvedRefs: [...unresolvedRefs] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. pageRegistry (AC-3.6) — KHÔNG glob `*Page.tsx`
// ─────────────────────────────────────────────────────────────────────────────

export function parseRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) return { ok: false, entries: [], notes: [`${KHONG_VERIFY}: không tìm thấy ${rel(registryPath)}`] };
  const src = fs.readFileSync(registryPath, "utf8");
  const keepStrings = maskSource(src, false);
  const entries = [];
  const factories = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\(\s*(['"])([^'"]+)\2\s*,\s*(['"])([^'"]+)\4\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*(?:return\s*)?import\s*\(\s*(['"])([^'"]+)\6\s*\)/g;
  for (const m of keepStrings.matchAll(re)) {
    factories.add(m[1]);
    entries.push({ routeId: m[3], status: m[5], spec: m[7], line: lineOf(src, m.index) });
  }
  const notes = [];
  if (factories.size > 1) notes.push(`CẢNH BÁO: registry có ${factories.size} factory khác nhau (${[...factories].join(", ")})`);
  if (entries.length === 0) notes.push(`${KHONG_VERIFY}: không parse được entry nào từ ${rel(registryPath)}`);
  return { ok: entries.length > 0, entries, notes, factories: [...factories], file: registryPath };
}

/**
 * Bảng `routeId → registryId` trong `resolvePageComponent()` của entry.
 * Không có nó thì 8 registry id (`core-dashboard`, `whale-advisory`, …) bị báo
 * "route chết" một cách SAI — chúng chỉ được tham chiếu qua bảng map này.
 */
export function parseRemapTable(mainFile) {
  const out = new Map();
  if (!mainFile || !fs.existsSync(mainFile)) return out;
  const src = fs.readFileSync(mainFile, "utf8");
  const body = /function resolvePageComponent\b[\s\S]*?\n}/.exec(src)?.[0] ?? "";
  for (const m of body.matchAll(/routeId\s*===\s*['"]([^'"]+)['"]\)\s*registryId\s*=\s*['"]([^'"]+)['"]/g)) out.set(m[1], m[2]);
  for (const m of body.matchAll(/routeId\.startsWith\(\s*['"]([^'"]+)['"]\s*\)\s*registryId\s*=\s*['"]([^'"]+)['"]/g)) out.set(m[1], m[2]);
  return out;
}

export function parseRoutePaths(mainFile) {
  if (!mainFile || !fs.existsSync(mainFile)) return [];
  const src = fs.readFileSync(mainFile, "utf8");
  const keepStrings = maskSource(src, false);
  const out = [];
  for (const m of keepStrings.matchAll(/\bpath\s*:\s*(['"])([^'"]+)\1/g)) out.push({ path: m[2], line: lineOf(src, m.index) });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Phân tích
// ─────────────────────────────────────────────────────────────────────────────

export function analyze({ viteConfigPath, registryPath }) {
  const cfg = readViteConfig(viteConfigPath);
  const notes = [...(cfg.notes ?? [])];
  if (!cfg.ok) return { ok: false, notes };

  const html = readHtmlEntry(cfg.root);
  notes.push(...html.notes);
  if (!html.ok) return { ok: false, notes };

  const srcRoot = path.resolve(cfg.root, "src");
  const ctx = { root: cfg.root, aliases: cfg.aliases };
  const graph = new Graph(ctx);
  const entryClosure = importClosure(graph, html.entry);

  const reg = parseRegistry(registryPath ?? path.join(srcRoot, "pages", "pageRegistry.js"));
  notes.push(...(reg.notes ?? []));
  const remap = parseRemapTable(html.entry);
  const routePaths = parseRoutePaths(html.entry);

  const routes = [];
  for (const e of reg.entries) {
    const resolved = resolveSpecifier(e.spec, reg.file, ctx);
    if (resolved.kind !== "file") {
      routes.push({ ...e, entryFile: null, verdict: "KHONG_VERIFY", reason: `không resolve được "${e.spec}" (kind=${resolved.kind})`, h1: [], h1Render: [], h1ClosureOnly: [], dynamic: [], dynamicRender: [], moduleUnresolved: [], renderUnresolvedRefs: [] });
      continue;
    }
    const closure = importClosure(graph, resolved.file);
    const render = renderReachable(graph, resolved.file);

    const h1 = [];
    const dynamic = [];
    for (const f of closure) {
      const mod = graph.module(f);
      if (!mod) continue;
      const rendered = render.names.get(f) ?? new Set();
      for (const s of mod.h1Sites) {
        // h1 chỉ "render-reachable" nếu component BAO QUANH nó nằm trong tập component
        // đã chứng minh được render. h1 ở cấp module ⇒ không render được.
        const inRender = s.component ? rendered.has(s.component) : false;
        h1.push({ ...s, file: f, component: s.component ?? "(module-level)", inRender });
      }
      for (const s of mod.dynamicSites) dynamic.push({ ...s, file: f, inRender: rendered.has(s.component ?? "") });
    }
    const h1Render = h1.filter((x) => x.inRender);
    const h1ClosureOnly = h1.filter((x) => !x.inRender);
    const moduleUnresolved = [...graph.unresolved.values()].filter((u) => closure.has(u.file));

    let verdict;
    if (h1Render.length) verdict = "CO_H1_RENDER_REACHABLE";
    else if (h1ClosureOnly.length) verdict = "H1_CHI_TRONG_CLOSURE";
    else if (dynamic.length) verdict = "KHONG_TIM_THAY_H1__CO_PHAN_DONG";
    else verdict = "KHONG_TIM_THAY_H1_TRONG_CLOSURE";

    routes.push({
      ...e,
      entryFile: resolved.file,
      resolveRule: resolved.rule,
      closureSize: closure.size,
      renderSize: render.files.size,
      h1, h1Render, h1ClosureOnly,
      dynamic,
      dynamicRender: dynamic.filter((x) => x.inRender),
      renderUnresolvedRefs: render.unresolvedRefs,
      moduleUnresolved,
      verdict,
      verdictCaution:
        dynamic.length > 0
          ? "có phần động ⇒ KHÔNG kết luận được 'trang này chắc chắn không có h1'"
          : h1ClosureOnly.length > 0
            ? "h1 trong closure import nhưng KHÔNG chứng minh được render (over-approx)"
            : "",
    });
  }

// Đối chiếu registry ↔ entry (AC-3.6)
  //
  // ⚠ KHÔNG quét "chuỗi bất kỳ trong closure" — chính file của một route có thể
  // nhắc lại routeId của nó (`createElement('h1', null, 'orphan')`) và khiến route
  // chết trông như đã được tham chiếu. Bằng chứng phải nằm ở module NGOÀI registry
  // và NGOÀI closure của chính route đó ⇒ tính **theo từng route**, không gộp.
  const registryIds = new Set(reg.entries.map((e) => e.routeId));
  const remapTargets = new Set([...remap.values()]);
  const idsByModule = new Map();
  for (const f of entryClosure) {
    if (f === reg.file) continue;
    const mod = graph.module(f);
    if (!mod) continue;
    const ids = new Set();
    for (const m of maskSource(mod.src, false).matchAll(/(['"])([a-z0-9][a-z0-9-]{2,})\1/g)) {
      if (registryIds.has(m[2])) ids.add(m[2]);
    }
    if (ids.size) idsByModule.set(f, ids);
  }
  const unreferenced = [];
  for (const r of routes) {
    if (remapTargets.has(r.routeId)) continue;
    const own = r.entryFile ? importClosure(graph, r.entryFile) : new Set();
    let evidence = null;
    for (const [f, ids] of idsByModule) {
      if (own.has(f) || !ids.has(r.routeId)) continue;
      evidence = f;
      break;
    }
    if (!evidence) unreferenced.push(r.routeId);
  }
  notes.push(
    `resolvePageComponent() remap ${remapTargets.size} routeId → registryId; các id này không xuất hiện chuỗi trong entry nhưng KHÔNG phải route chết`,
  );

  // forwarder XUYÊN FILE (hàm bọc createElement được export rồi import nơi khác):
  // script KHÔNG resolve được, nên phải báo chứ không bỏ qua âm thầm.
  const exportedFwd = new Set();
  for (const m of graph.modules.values()) if (m?.exportedForwarders) for (const n of m.exportedForwarders) exportedFwd.add(n);
  const crossFileFwd = [];
  for (const m of graph.modules.values()) {
    if (!m) continue;
    for (const [local, spec] of m.bindings) {
      if (exportedFwd.has(local)) crossFileFwd.push(`${rel(m.file)} import { ${local} } từ ${spec}`);
    }
  }

  return {
    ok: true,
    notes,
    viteConfig: { path: cfg.configPath, root: cfg.root, rootExplicit: cfg.rootExplicit, aliases: cfg.aliases },
    html: { path: html.htmlPath, line: html.htmlLine, spec: html.spec },
    entry: html.entry,
    srcRoot,
    registry: { path: reg.file, count: reg.entries.length, factories: reg.factories },
    remap: Object.fromEntries(remap),
    routePathCount: new Set(routePaths.map((r) => r.path)).size,
    routePaths: routePaths.map((r) => r.path),
    entryClosureSize: entryClosure.size,
    stats: {
      modules: [...graph.modules.values()].filter(Boolean).length,
      unresolvedImports: graph.unresolved.size,
      unresolvedDetails: [...graph.unresolved.values()].map((u) => ({ file: rel(u.file), spec: u.spec, tried: u.tried })),
      assets: graph.assets.size,
      externals: graph.externals.size,
      rules: Object.fromEntries(graph.rules),
      parseErrors: [...graph.modules.values()].filter((m) => m && m.parseError).map((m) => ({ file: rel(m.file), error: m.parseError })),
    },
    unreferencedRegistryIds: unreferenced,
    crossFileForwarders: crossFileFwd,
    routes,
    graph,
    entryClosure,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Báo cáo
// ─────────────────────────────────────────────────────────────────────────────

export const VERDICT = {
  CO_H1_RENDER_REACHABLE: "CO_H1_RENDER_REACHABLE",
  H1_CHI_TRONG_CLOSURE: "H1_CHI_TRONG_CLOSURE",
  KHONG_TIM_THAY_H1__CO_PHAN_DONG: "KHONG_TIM_THAY_H1__CO_PHAN_DONG",
  KHONG_TIM_THAY_H1_TRONG_CLOSURE: "KHONG_TIM_THAY_H1_TRONG_CLOSURE",
  KHONG_VERIFY: "KHONG_VERIFY",
};

function printReport(a) {
  const L = [];
  const p = (s = "") => L.push(s);

  p("═══ check-h1-graph — h1 theo đồ thị import thật ═══");
  p();
  p("── 1. ENTRY POINT (AC-3.1) ──");
  for (const n of a.notes) p(`  · ${n}`);
  p(`  · alias: ${a.viteConfig.aliases.map((x) => `${x.find} → ${rel(x.dir)}`).join(", ") || "(không có)"}`);
  p(`  · entry module: ${rel(a.entry)}`);
  p();
  p("── 2. ĐỒ THỊ ──");
  p(`  module đã đọc             : ${a.stats.modules}`);
  p(`  entry closure (BFS)       : ${a.entryClosureSize}`);
  p(`  import KHÔNG resolve được : ${a.stats.unresolvedImports}`);
  p(`  asset bỏ qua (.css/.svg)  : ${a.stats.assets}   | package ngoài: ${a.stats.externals}`);
  p(`  quy tắc resolve đã dùng:`);
  for (const [k, v] of Object.entries(a.stats.rules).sort((x, y) => y[1] - x[1])) p(`      ${String(v).padStart(5)}  ${k}`);
  if (a.stats.parseErrors.length) {
    p(`  ⚠ LỖI PARSE — KHÔNG phân tích được, KHÔNG coi là "không có h1":`);
    for (const e of a.stats.parseErrors) p(`      ${e.file} :: ${e.error}`);
  }
  p();
  p("── 3. DANH SÁCH ROUTE (AC-3.6 — lấy từ pageRegistry, KHÔNG glob *Page.tsx) ──");
  p(`  registry                        : ${rel(a.registry.path)} → ${a.registry.count} entry (factory: ${a.registry.factories.join(", ")})`);
  p(`  <Route path=…> trong entry file : ${a.routePathCount} path (trục KHÁC — dùng để đối chiếu)`);
  p(`  registry entry KHÔNG tham chiếu : ${a.unreferencedRegistryIds.length}${a.unreferencedRegistryIds.length ? " → " + a.unreferencedRegistryIds.join(", ") : ""}`);
  p(`  forwarder createElement XUYÊN FILE : ${a.crossFileForwarders.length}${a.crossFileForwarders.length ? " → " + a.crossFileForwarders.join(", ") + "  (KHÔNG resolve được — hãy kiểm tay)" : ""}`);
  p(`  remap resolvePageComponent()    : ${JSON.stringify(a.remap)}`);
  p();
  p("── 4. KẾT LUẬN TỪNG ROUTE ──");
  p("  closure = |closure import| (bao gồm cả module có thể KHÔNG được render — over-approx)");
  p("  render  = |module chứng minh được render| · dyn = call site createElement mà TAG không xác định tĩnh");
  p();

  const rows = a.routes
    .map((r) => ({
      routeId: r.routeId,
      status: r.status,
      reg: `${rel(a.registry.path)}:${r.line}`,
      entry: r.entryFile ? rel(r.entryFile) : `${KHONG_VERIFY} (${r.spec})`,
      cl: r.closureSize ?? 0,
      rn: r.renderSize ?? 0,
      h1: r.h1.length,
      h1r: r.h1Render.length,
      dyn: r.dynamic.length,
      unres: r.moduleUnresolved.length,
      verdict: r.verdict,
    }))
    .sort((x, y) => x.routeId.localeCompare(y.routeId));
  for (const r of rows) {
    p(`  ${r.routeId}  [${r.status}]   registry:${r.reg}`);
    p(`      entry ${r.entry}`);
    p(`      closure=${String(r.cl).padStart(3)} render=${String(r.rn).padStart(3)} h1=${String(r.h1).padStart(2)} (render-reachable=${r.h1r}) dyn=${String(r.dyn).padStart(3)} unresolved=${r.unres}  → ${r.verdict}`);
  }
  p();
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  p(`  TỔNG route phân tích: ${rows.length}`);
  p(`  · CO_H1_RENDER_REACHABLE       : ${count(VERDICT.CO_H1_RENDER_REACHABLE)}`);
  p(`  · H1_CHI_TRONG_CLOSURE         : ${count(VERDICT.H1_CHI_TRONG_CLOSURE)}`);
  p(`  · KHONG_TIM_THAY_H1__CO_PHAN_DONG: ${count(VERDICT.KHONG_TIM_THAY_H1__CO_PHAN_DONG)}`);
  p(`  · KHONG_TIM_THAY_H1_TRONG_CLOSURE: ${count(VERDICT.KHONG_TIM_THAY_H1_TRONG_CLOSURE)}`);
  p(`  · KHONG_VERIFY                 : ${count(VERDICT.KHONG_VERIFY)}`);
  p();

  p("── 5. PHẦN ĐỘNG / KHÔNG GIẢI ĐƯỢC (AC-3.5 — BẮT BUỘC) ──");
  const allDyn = a.routes.flatMap((r) => r.dynamic.map((d) => ({ ...d, routeId: r.routeId })));
  const dynFiles = new Set(allDyn.map((d) => rel(d.file)));
  const dynKeys = new Set(allDyn.map((d) => `${rel(d.file)}:${d.line}`));
  const allUnres = new Set(a.routes.flatMap((r) => r.moduleUnresolved.map((u) => `${rel(u.file)} -> ${u.spec}`)));
  const allRef = new Set(a.routes.flatMap((r) => r.renderUnresolvedRefs));
  const allDynUnres = new Set(a.routes.flatMap((r) => graphModuleDynUnres(a.graph, r)));
  p(`  call site createElement có tag KHÔNG xác định tĩnh : ${allDyn.length}  (ở ${dynFiles.size} file, ${dynKeys.size} vị trí nguồn Duy nhất)`);
  p(`  import KHÔNG resolve được (trong cây route)         : ${allUnres.size}`);
  p(`  binding render không ánh xạ được module              : ${allRef.size}`);
  p(`  import() có biến — KHÔNG resolve được                : ${allDynUnres.size}`);
  p(`  ⇒ KHÔNG route nào ở trên được kết luận "chắc chắn không có h1".`);
  p();
  for (const kind of ["tag-local-variable", "tag-conditional", "tag-expression", "tag-jsx-variable"]) {
    const items = allDyn.filter((d) => d.kind === kind);
    p(`  -- ${kind}: ${items.length} --`);
    for (const d of items) p(`     ${rel(d.file)}:${d.line}  [route ${d.routeId}]  ${d.shape}`);
    p();
  }
  p(`  -- import KHÔNG resolve được: ${allUnres.size} --`);
  for (const u of [...allUnres].sort()) p(`     ${u}`);
  p();
  p(`  -- binding render không ánh xạ được: ${allRef.size} --`);
  for (const u of [...allRef].sort()) p(`     ${u}`);
  p();
  p(`  -- import() có biến: ${allDynUnres.size} --`);
  for (const u of [...allDynUnres].sort()) p(`     ${u}`);
  p();
  return L.join("\n");
}

function graphModuleDynUnres(graph, route) {
  const out = [];
  for (const f of graph.modules.keys()) {
    const mod = graph.module(f);
    if (!mod) continue;
    for (const d of mod.dynamicUnresolvable) out.push(`${rel(f)}:${d.line} ${d.snippet}`);
  }
  return out;
}

function toJson(a) {
  return {
    tool: "check-h1-graph",
    _honesty: [
      "closure = trên xấp xỉ: mọi module trong closure import đều được tính, kể cả module không chắc được render.",
      "renderReachable = binding dùng ở vị trí render (JSX <Foo> hoặc createElement(Foo)) và truy được về module import; mức COMPONENT, không phải mức module.",
      "dynamicSites = call site createElement mà TAG không xác định được tĩnh ⇒ có thể sinh h1 lúc chạy.",
      "unresolved = KHONG VERIFY DUOC, KHÔNG BAO GIỜ được coi là 'không có h1'.",
      "GIỚI HẠN ĐÃ BIẾT: đồ thị tĩnh KHÔNG đánh giá được điều kiện nhánh ⇒ 2 <h1> trong 2 `return` sớm loại trừ nhau vẫn bị đếm là 2 (đã kiểm tay: AuthLoginPage:134/146, AdminCrawlControlPage:130/150, ShellWatchlistPage:71 + ShellPageChrome).",
      "GIỚI HẠN ĐÃ BIẾT: forwarder createElement chỉ resolve trong cùng file; forwarder export rồi import nơi khác thì KHÔNG resolve — xem `crossFileForwarders`.",
      "GIỚI HẠN ĐÃ BIẾT: entry module của route bị coi là render mọi component cục bộ (trên xấp xỉ có kiểm soát: chỉ gây thừa, không gây thiếu).",
    ],
    entry: rel(a.entry),
    viteConfig: rel(a.viteConfig.path),
    root: rel(a.viteConfig.root),
    rootExplicit: a.viteConfig.rootExplicit,
    html: { file: rel(a.html.path), line: a.html.line, scriptSrc: a.html.spec },
    aliases: a.viteConfig.aliases.map((x) => ({ find: x.find, dir: rel(x.dir) })),
    registry: { file: rel(a.registry.path), entries: a.registry.count },
    routePathCount: a.routePathCount,
    unreferencedRegistryIds: a.unreferencedRegistryIds,
    crossFileForwarders: a.crossFileForwarders,
    remap: a.remap,
    stats: {
      modules: a.stats.modules,
      entryClosure: a.entryClosureSize,
      unresolvedImports: a.stats.unresolvedImports,
      unresolvedDetails: a.stats.unresolvedDetails,
      assets: a.stats.assets,
      externals: a.stats.externals,
      parseErrors: a.stats.parseErrors,
      resolveRules: a.stats.rules,
    },
    counts: {
      routes: a.routes.length,
      coH1RenderReachable: a.routes.filter((r) => r.verdict === VERDICT.CO_H1_RENDER_REACHABLE).length,
      h1ChiTrongClosure: a.routes.filter((r) => r.verdict === VERDICT.H1_CHI_TRONG_CLOSURE).length,
      khongTimThayCoPhanDong: a.routes.filter((r) => r.verdict === VERDICT.KHONG_TIM_THAY_H1__CO_PHAN_DONG).length,
      khongTimThayTinh: a.routes.filter((r) => r.verdict === VERDICT.KHONG_TIM_THAY_H1_TRONG_CLOSURE).length,
      khongVerify: a.routes.filter((r) => r.verdict === VERDICT.KHONG_VERIFY).length,
      dynamicSites: a.routes.reduce((n, r) => n + r.dynamic.length, 0),
      dynamicRoutes: a.routes.filter((r) => r.dynamic.length > 0).length,
      routesWithUnresolvedImports: a.routes.filter((r) => r.moduleUnresolved.length > 0).length,
    },
    routes: a.routes.map((r) => ({
      routeId: r.routeId,
      status: r.status,
      registryLine: r.line,
      spec: r.spec,
      entry: r.entryFile ? rel(r.entryFile) : null,
      resolveRule: r.resolveRule ?? null,
      verdict: r.verdict,
      verdictCaution: r.verdictCaution ?? "",
      closureModules: r.closureSize ?? 0,
      renderModules: r.renderSize ?? 0,
      h1RenderReachable: r.h1Render.length,
      h1ClosureOnly: r.h1ClosureOnly.length,
      h1Sites: r.h1.map((h) => ({ file: rel(h.file), line: h.line, shape: h.shape, multiLine: h.multiLine, viaWrapper: !!h.viaWrapper, component: h.component ?? null, renderReachable: h.inRender })),
      dynamicSites: r.dynamic.map((d) => ({ file: rel(d.file), line: d.line, shape: d.shape, kind: d.kind, component: d.component ?? null, renderReachable: d.inRender })),
      unresolvedImports: r.moduleUnresolved.map((u) => ({ file: rel(u.file), spec: u.spec })),
      renderUnresolvedRefs: r.renderUnresolvedRefs,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Gate — hàm mà self-test kiểm bằng chứng ÂM
// ─────────────────────────────────────────────────────────────────────────────

export function findViolations(a) {
  const v = [];
  if (!a.ok) {
    v.push({ kind: "entry-unresolved", detail: a.notes.join(" | ") });
    return v;
  }
  for (const e of a.stats.parseErrors) v.push({ kind: "parse-error", detail: `${e.file} :: ${e.error}` });
  for (const id of a.unreferencedRegistryIds) v.push({ kind: "unreferenced-registry-entry", detail: `${id} (registry khai nhưng không route nào trong entry tham chiếu)` });
  for (const r of a.routes) {
    if (r.verdict === VERDICT.KHONG_VERIFY) {
      v.push({ kind: "route-unresolved", detail: `${r.routeId} :: ${r.reason}` });
      continue;
    }
    if (r.moduleUnresolved.length) v.push({ kind: "unresolved-import", detail: `${r.routeId} :: ${r.moduleUnresolved.map((u) => `${rel(u.file)} -> ${u.spec}`).join(", ")}` });
    if (r.renderUnresolvedRefs.length) v.push({ kind: "unresolved-render-ref", detail: `${r.routeId} :: ${r.renderUnresolvedRefs.join(", ")}` });
    if (r.verdict === VERDICT.KHONG_TIM_THAY_H1_TRONG_CLOSURE) v.push({ kind: "route-missing-h1", detail: `${r.routeId} :: ${r.entryFile ? rel(r.entryFile) : r.spec}` });
    else if (r.verdict === VERDICT.KHONG_TIM_THAY_H1__CO_PHAN_DONG) v.push({ kind: "dynamic-tag", detail: `${r.routeId} :: ${r.dynamic.length} call site tag không xác định tĩnh, 0 h1 tĩnh` });
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Self-test — BẰNG CHỨNG ÂM (AC-3.4)
// ─────────────────────────────────────────────────────────────────────────────

const CASES = [
  {
    dir: "case-01-route-without-h1",
    mustCatch: "route-missing-h1",
    why: "route không có h1 nào trong closure ⇒ gate phải ĐỎ",
    check: (a, r) => ({ ok: r.h1.length === 0, detail: `h1=${r.h1.length} (mong đợi 0)` }),
  },
  {
    dir: "case-02-dynamic-tag",
    mustCatch: "dynamic-tag",
    why: "h1 sinh động (tag là biến) ⇒ phải vào PHẦN ĐỘNG, KHÔNG được kết luận 'không có h1'",
    check: (a, r) => ({
      ok: r.dynamic.some((d) => d.kind === "tag-local-variable") && r.verdict === VERDICT.KHONG_TIM_THAY_H1__CO_PHAN_DONG && r.h1.length === 0,
      detail: `verdict=${r.verdict}, dyn=${r.dynamic.length}, tag-local-variable=${r.dynamic.filter((d) => d.kind === "tag-local-variable").length}`,
    }),
  },
  {
    dir: "case-03-unresolved-import",
    mustCatch: "unresolved-import",
    why: "import trỏ tới file không tồn tại ⇒ KHÔNG VERIFY DUOC, không phải 'không có h1'",
    check: (a) => ({ ok: a.stats.unresolvedImports === 1, detail: `unresolvedImports=${a.stats.unresolvedImports} (mong đợi 1)` }),
  },
  {
    dir: "case-04-multiline-alias-transitive",
    mustCatch: null,
    why: "h1 dạng nhiều dòng qua alias `const e = createElement`, nằm 3 tầng sâu (AC-3.2 + AC-3.3)",
    check: (a, r) => {
      const ml = r.h1Render.find((h) => h.multiLine);
      return { ok: r.h1Render.length === 1 && !!ml && r.renderSize >= 3, detail: `h1Render=${r.h1Render.length} (mong đợi 1), shape=${ml?.shape ?? "KHÔNG có"} multiLine=${ml?.multiLine}, renderSize=${r.renderSize} (mong đợi ≥3)` };
    },
  },
  {
    dir: "case-05-h1-in-comment-and-string",
    mustCatch: null,
    why: "<h1> trong JSDoc + trong string ⇒ KHÔNG được đếm (chống false positive)",
    check: (a, r) => ({
      ok: r.h1.length === 1 && /RealHeading/.test(r.h1[0].file),
      detail: `h1=${r.h1.length} (mong đợi 1), nguồn=${r.h1[0] ? rel(r.h1[0].file) : "—"} (mong đợi chứa RealHeading)`,
    }),
  },
  {
    dir: "case-06-entry-not-main",
    mustCatch: null,
    why: "entry là boot.tsx KHÔNG phải main.tsx; main.tsx có h1 nhưng không được nạp ⇒ h1=1 không phải 2 (hazard 7)",
    check: (a, r) => {
      const fromMain = r.h1.some((h) => /main\.tsx$/.test(rel(h.file)));
      return { ok: /boot\.tsx$/.test(rel(a.entry)) && r.h1.length === 1 && !fromMain, detail: `entry=${rel(a.entry)} (mong đợi boot.tsx), h1=${r.h1.length} (mong đợi 1), h1 từ main.tsx=${fromMain} (mong đợi false)` };
    },
  },
  {
    dir: "case-08-mask-regex-in-template",
    mustCatch: null,
    why: "regression masker: regex literal chứa dấu nháy bên trong `${ … }` (`.replace(/\"/g', '\"\"')`) trước đây làm mất mọi `<h1>` phía sau, KHÔNG cảnh báo",
    check: (a, r) => ({
      ok: r.h1Render.length === 1 && /RouteAfterTemplate\.js/.test(r.h1Render[0]?.file ?? ""),
      detail: `h1Render=${r.h1Render.length} (mong đợi 1), file=${r.h1Render[0] ? rel(r.h1Render[0].file) : "—"}`,
    }),
  },
  {
    dir: "case-07-dead-registry-entry",
    mustCatch: "unreferenced-registry-entry",
    why: "registry khai 2 entry, entry chỉ dùng 1 ⇒ phải BÁO entry chết, không âm thầm bỏ",
    check: (a) => ({ ok: a.registry.count === 2 && a.unreferencedRegistryIds.length === 1 && a.unreferencedRegistryIds[0] === "orphan", detail: `registry=${a.registry.count} (mong đợi 2), unreferenced=${JSON.stringify(a.unreferencedRegistryIds)}` }),
  },
];

function runSelfTest() {
  console.log("── self-test: BẰNG CHỨNG ÂM (fixture phải làm gate ĐỎ; control phải XANH) ──");
  console.log(`   fixtures: ${rel(FIXTURES_DIR)}`);
  console.log("");
  let bad = 0;
  for (const c of CASES) {
    const dir = path.join(FIXTURES_DIR, c.dir);
    const viteConfigPath = path.join(dir, "vite.config.ts");
    if (!fs.existsSync(viteConfigPath)) {
      console.log(`  FAIL  ${c.dir} — fixture không tồn tại (${rel(viteConfigPath)})`);
      bad++;
      continue;
    }
    const a = analyze({ viteConfigPath, registryPath: path.join(dir, "src", "pages", "pageRegistry.js") });
    const violations = findViolations(a);
    const caught = c.mustCatch ? violations.filter((v) => v.kind === c.mustCatch).length : 0;
    const r = a.ok ? a.routes[0] : null;
    const extra = a.ok && r ? c.check(a, r) : { ok: false, detail: "analyze() không trả về route" };

    const ok = c.mustCatch ? caught > 0 : violations.length === 0 && extra.ok;
    if (!ok) bad++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.dir}`);
    console.log(`         lý do : ${c.why}`);
    if (c.mustCatch) {
      console.log(`         âm     : violations=${violations.length} (mong đợi >0 ⇒ exit ${1}), loại "${c.mustCatch}" bắt ${caught}`);
    } else {
      console.log(`         dương  : violations=${violations.length} (mong đợi 0 ⇒ exit 0)`);
      console.log(`         kiểm   : ${extra.detail}${extra.ok ? "" : "   ← SAI"}`);
    }
    for (const v of violations) console.log(`           - [${v.kind}] ${v.detail}`);
  }
  console.log("");
  if (bad > 0) {
    console.error(`✗ self-test FAIL — ${bad}/${CASES.length} fixture KHÔNG đạt`);
    process.exit(1);
  }
  console.log(`✓ self-test PASS — ${CASES.length}/${CASES.length} fixture (4 âm + 4 dương)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { flags: new Set(), appDir: null, registry: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--app-dir") out.appDir = argv[++i];
    else if (a === "--registry") out.registry = argv[++i];
    else if (a.startsWith("--")) out.flags.add(a.slice(2));
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.has("help")) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
    return;
  }
  if (args.flags.has("self-test")) return runSelfTest();

  const viteConfigPath = args.appDir ? path.resolve(args.appDir) : DEFAULT_VITE_CONFIG;
  const a = analyze({ viteConfigPath, registryPath: args.registry ? path.resolve(args.registry) : undefined });

  if (args.flags.has("json")) {
    console.log(a.ok ? JSON.stringify(toJson(a), null, 2) : JSON.stringify({ tool: "check-h1-graph", ok: false, notes: a.notes }, null, 2));
  } else if (!a.ok) {
    console.error("✗ check-h1-graph — KHÔNG phân tích được entry point:");
    for (const n of a.notes) console.error(`   ${n}`);
  } else if (args.flags.has("list-routes")) {
    for (const r of a.routes) console.log(`${r.routeId}\t${r.status}\t${rel(a.registry.path)}:${r.line}\t${r.entryFile ? rel(r.entryFile) : KHONG_VERIFY}\t${r.verdict}`);
  } else {
    console.log(printReport(a));
  }

  if (!a.ok) process.exit(1);

  if (args.flags.has("gate")) {
    const v = findViolations(a);
    if (v.length) {
      console.error("");
      console.error(`✗ check-h1-graph --gate — FAIL (${v.length} vi phạm)`);
      for (const x of v) console.error(`   [${x.kind}] ${x.detail}`);
      process.exit(1);
    }
    console.log("");
    console.log(`✓ check-h1-graph --gate — PASS (0 vi phạm; ${a.routes.length} route)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();