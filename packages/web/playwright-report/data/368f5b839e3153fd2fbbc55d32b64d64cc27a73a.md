# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stock-detail-workstation.spec.ts >> Stock Detail Workstation >> Desktop Layout (>768px) >> symbol switch updates data
- Location: tests\visual\stock-detail-workstation.spec.ts:95:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ob-widget')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.ob-widget')

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
  1   | /**
  2   |  * Stock Detail Workstation E2E Tests
  3   |  * 
  4   |  * Tests cover:
  5   |  * - Symbol switching
  6   |  * - Mobile layout with tab switcher
  7   |  * - Desktop split-screen layout
  8   |  * - Realtime polling updates
  9   |  * - Accessibility (WCAG 2.1 AA)
  10  |  * - Feature flag toggle
  11  |  */
  12  | 
  13  | import { test, expect } from '@playwright/test';
  14  | 
  15  | const STOCK_SYMBOLS = ['FPT', 'VCB', 'HPG', 'VIC', 'MWG'];
  16  | 
  17  | test.describe('Stock Detail Workstation', () => {
  18  |   test.beforeEach(async ({ page }) => {
  19  |     // Enable feature flag
  20  |     await page.addInitScript(() => {
  21  |       window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
  22  |       localStorage.setItem('workstation_v2', 'true');
  23  |     });
  24  |     
  25  |     // Navigate to stock detail page
  26  |     await page.goto('/stocks/FPT');
  27  |     await page.waitForLoadState('networkidle');
  28  |   });
  29  | 
  30  |   test.describe('Desktop Layout (>768px)', () => {
  31  |     test.use({ viewport: { width: 1280, height: 720 } });
  32  | 
  33  |     test('renders split-screen layout with chart and order book', async ({ page }) => {
  34  |       // Check for desktop layout
  35  |       await expect(page.locator('.ws-desktop')).toBeVisible();
  36  |       await expect(page.locator('.ws-left-column')).toBeVisible();
  37  |       await expect(page.locator('.ws-right-column')).toBeVisible();
  38  |       
  39  |       // Check left column has chart
  40  |       await expect(page.locator('.ws-left-column')).toContainText('Chart');
  41  |       
  42  |       // Check right column has order book and trade log
  43  |       await expect(page.locator('.ws-right-column .ob-widget')).toBeVisible();
  44  |       await expect(page.locator('.ws-right-column .tl-widget')).toBeVisible();
  45  |     });
  46  | 
  47  |     test('displays order book with bids and asks', async ({ page }) => {
  48  |       const orderBook = page.locator('.ob-widget');
  49  |       await expect(orderBook).toBeVisible();
  50  |       
  51  |       // Check header
  52  |       await expect(orderBook.locator('.ob-title')).toContainText('Sổ lệnh');
  53  |       await expect(orderBook.locator('.ob-spread')).toBeVisible();
  54  |       
  55  |       // Check bids (3 levels)
  56  |       const bids = orderBook.locator('.ob-bids .ob-row');
  57  |       await expect(bids).toHaveCount(3);
  58  |       
  59  |       // Check asks (3 levels)
  60  |       const asks = orderBook.locator('.ob-asks .ob-row');
  61  |       await expect(asks).toHaveCount(3);
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
> 97  |       await expect(page.locator('.ob-widget')).toBeVisible();
      |                                                ^ Error: expect(locator).toBeVisible() failed
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
  194 |       await expect(tradeLog.locator('[role="log"][aria-live="polite"]')).toBeVisible();
  195 |       
  196 |       // Check list items
  197 |       await expect(tradeLog.locator('[role="listitem"]')).toBeVisible();
```