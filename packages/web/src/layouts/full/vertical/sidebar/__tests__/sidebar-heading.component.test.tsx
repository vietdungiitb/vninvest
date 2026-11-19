import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const H1_RE = /(?:['"]h1['"]|<h1[\s/>])/;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Sidebar brand không được là <h1>", () => {
  it("Sidebar.tsx không render heading level 1", () => {
    const src = strip(readFileSync("src/layouts/full/vertical/sidebar/Sidebar.tsx", "utf8"));
    expect(H1_RE.test(src)).toBe(false);
  });

  it("control dương: detector bắt được h1 thật", () => {
    expect(H1_RE.test("e('h1', {}, 'Brand')")).toBe(true);
    expect(H1_RE.test("<h1>Brand</h1>")).toBe(true);
  });
});
