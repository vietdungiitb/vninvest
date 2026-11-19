import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGETS = [
  { path: "src/pages/admin/ShellOperationsCenterPage.tsx", greenAtBaseline: true },
  { path: "src/pages/AICommandCenterPage.tsx", greenAtBaseline: false },
  { path: "src/pages/DashboardPage.tsx", greenAtBaseline: false },
  { path: "src/pages/portfolio/PortfolioOverviewPage.tsx", greenAtBaseline: false },
  { path: "src/pages/admin/AdminUsersPage.tsx", greenAtBaseline: false },
] as const;

/** Strip comment trước khi detect — nếu không, comment ở AdminUsers:13 sẽ cho kết quả giả. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function detectH1(src: string): boolean {
  const s = stripComments(src);
  return /<h1[\s>]/.test(s)
    || /(?:createElement|renderElement|\be)\(\s*["']h1["']/.test(s);
}

function usesShellChrome(src: string): boolean {
  return /ShellPageChrome/.test(stripComments(src));
}

describe("W1 chrome — 4 route RED + 1 regression GREEN", () => {
  for (const t of TARGETS) {
    it(`${t.path}: ${t.greenAtBaseline ? "đã xanh (regression)" : "phải chuyển sang shell"}`, () => {
      const src = readFileSync(t.path, "utf8");
      const ok = usesShellChrome(src) && !detectH1(src);
      // Trạng thái đích: MỌI route dùng chrome và không tự render <h1>.
      // Baseline: 4 route RED, ShellOperationsCenterPage GREEN (regression guard).
      expect(ok, t.greenAtBaseline ? "regression hỏng" : "route chưa dùng chung chrome").toBe(true);
    });
  }

  it("control dương/âm của detector", () => {
    expect(detectH1('e("h1", {}, "x")')).toBe(true);
    expect(detectH1('// <h1>x</h1>\nconst y = 1')).toBe(false);
    expect(detectH1('renderElement("h1", {})')).toBe(true);
  });
});
