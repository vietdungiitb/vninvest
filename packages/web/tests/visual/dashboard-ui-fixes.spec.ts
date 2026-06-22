import { test, expect } from '@playwright/test';

test.describe('Dashboard UI Fixes Regression Tests', () => {
  // Common login and mock setup before each test
  test.beforeEach(async ({ page }) => {
    // Mock all API calls to core v1 to decouple E2E tests from backend server state
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
        // General portfolios list
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

      // Default fallback
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      });
    });

    // Navigate to login
    await page.goto('/login', { waitUntil: 'networkidle' });

    // Fill credentials
    const emailInput = page.locator('#auth-login-username, input[placeholder*="tên đăng nhập"]').first();
    await emailInput.fill('testuser@vninvest.vn');

    const passwordInput = page.locator('#auth-login-password, input[type="password"]').first();
    await passwordInput.fill('TestPass123!');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for redirection to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(1000); // Allow dashboard data to settle
  });

  test('UI-01: No redundant hamburger toggle button in sidebar on desktop view', async ({ page }) => {
    // Assert we are on dashboard
    expect(page.url()).toContain('/dashboard');

    // Sidebar container (aside)
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // The sidebar toggle button we removed should NOT exist inside the sidebar (aside)
    const sidebarHamburger = sidebar.locator('button:has-text("☰")');
    await expect(sidebarHamburger).toHaveCount(0);

    // The header toggle button that is active for this viewport should be visible
    const headerHamburger = page.locator('header button:has-text("☰"), header button:has-text("✕")').filter({ visible: true });
    await expect(headerHamburger).toBeVisible();
  });

  test('UI-02: Sidebar group headers are hidden in collapsed state', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Desktop viewport is collapsed by default. We check that group headings (h3) are not visible
    const groupHeadings = sidebar.locator('h3');
    const headingsCount = await groupHeadings.count();

    // Every heading should be hidden (display: none or not rendered)
    for (let i = 0; i < headingsCount; i++) {
      await expect(groupHeadings.nth(i)).toBeHidden();
    }
  });

  test('UI-03: UnifiedAlertCenter uses vertical stack (flex-col) for narrow widths', async ({ page }) => {
    // Locate the Alert Center lane
    const alertLane = page.locator('.core-dashboard-slot--alert-lane');
    await expect(alertLane).toBeVisible();

    // Verify the header wrapper is using flex-col layout (and NOT sm:flex-row)
    const headerWrapper = alertLane.locator('> div > div').first();
    const classList = await headerWrapper.getAttribute('class');
    
    // It should have 'flex-col' and NOT 'sm:flex-row'
    expect(classList).toContain('flex-col');
    expect(classList).not.toContain('sm:flex-row');

    // Row 1 (Title) and Row 2 (Pills) are stacked
    const titleBlock = headerWrapper.locator('> div').first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock.locator('h3')).toContainText('Cảnh báo');
  });

  test('UI-04: SmartStatsHeader displays breadth label correctly as "Độ rộng thị trường"', async ({ page }) => {
    const statsHeader = page.locator('.smart-stats-header');
    await expect(statsHeader).toBeVisible();

    // Verify the label text matches "Độ rộng thị trường"
    const breadthLabel = statsHeader.locator('span:has-text("Độ rộng thị trường")');
    await expect(breadthLabel).toBeVisible();
  });
});
