import { test, expect } from '@playwright/test';

/**
 * R1 E2E trên STAGING thật (không mock):
 *   PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn E2E_USER=... E2E_PASS=... \
 *   npx playwright test tests/visual/broker-config-r1.spec.ts --project=chromium
 *
 * Chạy auth.setup trước (project chromium đã có dependency), hoặc truyền storageState.
 * Ảnh chụp được lưu dưới docs/evidence/broker-config-r1/e2e/ (tạo bằng script riêng).
 */
test('broker tab: i18n service và credential form chặn secrets rỗng', async ({ page }) => {
  // project `chromium` đã có storageState từ auth.setup (testuser = superuser/staff).
  // KHÔNG xoá cookie giữa chừng — làm auth/me abort ⇒ single-flight refresh treo.

  page.on('request', (r) => { if (r.url().includes('/broker/')) console.log('E2E_REQ', r.method(), r.url()); });
  page.on('response', (r) => { if (r.url().includes('/broker/')) console.log('E2E_RES', r.status(), r.url()); });
  page.on('requestfailed', (r) => console.log('E2E_FAIL_ALL', r.failure()?.errorText, r.url()));
  page.on('response', (r) => { if (r.status() >= 400) console.log('E2E_HTTP_ERR', r.status(), r.url()); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('E2E_CONSOLE', m.text()); });
  await page.goto('/operations-center?tab=broker', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Danh sách nhà môi giới', exact: true })).toBeVisible({ timeout: 60000 });

  // AC1: không còn raw i18n key trên màn hình
  await expect(page.getByText('SOC.BROKER.COL_PROVIDER')).toHaveCount(0);
  await expect(page.getByText('soc.broker.table_caption')).toHaveCount(0);
  await expect(page.getByText('soc.broker.no_queues')).toHaveCount(0);

  // R2: 3 tab, mỗi broker một form riêng — KHÔNG còn textarea JSON
  await expect(page.getByRole('tab', { name: 'DNSE', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'SSI', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TCBS', exact: true })).toBeVisible();
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByLabel('Client ID')).toHaveValue('');
  await expect(page.getByLabel('Client Secret')).toHaveValue('');

  await page.getByRole('tab', { name: 'SSI', exact: true }).click();
  await expect(page.getByLabel('API Key')).toBeVisible();
  await expect(page.getByLabel('API Secret')).toBeVisible();
  await page.getByRole('tab', { name: 'TCBS', exact: true }).click();
  await expect(page.getByLabel('API Key')).toBeVisible();
  await expect(page.getByLabel('Client ID')).toHaveCount(0);
  await page.getByRole('tab', { name: 'DNSE', exact: true }).click();

  // AC2: bấm Lưu với form rỗng ⇒ KHÔNG có POST credentials và hiện lỗi i18n
  const posts: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/operator/soc/broker/credentials/')) posts.push(req.url());
  });
  await page.getByRole('button', { name: 'Lưu credential' }).click();
  await expect(page.getByText(/Nhập đủ/)).toBeVisible({ timeout: 10000 });
  expect(posts).toHaveLength(0);

  await page.screenshot({ path: 'docs/evidence/broker-config-r1/e2e/broker-tabs-r2.png', fullPage: true });
});
