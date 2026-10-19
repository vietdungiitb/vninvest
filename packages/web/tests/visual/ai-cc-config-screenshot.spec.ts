/**
 * S6 — chụp ảnh `/settings/ai` **CÓ DỮ LIỆU** để chứng minh nhãn enum đã dịch.
 *
 * Vì sao cần spec này: ảnh `01-settings-ai-after.png` cho thấy ô provider = "—",
 * model = "Cần cấu hình" — vì `testuser` trên staging **chưa có cấu hình AI**.
 * Không có dữ liệu thì không có provider để dịch, và assertion sẽ đỏ vì **lý do sai**.
 *
 * ⚠ SCRIPT NÀY **GHI DỮ LIỆU LÊN MÔI TRƯỜNG THẬT**. Owner đã đồng ý (2026-10-19).
 * Vì vậy nó **luôn** khôi phục về trạng thái ban đầu trong `finally` — kể cả khi
 * assert đỏ. Không có `finally` thì mutant sống và staging bị bỏ lại cấu hình
 * giả (hazard 15 / agent-lessons §15).
 *
 * Cách làm: thao tác **trên chính form của trang** (không gọi API giả), nên nó
 * vừa chụp ảnh vừa kiểm chứng luồng "lưu cấu hình" thật.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), '../../docs/evidence/ai-cc-uiux');
const LOAD = { waitUntil: 'domcontentloaded' } as const;

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

/** Chờ form AI RUNTIME render xong (không còn dòng "Đang tải cấu hình AI..."). */
async function formReady(page: import('@playwright/test').Page) {
  await page.locator('.loading-subtext').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await expect(page.locator('[data-testid="ai-cc-form"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Đang tải cấu hình AI...')).toBeHidden({ timeout: 30_000 });
}

/** Chọn <select> theo data-testid của field, chọn theo giá trị `value`. */
async function choose(page: import('@playwright/test').Page, testId: string, value: string) {
  const sel = page.locator(`[data-testid="${testId}"] select`);
  await sel.selectOption(value);
}

/**
 * Mốc KHOI PHỤC cố định, đọc từ lần chạy sạch đầu tiên trên staging
 * (`CAU HINH TRUOC = {"provider":"openai","model":"gpt-4o-mini"}`).
 *
 * ⚠ Vì sao KHÔNG dùng `before` (trạng thái lúc bắt đầu) làm mốc:
 * lần chạy trước đó hỏng giữa chừng đã để lại `gemini` trên staging; nếu lấy
 * `before` làm mốc thì nó sẽ **giữ nguyên ô nhiễm đó** và mọi lần chạy sau đều
 * "đúng" so với một mốc đã bẩn. Đây cũng chính là lỗi của lần teardown trước:
 * đối chiếu `select` **sau khi mình vừa tự đặt** ⇒ xanh dù server chưa lưu.
 */
const BASELINE = { provider: 'openai', model: 'gpt-4o-mini' } as const;

test('S6b: chup anh /settings/ai KHI CO cau hinh that, roi khoi phuc ve baseline', async ({ page }) => {
  test.slow();
  await page.goto('/settings/ai', LOAD);
  await formReady(page);

  const readCfg = async () => ({
    provider: await page.locator('[data-testid="field-ai-provider"] select').inputValue(),
    model: await page.locator('[data-testid="field-ai-model"] select').inputValue(),
  });

  const before = await readCfg();
  console.log('CAU HINH LUC VAO = ' + JSON.stringify(before) + ' | BASELINE = ' + JSON.stringify(BASELINE));

  try {
    // Panel tong quan — noi o "Nha cung cap hieu luc" hien nhan da dich.
    const summary = page.locator('article', { hasText: 'Tổng quan' }).first();

    // Provider `gemini` co model san; model goc cua Gemini trong providerModels.ts.
    await choose(page, 'field-ai-provider', 'gemini');
    await page.waitForTimeout(400);
    await choose(page, 'field-ai-model', 'gemini-3.8-flash');
    await page.waitForTimeout(400);

    // Luu qua preview (R1.9 AC4: bam Luu -> xem diff -> xac nhan moi PUT).
    await page.locator('[data-testid="save-config"]').click();
    const confirm = page.locator('[data-testid="preview-confirm"]');
    await expect(confirm, 'preview diff khong mo').toBeVisible({ timeout: 15_000 });
    await confirm.click();

    // Phai CHỜ server ghi xong truoc khi chup — khong chup ngay khi click xong.
    await page.waitForTimeout(2500);

    await expect(summary.getByText('Google Gemini'), 'o provider van chua dich').toBeVisible({ timeout: 15_000 });
    await expect(summary.getByText('Cấu hình trung tâm AI')).toBeVisible();

    // ⚠ DONG modal preview truoc khi chup. Lần chay truoc chup ngay sau `confirm.click()`
    // ⇒ anh bi overlay "Xem lại thay đổi trước khi lưu" che mất trang (L-V05: phai
    // MO ANH ra xem, và bỏ qua thì ảnh là bằng chứng sai).
    const modalClose = page.locator('button[aria-label*="Đóng" i], button[aria-label*="close" i]');
    if (await modalClose.first().isVisible().catch(() => false)) {
      await modalClose.first().click();
      await page.waitForTimeout(800);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
    // Xac nhan modal da that su bien mat truoc khi chup.
    await expect(page.getByText('Xem lại thay đổi trước khi lưu')).toBeHidden({ timeout: 10_000 });

    await page.screenshot({ path: resolve(OUT, '04-co-cau-hinh-nhan-da-dich.png'), fullPage: true });
    await page.screenshot({ path: resolve(OUT, '05-tong-quan-co-du-lieu.png'), clip: { x: 0, y: 0, width: 1600, height: 900 } });
    console.log('CHUP XONG — anh 04/05 co nhan da dich, modal da dong');
  } finally {
    // ⚠ LUON khoi phuc ve BASELINE, ke ca khi assert do.
    await page.goto('/settings/ai', LOAD);
    await formReady(page);
    await page.locator('[data-testid="field-ai-provider"] select').selectOption(BASELINE.provider);
    await page.waitForTimeout(500);
    await page.locator('[data-testid="field-ai-model"] select').selectOption(BASELINE.model);
    await page.waitForTimeout(500);

    const save = page.locator('[data-testid="save-config"]');
    expect(await save.isEnabled(), 'nut Luu bi khoa ⇒ khong luon duoc gui').toBe(true);
    await save.click();
    const confirm = page.locator('[data-testid="preview-confirm"]');
    await expect(confirm, 'preview khoi phuc khong mo').toBeVisible({ timeout: 15_000 });
    await confirm.click();
    await page.waitForTimeout(2500);

    // ⚠ XAC MINH LAI BANG TRANG THAI SERVER: `goto` moi la tai lai trang tu dau.
    // Doc `select` ngay sau khi tu dat cho ra kiem tra gia — do la xanh gia.
    await page.goto('/settings/ai', LOAD);
    await formReady(page);
    const after = await readCfg();
    console.log('KHOI PHUC XONG (doc lai tu server) = ' + JSON.stringify(after));
    expect(after, 'staging van con cau hinh cua test').toEqual({ provider: BASELINE.provider, model: BASELINE.model });
  }
});
