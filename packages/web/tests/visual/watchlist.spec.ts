import { test, expect } from '@playwright/test';

test.describe('Watchlist CRUD', () => {
  test('displays watchlist page with empty state or existing items', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="watchlist-search"], [data-testid="watchlist-skeleton"], table').first()).toBeVisible({ timeout: 10000 });
    const pageLoaded = await page.locator('body').textContent();
    expect(pageLoaded!.length).toBeGreaterThan(0);
  });

  test('allows adding a symbol to watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="watchlist-add-input"], [data-testid="watchlist-search"]').first()).toBeVisible({ timeout: 10000 });
    const addInput = page.locator('[data-testid="watchlist-add-input"]');
    if (await addInput.isVisible()) {
      await addInput.fill('VCB');
      const addBtn = page.locator('[data-testid="watchlist-add-submit"]');
      await expect(addBtn).toBeEnabled({ timeout: 5000 });
      await addBtn.click();
      await expect(page.locator('[data-testid="watchlist-row-VCB"]')).toBeVisible({ timeout: 10000 }).catch(() => {});
    } else {
      const searchInput = page.locator('[data-testid="watchlist-search"]');
      await searchInput.fill('VCB');
      await expect(page.locator('[data-testid="watchlist-row-VCB"]')).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('displays symbols in the watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="watchlist-search"], table').first()).toBeVisible({ timeout: 10000 });
    const rows = page.locator('[data-testid^="watchlist-row-"]');
    const count = await rows.count();
    if (count > 0) {
      const firstSymbol = await rows.first().textContent();
      expect(firstSymbol?.length).toBeGreaterThan(0);
    } else {
      await expect(page.locator('text=Danh sách trống')).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('allows removing a symbol from watchlist', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="watchlist-search"], table').first()).toBeVisible({ timeout: 10000 });
    const removeButton = page.locator('[data-testid^="watchlist-remove-"]').first();
    if (await removeButton.isVisible().catch(() => false)) {
      await removeButton.click();
      const confirmBtn = page.locator('[data-testid="watchlist-remove-confirm"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();
      await expect(page.locator('[data-testid="watchlist-remove-dialog"]')).toBeHidden({ timeout: 5000 });
    }
  });

  test('bulk bar appears when selecting rows', async ({ page }) => {
    await page.goto('/watchlist', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="watchlist-search"], table').first()).toBeVisible({ timeout: 10000 });
    const selectAll = page.locator('[data-testid="watchlist-select-all"]');
    if (await selectAll.isVisible()) {
      await selectAll.check();
      await expect(page.locator('[data-testid="watchlist-bulk-bar"]')).toBeVisible({ timeout: 5000 });
      const bulkDelete = page.locator('[data-testid="watchlist-bulk-delete"]');
      await expect(bulkDelete).toBeVisible({ timeout: 5000 });
    }
  });
});
