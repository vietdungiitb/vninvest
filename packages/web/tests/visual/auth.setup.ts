import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/visual/.auth/user.json';

setup('authenticate testuser', async ({ page }) => {
  // NOTE: app keeps realtime polling/WS open, so 'networkidle' never fires — use domcontentloaded
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const emailInput = page
    .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
    .first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill('testuser@vninvest.vn');
  await page.locator('input[type="password"]').fill('TestPass123!');
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
