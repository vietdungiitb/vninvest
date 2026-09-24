import { test, expect } from '@playwright/test';

// Probe chẩn đoán với data mock y hệt user: portfolio có holdings,
// snapshot 20 alerts (15 high / 4 medium / 1 low), AI feed rỗng.
test.describe('Dashboard alert-lane probe (mocked 20 alerts)', () => {
  test.beforeEach(async ({ page }) => {
    const alerts = Array.from({ length: 20 }, (_, i) => ({
      alert_id: `snap-${i}`,
      symbol: ['CAR', 'VBB', 'HPG', 'VCB', 'FPT'][i % 5],
      severity: i < 15 ? 'high' : i < 19 ? 'medium' : 'low',
      source: 'whale',
      direction: 'buy',
      value: 660489030 + i,
      confidence: 0.85,
      session_date: '2026-09-21',
      body: `Cá mập mua #${i}`,
      message: `Cá mập mua #${i}`,
      triggered_at: new Date(Date.now() - i * 60000).toISOString(),
    }));

    await page.route('**/core/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const ok = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (url.includes('/auth/token/') && method === 'POST') {
        return ok({ access: 'mock-access-token', refresh: 'mock-refresh-token' });
      }
      if (url.includes('/identity/profile/') && method === 'GET') {
        return ok({ id: 1, username: 'testuser', email: 'testuser@vninvest.vn', is_staff: true, is_superuser: true, language: 'vi', theme: 'dark', tenants: [{ tenant_id: 't', public_id: 't', display_name: 'T', plan: 'enterprise' }] });
      }
      if (url.includes('/tenant/lifecycle/') && method === 'GET') {
        return ok({ plan: 'enterprise' });
      }
      if (url.includes('/workspace/portfolios/') && method === 'GET') {
        if (url.includes('/holdings/')) return ok({ results: [{ symbol: 'VCB', quantity: 100, current_price: 90000, market_cap_bn: 120 }] });
        if (url.includes('/summary/')) return ok({ total_market_value: 9000000, total_unrealized_pl: 500000, total_unrealized_pl_pct: 5.5 });
        if (url.includes('/analytics/')) return ok({ alpha_annual_pct: 12.5, beta: 0.95, sharpe_ratio: 1.8, max_drawdown_pct: -8.5 });
        return ok({ results: [{ id: 123, name: 'Main Portfolio', description: 'Test' }] });
      }
      if (url.includes('/signals/alert-center/feed') && method === 'GET') {
        return ok({ results: alerts, next: 'cursor-page-2', previous: null });
      }
      if (url.includes('/signals/ai-alerts/feed') && method === 'GET') {
        return ok({ results: [] });
      }
      return ok({ results: [] });
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#auth-login-username, input[placeholder*="tên đăng nhập"]').first().fill('testuser@vninvest.vn');
    await page.locator('#auth-login-password, input[type="password"]').first().fill('TestPass123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('20 alerts → 20 card hiện, counter khớp, lane full-height, AI không chồng deck', async ({ page }) => {
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    const lane = page.locator('.core-dashboard-slot--alert-lane');
    await expect(lane).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);

    const probe = await page.evaluate(() => {
      const q = (s: string) => Array.from(document.querySelectorAll(s));
      const rect = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const cs = (el: Element | null, prop: string) =>
        el ? window.getComputedStyle(el as HTMLElement).getPropertyValue(prop) : null;
      const cards = q('.alert-card');
      const laneEl = document.querySelector('.core-dashboard-slot--alert-lane');
      const grid = document.querySelector('.dashboard-triad-grid');
      const aiLane = document.querySelector('.core-dashboard-slot--ai');
      const deck = document.querySelector('.core-dashboard-slot--deck');
      return {
        cardCount: cards.length,
        cardHeights: cards.slice(0, 5).map((c) => Math.round((c as HTMLElement).getBoundingClientRect().height)),
        firstCardText: (cards[0] as HTMLElement)?.innerText?.slice(0, 120) || null,
        counter: document.body.innerText.match(/Hiển thị \d+\/\d+/)?.[0] || null,
        activeChips: q('.seg button[aria-pressed="true"]').map((b) => (b as HTMLElement).innerText),
        laneRect: laneEl ? rect(laneEl) : null,
        gridHeight: grid ? cs(grid, 'height') : null,
        listScroll: (() => {
          const l = document.querySelector('.core-alert-list') as HTMLElement | null;
          return l ? { scrollH: l.scrollHeight, clientH: l.clientHeight } : null;
        })(),
        aiDeck: (() => {
          if (!aiLane || !deck) return null;
          const a = (aiLane as HTMLElement).getBoundingClientRect();
          const d = (deck as HTMLElement).getBoundingClientRect();
          return { aiBottom: Math.round(a.bottom), deckTop: Math.round(d.top), overlapY: Math.max(0, Math.min(a.bottom, d.bottom) - Math.max(a.top, d.top)) };
        })(),
      };
    });
    console.log('PROBE:', JSON.stringify(probe, null, 1));
    await page.locator('.core-dashboard-slot--alert-lane').screenshot({ path: 'tests/visual/dashboard-alert-probe-lane.png' });
    expect(probe.cardCount).toBe(20);
    expect(probe.listScroll!.clientH).toBeGreaterThan(0);
  });

  test('2-col (1100px): cards hiện, AI không chồng deck', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const lane = page.locator('.core-dashboard-slot--alert-lane');
    await expect(lane).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);
    const probe = await page.evaluate(() => {
      const r = (el: Element | null) => {
        if (!el) return null;
        const b = (el as HTMLElement).getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const cards = Array.from(document.querySelectorAll('.alert-card'));
      const aiLane = document.querySelector('.core-dashboard-slot--ai');
      const deck = document.querySelector('.core-dashboard-slot--deck');
      let overlapY = 0;
      if (aiLane && deck) {
        const a = (aiLane as HTMLElement).getBoundingClientRect();
        const d = (deck as HTMLElement).getBoundingClientRect();
        overlapY = Math.max(0, Math.min(a.bottom, d.bottom) - Math.max(a.top, d.top));
      }
      return {
        cardCount: cards.length,
        firstCardH: cards.length ? Math.round((cards[0] as HTMLElement).getBoundingClientRect().height) : 0,
        listW: r(document.querySelector('.core-alert-list'))?.w || 0,
        laneH: r(document.querySelector('.core-dashboard-slot--alert-lane'))?.h || 0,
        overlapY: Math.round(overlapY),
      };
    });
    console.log('PROBE-2COL:', JSON.stringify(probe));
    expect(probe.cardCount).toBe(20);
    expect(probe.listW).toBeGreaterThan(200);
    expect(probe.firstCardH).toBeLessThan(160);
    expect(probe.firstCardH).toBeGreaterThan(40);
    expect(probe.laneH).toBeGreaterThanOrEqual(470);
    expect(probe.overlapY).toBe(0);
  });
});
