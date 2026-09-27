import { test, expect } from '@playwright/test';

// Pilot-0 baseline — 0 code change capture
// 4 routes × 6 viewports = 24 screenshots (baseline, no diff)
// Routes: /dashboard, /alert-center, /watchlist, /stocks/HPG (Workstation)
// Viewports: 1920/1440/1280/1024/768/390 — per IMPLEMENTATION_PLAN §4 Pilot-0 + §5 HIGH8
// After capture: record commit, viewport, route, fixture, checksum per DOM_LAYOUT_CONTRACT.md:5

const PILOT0_ROUTES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/alert-center', name: 'alert-center' },
  { path: '/watchlist', name: 'watchlist' },
  { path: '/stocks/HPG', name: 'stocks-HPG' },
];

const PILOT0_VIEWPORTS = [
  { name: '1920', width: 1920, height: 1080 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];

for (const route of PILOT0_ROUTES) {
  for (const vp of PILOT0_VIEWPORTS) {
    test(`Pilot-0 baseline ${route.name} @ ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route.path, { waitUntil: 'load' });
      // wait for shell to hydrate — FullLayout main + Shell region
      await page.waitForFunction(
        () => document.querySelectorAll('main').length >= 1,
        { timeout: 5000 }
      );
      await page.waitForTimeout(500);
      await page.addStyleTag({
        content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important}`,
      });
      // DOM contract assertion (runtime) — exactly 1 main, no nested
      const mainCount = await page.evaluate(() => document.querySelectorAll('main').length);
      expect(mainCount).toBe(1);
      const nested = await page.evaluate(() => document.querySelector('main main'));
      expect(nested).toBeNull();
      // baseline screenshot — checksum will be stored in snapshot
      await expect(page).toHaveScreenshot(`pilot0-${route.name}-${vp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });
  }
}
