// W1-1 AC-3: computed theme tokens differ between dark and light (temporary verify spec).
import { test, expect } from '@playwright/test';

test('theme tokens switch with data-theme', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const get = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );
  const darkBg = await get('--bg-panel');
  const darkText = await get('--text-primary');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const lightBg = await get('--bg-panel');
  const lightText = await get('--text-primary');
  expect(darkBg).not.toEqual('');
  expect(lightBg).not.toEqual('');
  expect(lightBg).not.toEqual(darkBg);
  expect(lightText).not.toEqual(darkText);
});
