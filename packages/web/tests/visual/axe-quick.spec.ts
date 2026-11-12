/**
 * axe-quick.spec.ts — SCRATCH (khong commit): axe scan 5 route o 390x851.
 * Doi bootstrap xong (het "Dang xac thuc") truoc khi scan — neu khong chi
 * scan man hinh loading (vacuous PASS).
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/login", "/register", "/dashboard", "/settings", "/operations-center"];

async function waitReady(page: any, route: string) {
  try {
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Đang xác thực tài khoản"),
      { timeout: 45000 },
    );
  } catch {
    console.log(`${route}: van verifying sau 45s (scan trang thai hien tai)`);
  }
  await page.waitForTimeout(2000);
}

for (const route of ROUTES) {
  test(`axe ${route} @390x851 — 0 critical/serious`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 851 });
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitReady(page, route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = results.violations.filter((v) =>
      v.impact === "critical" || v.impact === "serious",
    );
    const summary = blocking.map((v) => `${v.id}(${v.impact}): ${v.nodes.length} nodes`).join("; ");
    expect(blocking, `blocking axe violations on ${route}: ${summary}`).toEqual([]);
    const minor = results.violations.filter((v) => v.impact === "minor" || v.impact === "moderate");
    console.log(`${route}: minor/moderate rules: ${minor.map((v) => v.id).join(",") || "none"}`);
  });
}
