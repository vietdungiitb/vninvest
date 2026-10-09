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
import {
  codeLines,
  isCommentLine,
  nav1Candidate,
  urlSyncedVars,
} from "./nav1-rule.mjs";

const ROOT = process.argv[2] ?? "packages/web/src";
const EXTS = new Set([".tsx", ".jsx", ".ts", ".js", ".css"]);
const SKIP_DIR = new Set(["node_modules", "__tests__", "tests", "__mocks__"]);

/**
 * Dòng comment: `//`, `*`, `/*`, `<!--`.
 *
 * ⚠ WAVE 4 (2026-10-09): hàm này đã **chuyển** sang `nav1-rule.mjs` và được
 * import từ đó, để scanner và `nav1-report.mjs` dùng CHUNG một bản. Trước đây
 * có 2 bản trong 2 file — nguyên nhân gốc của loạt "số dòng lệch".
 *
 * PHẢI theo dõi TRẠNG THÁI comment nhiều dòng `/* … *\/`, không chỉ prefix:
 * dòng nằm GIỮA `/*` và `*\/` không bat dau bang `*` (vd "  thuoc tinh nay…")
 * nen scanner dem nham - da gap o comment CSS vua viet trong slice UX-02.
 */

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
      // WAVE 4 (2026-10-09, Major 1): escape CHUYỂN TỪ CẤP FILE → CẤP BIẾN.
      //
      // Bản cũ dùng `ctx.fileHasUrlSync` — quét TOÀN BỘ text của file kể cả
      // comment, nên (a) 1 dòng comment nhắc tên hook làm mất MỌI hit NAV-1
      // trong file, và (b) 1 biến đã sync làm che luôn các biến CHƯA sync.
      // Cả hai đều làm gate yếu đi mà không ai báo.
      //
      // Nay chỉ bỏ qua khi biến đó **thật sự** là key của hook URL, và bằng
      // chứng chỉ đọc từ dòng KHÔNG phải comment. Chi tiết + hạn số biết:
      // `nav1-rule.mjs`. Số đo trước/sau: `nav1-report.mjs --why`.
      const cand = nav1Candidate(ctx.line, ctx.urlSynced ?? new Map());
      if (!cand) return null;
      return `${cand.hook}("${cand.name}") khong dong bo URL  → mat deep-link  (${ctx.rel})`;
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
  // W3-0 (2026-10-08): giu CHI SO DONG THAT cung voi mang da loc.
  //
  // Truoc day chi con `lines = raw.filter(...)` roi in `i + 1` => moi
  // `file:line` in ra lech, dung bang so dong comment dung truoc vi tri do
  // (do `lines` khong con chua dong comment nua). Do lech tich luy toi 36 dong
  // tren `WhaleBubbleChart.jsx`. Day la nguyen nhan goc cua nhieu lan "sai so".
  //
  // PHAI giu `lines` da loc nguyen ven: `prev6`/`next6`/`block`/`next1..3`
  // duoc tinh tren mang da loc (dong 306-341). Bo `.filter` se lam cua so +-6
  // chua ca dong comment => rule A11Y-9 (dong nay tim `<label` trong +-6) doi
  // ket qua => COUNT doi => gate doi hanh vi. AC-0.2 khoa 11 rule count.
  const kept = [];
  raw.forEach((l, idx) => {
    if (!isCommentLine(l, cState)) kept.push({ t: l, n: idx + 1 });
  });
  const lines = kept.map((k) => k.t);
  const trueLine = kept.map((k) => k.n);
  const rel = f.replace(/\\/g, "/").replace(/^packages\/web\//, "");
  const base = {
    file: f, rel, isCss, lines, fileText: txt,
    // noi dung moi rule co chua `:focus` — dung cho luat A11Y-8
    focusBlocks: [...txt.matchAll(/([^{}]*:focus[^{}]*)\{([^{}]*)\}/g)].map((m) => m[2]),
    fileHasReducedMotion: /prefers-reduced-motion/.test(txt),
    fileHasTabular: /tabular-nums|fontVariantNumeric/.test(txt),
    // WAVE 4 (Major 1): bien nao THAT SU la key cua hook URL. Tinh tren
    // `lines` — mang DA LOAI COMMENT — nen comment khong the nhien dan sai.
    // Thay cho `fileHasUrlSync` cap file (da bo, xem comment o rule NAV-1).
    urlSynced: urlSyncedVars(lines),
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
      if (isTestFile(f)) { skippedTests.push({ rule: r.id, file: rel, line: trueLine[i] }); continue; }
      findings.push({ rule: r.id, prio: r.prio, name: r.name, file: rel, line: trueLine[i], src: out });
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

// ── SELF-TEST (WAVE 4, Major 1) ────────────────────────────────────────────
// Chay: node docs/audit-uiux/scripts/scan-ui-guidelines.mjs <root> --self-test
//
// Gate chi duoc tin khi DA THAY NO BAT VI PHAM. 2 truong hop duoi day chinh la
// 2 bug da xay ra that cua ban escape CAP FILE:
//
//   T1 (a) 1 dong COMMENT chua ten hook → ton tai o CODE, phai KHONG che hit.
//   T2 (b) file goi hook cho bien A     → khong duoc che hit bien B chua sync.
//   T3      bien THAT SU la key hook URL → phai duoc che (escape CAP BIEN hoat dong).
//
// Self-test chay tren TEXT do bo vao trong RAM, khong tao file, khong can root.
if (process.argv.includes("--self-test")) {
  const cases = [];
  const scan = (src) => {
    const { lines, trueLine } = codeLines(src);
    const synced = urlSyncedVars(lines);
    const hits = [];
    lines.forEach((l, i) => {
      const c = nav1Candidate(l, synced);
      if (c) hits.push(c.name);
    });
    return { hits, synced, trueLine };
  };

  // T1: comment chua `useUrlValue` KHONG duoc che `filterStatus` that.
  {
    const r = scan([
      "// ban doan nay co useUrlValue/useSearchParams trong comment",
      "/* useUrlValue('x') o day la COMMENT, khong phai code */",
      "export function P() {",
      "  const [filterStatus, setFilterStatus] = useState('all');",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T1 comment chua ten hook khong che hit",
      pass: r.hits.includes("filterStatus"),
      detail: `hits=[${r.hits.join(",")}] — mong doi co "filterStatus"`,
    });
  }

  // T2: bien A da sync KHONG duoc che bien B chua sync cung file.
  {
    const r = scan([
      "export function P() {",
      "  const [sortCol, setSortCol] = useUrlValue('sort', stringCodec, '');",
      "  const [globalFilter, setGlobalFilter] = useState('');",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T2 bien A da sync khong che bien B chua sync",
      pass: r.hits.includes("globalFilter") && !r.hits.includes("sortCol"),
      detail: `hits=[${r.hits.join(",")}] — mong doi co "globalFilter", KHONG co "sortCol"`,
    });
  }

  // T3: escape cap BIEN van hoat dong (khong lam rule te hon).
  {
    const r = scan([
      "export function P() {",
      "  const [globalFilter, setGlobalFilter] = useUrlValue('q', stringCodec, '');",
      "  const [page, setPage] = useState(1);",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T3 escape cap bien van hoat dong",
      pass: r.hits.includes("page") && !r.hits.includes("globalFilter"),
      detail: `hits=[${r.hits.join(",")}] — mong doi co "page", KHONG co "globalFilter"`,
    });
  }

  // T4: comment O TRUOC hit khong lam lech so dong (W3-0 AC-0.1) — dang comment
  // loc ra khoi mang nen chi so phai giu lai, khong in `i + 1`.
  {
    const { trueLine } = codeLines([
      "// comment 1",
      "const keepMe = 1;",
      "const [filterStatus, setFilterStatus] = useState('all');",
    ].join("\n"));
    cases.push({
      id: "T4 so dong that khong lech o comment",
      pass: trueLine[0] === 2 && trueLine[1] === 3,
      detail: `trueLine=${JSON.stringify(trueLine)} — mong doi [2,3] (neu in "i+1" se ra [1,2])`,
    });
  }

  // T5 — ĐÂY mới là bằng chứng THẬT cho AC-4.2(a), và T1 ở trên KHÔNG đủ.
  //
  // ⚠ T1 kiểm tra *đường ống* (comment đã bị `codeLines` lọc trước khi
  // `urlSyncedVars` kịp thấy) ⇒ T1 **tautology**: nó xanh kể cả khi
  // `urlSyncedVars` đọc trên text thực. Đo được 2026-10-09: cố tình làm hỏng
  // `urlSyncedVars` (cho nó tự `split` text thay vì nhận mảng đã lọc) thì T1
  // **vẫn PASS 4/4** — tức gate bảo vệ sai thứ.
  //
  // T5 gọi `urlSyncedVars` TRỰC TIẾP với text còn nguyên comment, và đòi nó
  // **không** nhận ra hook call nằm trong comment. Đây mới là hợp đồng của hàm.
  {
    const raw = [
      "// canh bao: neu them useUrlValue('sort') vao day thi se hong",
      "/* const [sortCol, setSortCol] = useUrlValue('sort'); */",
      " * useUrlValue('q') trong JSDoc khong phai code",
      "const [filterStatus, setFilterStatus] = useState('all');",
    ].join("\n");
    const synced = urlSyncedVars(raw.split(/\r?\n/));
    cases.push({
      id: "T5 urlSyncedVars BO QUA hook call nam trong comment",
      pass: synced.size === 0 && !synced.has("sortCol"),
      detail: `synced=[${[...synced.keys()].join(",")}] — mong doi RONG (comment khong phai code)`,
    });
  }

  // T6 — WAVE 5: nhanh `|q` RONG trong `NAME_RE` khop BAT KY tu chua chu `q`.
  // Do duoc 2026-10-09 bang `nav1-classify.mjs`: 12/104 hit la false positive
  // thuoc loai nay (`quantity` · `orderQuantity` · `queueTiers`×5 · `quotesBySymbol`
  // · `selectedRequestId` · `quota` · `quotas`).
  //
  // ⚠ Test nay **FAIL o ban rule cu** va PASS o ban da sua — la bang chung
  // fail-before. Khong co no thi "da sua" chi la cam tinh.
  {
    const r = scan([
      "export function P() {",
      "  const [quantity, setQuantity] = useState(0);",
      "  const [queueTiers, setQueueTiers] = useState([]);",
      "  const [page, setPage] = useState(1);",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T6 nhanh `|q` rong: quantity/queueTiers KHONG phai bo loc",
      pass: r.hits.includes("page") && !r.hits.includes("quantity") && !r.hits.includes("queueTiers"),
      detail:
        `hits=[${r.hits.join(",")}] — mong doi co "page", ` +
        `KHONG co "quantity"/"queueTiers" (chua "q"/"que" ma khong phai tim kiem)`,
    });
  }

  // T7 — `q` VAN PHAI BAT khi no la bien that. T6 kiem "khong bat qua"; test nay
  // kiem chua sua nuao lam rule **yeu** di (lesson `HANDOFF_UIUX_WAVE3` §4.2).
  //
  // ⚠ `qValue` them vao sau khi do THAT: ban sua dau tien dung `q(?![a-z])` ben
  // trong regex co co `i` ⇒ `[a-z]` khop ca chu hoa ⇒ `qValue` **khong con
  // bi bat**. Do la thay doi "giam false positive" lam rule YEU — test nay bat
  // duoc truoc khi no xay ra.
  {
    const r = scan([
      "export function P() {",
      "  const [q, setQ] = useState('');",
      "  const [qValue, setQValue] = useState('');",
      "  const [statusFilter, setStatusFilter] = useState('all');",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T7 bien `q` that (q · qValue) VAN bi bat",
      pass: r.hits.includes("q") && r.hits.includes("qValue") && r.hits.includes("statusFilter"),
      detail: `hits=[${r.hits.join(",")}] — mong doi co "q", "qValue" VA "statusFilter"`,
    });
  }

  // T8 — `useSearchParams`/`useRouterSearchParams` LA co che doc URL ⇒ `searchParams`
  // KHONG phai "bo loc khong dong bo URL". Do duoc 2026-10-09: 3 hit trong
  // `ShellOperationsCenterPage.tsx:40`, `ScreenerPage.tsx:158`, `SupportPage.tsx:47`.
  {
    const r = scan([
      "export function P() {",
      "  const [searchParams, setSearchParams] = useRouterSearchParams();",
      "  const [statusFilter, setStatusFilter] = useState('all');",
      "  return null;",
      "}",
    ].join("\n"));
    cases.push({
      id: "T8 escape `searchParams` tu useRouterSearchParams",
      pass: !r.hits.includes("searchParams") && r.hits.includes("statusFilter"),
      detail:
        `hits=[${r.hits.join(",")}] — mong doi KHONG co "searchParams" ` +
        `(no la URL), VAN co "statusFilter"`,
    });
  }

  console.log("");
  let ok = 0;
  for (const c of cases) {
    if (c.pass) ok += 1;
    console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.id}`);
    console.log(`         ${c.detail}`);
  }
  console.log("");
  if (ok !== cases.length) {
    console.error(`✗ self-test FAIL — ${cases.length - ok}/${cases.length} truong hop KHONG bat duoc`);
    process.exit(1);
  }
  console.log(`✓ self-test PASS (${ok}/${cases.length})`);
}
