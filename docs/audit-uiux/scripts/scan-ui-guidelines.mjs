/**
 * Scanner UI/UX — phiên bản ĐÃ LỌC false positive.
 *
 * V1 (docs/audit-uiux/UIUX_AUDIT_20261007.md mục "phương pháp") đếm 1535 hit thô,
 * trong đó phần lớn KHÔNG phải lỗi:
 *   - `setLoading(true)` bị match nhầm bởi luật "loading state thiếu …"
 *   - `...` trong JSDoc/comment bị đếm như chữ hiển thị
 *   - `outline-none` đã có `focus:` thay thế vẫn bị đếm
 *   - `<Input` là component, label nằm ở dòng khác
 * V2 lọc bằng `isCommentLine` + kiểm tra ngữ cảnh trước khi đếm.
 *
 * Quy tắc: chỉ báo thứ máy đếm được VÀ không sai. Nghi vấn cần đọc hiểu thì
 * đánh dấu `REVIEW` chứ không đếm vào finding.
 *
 * Chạy:  node docs/audit-uiux/scripts/scan-ui-guidelines.mjs [root]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? "packages/web/src";
const EXTS = new Set([".tsx", ".jsx", ".ts", ".js", ".css"]);
const SKIP_DIR = new Set(["node_modules", "__tests__", "tests", "__mocks__"]);

/**
 * Dòng comment: `//`, `*`, `/*`, `<!--`.
 *
 * PHẢI theo dõi TRẠNG THÁI comment nhiều dòng `/* … *\/`, không chỉ prefix:
 * dòng nằm GIỮA `/*` và `*\/` không bat dau bang `*` (vd "  thuoc tinh nay…")
 * nên scanner dem nham - da gap o comment CSS vua viet trong slice UX-02.
 */
function isCommentLine(line, state) {
  const t = line.trim();
  if (state.inBlock) {
    if (t.includes("*/")) state.inBlock = false;
    return true;
  }
  if (t.startsWith("//") || t.startsWith("<!--")) return true;
  if (t.startsWith("/*")) {
    if (!t.includes("*/")) state.inBlock = true;
    return true;
  }
  if (t.startsWith("*")) return true;
  if (/^https?:\/\//.test(t)) return true;
  return false;
}

function isTestFile(f) {
  return /\.(test|spec)\./.test(path.basename(f));
}

const RULES = [
  {
    id: "A11Y-1", prio: "P0",
    name: "icon-only button thiếu accessible name",
    check(ctx) {
      if (!/<button\b/.test(ctx.line)) return null;
      const hasSvg = /<svg\b/.test(ctx.next3.join(" "));
      if (!hasSvg) return null;
      const block = ctx.block;
      if (/aria-label|aria-labelledby/.test(block)) return null;
      if (!/>\s*<svg/.test(ctx.line + ctx.next1[0])) return null;
      return `${ctx.line.trim()}  → button chỉ có <svg>, không aria-label`;
    },
  },
  {
    id: "A11Y-2", prio: "P1",
    name: "svg trong button chưa aria-hidden",
    check(ctx) {
      const i = ctx.line.search(/<svg(?![^>]*aria-hidden)/);
      if (i === -1) return null;
      // svg nằm trong button thì phải ẩn khỏi AT (tên đến từ aria-label)
      const near = ctx.prev2.concat(ctx.line.slice(i)).join(" ");
      if (!/<button\b/.test(near) && !/aria-label/.test(ctx.block)) return null;
      return `${ctx.line.trim().slice(0, 130)}  → <svg> thiếu aria-hidden="true"`;
    },
  },
  {
    id: "A11Y-3", prio: "P0",
    name: "<img> thiếu alt",
    check(ctx) {
      if (!/<img\b/.test(ctx.line)) return null;
      const block = ctx.block;
      if (/\balt=/.test(block)) return null;
      return `${ctx.line.trim()}  → <img> không có alt`;
    },
  },
  {
    id: "A11Y-4", prio: "P2",
    name: "<img> thiếu width/height (CLS)",
    check(ctx) {
      if (!/<img\b/.test(ctx.line)) return null;
      if (!/\bwidth=/.test(ctx.block) || !/\bheight=/.test(ctx.block)) {
        return `${ctx.line.trim()}  → <img> không khai width/height`;
      }
      return null;
    },
  },
  {
    id: "A11Y-5", prio: "P1",
    name: "<div>/<span> gắn onClick thay cho <button>",
    check(ctx) {
      const m = ctx.line.match(/<(div|span)\b[^>]*\bonClick=/);
      if (!m) return null;
      // overlay nền của modal/drawer là ngoại lệ hợp lệ (click để đóng)
      if (/drawerOverlay|absolute inset-0|backdrop-blur/.test(ctx.line)) return null;
      if (/role="(dialog|presentation|button)"/.test(ctx.line)) return null;
      return `${ctx.line.trim().slice(0, 130)}  → <${m[1]}> onClick, không phải <button>`;
    },
  },
  {
    id: "A11Y-6", prio: "P2",
    name: "tabIndex > 0",
    check(ctx) {
      const m = ctx.line.match(/tab[Ii]ndex=\{?["']?([1-9])/);
      return m ? `${ctx.line.trim()}  → tabIndex=${m[1]} đảo thứ tự Tab` : null;
    },
  },
  {
    id: "A11Y-7", prio: "P2",
    name: "autoFocus không giải thích",
    check(ctx) {
      return /\bautoFocus\b/.test(ctx.line) ? `${ctx.line.trim().slice(0, 120)}  → autoFocus` : null;
    },
  },
  {
    id: "A11Y-8", prio: "P1",
    name: "outline-none KHÔNG có focus thay thế",
    check(ctx) {
      if (!/outline-none|outline\s*:\s*none/.test(ctx.line)) return null;
      if (!ctx.isCss) {
        // JSX/TSX: Tailwind `outline-none` chỉ OK nếu cùng chỗ có `focus:`/`focus-visible:`
        const scope = ctx.line + ctx.next2.join(" ");
        if (/focus-visible|focus:|focusRing|ring-/.test(scope)) return null;
        // phần tử không focusable (panel, overlay, wrapper) => outline vô nghĩa
        if (/role="(dialog|presentation|none)"|aria-hidden/.test(ctx.block)) return null;
        return `${ctx.line.trim().slice(0, 130)}  → bỏ outline mà không có focus thay thế`;
      }
      // CSS: file co `outline: none` o dau do, va file KHONG co bat ky rule
      // `:focus` nao dat chi bao hien nhin thay (border-color / box-shadow /
      // outline). Do o MUC FILE chu khong phai selector tung dong: selector
      // nhieu phan tu (`.dnse-panel__field input`, `.domainPill`) lam matcher
      // theo ten don le that - da 6/7 false positive o cac file CSS cua repo.
      const focusBlocks = ctx.focusBlocks ?? [];
      const visible = focusBlocks.some((b) =>
        /border-color\s*:|box-shadow\s*:|outline\s*:/.test(b)
        && !/outline\s*:\s*none/.test(b));
      if (visible) return null;
      if (focusBlocks.length > 0) {
        // co :focus nhung khong doi gi => viet ro de nguoi doc quyet dinh
        return `${ctx.line.trim().slice(0, 120)}  → có :focus nhưng không đổi chỉ báo nhìn thấy`;
      }
      return `${ctx.line.trim().slice(0, 130)}  → bỏ outline mà không có :focus thay thế`;
    },
  },
  {
    id: "A11Y-9", prio: "P2",
    name: "thiếu <label>/aria-label cho control",
    check(ctx) {
      const m = ctx.line.match(/<(input|select|textarea)\b/i);
      if (!m) return null;
      // control native 1 dòng kèm id → label htmlFor hợp lệ
      if (/\bid=/.test(ctx.line) && !/type=["'](checkbox|radio)["']/.test(ctx.line)) return null;
      if (/aria-label|aria-labelledby/.test(ctx.line)) return null;
      // component wrapper <Input>/<Select> → label có thể ở component khác, đánh dấu review
      if (/<(Input|Select|Textarea|Checkbox|Switch)\b/.test(ctx.line)) return null;
      // tìm <label ...for="id"> trong ±6 dòng
      const win = ctx.prev6.concat(ctx.next6).join("\n");
      if (/<label\b/.test(win)) return null;
      return `${ctx.line.trim().slice(0, 120)}  → ${m[1]} không label/aria-label`;
    },
  },
  {
    id: "A11Y-10", prio: "P2",
    name: "input type=number/email/tel thiếu inputMode",
    check(ctx) {
      if (!/<input[^>]*type=["'](number|email|tel)["']/i.test(ctx.line)) return null;
      if (/inputMode/.test(ctx.line)) return null;
      return `${ctx.line.trim().slice(0, 120)}  → thiếu inputMode`;
    },
  },
  {
    id: "A11Y-11", prio: "P2",
    name: "input thiếu autocomplete",
    check(ctx) {
      if (!/<input\b/.test(ctx.line)) return null;
      if (!/type=["'](text|search|email|tel|number|url|password|date)["']/i.test(ctx.line)) return null;
      if (/autoComplete/.test(ctx.line)) return null;
      return `${ctx.line.trim().slice(0, 120)}  → thiếu autoComplete`;
    },
  },
  {
    id: "CSS-1", prio: "P1",
    name: "transition: all (anti-pattern)",
    check(ctx) {
      if (!ctx.isCss) return null;
      const m = ctx.line.match(/transition\s*:\s*all\b[^;]*/);
      return m ? `${ctx.line.trim().slice(0, 120)}  → liệt kê thuộc tính cụ thể` : null;
    },
  },
  {
    id: "CSS-2", prio: "P2",
    name: "transition/animation không kèm prefers-reduced-motion",
    check(ctx) {
      if (!ctx.isCss) return null;
      if (!/transition\s*:|animation\s*:|@keyframes/.test(ctx.line)) return null;
      if (/@media\s*\(prefers-reduced-motion/.test(ctx.fileHasReducedMotion ? "@media (prefers-reduced-motion)" : "")) return null;
      if (!ctx.fileHasReducedMotion) {
        return `${ctx.line.trim().slice(0, 110)}  → file không có prefers-reduced-motion`;
      }
      return null;
    },
  },
  {
    id: "TYPO-1", prio: "P3",
    name: 'chữ hiển thị dùng "..." thay vì "…"',
    check(ctx) {
      // chỉ trong chuỗi hiển thị: không phải comment, không phải URL/spread
      const m = ctx.line.match(/(?:"|'|`)([^"'`]*\.\.\.[^"'`]*)["'`]/);
      if (!m) return null;
      const s = m[1];
      if (/https?:|api\/|\/v1\/|\.map|\.\.\./.test(s)) return null;
      if (s.length < 4) return null;
      return `${ctx.line.trim().slice(0, 120)}  → dùng …`;
    },
  },
  {
    id: "TYPO-2", prio: "P2",
    name: "cột số thiếu font-variant-numeric: tabular-nums",
    check(ctx) {
      if (ctx.isCss || isTestFile(ctx.file)) return null;
      if (!/<table\b/.test(ctx.file)) return null;
      if (ctx.fileHasTabular) return null;
      return `file có <table> nhưng không tabular-nums  (${ctx.rel})`;
    },
    once: true,
  },
  {
    id: "TYPO-3", prio: "P3",
    name: "định dạng phần trăm tự chế thay vì Intl",
    check(ctx) {
      const m = ctx.line.match(/toFixed\(\d\)\s*\+\s*['"]%['"]/);
      return m ? `${ctx.line.trim().slice(0, 110)}  → dùng Intl.NumberFormat` : null;
    },
  },
  {
    id: "I18N-1", prio: "P2",
    name: "toLocale* không truyền locale (mặc định theo máy)",
    check(ctx) {
      if (!/toLocale(String|DateString|TimeString)\(\s*\)/.test(ctx.line)) return null;
      return `${ctx.line.trim().slice(0, 110)}  → truyền locale từ LangContext`;
    },
  },
  {
    id: "NAV-1", prio: "P1",
    name: "bộ lọc/sắp xếp/phân trang không đồng bộ URL",
    check(ctx) {
      if (ctx.isCss) return null;
      const m = ctx.line.match(/const\s*\[\s*(\w*(filter|search|sort|page|tab|query|q)\w*)\s*,/i);
      if (!m) return null;
      if (ctx.fileHasUrlSync) return null;
      return `useState("${m[1]}") không đồng bộ URL  → mất deep-link  (${ctx.rel})`;
    },
  },
  {
    id: "PERF-1", prio: "P2",
    name: "đọc layout trong thân render",
    check(ctx) {
      if (!/(getBoundingClientRect|offsetHeight|offsetWidth|scrollTop|scrollHeight)\s*\./.test(ctx.line)) return null;
      if (/useEffect|useLayoutEffect|useCallback|=>\s*\{/.test(ctx.line)) return null;
      return `${ctx.line.trim().slice(0, 110)}  → chuyển vào useLayoutEffect`;
    },
  },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const findings = [];
const skippedTests = [];

for (const f of files) {
  const txt = fs.readFileSync(f, "utf8");
  const isCss = f.endsWith(".css");
  const raw = txt.split(/\r?\n/);
  const cState = { inBlock: false };
  const lines = raw.filter((l) => !isCommentLine(l, cState));
  const rel = f.replace(/\\/g, "/").replace(/^packages\/web\//, "");
  const base = {
    file: f, rel, isCss, lines, fileText: txt,
    // noi dung moi rule co chua `:focus` — dung cho luat A11Y-8
    focusBlocks: [...txt.matchAll(/([^{}]*:focus[^{}]*)\{([^{}]*)\}/g)].map((m) => m[2]),
    fileHasReducedMotion: /prefers-reduced-motion/.test(txt),
    fileHasTabular: /tabular-nums|fontVariantNumeric/.test(txt),
    fileHasUrlSync: /useSearchParams|URLSearchParams|useNavigate|useLocation/.test(txt),
  };
  const doneOnce = new Set();

  lines.forEach((line, i) => {
    // block = cửa sổ ±8 dòng để kiểm label/alt có nằm gần hay không
    const win = (n) => lines.slice(Math.max(0, i - n), i + n + 1);
    const ctx = {
      ...base,
      line,
      index: i,
      // selector dang sua (CSS): doc nguoc dong hien tai tim dau `}` roi `.ten`
      selectorName: isCss ? (() => {
        for (let j = i; j >= 0 && j >= i - 40; j -= 1) {
          const m = /(?:^|\})\s*([^{}@]+?)\s*\{[^{}]*$/.exec(lines.slice(0, j + 1).join("\n"));
          if (m) {
            const nm = m[1].trim().split(/\s+|,|:is\(|:where\(/).pop();
            if (nm && /^[A-Za-z][\w-]*$/.test(nm)) return nm;
          }
        }
        return null;
      })() : null,
      block: win(8).join("\n"),
      next1: win(1).slice(1, 2),
      next2: win(2).slice(1),
      next3: win(3).slice(1),
      prev2: win(2).slice(0, -1),
      prev6: win(6).slice(0, -1),
      next6: win(6).slice(1),
    };
    for (const r of RULES) {
      if (r.once && doneOnce.has(r.id)) continue;
      let out = null;
      try { out = r.check(ctx); } catch { out = null; }
      if (!out) continue;
      doneOnce.add(r.id);
      if (isTestFile(f)) { skippedTests.push({ rule: r.id, file: rel, line: i + 1 }); continue; }
      findings.push({ rule: r.id, prio: r.prio, name: r.name, file: rel, line: i + 1, src: out });
    }
  });
}

const byRule = {};
for (const x of findings) (byRule[x.rule] ??= []).push(x);
const prio = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const x of findings) prio[x.prio] += 1;

console.log("=".repeat(80));
console.log("SCAN UI GUIDELINES v2 (đã lọc comment + ngữ cảnh) — root:", ROOT);
console.log("file quét:", files.length, "| bỏ qua dòng trong test:", skippedTests.length);
console.log("=".repeat(80));
for (const [rule, xs] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n## [${xs[0].prio}] ${rule} — ${xs.length} hit`);
  console.log(`   ${xs[0].name}`);
  for (const x of xs.slice(0, 8)) console.log(`   ${x.file}:${x.line}  ${x.src}`);
  if (xs.length > 8) console.log(`   … +${xs.length - 8} nữa`);
}
console.log(`\n${"-".repeat(80)}`);
console.log(`TONG = ${findings.length}   P0=${prio.P0} P1=${prio.P1} P2=${prio.P2} P3=${prio.P3}`);
console.log(`(bỏ qua trong file test: ${skippedTests.length})`);
