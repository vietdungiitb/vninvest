# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stock-detail-workstation.spec.ts >> Stock Detail Workstation >> Mobile Layout (<768px) >> orderbook tab shows order book widget
- Location: tests\visual\stock-detail-workstation.spec.ts:161:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#tab-orderbook')

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - heading "VNInvest" [level=1] [ref=e5]
    - paragraph [ref=e6]: Đăng nhập vào nền tảng SaaS VNInvest
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: Tên đăng nhập hoặc email
        - textbox "Tên đăng nhập hoặc email" [ref=e10]:
          - /placeholder: Nhập tên đăng nhập hoặc email
      - generic [ref=e11]:
        - generic [ref=e12]: Mật khẩu
        - textbox "Mật khẩu" [ref=e13]:
          - /placeholder: ••••••••
      - button "Đăng nhập" [ref=e14]
    - generic [ref=e15]:
      - link "Tạo tài khoản" [ref=e16] [cursor=pointer]:
        - /url: /register
      - link "Quên mật khẩu?" [ref=e17] [cursor=pointer]:
        - /url: /reset-password
```

# Test source

```ts
  62  |       
  63  |       // Check price formatting
  64  |       await expect(bids.first().locator('.ob-price-value')).toBeVisible();
  65  |       await expect(asks.first().locator('.ob-price-value')).toBeVisible();
  66  |       
  67  |       // Check volume and orders
  68  |       await expect(bids.first().locator('.ob-volume-value')).toBeVisible();
  69  |       await expect(bids.first().locator('.ob-orders')).toBeVisible();
  70  |       
  71  |       // Check progress bars
  72  |       await expect(bids.first().locator('.ob-progress-bar')).toBeVisible();
  73  |       await expect(asks.first().locator('.ob-progress-bar')).toBeVisible();
  74  |     });
  75  | 
  76  |     test('displays trade log with realtime trades', async ({ page }) => {
  77  |       const tradeLog = page.locator('.tl-widget');
  78  |       await expect(tradeLog).toBeVisible();
  79  |       
  80  |       // Check header
  81  |       await expect(tradeLog.locator('.tl-title')).toContainText('Nhật ký khớp lệnh');
  82  |       
  83  |       // Check trade rows
  84  |       const trades = tradeLog.locator('.tl-list .tl-row');
  85  |       await expect(trades.first()).toBeVisible();
  86  |       
  87  |       // Check trade columns
  88  |       await expect(trades.first().locator('.tl-time')).toBeVisible();
  89  |       await expect(trades.first().locator('.tl-price')).toBeVisible();
  90  |       await expect(trades.first().locator('.tl-volume')).toBeVisible();
  91  |       await expect(trades.first().locator('.tl-side-badge')).toBeVisible();
  92  |       await expect(trades.first().locator('.tl-change-value')).toBeVisible();
  93  |     });
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
> 162 |       await page.click('#tab-orderbook');
      |                  ^ Error: page.click: Test timeout of 30000ms exceeded.
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
  194 |       await expect(tradeLog.locator('[role="log"][aria-live="polite"]')).toBeVisible();
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
```