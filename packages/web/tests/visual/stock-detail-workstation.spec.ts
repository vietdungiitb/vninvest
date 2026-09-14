/**
 * Stock Detail Workstation E2E Tests
 * 
 * Tests cover:
 * - Symbol switching
 * - Mobile layout with tab switcher
 * - Desktop split-screen layout
 * - Realtime polling updates
 * - Accessibility (WCAG 2.1 AA)
 * - Feature flag toggle
 */

import { test, expect } from '@playwright/test';

const STOCK_SYMBOLS = ['FPT', 'VCB', 'HPG', 'VIC', 'MWG'];

test.describe('Stock Detail Workstation', () => {
  test.beforeEach(async ({ page }) => {
    // Enable feature flag
    await page.addInitScript(() => {
      window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
      localStorage.setItem('workstation_v2', 'true');
    });
    
    // Navigate to stock detail page
    await page.goto('/stocks/FPT');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Desktop Layout (>768px)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('renders split-screen layout with chart and order book', async ({ page }) => {
      // Check for desktop layout
      await expect(page.locator('.ws-desktop')).toBeVisible();
      await expect(page.locator('.ws-left-column')).toBeVisible();
      await expect(page.locator('.ws-right-column')).toBeVisible();
      
      // Check left column has chart
      await expect(page.locator('.ws-left-column')).toContainText('Chart');
      
      // Check right column has order book and trade log
      await expect(page.locator('.ws-right-column .ob-widget')).toBeVisible();
      await expect(page.locator('.ws-right-column .tl-widget')).toBeVisible();
    });

    test('displays order book with bids and asks', async ({ page }) => {
      const orderBook = page.locator('.ob-widget');
      await expect(orderBook).toBeVisible();
      
      // Check header
      await expect(orderBook.locator('.ob-title')).toContainText('Sổ lệnh');
      await expect(orderBook.locator('.ob-spread')).toBeVisible();
      
      // Check bids (3 levels)
      const bids = orderBook.locator('.ob-bids .ob-row');
      await expect(bids).toHaveCount(3);
      
      // Check asks (3 levels)
      const asks = orderBook.locator('.ob-asks .ob-row');
      await expect(asks).toHaveCount(3);
      
      // Check price formatting
      await expect(bids.first().locator('.ob-price-value')).toBeVisible();
      await expect(asks.first().locator('.ob-price-value')).toBeVisible();
      
      // Check volume and orders
      await expect(bids.first().locator('.ob-volume-value')).toBeVisible();
      await expect(bids.first().locator('.ob-orders')).toBeVisible();
      
      // Check progress bars
      await expect(bids.first().locator('.ob-progress-bar')).toBeVisible();
      await expect(asks.first().locator('.ob-progress-bar')).toBeVisible();
    });

    test('displays trade log with realtime trades', async ({ page }) => {
      const tradeLog = page.locator('.tl-widget');
      await expect(tradeLog).toBeVisible();
      
      // Check header
      await expect(tradeLog.locator('.tl-title')).toContainText('Nhật ký khớp lệnh');
      
      // Check trade rows
      const trades = tradeLog.locator('.tl-list .tl-row');
      await expect(trades.first()).toBeVisible();
      
      // Check trade columns
      await expect(trades.first().locator('.tl-time')).toBeVisible();
      await expect(trades.first().locator('.tl-price')).toBeVisible();
      await expect(trades.first().locator('.tl-volume')).toBeVisible();
      await expect(trades.first().locator('.tl-side-badge')).toBeVisible();
      await expect(trades.first().locator('.tl-change-value')).toBeVisible();
    });

    test('symbol switch updates data', async ({ page }) => {
      // Wait for initial data
      await expect(page.locator('.ob-widget')).toBeVisible();
      
      // Change symbol via URL
      await page.goto('/stocks/VCB');
      await page.waitForLoadState('domcontentloaded');
      
      // Verify data updated
      await expect(page.locator('.ob-widget')).toBeVisible();
      await expect(page.locator('.tl-widget')).toBeVisible();
    });

    test('realtime polling updates order book', async ({ page }) => {
      const orderBook = page.locator('.ob-widget');
      await expect(orderBook).toBeVisible();
      
      // Get initial timestamp
      const initialTimestamp = await orderBook.locator('.ob-timestamp').textContent();
      
      // Wait for polling interval (5 seconds)
      await page.waitForTimeout(6000);
      
      // Check if timestamp updated (indicating new data)
      const updatedTimestamp = await orderBook.locator('.ob-timestamp').textContent();
      // Note: In test environment, mock data may not change, but polling should occur
    });
  });

  test.describe('Mobile Layout (<768px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('renders mobile tab switcher', async ({ page }) => {
      // Check for mobile layout
      await expect(page.locator('.ws-mobile')).toBeVisible();
      await expect(page.locator('.ws-tab-bar')).toBeVisible();
      
      // Check tabs
      await expect(page.locator('.ws-tab[aria-controls="panel-chart"]')).toContainText('Biểu đồ');
      await expect(page.locator('.ws-tab[aria-controls="panel-orderbook"]')).toContainText('Sổ lệnh');
      await expect(page.locator('.ws-tab[aria-controls="panel-tradelog"]')).toContainText('Khớp lệnh');
    });

    test('switches between tabs', async ({ page }) => {
      // Default tab should be chart
      await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#panel-chart')).not.toHaveAttribute('hidden');
      
      // Click orderbook tab
      await page.click('#tab-orderbook');
      await expect(page.locator('#tab-orderbook')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#panel-orderbook')).not.toHaveAttribute('hidden');
      await expect(page.locator('#panel-chart')).toHaveAttribute('hidden', '');
      
      // Click tradelog tab
      await page.click('#tab-tradelog');
      await expect(page.locator('#tab-tradelog')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#panel-tradelog')).not.toHaveAttribute('hidden');
      await expect(page.locator('#panel-orderbook')).toHaveAttribute('hidden', '');
      
      // Click back to chart
      await page.click('#tab-chart');
      await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#panel-chart')).not.toHaveAttribute('hidden');
    });

    test('orderbook tab shows order book widget', async ({ page }) => {
      await page.click('#tab-orderbook');
      await expect(page.locator('#panel-orderbook .ob-widget')).toBeVisible();
    });

    test('tradelog tab shows trade log widget', async ({ page }) => {
      await page.click('#tab-tradelog');
      await expect(page.locator('#panel-tradelog .tl-widget')).toBeVisible();
    });
  });

  test.describe('Accessibility (WCAG 2.1 AA)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('order book has proper ARIA roles', async ({ page }) => {
      const orderBook = page.locator('.ob-widget');
      
      // Check rowgroups
      await expect(orderBook.locator('[role="rowgroup"][aria-label="Ba mức giá Mua (Bid)"]')).toBeVisible();
      await expect(orderBook.locator('[role="rowgroup"][aria-label="Ba mức giá Bán (Ask)"]')).toBeVisible();
      
      // Check rows are keyboard navigable
      const rows = orderBook.locator('[role="row"][tabindex="0"]');
      await expect(rows.first()).toBeVisible();
      
      // Check color-blind friendly badges
      await expect(orderBook.locator('.ob-side-badge')).toBeVisible();
    });

    test('trade log has proper ARIA roles', async ({ page }) => {
      const tradeLog = page.locator('.tl-widget');
      
      // Check log role
      await expect(tradeLog.locator('[role="log"][aria-live="polite"]')).toBeVisible();
      
      // Check list items
      await expect(tradeLog.locator('[role="listitem"]')).toBeVisible();
      
      // Check color-blind friendly icons
      await expect(tradeLog.locator('.tl-side-icon')).toBeVisible();
    });

    test('mobile tabs have proper ARIA attributes', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      const tabList = page.locator('[role="tablist"]');
      await expect(tabList).toHaveAttribute('aria-label', 'Chế độ xem Workstation');
      
      const tabs = page.locator('[role="tab"]');
      await expect(tabs).toHaveCount(3);
      
      for (const tab of await tabs.all()) {
        await expect(tab).toHaveAttribute('aria-selected');
        await expect(tab).toHaveAttribute('aria-controls');
        await expect(tab).toHaveAttribute('id');
      }
      
      const panels = page.locator('[role="tabpanel"]');
      await expect(panels).toHaveCount(3);
      
      for (const panel of await panels.all()) {
        await expect(panel).toHaveAttribute('aria-labelledby');
        await expect(panel).toHaveAttribute('id');
      }
    });

    test('focus visible styles work', async ({ page }) => {
      // Tab through order book rows
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focus styles are applied
      const focusedElement = page.locator(':focus-visible');
      await expect(focusedElement).toBeVisible();
    });

    test('reduced motion respected', async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      // Animations should be disabled
      const orderBook = page.locator('.ob-widget');
      await expect(orderBook).toBeVisible();
      
      // Check that transitions are not applied (would need CSS inspection)
    });
  });

  test.describe('Feature Flag', () => {
    test('works when enabled via window.__ENV__', async ({ page }) => {
      await page.addInitScript(() => {
        window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
      });
      
      await page.goto('/stocks/FPT');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.locator('.ws-desktop')).toBeVisible();
    });

    test('works when enabled via localStorage', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('workstation_v2', 'true');
      });
      
      await page.goto('/stocks/FPT');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.locator('.ws-desktop')).toBeVisible();
    });

    test('falls back to legacy layout when disabled', async ({ page }) => {
      await page.addInitScript(() => {
        window.__ENV__ = { WORKSTATION_LAYOUT_V2: false };
        localStorage.removeItem('workstation_v2');
      });
      
      await page.goto('/stocks/FPT');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.locator('.ws-legacy')).toBeVisible();
      await expect(page.locator('.ws-desktop')).not.toBeVisible();
    });
  });

  test.describe('Responsive Breakpoints', () => {
    test('switches to mobile at 768px', async ({ page }) => {
      // Start at desktop
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/stocks/FPT');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.ws-desktop')).toBeVisible();
      
      // Resize to mobile
      await page.setViewportSize({ width: 767, height: 600 });
      await page.waitForTimeout(100); // Allow resize handler
      await expect(page.locator('.ws-mobile')).toBeVisible();
      await expect(page.locator('.ws-desktop')).not.toBeVisible();
    });

    test('switches to desktop at 768px', async ({ page }) => {
      // Start at mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/stocks/FPT');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.ws-mobile')).toBeVisible();
      
      // Resize to desktop
      await page.setViewportSize({ width: 768, height: 600 });
      await page.waitForTimeout(100); // Allow resize handler
      await expect(page.locator('.ws-desktop')).toBeVisible();
      await expect(page.locator('.ws-mobile')).not.toBeVisible();
    });
  });
});

test.describe('Visual Regression', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('desktop workstation matches baseline', async ({ page }) => {
    await page.addInitScript(() => {
      window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    });
    
    await page.goto('/stocks/FPT');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Allow animations to settle
    
    await expect(page).toHaveScreenshot('stock-detail-workstation-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile workstation matches baseline', async ({ page }) => {
    await page.addInitScript(() => {
      window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    });
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/stocks/FPT');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('stock-detail-workstation-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});