import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/visual/.auth/user.json';

setup('authenticate testuser', async ({ page }) => {
  // NOTE: app keeps realtime polling/WS open, so 'networkidle' never fires — use domcontentloaded
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const emailInput = page
    .locator('input#auth-login-username, input[type="text"], input[name="username"], input[type="email"]')
    .first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill('testuser@vninvest.vn');
  await page.locator('input[type="password"]').fill('TestPass123!');
  await page.locator('button[type="submit"]').click();

  // `waitUntil: 'domcontentloaded'` — KHÔNG bỏ được.
  //
  // Sửa 2026-10-13 (claim `pf-manage-rebuild`). Mặc định của `waitForURL` là
  // `waitUntil: 'load'`, mà app mở kết nối realtime/WebSocket/pollng nên
  // **sự kiện `load` không bao giờ fire**. Log lỗi cũ tự mâu thuẫn:
  //   "navigated to 'https://docker.edusuccess.vn/dashboard'"  ← ĐÃ điều hướng
  //   rồi vẫn "Timeout 15000ms exceeded".
  // Hệ quả: `storageState` không bao giờ được ghi ⇒ **mọi** spec E2E trong
  // repo fail ở bước đăng nhập với lý do sai (tưởng app hỏng, thực ra là
  // chờ sai sự kiện).
  await page.waitForURL('**/dashboard', { timeout: 30000, waitUntil: 'domcontentloaded' });

  // W1 guard: bootstrap (PortfolioContext) must release the auth gate.
  // Previously a hanging syncAuthState/fetchPortfolios left the
  // "Đang xác thực tài khoản..." spinner forever on stored-state reload.
  await expect(page.getByText('Đang xác thực tài khoản...')).toBeHidden({ timeout: 20000 });

  await page.context().storageState({ path: authFile });
});
