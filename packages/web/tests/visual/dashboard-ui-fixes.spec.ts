import { test, expect } from '@playwright/test';

test.describe('Dashboard UI Fixes Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/core/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/auth/token/') && method === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access: 'mock-access-token', refresh: 'mock-refresh-token' }),
        });
      }

      if (url.includes('/identity/profile/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            username: 'testuser',
            email: 'testuser@vninvest.vn',
            is_staff: true,
            is_superuser: true,
            language: 'vi',
            theme: 'dark',
            tenants: [
              {
                tenant_id: 'test-tenant',
                public_id: 'test-tenant',
                display_name: 'Test Tenant',
                plan: 'enterprise',
              }
            ]
          }),
        });
      }

      if (url.includes('/tenant/lifecycle/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ plan: 'enterprise' }),
        });
      }

      if (url.includes('/workspace/portfolios/') && method === 'GET') {
        if (url.includes('/holdings/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ results: [{ symbol: 'VCB', quantity: 100, current_price: 90000 }] }),
          });
        }
        if (url.includes('/summary/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ total_market_value: 9000000, total_unrealized_pl: 500000, total_unrealized_pl_pct: 5.5 }),
          });
        }
        if (url.includes('/analytics/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ alpha_annual_pct: 12.5, beta: 0.95, sharpe_ratio: 1.8, max_drawdown_pct: -8.5 }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [{ id: 123, name: 'Main Portfolio', description: 'Test portfolio' }] }),
        });
      }

      if (url.includes('/workspace/watchlists/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      }

      if (url.includes('/stock-management/tracked-symbols/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      }

      if (url.includes('/watchlist-groups/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      }

      if (url.includes('/bulk-technicals/') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      }

      if (url.includes('/portfolio/news-digest') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ digest: 'All stable today.' }),
        });
      }

      if (url.includes('/signals/alert-center/feed') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { id: 'snap-1', symbol: 'VCB', severity: 'high', title: 'Test alert', ts: new Date().toISOString() },
              { id: 'snap-2', symbol: 'VCB', severity: 'medium', title: 'Medium alert', ts: new Date().toISOString() },
            ],
            next: null,
            previous: null,
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      });
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    const emailInput = page.locator('#auth-login-username, input[placeholder*="tên đăng nhập"]').first();
    await emailInput.fill('testuser@vninvest.vn');

    const passwordInput = page.locator('#auth-login-password, input[type="password"]').first();
    await passwordInput.fill('TestPass123!');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('UI-01: No desktop toggle button in header; mobile toggle present', async ({ page }) => {
    expect(page.url()).toContain('/dashboard');

    const header = page.locator('header');

    // Desktop toggle button (hidden lg:flex) should NOT exist
    const desktopToggle = header.locator('button.hidden\\.lg\\:flex');
    await expect(desktopToggle).toHaveCount(0);

    // Mobile toggle button (lg:hidden) should exist
    const mobileToggle = header.locator('button.lg\\:hidden');
    await expect(mobileToggle).toHaveCount(1);
  });

  test('UI-02: Sidebar always shows w-72 and group headers are visible on desktop', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Sidebar should have w-72 class (always expanded)
    const classList = await sidebar.getAttribute('class') || '';
    expect(classList).toContain('w-72');

    // Group headers (h3) should ALWAYS be visible (no collapsed state)
    const groupHeadings = sidebar.locator('h3');
    const headingsCount = await groupHeadings.count();
    expect(headingsCount).toBeGreaterThan(0);
    for (let i = 0; i < headingsCount; i++) {
      await expect(groupHeadings.nth(i)).toBeVisible();
    }
  });

  test('UI-03: Active sidebar item uses bg-blue-600 style', async ({ page }) => {
    const sidebar = page.locator('aside');

    // The active nav link (dashboard) should have bg-blue-600
    const activeLink = sidebar.locator('[aria-current="page"]');
    await expect(activeLink).toBeVisible();

    const activeClass = await activeLink.getAttribute('class') || '';
    expect(activeClass).toContain('bg-blue-600');
    expect(activeClass).toContain('text-white');
  });

  test('UI-04: UnifiedAlertCenter uses flex-col layout with severity filters', async ({ page }) => {
    const alertLane = page.locator('.core-dashboard-slot--alert-lane');
    await expect(alertLane).toBeVisible();

    const headerWrapper = alertLane.locator('> div > div').first();
    const classList = await headerWrapper.getAttribute('class') || '';

    expect(classList).toContain('flex-col');
    expect(classList).not.toContain('sm:flex-row');

    const titleBlock = headerWrapper.locator('> div').first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock.locator('h3')).toContainText('Cảnh báo');
  });

  test('UI-05: SmartStatsHeader displays breadth label as "Độ rộng thị trường"', async ({ page }) => {
    const statsHeader = page.locator('.smart-stats-header');
    await expect(statsHeader).toBeVisible();

    const breadthLabel = statsHeader.locator('span:has-text("Độ rộng thị trường")');
    await expect(breadthLabel).toBeVisible();
  });
});
