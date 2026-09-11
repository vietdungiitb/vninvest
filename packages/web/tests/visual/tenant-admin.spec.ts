import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/tenant-admin/home', name: 'tenant-admin-home' },
  { path: '/tenant-admin/members', name: 'tenant-admin-members' },
  { path: '/tenant-admin/service-accounts', name: 'tenant-admin-service-accounts' },
  { path: '/tenant-admin/pats', name: 'tenant-admin-pats' },
  { path: '/tenant-admin/usage', name: 'tenant-admin-usage' },
  { path: '/tenant-admin/billing', name: 'tenant-admin-billing' },
  { path: '/tenant-admin/audit-logs', name: 'tenant-admin-audit-logs' },
  { path: '/tenant-admin/webhooks', name: 'tenant-admin-webhooks' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Tenant Admin Visual - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route.name} - visual match`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      });
    }
  });
}
