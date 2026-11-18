import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectUniqueSortedSymbols } from "../../utils/dashboardSymbols.js";

const pagePath = resolve(process.cwd(), "src/pages/DashboardPage.tsx");

describe("P0-6 — auto-select mã đầu tiên (không lấy 1 ký tự)", () => {
  it("helper trả chuỗi '|' → split('|')[0] mới lấy đúng mã", () => {
    const token = collectUniqueSortedSymbols([{ symbol: "FPT" }], [{ symbol: "ACB" }], [], []);
    expect(token).toBe("ACB|FPT");
    expect(token.split("|")[0]).toBe("ACB");
    expect(token[0]).toBe("A");
  });

  it("call-site DashboardPage.tsx dùng split('|')[0], KHÔNG đánh index thẳng vào chuỗi", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).toMatch(/collectUniqueSortedSymbols\([^;]*?\)\.split\('\|'\)\[0\]/s);
    expect(src).not.toMatch(/collectUniqueSortedSymbols\([^)]*\)\[0\]/);
  });
});
