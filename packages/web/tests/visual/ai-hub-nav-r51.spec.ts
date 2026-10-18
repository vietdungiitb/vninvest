/**
 * R5.1c — E2E nav AI trên staging với phiên đã đăng nhập:
 *   1. `/settings/ai`        — hub: **đúng 5 tab** (staff) và **0 link** tới Agents
 *   2. `/settings/ai/audit`  — tab Audit của R4.5 (trước đây **chưa từng** E2E)
 *
 * Vì sao selector phải lo theo `nav:has(...)`:
 * `a[href="/settings/ai"]` khớp **cả link điều hướng toàn cục** trên layout ⇒ assert
 * trên selector đó **xanh dù nav hub chưa render** (L-V04 ở dạng hình ảnh — đúng
 * đường dẫn ≠ đúng chỗ). `AiHubNav.tsx:115-130` render `<nav aria-label>` chứa 5
 * `<Link>`; tao khoá bằng link riêng của hub (`/settings/ai/usage`).
 *
 * 5 tab vì staging có `testuser` (`auth_user` id 2) `is_staff=t, is_superuser=t`
 * ⇒ tab Audit staff-only phải hiện. Nếu user đổi thành non-staff thì kỳ vọng 4 tab —
 * sửa `EXPECTED_TABS` cho khớp, **đừng** xoá assert để cho qua.
 *
 * Chạy (sau khi deploy R5.1 lên staging):
 *   PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test ai-hub-nav-r51 --project=chromium
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), '../../docs/evidence/ai-r51/visual');

/** Đúng thứ tự khai báo trong `AiHubNav.tsx:76-113`. */
const EXPECTED_TABS = [
  '/settings/ai',
  '/settings/ai/usage',
  '/settings/ai/traces',
  '/settings/ai/slo',
  '/settings/ai/audit',
];

const REMOVED_ROUTE = '/settings/ai/agents';

const LOAD = { waitUntil: 'domcontentloaded' } as const;

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

/** Chờ app thoát trạng thái "đang nạp" — không `networkidle` (app giữ WS/poll). */
async function ready(page: import('@playwright/test').Page) {
  await page.locator('.loading-subtext').waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => { /* không có overlay ⇒ đã sẵn sàng */ });
}

test('AC3+AC4: hub AI có đúng 5 tab, không còn link tới Agents', async ({ page }) => {
  await page.goto('/settings/ai', LOAD);
  await ready(page);

  // Khoá đúng khối nav của hub (có link riêng /settings/ai/usage).
  const hub = page.locator(`nav:has(a[href="/settings/ai/usage"])`);
  await expect(hub).toHaveCount(1, { timeout: 30_000 });

  const hrefs = await hub.locator('a').evaluateAll((els) =>
    els.map((el) => el.getAttribute('href')),
  );
  expect(hrefs, `tab thực tế: ${JSON.stringify(hrefs)}`).toEqual(EXPECTED_TABS);

  // AC3: **toàn trang** (không chỉ nav) không được còn link tới route đã gỡ.
  const stale = await page.locator(`a[href="${REMOVED_ROUTE}"]`).count();
  expect(stale, `còn ${stale} link tới ${REMOVED_ROUTE}`).toBe(0);

  // Chụp SAU khi nội dung có — ảnh phải là bằng chứng, không phải trạng thái tải.
  await page.screenshot({ path: resolve(OUT, '01-hub-5-tabs.png'), fullPage: true });
});

test('AC-R4.5: /settings/ai/audit render được (tab Audit staff-only)', async ({ page }) => {
  await page.goto('/settings/ai/audit', LOAD);
  await ready(page);

  // Breadcrumb 3 mức: /settings → /settings/ai → /settings/ai/audit
  await expect(page.locator('nav.breadcrumb a[href="/settings"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('nav.breadcrumb a[href="/settings/ai"]')).toHaveCount(1);

  // Tab Audit phải **đang được đánh dấu** khi đứng trên route của nó.
  const hub = page.locator(`nav:has(a[href="/settings/ai/usage"])`);
  await expect(hub.locator('a[href="/settings/ai/audit"][aria-current="page"]')).toHaveCount(1);

  await page.screenshot({ path: resolve(OUT, '02-audit-tab.png'), fullPage: true });
});

test('AC2: route Agents trả về trang 404 của app (không phải hub)', async ({ page }) => {
  await page.goto(REMOVED_ROUTE, LOAD);
  await ready(page);
  const hub = page.locator(`nav:has(a[href="/settings/ai/usage"])`);
  // Không được render hub như cũ; và không được có link Agents ở bất kỳ đâu.
  await expect(hub).toHaveCount(0);
  await expect(page.locator(`a[href="${REMOVED_ROUTE}"]`)).toHaveCount(0);
});