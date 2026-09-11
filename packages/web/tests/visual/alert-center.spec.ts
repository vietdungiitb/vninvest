import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 375, height: 667 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Alert Center Visual Regression - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('alert-center base - visual match', async ({ page }) => {
      await page.goto('/alert-center', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }`,
      });
      await expect(page).toHaveScreenshot(`alert-center-base-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels: 150,
      });
    });

    test('alert-center detail drawer open - visual match', async ({ page }) => {
      await page.goto('/alert-center', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      const detailBtn = page.getByRole('button', { name: /chi tiết|details/i }).first();
      if (await detailBtn.count()) {
        await detailBtn.click();
        await page.waitForTimeout(800);
      }
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }`,
      });
      await expect(page).toHaveScreenshot(`alert-center-drawer-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels: 150,
      });
    });
  });
}
