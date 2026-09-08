import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ShellPageChrome } from "../ShellPageTemplate.js";
import fs from "node:fs";

// P0-0 BLOCKER1 — runtime DOM contract (isolated, no FullLayout render due to @ alias complexity)
// FullLayout DOM check is via scripts/check-dom-landmarks.mjs static + Playwright runtime in P4
// Here we verify ShellPageChrome a11y contract isolated.

describe("DOM landmarks — P0-0 contract (Shell isolated) — HIGH1 fixed", () => {
  it("ShellPageChrome does NOT render <main>, renders region with auto a11y", () => {
    const { container } = render(
      <ShellPageChrome title="Pilot title" eyebrow="Pilot" description="desc">
        <div>child</div>
      </ShellPageChrome>
    );
    expect(container.querySelectorAll("main").length).toBe(0);
    expect(container.querySelector("main main")).toBeNull();
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    // auto-generated id when not provided (HIGH1 fix)
    expect(region?.getAttribute("aria-labelledby")).toBeTruthy();
    const h1 = container.querySelector("h1");
    expect(h1?.id).toBeTruthy();
    expect(region?.getAttribute("aria-labelledby")).toBe(h1?.id);
  });

  it("ShellPageChrome title has id linked to region when id provided", () => {
    const { container } = render(
      <ShellPageChrome id="test-shell" title="Hello" description="desc">
        <div>child</div>
      </ShellPageChrome>
    );
    const h1 = container.querySelector("h1");
    expect(h1?.id).toBe("test-shell-title");
    const region = container.querySelector('[role="region"]');
    expect(region?.getAttribute("aria-labelledby")).toBe("test-shell-title");
  });

  it("FullLayout.tsx source has exactly one element <main> (static check)", () => {
    const full = fs.readFileSync("src/layouts/full/FullLayout.tsx", "utf8");
    const mains = (full.match(/e\(\s*['"]main['"]/g) || []).length;
    expect(mains).toBe(1);
  });

  it("ShellPageTemplate.js source does NOT contain element <main>", () => {
    const shell = fs.readFileSync("src/components/ShellPageTemplate.js", "utf8");
    expect(shell).not.toMatch(/renderElement\(\s*"main"/);
    expect(shell).toMatch(/role: "region"/);
  });
});
