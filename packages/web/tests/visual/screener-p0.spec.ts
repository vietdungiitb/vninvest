import { test, expect } from '@playwright/test';
import path from 'path';

// Repo-root evidence dir regardless of cwd (vitest/vite run from packages/web).
const EVIDENCE = path.resolve(__dirname, '../../../docs/evidence/screener-p0');

// P0 acceptance screenshots (VI locale default).
test('screener P0: page renders with template actions', async ({ page }) => {
  await page.goto('/screener', { waitUntil: 'networkidle' });

  // P0.5: Vietnamese title with full diacritics
  await expect(page.getByRole('heading', { name: 'Screener cổ phiếu' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(EVIDENCE, 'ui-screener-top.png') });

  // P0.4: each template card has Preview + Save buttons
  await expect(page.getByRole('button', { name: 'Chạy thử' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Lưu thành rule' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Chạy thử' }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(EVIDENCE, 'ui-screener-templates.png') });

  await page.screenshot({ path: path.join(EVIDENCE, 'ui-screener-full.png'), fullPage: true });
});
