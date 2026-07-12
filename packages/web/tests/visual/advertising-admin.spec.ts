import { test, expect } from '@playwright/test';

// E2E coverage for the Advertising & Trademark admin page.
// Requires an admin/superuser session. Provide credentials via env:
//   ADMIN_USERNAME / ADMIN_PASSWORD
// The spec skips gracefully when no session can be established.

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'testuser@vninvest.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TestPass123!';

async function ensureAdminSession(page: import('@playwright/test').Page) {
  const hasToken = await page.evaluate(() => {
    return !!(
      localStorage.getItem('auth_access_token') ||
      sessionStorage.getItem('auth_access_token')
    );
  });
  if (hasToken) return;

  await page.goto('/login', { waitUntil: 'networkidle' });
  const emailInput = page
    .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
    .first();
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.fill(ADMIN_USERNAME);
  await passwordInput.fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

  const authed = await page.evaluate(() => {
    return !!(
      localStorage.getItem('auth_access_token') ||
      sessionStorage.getItem('auth_access_token')
    );
  });
  test.skip(!authed, 'No admin session available for advertising admin E2E');
}

test.describe('Advertising & Trademark Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await ensureAdminSession(page);
  });

  test('renders the advertising admin page with tabs', async ({ page }) => {
    await page.goto('/admin/advertising', { waitUntil: 'networkidle' });
    await expect(page.getByText('advertising.title')).toBeVisible();
  });

  test('campaigns tab shows the create button and table', async ({ page }) => {
    await page.goto('/admin/advertising', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'advertising.tabs.campaigns' }).click();
    await expect(page.getByRole('button', { name: 'advertising.campaign.create' })).toBeVisible();
  });

  test('trademark settings tab allows toggling and saving', async ({ page }) => {
    await page.goto('/admin/advertising', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'advertising.tabs.settings' }).click();
    await expect(page.getByText('advertising.trademark.title')).toBeVisible();

    const toggle = page.getAllByRole('button').first();
    await toggle.click();

    const input = page.locator('input[type="datetime-local"]');
    await expect(input).toBeEnabled();
    await input.fill('2030-01-15T09:30');

    await page.getByRole('button', { name: 'advertising.trademark.save' }).click();
    await expect(page.getByText('advertising.trademark.saveSuccess')).toBeVisible();
  });
});
