/**
 * R1.1 — 13 token `--ai-*` phải khai báo ở `:root`, không nằm trong `.page`.
 *
 * Bối cảnh (aiSettings.module.css:51-64 @ 8b78660c): 13 token `--ai-*` khai
 * trong selector `.page` nên chỉ resolve khi có tổ tiên `.page`. Hub page
 * (AICommandCenterPage.tsx:187 root `shellPage`, dùng `var(--ai-border)` ở
 * :353/:387) KHÔNG có `.page` → border rơi về currentcolor. Ra `:root` vừa
 * sửa mất token toàn trang vừa chữa 2 chỗ hub.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = resolve(process.cwd(), "src/components/aiSettings.module.css");
const HUB_PAGE = resolve(process.cwd(), "src/pages/AICommandCenterPage.tsx");
const SUB_ROUTE_A = resolve(process.cwd(), "src/pages/AIAgentFederationPage.tsx");
const SUB_ROUTE_B = resolve(process.cwd(), "src/pages/AIUsageAnalyticsPage.tsx");

/** Đúng 13 token theo aiSettings.module.css:52-64. */
const AI_TOKENS = [
  "--ai-ink",
  "--ai-muted",
  "--ai-secondary",
  "--ai-accent",
  "--ai-accent-soft",
  "--ai-border",
  "--ai-border-strong",
  "--ai-surface",
  "--ai-surface-translucent",
  "--ai-shadow",
  "--ai-success",
  "--ai-danger",
  "--ai-warning",
] as const;

function readCss(): string {
  return readFileSync(CSS_PATH, "utf8");
}

/** Khai báo (`--x:`), khác cách dùng (`var(--x)`). */
function declarationsIn(src: string): string[] {
  return [...src.matchAll(/--ai-[a-z-]+(?=\s*:)/g)].map((m) => m[0]);
}

describe("R1.1: --ai-* tokens live on :root, not .page", () => {
  it("AC1: không còn khai báo --ai-* nào từ `.page` trở xuống", () => {
    const src = readCss();
    const pageIdx = src.indexOf(".page {");
    expect(pageIdx, "selector .page phải tồn tại (giữ layout rules)").toBeGreaterThan(-1);
    const afterPage = src.slice(pageIdx);
    expect(declarationsIn(afterPage), "token còn kẹt trong .page").toEqual([]);
  });

  it("AC1b: đủ 13 token khai báo ở :root (trước .page)", () => {
    const src = readCss();
    const beforePage = src.slice(0, src.indexOf(".page {"));
    const found = new Set(declarationsIn(beforePage));
    for (const t of AI_TOKENS) {
      expect(found.has(t), `thiếu ${t} ở :root`).toBe(true);
    }
    expect(found.size).toBe(AI_TOKENS.length);
  });

  it("AC2: --ai-border có giá trị khác rỗng (source contract — jsdom không load CSS module nên không assert computed)", () => {
    const src = readCss();
    const m = src.match(/--ai-border\s*:\s*([^;]+);/);
    expect(m, "--ai-border phải được khai báo").not.toBeNull();
    expect(m![1].trim().length).toBeGreaterThan(0);
  });

  it("AC3: override :root[data-theme=light] còn nguyên", () => {
    const src = readCss();
    expect(src.includes(':root[data-theme="light"]')).toBe(true);
    expect(src.includes("--ais-c-0b0f19: #f8fafc")).toBe(true);
  });

  it("AC4: styles.page chỉ còn ở 2 sub-route, hub không dùng", () => {
    const usesPage = (file: string): boolean =>
      /\bstyles\.page\b(?![A-Z])/.test(readFileSync(file, "utf8"));
    expect(usesPage(HUB_PAGE), "hub AICommandCenterPage không dùng styles.page").toBe(false);
    expect(usesPage(SUB_ROUTE_A), "AIAgentFederationPage giữ styles.page").toBe(true);
    expect(usesPage(SUB_ROUTE_B), "AIUsageAnalyticsPage giữ styles.page").toBe(true);
  });
});
