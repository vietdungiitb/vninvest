/**
 * W0.9 / W1.4 / W2.1 — "mo khoa du lieu chart dang bi tat trong chinh repo".
 *
 * D1 (Owner 2026-10-21): retail mua "charts" la nhu cau #1. Widget
 * `vninvestcharts-widget@1.2.5` co san 59 indicator + tape panel + workspace
 * toolbar, nhung app chi truyen 7 series va 3 flag `show*` = false.
 *
 * Test nay QUET NGUON (khong render widget) — cung pattern voi
 * `commercial-page.component.test.tsx` trong repo. Ly do: widget la npm package
 * ngoai repo, khong mock duoc trong vitest jsdom ma van assert duoc HOP DONG
 * prop ma app truyen cho widget.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL_SRC = resolve(HERE, "..", "VNStockChartPanel.js");
const VI_I18N = resolve(HERE, "..", "..", "i18n", "vi.js");
const EN_I18N = resolve(HERE, "..", "..", "i18n", "en.js");

const src = readFileSync(PANEL_SRC, "utf8");
const vi = readFileSync(VI_I18N, "utf8");
const en = readFileSync(EN_I18N, "utf8");

describe("W0.9 — chart data unlock (tape + workspace toolbar + pane chi bao)", () => {
  it("S1 — bat showTapePanel (du lieu tick THAT co san o BE)", () => {
    expect(src).toMatch(/showTapePanel:\s*true/);
    expect(src).not.toMatch(/showTapePanel:\s*false/);
  });

  it("S2 — bat showWorkspaceToolbar (co prop nay trong type decl widget)", () => {
    expect(src).toMatch(/showWorkspaceToolbar:\s*true/);
  });

  it("S3 — co pane 'indicators' voi >= 6 indicator mac dinh", () => {
    const start = src.indexOf("id: 'indicators'");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("\n    },", start) > 0 ? src.indexOf("\n    },", start) : start + 4000);
    const seriesCount = (block.match(/type:\s*'/g) || []).length;
    expect(seriesCount).toBeGreaterThanOrEqual(6);
  });

  it("S4 — label i18n 'chartIndicators' co o CA vi.js va en.js", () => {
    expect(vi).toMatch(/chartIndicators:/);
    expect(en).toMatch(/chartIndicators:/);
  });

  it("S5 — KHONG bat showCorporateEvents khi BE chua co nguon du lieu (khong bat mu)", () => {
    expect(src).toMatch(/showCorporateEvents:\s*false/);
    // Comment ghi "corporate actions" (BE chua co nguon du lieu) — khop Y DO test:
    // "co comment giai thich", khong khop mot cum tieng Anh cu the.
    expect(src).toMatch(/corporate (events|actions)/i);
  });
});
