# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stock-detail-workstation.spec.ts >> Stock Detail Workstation >> Responsive Breakpoints >> switches to mobile at 768px
- Location: tests\visual\stock-detail-workstation.spec.ts:291:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ws-desktop')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.ws-desktop')

```

```yaml
- main:
  - heading "VNInvest" [level=1]
  - paragraph: Đăng nhập vào nền tảng SaaS VNInvest
  - text: Tên đăng nhập hoặc email
  - textbox "Tên đăng nhập hoặc email":
    - /placeholder: Nhập tên đăng nhập hoặc email
  - text: Mật khẩu
  - textbox "Mật khẩu":
    - /placeholder: ••••••••
  - button "Đăng nhập"
  - link "Tạo tài khoản":
    - /url: /register
  - link "Quên mật khẩu?":
    - /url: /reset-password
```

# Test source

```ts
  196 |       // Check list items
  197 |       await expect(tradeLog.locator('[role="listitem"]')).toBeVisible();
  198 |       
  199 |       // Check color-blind friendly icons
  200 |       await expect(tradeLog.locator('.tl-side-icon')).toBeVisible();
  201 |     });
  202 | 
  203 |     test('mobile tabs have proper ARIA attributes', async ({ page }) => {
  204 |       await page.setViewportSize({ width: 375, height: 667 });
  205 |       await page.reload();
  206 |       await page.waitForLoadState('networkidle');
  207 |       
  208 |       const tabList = page.locator('[role="tablist"]');
  209 |       await expect(tabList).toHaveAttribute('aria-label', 'Chế độ xem Workstation');
  210 |       
  211 |       const tabs = page.locator('[role="tab"]');
  212 |       await expect(tabs).toHaveCount(3);
  213 |       
  214 |       for (const tab of await tabs.all()) {
  215 |         await expect(tab).toHaveAttribute('aria-selected');
  216 |         await expect(tab).toHaveAttribute('aria-controls');
  217 |         await expect(tab).toHaveAttribute('id');
  218 |       }
  219 |       
  220 |       const panels = page.locator('[role="tabpanel"]');
  221 |       await expect(panels).toHaveCount(3);
  222 |       
  223 |       for (const panel of await panels.all()) {
  224 |         await expect(panel).toHaveAttribute('aria-labelledby');
  225 |         await expect(panel).toHaveAttribute('id');
  226 |       }
  227 |     });
  228 | 
  229 |     test('focus visible styles work', async ({ page }) => {
  230 |       // Tab through order book rows
  231 |       await page.keyboard.press('Tab');
  232 |       await page.keyboard.press('Tab');
  233 |       
  234 |       // Check focus styles are applied
  235 |       const focusedElement = page.locator(':focus-visible');
  236 |       await expect(focusedElement).toBeVisible();
  237 |     });
  238 | 
  239 |     test('reduced motion respected', async ({ page }) => {
  240 |       // Enable reduced motion
  241 |       await page.emulateMedia({ reducedMotion: 'reduce' });
  242 |       await page.reload();
  243 |       await page.waitForLoadState('networkidle');
  244 |       
  245 |       // Animations should be disabled
  246 |       const orderBook = page.locator('.ob-widget');
  247 |       await expect(orderBook).toBeVisible();
  248 |       
  249 |       // Check that transitions are not applied (would need CSS inspection)
  250 |     });
  251 |   });
  252 | 
  253 |   test.describe('Feature Flag', () => {
  254 |     test('works when enabled via window.__ENV__', async ({ page }) => {
  255 |       await page.addInitScript(() => {
  256 |         window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
  257 |       });
  258 |       
  259 |       await page.goto('/stocks/FPT');
  260 |       await page.waitForLoadState('networkidle');
  261 |       
  262 |       await expect(page.locator('.ws-desktop')).toBeVisible();
  263 |     });
  264 | 
  265 |     test('works when enabled via localStorage', async ({ page }) => {
  266 |       await page.addInitScript(() => {
  267 |         localStorage.setItem('workstation_v2', 'true');
  268 |       });
  269 |       
  270 |       await page.goto('/stocks/FPT');
  271 |       await page.waitForLoadState('networkidle');
  272 |       
  273 |       await expect(page.locator('.ws-desktop')).toBeVisible();
  274 |     });
  275 | 
  276 |     test('falls back to legacy layout when disabled', async ({ page }) => {
  277 |       await page.addInitScript(() => {
  278 |         window.__ENV__ = { WORKSTATION_LAYOUT_V2: false };
  279 |         localStorage.removeItem('workstation_v2');
  280 |       });
  281 |       
  282 |       await page.goto('/stocks/FPT');
  283 |       await page.waitForLoadState('networkidle');
  284 |       
  285 |       await expect(page.locator('.ws-legacy')).toBeVisible();
  286 |       await expect(page.locator('.ws-desktop')).not.toBeVisible();
  287 |     });
  288 |   });
  289 | 
  290 |   test.describe('Responsive Breakpoints', () => {
  291 |     test('switches to mobile at 768px', async ({ page }) => {
  292 |       // Start at desktop
  293 |       await page.setViewportSize({ width: 1024, height: 768 });
  294 |       await page.goto('/stocks/FPT');
  295 |       await page.waitForLoadState('networkidle');
> 296 |       await expect(page.locator('.ws-desktop')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  297 |       
  298 |       // Resize to mobile
  299 |       await page.setViewportSize({ width: 767, height: 600 });
  300 |       await page.waitForTimeout(100); // Allow resize handler
  301 |       await expect(page.locator('.ws-mobile')).toBeVisible();
  302 |       await expect(page.locator('.ws-desktop')).not.toBeVisible();
  303 |     });
  304 | 
  305 |     test('switches to desktop at 768px', async ({ page }) => {
  306 |       // Start at mobile
  307 |       await page.setViewportSize({ width: 375, height: 667 });
  308 |       await page.goto('/stocks/FPT');
  309 |       await page.waitForLoadState('networkidle');
  310 |       await expect(page.locator('.ws-mobile')).toBeVisible();
  311 |       
  312 |       // Resize to desktop
  313 |       await page.setViewportSize({ width: 768, height: 600 });
  314 |       await page.waitForTimeout(100); // Allow resize handler
  315 |       await expect(page.locator('.ws-desktop')).toBeVisible();
  316 |       await expect(page.locator('.ws-mobile')).not.toBeVisible();
  317 |     });
  318 |   });
  319 | });
  320 | 
  321 | test.describe('Visual Regression', () => {
  322 |   test.use({ viewport: { width: 1280, height: 720 } });
  323 | 
  324 |   test('desktop workstation matches baseline', async ({ page }) => {
  325 |     await page.addInitScript(() => {
  326 |       window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
  327 |     });
  328 |     
  329 |     await page.goto('/stocks/FPT');
  330 |     await page.waitForLoadState('networkidle');
  331 |     await page.waitForTimeout(1000); // Allow animations to settle
  332 |     
  333 |     await expect(page).toHaveScreenshot('stock-detail-workstation-desktop.png', {
  334 |       fullPage: true,
  335 |       animations: 'disabled',
  336 |     });
  337 |   });
  338 | 
  339 |   test('mobile workstation matches baseline', async ({ page }) => {
  340 |     await page.addInitScript(() => {
  341 |       window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
  342 |     });
  343 |     
  344 |     await page.setViewportSize({ width: 375, height: 667 });
  345 |     await page.goto('/stocks/FPT');
  346 |     await page.waitForLoadState('networkidle');
  347 |     await page.waitForTimeout(1000);
  348 |     
  349 |     await expect(page).toHaveScreenshot('stock-detail-workstation-mobile.png', {
  350 |       fullPage: true,
  351 |       animations: 'disabled',
  352 |     });
  353 |   });
  354 | });
```