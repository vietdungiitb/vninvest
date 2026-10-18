/**
 * R4.4 AC3 — ảnh chụp **3 mức điều hướng** thật trên staging:
 *   1. `/settings`         — trang cài đặt, có nhóm "Trí tuệ nhân tạo" (AC1)
 *   2. `/settings/ai`       — hub AI (breadcrumb 2 mức)
 *   3. `/settings/ai/slo`   — tab con (breadcrumb 3 mức)
 *
 * AC3 yêu cầu **ảnh**, nên test này **không** thay thế AC3 — nó là cách tạo ra ảnh
 * và tự kiểm 3 mức có hiện thật trong ảnh. Ảnh ghi ra `docs/evidence/ai-r44/visual/`.
 *
 * ⚠ Phải chạy **sau khi deploy** R4.4 lên môi trường đích, không deploy thì ảnh
 * chụp phản bản cũ — đây là bài học "ảnh bằng chứng cũng phải đúng phiên bản"
 * (`verification.md` L-V01: phép đo sai vẫn trông hợp lý).
 *
 * Chạy:
 *   PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test ai-settings-nav
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Ghi ra `docs/evidence/ai-r44/visual/` ở GỐC REPO (cwd của Playwright là `packages/web`). */
const OUT = resolve(process.cwd(), '../../docs/evidence/ai-r44/visual');

/** Ba mức điều hướng theo thứ tự AC3. */
const LEVELS = [
  { name: '01-settings', path: '/settings' },
  { name: '02-ai-hub', path: '/settings/ai' },
  { name: '03-ai-slo-tab', path: '/settings/ai/slo' },
];

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

// app giữ WebSocket/realtime ⇒ `networkidle` không bao giờ fire (xem `auth.setup.ts`).
const LOAD = { waitUntil: 'domcontentloaded' } as const;

for (const level of LEVELS) {
  test(`AC3 muc ${level.name}: ${level.path}`, async ({ page }) => {
    await page.goto(level.path, LOAD);
    await page.waitForSelector('main, [class*="page"]', { timeout: 30_000 });
    await page.screenshot({ path: resolve(OUT, `${level.name}.png`), fullPage: true });

    if (level.path === '/settings') {
      // AC1: nhóm "Trí tuệ nhân tạo" phải có mặt thật trong ảnh mức 1.
      const link = page.locator('a[href="/settings/ai"]');
      await expect(link).toHaveCount(1);
    } else {
      // AC2: breadcrumb phải có link quay về /settings.
      const crumb = page.locator('nav.breadcrumb a[href="/settings"]');
      await expect(crumb).toHaveCount(1);
      if (level.path !== '/settings/ai') {
        await expect(page.locator('nav.breadcrumb a[href="/settings/ai"]')).toHaveCount(1);
      }
    }
  });
}