import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Critical Pages
 * 
 * Baseline images should be in ./visual-baselines/
 * Run baseline capture: node scripts/capture-baseline.mjs
 * 
 * Test pages:
 * - Dashboard (home)
 * - Stock Detail (VCB)
 * - Alert Center
 * - AI Command Center
 */

const PAGES = [
  { path: '/', name: 'dashboard' },
  { path: '/stocks/VCB', name: 'stock-detail-vcb' },
  { path: '/alert-center', name: 'alert-center' },
  { path: '/ai-command-center', name: 'ai-command-center' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Visual Regression - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const pageConfig of PAGES) {
      test(`${pageConfig.name} - visual match`, async ({ page }) => {
        await page.goto(pageConfig.path, { waitUntil: 'networkidle' });
        
        // Wait for animations to settle
        await page.waitForTimeout(1000);
        
        // Disable animations for consistent screenshots
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `
        });

        // Take screenshot and compare with baseline
        await expect(page).toHaveScreenshot(`${pageConfig.name}-${viewport.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      });
    }
  });
}
