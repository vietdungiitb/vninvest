import { test, expect } from '@playwright/test';

test.describe('Dashboard CSS probe', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/core/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const ok = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.includes('/auth/token/') && method === 'POST') return ok({ access: 'a', refresh: 'r' });
      if (url.includes('/identity/profile/')) return ok({ id: 1, username: 't', email: 't@t.vn', is_staff: true, is_superuser: true, language: 'vi', theme: 'dark', tenants: [{ tenant_id: 't', public_id: 't', display_name: 'T', plan: 'enterprise' }] });
      if (url.includes('/tenant/lifecycle/')) return ok({ plan: 'enterprise' });
      if (url.includes('/workspace/portfolios/') && method === 'GET') {
        if (url.includes('/holdings/')) return ok({ results: [{ symbol: 'VCB', quantity: 100, current_price: 90000, market_cap_bn: 120 }] });
        if (url.includes('/summary/')) return ok({ total_market_value: 9000000, total_unrealized_pl: 0, total_unrealized_pl_pct: 0 });
        if (url.includes('/analytics/')) return ok({ alpha_annual_pct: null, beta: null, sharpe_ratio: null, max_drawdown_pct: null });
        return ok({ results: [{ id: 123, name: 'Main', description: 'T' }] });
      }
      if (url.includes('/signals/alert-center/feed')) {
        return ok({ results: [{ alert_id: 'a1', symbol: 'CAR', severity: 'high', source: 'whale', direction: 'buy', value: 660489030, confidence: 0.85, session_date: '2026-09-21', body: 'Cá mập mua CAR', triggered_at: new Date().toISOString() }], next: null, previous: null });
      }
      return ok({ results: [] });
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#auth-login-username, input[placeholder*="tên đăng nhập"]').first().fill('a@b.vn');
    await page.locator('#auth-login-password, input[type="password"]').first().fill('x');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('ancestor chain widths list → lane', async ({ page }) => {
    await expect(page.locator('.alert-card').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const probe = await page.evaluate(() => {
      const list = document.querySelector('.core-alert-list') as HTMLElement | null;
      const parent = list?.parentElement as HTMLElement | null;
      const gs = (el: HTMLElement | null) => {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        return { w: s.width, minW: s.minWidth, maxW: s.maxWidth, pos: s.position, wm: s.writingMode, align: s.alignItems, box: s.boxSizing, ml: s.marginLeft, mr: s.marginRight, flex: s.flex, cls: String(el.className).slice(0, 80) };
      };
      const rules: string[] = [];
      const walk = (rl: CSSRuleList | undefined) => {
        if (!rl) return;
        for (const r of Array.from(rl)) {
          const st = (r as CSSStyleRule).selectorText;
          if (st && st.includes('.panel-body') && !st.includes('::')) rules.push(`${st} { ${(r as CSSStyleRule).style.cssText} }`);
          const inner = (r as unknown as { cssRules?: CSSRuleList }).cssRules;
          if (inner) walk(inner);
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        try { walk((sh as CSSStyleSheet).cssRules); } catch { /* xo */ }
      }
      const inner = list?.parentElement as HTMLElement | null;
      const si = inner ? window.getComputedStyle(inner) : null;
      return {
        list: gs(list),
        parent: gs(parent),
        inner: si ? { disp: si.display, dir: si.flexDirection, align: si.alignItems, w: si.width, cls: String(inner!.className).slice(0, 80) } : null,
        rules,
      };
    });
    console.log('CHAIN:', JSON.stringify(probe, null, 1));
    const exp = await page.evaluate(() => {
      const list = document.querySelector('.core-alert-list') as HTMLElement | null;
      if (!list) return null;
      const w = () => Math.round(list.getBoundingClientRect().width);
      const out: Record<string, number | string> = { before: w() };
      list.style.flex = 'none';
      out.noFlex = w();
      list.style.flex = '';
      list.style.width = '309px';
      out.fixedPx = w();
      list.style.width = '';
      list.style.minWidth = '309px';
      out.minW = w();
      list.style.minWidth = '';
      list.style.alignSelf = 'stretch';
      out.stretch = w();
      list.style.alignSelf = '';
      return out;
    });
    console.log('EXP:', JSON.stringify(exp));
    const exp2 = await page.evaluate(() => {
      const list = document.querySelector('.core-alert-list') as HTMLElement | null;
      if (!list) return null;
      const w = () => Math.round(list.getBoundingClientRect().width);
      const out: Record<string, number | string> = {};
      list.style.width = '100%';
      out.inlinePct = w();
      list.style.width = '-webkit-fill-available';
      out.fillAvail = w();
      list.style.width = '';
      (list.style as unknown as Record<string, string>).contain = 'none';
      out.containNone = w();
      list.style.setProperty('width', '100%', 'important');
      out.important = w();
      return out;
    });
    console.log('EXP2:', JSON.stringify(exp2));
    const cascade = await page.evaluate(() => {
      const list = document.querySelector('.core-alert-list') as HTMLElement | null;
      if (!list) return null;
      const hits: string[] = [];
      const walk = (rl: CSSRuleList | undefined, media: string) => {
        if (!rl) return;
        for (const r of Array.from(rl)) {
          const cssr = r as CSSStyleRule;
          if (cssr.selectorText) {
            try {
              if (list.matches(cssr.selectorText)) {
                const w = cssr.style.getPropertyValue('width');
                const fl = cssr.style.getPropertyValue('flex');
                if (w || fl) hits.push(`${media}${cssr.selectorText} { width:${w} flex:${fl} }`);
              }
            } catch { /* selector không hợp lệ */ }
          }
          const inner = (r as unknown as { cssRules?: CSSRuleList }).cssRules;
          if (inner) {
            const cond = (r as unknown as { conditionText?: string }).conditionText;
            walk(inner, cond ? `@media ${cond} ` : `${media}>`);
          }
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        try { walk((sh as CSSStyleSheet).cssRules, ''); } catch { /* xo */ }
      }
      return hits;
    });
    console.log('CASCADE:', JSON.stringify(cascade, null, 1));
    expect(cascade).toBeTruthy();
  });
});
