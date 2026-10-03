// BL-12: CI-critical smoke flows (chromium, no backend required).
//
// Backend-tolerant by design: without API, protected routes must fail closed
// to /login and public routes must render. No screenshots (no baseline drift).
// Full-state flows (CRUD/run/ack against live API) stay in nightly + manual QA.
import { test, expect } from '@playwright/test';

const FLOWS = [
  { name: 'login', url: '/login', expectSelector: 'input[type="password"]' },
  { name: 'dashboard-guard', url: '/dashboard', expectLoginRedirect: true },
  { name: 'watchlist-guard', url: '/watchlist', expectLoginRedirect: true },
  { name: 'screener-guard', url: '/screener', expectLoginRedirect: true },
  { name: 'alert-center-guard', url: '/alert-center', expectLoginRedirect: true },
];

test.describe('CI critical smoke (BL-12)', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh-CI emulation: stored state (.auth/user.json) may carry stale
    // tokens locally; clear so guard behavior is deterministic.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('login form renders', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  for (const flow of FLOWS.filter((f) => f.expectLoginRedirect)) {
    test(`${flow.name}: unauthenticated fails closed to login`, async ({ page }) => {
      await page.goto(flow.url, { waitUntil: 'domcontentloaded' });
      // App may show boot spinner first (fail-open ≤15s) then redirect.
      await page.waitForURL('**/login**', { timeout: 30000 });
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20000 });
    });
  }

  test('unknown route does not blank-crash', async ({ page }) => {
    await page.goto('/no-such-route-bl12', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
