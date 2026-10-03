import { test, expect } from '@playwright/test';

test('Debug CTG click on Heatmap', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Route API mock
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
          tenants: [{ tenant_id: 'test-tenant', public_id: 'test-tenant', display_name: 'Test Tenant', plan: 'enterprise' }]
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
        body: JSON.stringify({
          results: [{
            id: 1,
            name: 'Watchlist 1',
            items: [
              { symbol: 'CTG', quantity: 0, current_price: 35000, market_cap_bn: 150000 },
              { symbol: 'PVS', quantity: 0, current_price: 40000, market_cap_bn: 20000 },
            ]
          }]
        }),
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

    if (url.includes('/technicals/bulk/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { symbol: 'VCB', rsi_14: 55.4, sma20: 89000, sma50: 88000, momentum_20d_pct: 2.1 },
            { symbol: 'CTG', rsi_14: 45.2, sma20: 34000, sma50: 33000, momentum_20d_pct: -1.2 },
            { symbol: 'PVS', rsi_14: 64.5, sma20: 38.4, sma50: 38.9, momentum_20d_pct: 4.2 },
          ]
        }),
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
        body: JSON.stringify({ results: [] }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
  });

  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const emailInput = page.locator('#auth-login-username, input[placeholder*="tên đăng nhập"]').first();
  await emailInput.fill('testuser@vninvest.vn');

  const passwordInput = page.locator('#auth-login-password, input[type="password"]').first();
  await passwordInput.fill('TestPass123!');

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('--- Current Dashboard URL:', page.url());

  // Click on Technicals tab
  const techTab = page.locator('button:has-text("Kỹ thuật")');
  await techTab.click();
  await page.waitForTimeout(1000);

  // Take a screenshot before click
  await page.screenshot({ path: 'tests/visual/dashboard-before-click.png' });

  // Let's find CTG on the heatmap and click it
  // Wait, ECharts uses a canvas, so we can't easily click by text selector, but we can trigger the selectSymbol callback
  // OR we can just select CTG from the dropdown manually to see what happens
  console.log('Selecting Watchlist scope...');
  const scopeSelect = page.locator('select:has(option[value="holdings"])').first();
  await scopeSelect.selectOption('watchlist');
  await page.waitForTimeout(1000);

  console.log('Selecting CTG from select dropdown...');
  const symbolSelect = page.locator('select:not(:has(option[value="holdings"])):has(option[value="all"])').first();
  await symbolSelect.selectOption('CTG');
  await page.waitForTimeout(1000);

  // Print DOM of the deck area
  const deckHtml = await page.locator('.core-dashboard-slot--deck table').first().innerHTML();
  console.log('DECK HTML AFTER CTG SELECT:\n', deckHtml);

  await page.screenshot({ path: 'tests/visual/dashboard-after-ctg-select.png' });
});
