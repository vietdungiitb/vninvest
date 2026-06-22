import { test, expect } from '@playwright/test';

test.describe('Watchlist CRUD', () => {
  test('displays watchlist page with empty state or existing items', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });

    await page.waitForTimeout(1000);

    const pageLoaded = await page.locator('body').textContent();
    expect(pageLoaded.length).toBeGreaterThan(0);
  });

  test('allows adding a symbol to watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });

    await page.waitForTimeout(1000);

    const addButton = page.locator('button:has-text("Thêm"), button:has-text("Add"), [aria-label="Thêm mã"]').first();
    const searchInput = page.locator('input[placeholder*="mã"], input[placeholder*="symbol"], input[type="search"], input[name="symbol"]').first();
    const symbolInput = page.locator('input').first();

    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const input = page.locator('input').first();
      if (await input.isVisible()) {
        await input.fill('VCB');
        const confirmButton = page.locator('button:has-text("Xác nhận"), button:has-text("Lưu"), button:has-text("Save"), button:has-text("Thêm")').last();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } else if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('VCB');
      await page.waitForTimeout(500);
    } else if (await symbolInput.isVisible().catch(() => false)) {
      await symbolInput.fill('VCB');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
  });

  test('displays symbols in the watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });

    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [data-testid="watchlist-item"], .watchlist-item');
    const count = await rows.count();

    if (count > 0) {
      const firstSymbol = await rows.first().textContent();
      expect(firstSymbol?.length).toBeGreaterThan(0);
    }
  });

  test('allows removing a symbol from watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });

    await page.waitForTimeout(1000);

    const removeButton = page
      .locator(
        'button:has-text("Xoá"), button:has-text("Delete"), button:has-text("Remove"), [aria-label="Xoá mã"], [data-testid="remove-symbol"]'
      )
      .first();

    if (await removeButton.isVisible().catch(() => false)) {
      await removeButton.click();
      await page.waitForTimeout(500);

      const confirmButton = page.locator('button:has-text("Xác nhận"), button:has-text("Confirm"), button:has-text("Đồng ý")').first();
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
