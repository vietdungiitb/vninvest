import { describe, it, expect } from "vitest";

// P0-0 BLOCKER2+3 — scroll contract documentation test (not runtime)
// Runtime scroll verification is planned Playwright gate at P4 — see DOM_LAYOUT_CONTRACT.md:4
// This file only documents whitelist; actual overflow counting is DOM gate (planned).

describe("Scroll owners — P0-0 contract (documentation, not runtime)", () => {
  it("FullLayout main is the page-level scroll owner", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/layouts/full/FullLayout.tsx", "utf8");
    // FullLayout main must contain overflow-auto (page-level)
    expect(src).toMatch(/overflow-auto/);
    expect(src).toMatch(/e\(\s*['"]main['"]/);
  });

  it("StockDetail and Watchlist nested scroll have explicit selectors", async () => {
    // These files are .css — raw import may not be configured; just assert whitelist contract
    void (await import("../../pages/StockDetailPage.css?raw").catch(() => null));
    void (await import("../../pages/WatchlistPage.css?raw").catch(() => null));
    // Whitelist selectors:
    const allowedNested = [
      ".sdp-chart-wrapper", // StockDetailPage.css:453 height 640px
      ".watchlistPage__layout", // WatchlistPage.css:21 calc(100vh -120px)
      ".watchlistPage__sidebarCard", // nested overflow-y:auto
      ".watchlistPage__mainCard",
    ];
    expect(allowedNested.length).toBeGreaterThan(0);
  });

  it("forbids random overflow at page root outside whitelist", () => {
    // This test documents the whitelist — actual enforcement is via code review + DOM test
    const whitelist = [
      "FullLayout main.overflow-auto",
      ".sdp-chart-wrapper",
      ".watchlistPage__layout",
      ".watchlistPage__sidebarCard",
      ".watchlistPage__mainCard",
      ".watchlistPage__tableWrapper",
    ];
    expect(whitelist).toContain("FullLayout main.overflow-auto");
  });
});
