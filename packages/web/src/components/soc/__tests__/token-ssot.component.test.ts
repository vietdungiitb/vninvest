import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 13 tên semantic bị khai ở cả base layer — W0 phải đưa về 0. */
export const BASE_TOKENS = [
  "--text-primary", "--text-secondary", "--text-muted", "--accent-cyan",
  "--bg-panel", "--bg-panel-soft", "--border-default", "--font-sans",
  "--fs-xs", "--fs-sm", "--fs-md", "--shadow-sm", "--shadow-md",
] as const;

/** 6 light override cũ cần dời sang owner (không gồm --accent-cyan / --text-muted). */
export const LIGHT_KEYS = [
  "--text-primary", "--text-secondary", "--border-default",
  "--bg-panel", "--bg-panel-soft",
] as const;

/** O-24/O-25: 2 tên này KHÔNG được khai trong light block. */
export const FORBIDDEN_LIGHT = ["--accent-cyan", "--text-muted"] as const;

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const declareRe = (n: string) => new RegExp("(?<![-\\w])" + n + "\\s*:");

function splitBlocks(css: string) {
  const cut = css.indexOf(':root[data-theme="light"]');
  const base = stripComments(cut < 0 ? css : css.slice(0, cut));
  const light = stripComments(cut < 0 ? "" : css.slice(cut));
  return { base, light };
}

// vitest chạy với cwd = packages/web (vitest.config.ts); không dùng import.meta.url
// vì trong bản transform của vitest nó không phải scheme `file:`.
const soc = splitBlocks(readFileSync("src/components/soc/soc.tokens.css", "utf8"));
const theme = splitBlocks(readFileSync("src/theme/tokens.css", "utf8"));

describe("SOC/theme token SSOT (W0)", () => {
  it("control âm/dương của detector phải đúng trước khi dùng", () => {
    expect(declareRe("--bg-panel").test("--bg-panel: red;")).toBe(true);
    expect(declareRe("--bg-panel").test(stripComments("/* --bg-panel: red; */"))).toBe(false);
    expect(declareRe("--bg-panel").test("--soc-bg-panel: red;")).toBe(false);
  });

  it("soc.tokens.css base block không khai lại 13 tên dùng chung", () => {
    for (const name of BASE_TOKENS) {
      expect(soc.base.match(declareRe(name)), `${name} phải có 1 owner duy nhất`).toBeNull();
    }
  });

  it("5 light key nằm ở theme/tokens.css light block", () => {
    for (const name of LIGHT_KEYS) {
      expect(theme.light, `${name} light value phải ở owner`).toMatch(declareRe(name));
    }
  });

  it("O-24: --text-on-accent light = #0f172a; --accent-cyan KHÔNG override light", () => {
    expect(theme.light).toMatch(/--text-on-accent:\s*#0f172a/);
    for (const f of ["--accent-cyan", "--text-muted"]) {
      expect(theme.light, `${f} không được khai ở light block`).not.toMatch(declareRe(f));
    }
  });

  it("R3: soc.tokens.css light block cũng không còn --accent-cyan/--text-muted", () => {
    for (const f of FORBIDDEN_LIGHT) {
      expect(soc.light, `${f} phải đã dời/xoá khỏi SOC light`).not.toMatch(declareRe(f));
    }
  });
});
