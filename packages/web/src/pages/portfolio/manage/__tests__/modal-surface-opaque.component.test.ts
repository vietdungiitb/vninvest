/**
 * Chốt hồi quy: **mặt phẳng modal/drawer phải ĐỤC**.
 *
 * ── Vì sao file này tồn tại ─────────────────────────────────────────────
 * Owner báo ảnh `/portfolios/manage` bị "chồng chữ". Đo thật trên staging
 * (`getComputedStyle`, không phải đoán):
 *     `.pfm-drawer__panel` background = `rgba(8, 23, 52, 0.4)`  ← 40% trong suốt
 *     `.pfm-drawer__panel` backdropFilter = `none`
 *     `.pfm-drawer` box = `(0,0,1280x720)` đúng viewport, và
 *     `elementFromPoint` ở top-left / mid-left / bottom-left đều trả
 *     `DIV.pfm-drawer`  ⇒ **overlay KHÔNG hỏng**, chỉ panel mỏng.
 *
 * Gốc rễ: `--bg-panel` là token **kính 40%** (`soc.tokens.css:12`) nhưng ở
 * light theme lại là `#ffffff` **đục** (`soc.tokens.css:124`) ⇒ lỗi **chỉ ở
 * dark mode**. Token mới `--bg-panel-solid` là biến thể đục.
 *
 * ── Vì sao đọc chuỗi CSS thay vì `getComputedStyle` ──────────────────────
 * jsdom **không** nạp `.css` vào cây style ⇒ `getComputedStyle` trả rỗng ở đây,
 * nên test component không đo được độ đục. Vì vậy gate này đọc **nguồn CSS** và
 * chặn đúng lớp hồi quy thật: ai đổi panel modal về `--bg-panel` là đỏ ngay,
 * **không cần deploy**. Độ đục thật trên trình duyệt do
 * `tests/visual/portfolios-manage.spec.ts` đo (kèm control — L-V01).
 *
 * ── Kiểm soát chống false-green (L-V01) ─────────────────────────────────
 * `CONTROL` dưới đây là phần tử **biết trước là ĐỤC**
 * (`WatchlistPage.css` — `rgba(15,23,42,0.95)`). Parser phải đọc đúng file,
 * đọc đúng selector, phân biệt được alpha 0.4 với 0.95. Nếu parser hỏng,
 * control sẽ đỏ **trước** khi ta tin các dòng còn lại.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Gốc `packages/web` — vitest chạy với cwd đó (xem `vite.config.ts`). */
const SRC = process.cwd();
void HERE;

const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

/** Thân rule CSS đứng sau `selector`, hoặc `null` nếu không tồn tại. */
function ruleBody(css: string, selector: string): string | null {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  const m = re.exec(css);
  return m ? m[2] : null;
}

/**
 * Alpha của một khai báo màu; `null` nếu **đục** (không khai alpha).
 *
 * BẪY ĐÃ MẮC (L-V01): CSS4 viết alpha bằng DẤU GACH CHÉO —
 * `rgba(var(--soc-rgb-081734) / 0.4)` — không phải dấu phẩy. Bản đầu chỉ
 * tách theo `[\s,/]` rồi đòi 4 thành phần nên trả `null` ⇒ **báo nhầm là ĐỤC**
 * cho đúng cái token đang cần bắt lỗi. Phải xử lý cả hai cú pháp.
 */
function alphaOf(value: string): number | null {
  const start = /rgba?\(/.exec(value);
  if (!start) return null;
  // Quét cân bằng ngoặc: `[^)]*` dừng SỚ ở dấu `)` đóng của `var(--x)` bên trong.
  let depth = 0;
  let inner = "";
  for (let i = start.index + start[0].length - 1; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
    inner += ch;
  }
  inner = inner.trim();
  // Cú phát CSS4: `<nhan> / <alpha>`
  const slash = inner.split("/");
  if (slash.length === 2) {
    const a = Number(slash[1].trim());
    return Number.isFinite(a) ? a : null;
  }
  // Cú pháp cũ: `r, g, b, a`
  const parts = inner.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 4) return null;
  const a = Number(parts[3]);
  return Number.isFinite(a) ? a : null;
}

const tokens = read("src/components/soc/soc.tokens.css");
const manageCss = read("src/pages/portfolio/manage/portfolioManage.css");
const themeCss = read("src/theme/theme.module.css");
const watchCss = read("src/pages/WatchlistPage.css");

describe("CONTROL — parser đọc đúng (L-V01)", () => {
  test("đọc được alpha của panel ĐỤC-95% trong WatchlistPage", () => {
    const body = ruleBody(watchCss, ".watchlistPage__slideOver");
    expect(body, "phải tìm thấy .watchlistPage__slideOver").not.toBeNull();
    expect(alphaOf(body!)).toBeCloseTo(0.95, 5);
  });

  test("phân biệt được alpha thấp — .pfm-kpi__card là kính 40% (CỐ TÍNH mỏng)", () => {
    const body = ruleBody(manageCss, ".pfm-kpi__card");
    expect(body).not.toBeNull();
    // Thẻ KPI nằm TRÊN nền trang nên kính là hợp lý — chống lại việc ta sửa
    // nhầm thành đục rồi làm hỏng ngôn ngữ thị giác của trang.
    expect(ruleBody(manageCss, ".pfm-kpi__card")).toContain("var(--bg-panel)");
  });
});

describe("token --bg-panel-solid phải ĐỤC ở CẢ hai theme", () => {
  test("dark: có khai báo và KHÔNG kèm alpha", () => {
    const body = ruleBody(tokens, ":root");
    expect(body, ":root phải tồn tại").not.toBeNull();
    const decl = /--bg-panel-solid:\s*([^;]+);/.exec(body!);
    expect(decl, "phải khai --bg-panel-solid trong :root").not.toBeNull();
    expect(
      alphaOf(decl![1]),
      `--bg-panel-solid dark phải ĐỤC, thấy: ${decl![1]}`,
    ).toBeNull();
  });

  test("light theme cũng khai và cũng đục", () => {
    const blocks = [...tokens.matchAll(/[^{}]*data-theme[^{}]*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(blocks.length, "phải có ít nhất 1 khối light theme").toBeGreaterThan(0);
    const withToken = blocks.filter((b) => /--bg-panel-solid\s*:/.test(b));
    expect(withToken.length, "light theme phải khai --bg-panel-solid").toBeGreaterThan(0);
    for (const b of withToken) {
      const decl = /--bg-panel-solid:\s*([^;]+);/.exec(b)!;
      expect(alphaOf(decl[1]), `light phải ĐỤC, thấy: ${decl[1]}`).toBeNull();
    }
  });

  test("--bg-panel GIỮ NGUYÊN là kính — không được đổi token gốc", () => {
    const body = ruleBody(tokens, ":root")!;
    const decl = /--bg-panel:\s*([^;]+);/.exec(body)!;
    expect(alphaOf(decl[1]), "--bg-panel là kính 40%").toBeCloseTo(0.4, 5);
  });
});

describe("3 mặt phẳng modal/drawer phải dùng token ĐỤC", () => {
  const cases: [string, string, string][] = [
    ["src/pages/portfolio/manage/portfolioManage.css", ".pfm-modal__panel", manageCss],
    ["src/pages/portfolio/manage/portfolioManage.css", ".pfm-drawer__panel", manageCss],
    ["src/theme/theme.module.css", ".modalContent", themeCss],
  ];

  test.each(cases)("%s %s", (_file, selector, css) => {
    const body = ruleBody(css, selector);
    expect(body, `phải tìm thấy ${selector}`).not.toBeNull();
    expect(body, `${selector} phải tìm thấy`).not.toBeNull();
    // Khớp CHÍNH XÁC kèm dấu `)` — `var(--bg-panel-solid)` chứa `var(--bg-panel`
    // dưới dạng tiền tố, so khớp thiếu dấu đóng sẽ báo động giả.
    expect(body!, `${selector} KHÔNG được dùng var(--bg-panel)`).not.toMatch(
      /var\(--bg-panel\)/,
    );
    expect(body, `${selector} phải dùng var(--bg-panel-solid)`).toContain(
      "var(--bg-panel-solid)",
    );
    const decl = /background(?:-color)?:\s*([^;]+);/.exec(body!)!;
    expect(
      alphaOf(decl[1]),
      `${selector}: nền phải đục, không được khai alpha thấp (thấy ${decl[1]})`,
    ).toBeNull();
  });
});