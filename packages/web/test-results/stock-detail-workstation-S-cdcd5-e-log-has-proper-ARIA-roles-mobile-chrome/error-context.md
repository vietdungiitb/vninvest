# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stock-detail-workstation.spec.ts >> Stock Detail Workstation >> Accessibility (WCAG 2.1 AA) >> trade log has proper ARIA roles
- Location: tests\visual\stock-detail-workstation.spec.ts:190:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.tl-widget').locator('[role="log"][aria-live="polite"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.tl-widget').locator('[role="log"][aria-live="polite"]')

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
  94  | 
  95  |     test('symbol switch updates data', async ({ page }) => {
  96  |       // Wait for initial data
  97  |       await expect(page.locator('.ob-widget')).toBeVisible();
  98  |       
  99  |       // Change symbol via URL
  100 |       await page.goto('/stocks/VCB');
  101 |       await page.waitForLoadState('networkidle');
  102 |       
  103 |       // Verify data updated
  104 |       await expect(page.locator('.ob-widget')).toBeVisible();
  105 |       await expect(page.locator('.tl-widget')).toBeVisible();
  106 |     });
  107 | 
  108 |     test('realtime polling updates order book', async ({ page }) => {
  109 |       const orderBook = page.locator('.ob-widget');
  110 |       await expect(orderBook).toBeVisible();
  111 |       
  112 |       // Get initial timestamp
  113 |       const initialTimestamp = await orderBook.locator('.ob-timestamp').textContent();
  114 |       
  115 |       // Wait for polling interval (5 seconds)
  116 |       await page.waitForTimeout(6000);
  117 |       
  118 |       // Check if timestamp updated (indicating new data)
  119 |       const updatedTimestamp = await orderBook.locator('.ob-timestamp').textContent();
  120 |       // Note: In test environment, mock data may not change, but polling should occur
  121 |     });
  122 |   });
  123 | 
  124 |   test.describe('Mobile Layout (<768px)', () => {
  125 |     test.use({ viewport: { width: 375, height: 667 } });
  126 | 
  127 |     test('renders mobile tab switcher', async ({ page }) => {
  128 |       // Check for mobile layout
  129 |       await expect(page.locator('.ws-mobile')).toBeVisible();
  130 |       await expect(page.locator('.ws-tab-bar')).toBeVisible();
  131 |       
  132 |       // Check tabs
  133 |       await expect(page.locator('.ws-tab[aria-controls="panel-chart"]')).toContainText('Biểu đồ');
  134 |       await expect(page.locator('.ws-tab[aria-controls="panel-orderbook"]')).toContainText('Sổ lệnh');
  135 |       await expect(page.locator('.ws-tab[aria-controls="panel-tradelog"]')).toContainText('Khớp lệnh');
  136 |     });
  137 | 
  138 |     test('switches between tabs', async ({ page }) => {
  139 |       // Default tab should be chart
  140 |       await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
  141 |       await expect(page.locator('#panel-chart')).not.toHaveAttribute('hidden');
  142 |       
  143 |       // Click orderbook tab
  144 |       await page.click('#tab-orderbook');
  145 |       await expect(page.locator('#tab-orderbook')).toHaveAttribute('aria-selected', 'true');
  146 |       await expect(page.locator('#panel-orderbook')).not.toHaveAttribute('hidden');
  147 |       await expect(page.locator('#panel-chart')).toHaveAttribute('hidden', '');
  148 |       
  149 |       // Click tradelog tab
  150 |       await page.click('#tab-tradelog');
  151 |       await expect(page.locator('#tab-tradelog')).toHaveAttribute('aria-selected', 'true');
  152 |       await expect(page.locator('#panel-tradelog')).not.toHaveAttribute('hidden');
  153 |       await expect(page.locator('#panel-orderbook')).toHaveAttribute('hidden', '');
  154 |       
  155 |       // Click back to chart
  156 |       await page.click('#tab-chart');
  157 |       await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
  158 |       await expect(page.locator('#panel-chart')).not.toHaveAttribute('hidden');
  159 |     });
  160 | 
  161 |     test('orderbook tab shows order book widget', async ({ page }) => {
  162 |       await page.click('#tab-orderbook');
  163 |       await expect(page.locator('#panel-orderbook .ob-widget')).toBeVisible();
  164 |     });
  165 | 
  166 |     test('tradelog tab shows trade log widget', async ({ page }) => {
  167 |       await page.click('#tab-tradelog');
  168 |       await expect(page.locator('#panel-tradelog .tl-widget')).toBeVisible();
  169 |     });
  170 |   });
  171 | 
  172 |   test.describe('Accessibility (WCAG 2.1 AA)', () => {
  173 |     test.use({ viewport: { width: 1280, height: 720 } });
  174 | 
  175 |     test('order book has proper ARIA roles', async ({ page }) => {
  176 |       const orderBook = page.locator('.ob-widget');
  177 |       
  178 |       // Check rowgroups
  179 |       await expect(orderBook.locator('[role="rowgroup"][aria-label="Ba mức giá Mua (Bid)"]')).toBeVisible();
  180 |       await expect(orderBook.locator('[role="rowgroup"][aria-label="Ba mức giá Bán (Ask)"]')).toBeVisible();
  181 |       
  182 |       // Check rows are keyboard navigable
  183 |       const rows = orderBook.locator('[role="row"][tabindex="0"]');
  184 |       await expect(rows.first()).toBeVisible();
  185 |       
  186 |       // Check color-blind friendly badges
  187 |       await expect(orderBook.locator('.ob-side-badge')).toBeVisible();
  188 |     });
  189 | 
  190 |     test('trade log has proper ARIA roles', async ({ page }) => {
  191 |       const tradeLog = page.locator('.tl-widget');
  192 |       
  193 |       // Check log role
> 194 |       await expect(tradeLog.locator('[role="log"][aria-live="polite"]')).toBeVisible();
      |                                                                          ^ Error: expect(locator).toBeVisible() failed
  195 |       
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
```